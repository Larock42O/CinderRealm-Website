/* Cinderrealm website — shared game-server auth + profile.
 * The website keeps a SOFT session (name + token in sessionStorage, per-tab).
 * It does NOT auto-join the game world on page load: a hello spawns your
 * character in-game and kicks any active game session, so the WS is only
 * opened on demand (Tradekeep, Play). Full stay-logged-in needs the
 * server-side web-session API (queued for Tuesday). */
(function () {
  const WS_URL = 'wss://cinderrealm.onrender.com/ws-game';
  const S = { ws: null, authed: false, name: null, token: null, waiters: {}, level: null, live: false };
  let seq = 0;

  function saveSession() {
    try { sessionStorage.setItem('cinder_session', JSON.stringify({ name: S.name, token: S.token })); } catch (e) {}
  }
  function clearSession() {
    try { sessionStorage.removeItem('cinder_session'); } catch (e) {}
  }
  function send(obj) {
    if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify(obj));
  }
  // Open (or reuse) the game WS. When we hold a token, hello tries to resume it.
  // NOTE: a successful hello joins the game world (one session per account).
  function connect() {
    return new Promise((resolve, reject) => {
      if (S.ws && S.ws.readyState === 1) return resolve();
      const ws = new WebSocket(WS_URL);
      S.ws = ws;
      const to = setTimeout(() => reject(new Error('connect timeout')), 20000);
      ws.onopen = () => { clearTimeout(to); ws.send(JSON.stringify({ t: 'hello', token: S.token || '' })); resolve(); };
      ws.onerror = () => { clearTimeout(to); reject(new Error('connection failed')); };
      ws.onclose = () => { S.ws = null; S.live = false; renderProfile(); };
      ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        const t = m.t;
        if (t === 'auth_ok') {
          S.token = m.token || '';
          ws.send(JSON.stringify({ t: 'hello', token: S.token }));
          if (S.waiters.mode === 'register') {
            const w = S.waiters.auth; delete S.waiters.auth; delete S.waiters.mode;
            S.authed = true; S.name = S.pendingName; S.live = true;
            saveSession();
            renderProfile();
            if (w) w(true);
          }
        } else if (t === 'auth_err') {
          const w = S.waiters.auth; delete S.waiters.auth; delete S.waiters.mode;
          if (w) w(false, m.msg || 'Login failed');
          else { S.authed = false; S.name = null; S.token = null; S.live = false; clearSession(); renderProfile(); }
        } else if (t === 'welcome' || t === 'state') {
          S.authed = true; S.live = true;
          if (m.level != null) S.level = m.level;
          saveSession();
          const w = S.waiters.auth; delete S.waiters.auth;
          if (w) w(true);
          renderProfile();
        } else if (t && t.indexOf('bourse') === 0) {
          document.dispatchEvent(new CustomEvent('bourse', { detail: m }));
        }
      };
    });
  }

  async function login(name, pass, mode) {
    try {
      await connect();
    } catch (e) { return { ok: false, msg: 'Could not reach the game server.' }; }
    return new Promise((resolve) => {
      S.waiters.auth = (ok, msg) => {
        renderProfile();
        resolve({ ok, msg });
      };
      S.waiters.mode = mode || 'login';
      S.pendingName = name;
      S.ws.send(JSON.stringify({ t: mode || 'login', name, pass }));
      setTimeout(() => {
        if (S.waiters.auth) { delete S.waiters.auth; delete S.waiters.mode; resolve({ ok: false, msg: 'Login timed out.' }); }
      }, 20000);
    });
  }
  function logout() {
    try { S.ws && S.ws.close(); } catch (e) {}
    S.ws = null; S.authed = false; S.name = null; S.token = null; S.live = false; S.level = null;
    clearSession();
    renderProfile();
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  function renderProfile() {
    document.querySelectorAll('[data-profile]').forEach((el) => {
      if (!S.authed || !S.name) {
        el.innerHTML = '<a class="btn ghost" href="login.html" style="font-size:11px;padding:4px 12px">Log In</a> ' +
          '<a class="btn" href="register.html" style="font-size:11px;padding:4px 12px">Create Account</a>';
        return;
      }
      const lvl = S.level != null ? S.level : '—';
      const dot = S.live
        ? '<i class="pdot on"></i>'
        : '<i class="pdot"></i>';
      el.innerHTML =
        '<div class="pwrap">' +
          '<button class="pchip" data-act="profile" aria-haspopup="true">' + dot +
            '<span class="pname">' + esc(S.name) + '</span>' +
            '<span class="plvl">Lvl ' + esc(String(lvl)) + '</span>' +
            '<span class="pcaret">▾</span>' +
          '</button>' +
          '<div class="pmenu" hidden>' +
            '<div class="prow"><span>Status</span><b>' + (S.live ? 'In the realm' : 'On the site') + '</b></div>' +
            '<div class="prow"><span>Donation tier</span><b>—</b></div>' +
            '<a href="https://cinderrealm.onrender.com" target="_blank" rel="noopener">Play Now</a>' +
            '<button data-act="logout">Log out</button>' +
          '</div>' +
        '</div>';
    });
    // legacy nav login slot, if present
    document.querySelectorAll('[data-login-ui]').forEach((el) => {
      if (S.authed && S.name) {
        el.innerHTML = '<span class="status">Signed in as <b>' + esc(S.name) + '</b></span>';
      } else {
        el.innerHTML = '';
      }
    });
    const st = document.getElementById('login-status');
    if (st) { st.textContent = ''; }
  }

  document.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act;
    if (act === 'logout') { ev.preventDefault(); logout(); return; }
    if (act === 'profile') {
      ev.preventDefault();
      const wrap = b.closest('.pwrap');
      const menu = wrap && wrap.querySelector('.pmenu');
      if (menu) menu.hidden = !menu.hidden;
      return;
    }
  });
  document.addEventListener('click', (ev) => {
    if (!ev.target.closest('.pwrap')) {
      document.querySelectorAll('.pmenu').forEach((m) => { m.hidden = true; });
    }
  });

  window.Cinder = { login, logout, send, connect,
    get authed() { return S.authed; }, get name() { return S.name; }, get live() { return S.live; }, esc,
    ensure: async () => { if (!S.authed) throw new Error('not logged in'); await connect(); } };

  // Soft restore: remember who you are without joining the game world.
  (function restore() {
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem('cinder_session') || 'null'); } catch (e) {}
    if (!saved || !saved.token || !saved.name) return;
    S.name = saved.name; S.token = saved.token; S.authed = true; S.live = false;
  })();
  document.addEventListener('DOMContentLoaded', renderProfile);
  renderProfile();
})();
