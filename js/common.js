/* Cinderrealm website — shared auth + profile.
 * WEBSITE AND GAME ARE SEPARATE. The website verifies your account (so we
 * know who you are) but NEVER joins the game world: no hello, no player
 * spawn, no kicking your game session. Clicking "Play Now" takes you to the
 * game client, where you log in again, fresh.
 * The website session is just your name, kept per-tab. Live game data
 * (market, levels) comes via HTTP APIs (Tuesday); until then Tradekeep
 * shows a coming-soon notice — the old on-demand WS link sent hello
 * (world join) and is disabled. */
(function () {
  const WS_URL = 'wss://cinderrealm.onrender.com/ws-game';
  const S = { ws: null, authed: false, name: null, token: null, tokenAt: 0, waiters: {} };

  function saveSession() {
    try { sessionStorage.setItem('cinder_site_session', JSON.stringify({ name: S.name })); } catch (e) {}
  }
  function clearSession() {
    try { sessionStorage.removeItem('cinder_site_session'); } catch (e) {}
  }
  function closeWs() {
    try { S.ws && S.ws.close(); } catch (e) {}
    S.ws = null;
  }
  function send(obj) {
    if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify(obj));
  }

  // Verify-only login: prove the credentials, then hang up. Never hello.
  async function login(name, pass, mode) {
    const ws = new WebSocket(WS_URL);
    S.ws = ws;
    return new Promise((resolve) => {
      let done = false;
      const finish = (ok, msg) => {
        if (done) return; done = true;
        closeWs();
        if (ok) {
          S.authed = true; S.name = name;
          saveSession();
          renderProfile();
        }
        resolve({ ok, msg });
      };
      const to = setTimeout(() => finish(false, 'Could not reach the game server.'), 20000);
      ws.onopen = () => { ws.send(JSON.stringify({ t: mode || 'login', name, pass })); };
      ws.onerror = () => { clearTimeout(to); finish(false, 'Could not reach the game server.'); };
      ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.t === 'auth_ok') {
          clearTimeout(to);
          S.token = m.token || null; S.tokenAt = Date.now();
          finish(true);
        } else if (m.t === 'auth_err') {
          clearTimeout(to);
          finish(false, m.msg || 'Login failed');
        }
      };
      setTimeout(() => { if (!done) { clearTimeout(to); finish(false, 'Login timed out.'); } }, 25000);
    });
  }

  function logout() {
    closeWs();
    S.authed = false; S.name = null; S.token = null; S.tokenAt = 0;
    clearSession();
    renderProfile();
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  // Owner rank: shown with the game crown. Tuesday's /api/web/profile takes
  // over with server-side rank truth; this is the website-side stand-in.
  const OWNERS = ['larock420'];
  function isOwner() { return S.name && OWNERS.indexOf(S.name.toLowerCase()) !== -1; }
  function rankLabel() { return isOwner() ? 'Owner' : '—'; }
  function crown() { return isOwner() ? '&#128081; ' : ''; }

  // Tradekeep stopgap DISABLED: the old version opened a WebSocket and sent
  // hello (world join) to get market data — the website must never hello.
  // Live market data comes from Tuesday's HTTP market API instead.
  async function linkMarket() {
    throw new Error('market API not ready');
  }

  function renderProfile() {
    document.querySelectorAll('[data-profile]').forEach((el) => {
      if (!S.authed || !S.name) {
        el.innerHTML = '<a class="btn ghost" href="login.html" style="font-size:11px;padding:4px 12px">Log In</a> ' +
          '<a class="btn" href="register.html" style="font-size:11px;padding:4px 12px">Create Account</a>';
        return;
      }
      el.innerHTML =
        '<div class="pwrap">' +
          '<button class="pchip" data-act="profile" aria-haspopup="true">' +
            '<span class="pname">' + crown() + esc(S.name) + '</span>' +
            '<span class="plvl">Lvl —</span>' +
            '<span class="pcaret">▾</span>' +
          '</button>' +
          '<div class="pmenu" hidden>' +
            '<div class="prow"><span>Status</span><b>On the site</b></div>' +
            '<div class="prow"><span>Donation tier</span><b>' + rankLabel() + '</b></div>' +
            '<a href="settings.html">Account Settings</a>' +
            '<a href="https://cinderrealm.onrender.com" target="_blank" rel="noopener">Play Now</a>' +
            '<button data-act="logout">Log out</button>' +
          '</div>' +
        '</div>';
    });
    document.querySelectorAll('[data-login-ui]').forEach((el) => {
      el.innerHTML = (S.authed && S.name) ? '<span class="status">Signed in as <b>' + esc(S.name) + '</b></span>' : '';
    });
    const st = document.getElementById('login-status');
    if (st) { st.textContent = ''; }
  }

  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-act]');
    if (b) {
      const act = b.dataset.act;
      if (act === 'logout') { ev.preventDefault(); logout(); return; }
      if (act === 'profile') {
        ev.preventDefault();
        const wrap = b.closest('.pwrap');
        const menu = wrap && wrap.querySelector('.pmenu');
        if (menu) menu.hidden = !menu.hidden;
        return;
      }
    }
    if (!ev.target.closest('.pwrap')) {
      document.querySelectorAll('.pmenu').forEach((m) => { m.hidden = true; });
    }
  });

  window.Cinder = { login, logout, send, linkMarket,
    get authed() { return S.authed; }, get name() { return S.name; }, esc };

  // Soft restore: the website remembers who you are (per-tab). No game link.
  (function restore() {
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem('cinder_site_session') || 'null'); } catch (e) {}
    if (!saved || !saved.name) {
      try { sessionStorage.removeItem('cinder_session'); } catch (e) {}
      return;
    }
    S.name = saved.name; S.authed = true;
  })();
  document.addEventListener('DOMContentLoaded', renderProfile);
  renderProfile();
})();
