/* Cinderrealm website — shared auth + profile.
 * WEBSITE AND GAME ARE SEPARATE. The website verifies your account (so we
 * know who you are) but NEVER joins the game world: no hello, no player
 * spawn, no kicking your game session. Clicking "Play Now" takes you to the
 * game client, where you log in again, fresh.
 * The website session is just your name, kept per-tab. Live game data
 * (market, levels) comes via HTTP APIs (Tuesday); until then Tradekeep
 * can link on demand right after you log in. */
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

  // Tradekeep stopgap: link a live market feed on demand. Needs a fresh
  // token (right after login); Tuesday's HTTP market API replaces this.
  async function linkMarket() {
    if (!S.authed) throw new Error('not logged in');
    if (!S.token || Date.now() - S.tokenAt > 4 * 60 * 1000) throw new Error('session expired');
    const ws = new WebSocket(WS_URL);
    S.ws = ws;
    await new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('connect timeout')), 20000);
      ws.onopen = () => { clearTimeout(to); ws.send(JSON.stringify({ t: 'hello', token: S.token })); resolve(); };
      ws.onerror = () => { clearTimeout(to); reject(new Error('connection failed')); };
    });
    ws.onclose = () => { if (S.ws === ws) S.ws = null; };
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.t && m.t.indexOf('bourse') === 0) {
        document.dispatchEvent(new CustomEvent('bourse', { detail: m }));
      }
    };
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

/* Theme music: "Embers of Dunmere" (original composition, synthesized).
 * Browsers block autoplay-with-sound until the user interacts, so we try on
 * load and otherwise start on the first tap/click/keypress, then loop.
 * Mute toggle lives in the topstrip; preference persists per browser. */
(function music() {
  const audio = document.createElement('audio');
  audio.id = 'theme-audio';
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = 0.45;
  const srcEl = document.createElement('source');
  srcEl.src = 'audio/embers_of_dunmere.mp3';
  srcEl.type = 'audio/mpeg';
  audio.appendChild(srcEl);
  audio.style.display = 'none';

  let muted = false;
  try { muted = localStorage.getItem('cinder_music') === 'off'; } catch (e) {}
  audio.muted = muted;

  function updateBtn(btn) {
    btn.classList.toggle('off', muted);
    btn.innerHTML = '&#9835;';
    btn.title = muted ? 'Unmute theme music' : 'Mute theme music';
  }
  function inject() {
    if (document.getElementById('music-toggle')) return;
    const prof = document.querySelector('[data-profile]');
    const host = prof ? prof.parentNode : null;
    if (!host) return;
    const btn = document.createElement('button');
    btn.id = 'music-toggle';
    btn.className = 'music-btn';
    btn.setAttribute('aria-label', 'Toggle theme music');
    updateBtn(btn);
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      muted = !muted;
      try { localStorage.setItem('cinder_music', muted ? 'off' : 'on'); } catch (e) {}
      audio.muted = muted;
      if (!muted) audio.play().catch(() => {});
      updateBtn(btn);
    });
    host.insertBefore(btn, prof);
  }

  function tryPlay() { if (!muted) audio.play().catch(() => {}); }
  const kick = () => {
    tryPlay();
    window.removeEventListener('pointerdown', kick);
    window.removeEventListener('keydown', kick);
    window.removeEventListener('touchstart', kick);
  };
  window.addEventListener('pointerdown', kick);
  window.addEventListener('keydown', kick);
  window.addEventListener('touchstart', kick);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { document.body.appendChild(audio); inject(); tryPlay(); });
  } else {
    document.body.appendChild(audio); inject(); tryPlay();
  }
})();
