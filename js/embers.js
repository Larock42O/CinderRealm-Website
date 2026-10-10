/* Floating ember sparks */
(function () {
  const c = document.getElementById('embers');
  if (!c) return;
  const x = c.getContext('2d');
  let W, H, parts = [];
  function size() { W = c.width = innerWidth; H = c.height = innerHeight; }
  size(); addEventListener('resize', size);
  function spawn(top) {
    return {
      x: Math.random() * W,
      y: top ? H + 10 : Math.random() * H,
      r: 0.6 + Math.random() * 2.2,
      vy: 0.25 + Math.random() * 0.9,
      vx: (Math.random() - 0.5) * 0.35,
      life: 1,
      decay: 0.0015 + Math.random() * 0.004,
      hue: 18 + Math.random() * 28
    };
  }
  for (let i = 0; i < 90; i++) parts.push(spawn(false));
  (function tick() {
    x.clearRect(0, 0, W, H);
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      p.x += p.vx + Math.sin(p.y * 0.01) * 0.25;
      p.y -= p.vy; p.life -= p.decay;
      if (p.life <= 0 || p.y < -12) { parts[i] = spawn(true); continue; }
      x.beginPath();
      x.arc(p.x, p.y, p.r * p.life, 0, 7);
      x.fillStyle = 'hsla(' + p.hue + ',95%,' + (45 + p.life * 20) + '%,' + (p.life * 0.85) + ')';
      x.shadowColor = 'hsla(' + p.hue + ',95%,55%,0.9)';
      x.shadowBlur = 8 * p.life;
      x.fill();
    }
    requestAnimationFrame(tick);
  })();
})();
