/* Cinderrealm website — shared game-server auth + helpers */
(function () {
  const WS_URL = 'wss://cinderrealm.onrender.com/ws-game';
  const S = { ws: null, authed: false, name: null, token: null, waiters: {} };
  let seq = 0;

  function send(obj) {
    if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify(obj));
  }
  function connect() {
    return new Promise((resolve, reject) => {
      if (S.ws && S.ws.readyState === 1) return resolve();
      const ws = new WebSocket(WS_URL);
      S.ws = ws;
      const to = setTimeout(() => reject(new Error('connect timeout')), 20000);
      ws.onopen = () => { clearTimeout(to); ws.send(JSON.stringify({ t: 'hello', token: '' })); resolve(); };
      ws.onerror = () => { clearTimeout(to); reject(new Error('connection failed')); };
      ws.onclose = () => { S.authed = false; S.name = null; updateLoginUI(); };
      ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        const t = m.t;
        if (t === 'auth_ok') {
          S.token = m.token || '';
          ws.send(JSON.stringify({ t: 'hello', token: S.token }));
          // Registrations complete at auth_ok (character creator is in-game only)
          if (S.waiters.mode === 'register') {
            const w = S.waiters.auth; delete S.waiters.auth; delete S.waiters.mode;
            S.authed = true; S.name = S.pendingName;
            updateLoginUI();
            if (w) w(true);
          }
        } else if (t === 'auth_err') {
          const w = S.waiters.auth; delete S.waiters.auth; delete S.waiters.mode;
          if (w) w(false, m.msg || 'Login failed');
        } else if (t === 'welcome' || t === 'state') {
          S.authed = true;
          const w = S.waiters.auth; delete S.waiters.auth;
          if (w) w(true);
          updateLoginUI();
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
    S.name = name;
    return new Promise((resolve) => {
      S.waiters.auth = (ok, msg) => {
        updateLoginUI();
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
    S.ws = null; S.authed = false; S.name = null; S.token = null;
    updateLoginUI();
  }
  function updateLoginUI() {
    document.querySelectorAll('[data-login-ui]').forEach((el) => {
      const name = S.authed ? S.name : null;
      if (name) {
        el.innerHTML = '<span class="status">Signed in as <b>' + esc(name) + '</b></span> <button class="btn ghost" data-act="logout">Log out</button>';
        return;
      }
      el.innerHTML = '<a class="btn ghost" href="login.html" style="font-size:12px;padding:5px 14px">Log In</a> ' +
        '<a class="btn" href="register.html" style="font-size:12px;padding:5px 14px">Create Account</a>';
    });
    const st = document.getElementById('login-status');
    if (st) { st.textContent = S.authed ? 'Logged in as ' + S.name : ''; st.className = S.authed ? 'ok' : ''; }
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  document.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'logout') { ev.preventDefault(); logout(); }
  });

  window.Cinder = { login, logout, send, get authed() { return S.authed; }, get name() { return S.name; }, esc,
    ensure: async () => { if (!S.authed) throw new Error('not logged in'); await connect(); } };
  document.addEventListener('DOMContentLoaded', updateLoginUI);
})();
