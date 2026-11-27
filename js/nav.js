// Mobile hamburger nav + masthead account state (v20).
(function () {
  var btn = document.querySelector('.menu-btn');
  var nav = document.querySelector('.masthead nav.bar');
  if (btn && nav) {
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') nav.classList.remove('open');
    });
  }
  // Signed in? The profile chip (rendered by common.js into [data-profile])
  // takes the account spot, so hide the Login button.
  try {
    var saved = JSON.parse(sessionStorage.getItem('cinder_site_session') || 'null');
    if (saved && saved.name) {
      var lb = document.querySelector('.loginbtn');
      if (lb) lb.style.display = 'none';
    }
  } catch (e) {}
})();
