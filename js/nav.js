// Mobile hamburger nav (v19). Desktop nav is untouched.
(function () {
  var btn = document.querySelector('.menu-btn');
  var nav = document.querySelector('.masthead nav.bar');
  if (!btn || !nav) return;
  btn.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  nav.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') nav.classList.remove('open');
  });
})();
