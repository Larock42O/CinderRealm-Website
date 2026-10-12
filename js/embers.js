/* Cinderrealm website — ambient ember particles, shared across pages.
 * Same ember-and-gold soul as the game login page: few particles,
 * low opacity, fixed behind content. Pure decoration, no interaction. */
(function () {
  if (window.__embersInit) return;
  window.__embersInit = true;

  var canvas = document.createElement('canvas');
  canvas.id = 'ember-bg';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(canvas, document.body.firstChild);
  var ctx = canvas.getContext('2d');
  var W, H;

  function size() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  size();
  window.addEventListener('resize', size);

  // Respect users who prefer reduced motion.
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var COUNT = Math.min(36, Math.max(18, Math.floor(window.innerWidth / 48)));

  function Ember() { this.reset(true); }
  Ember.prototype.reset = function (initial) {
    this.x = Math.random() * W;
    this.y = initial ? Math.random() * H : H + 10;
    this.size = Math.random() * 2 + 0.5;
    this.speedY = Math.random() * 0.7 + 0.25;
    this.speedX = (Math.random() - 0.5) * 0.4;
    this.opacity = Math.random() * 0.35 + 0.08;
    this.fade = Math.random() * 0.002 + 0.0008;
    this.color = Math.random() > 0.45 ? '#f86a21' : '#d3381a';
  };
  Ember.prototype.step = function () {
    this.y -= this.speedY;
    this.x += this.speedX + Math.sin(this.y * 0.01) * 0.2;
    this.opacity -= this.fade;
    if (this.y < -10 || this.opacity <= 0) this.reset(false);
  };
  Ember.prototype.draw = function () {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.globalAlpha = this.opacity;
    ctx.shadowBlur = 6;
    ctx.shadowColor = this.color;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  };

  var embers = [];
  for (var i = 0; i < COUNT; i++) embers.push(new Ember());

  // Pause when the tab is hidden — no wasted cycles.
  var running = true;
  document.addEventListener('visibilitychange', function () {
    running = !document.hidden;
    if (running) requestAnimationFrame(tick);
  });

  function tick() {
    if (!running) return;
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < embers.length; i++) {
      embers[i].step();
      embers[i].draw();
    }
    requestAnimationFrame(tick);
  }
  tick();
})();
