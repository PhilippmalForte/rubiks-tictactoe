const COLORS = ['#ffb340', '#4fc3f7', '#ff5c8a', '#7bd88f', '#c58fff', '#fff176'];

export function createConfetti(canvas) {
  const ctx = canvas.getContext('2d');
  let particles = [];
  let raining = false;
  let rafId = null;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  function spawn(count) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 40,
        w: 6 + Math.random() * 8,
        h: 8 + Math.random() * 10,
        vy: 2 + Math.random() * 3.5,
        vx: -1.5 + Math.random() * 3,
        sway: Math.random() * Math.PI * 2,
        swaySpeed: 0.02 + Math.random() * 0.05,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: -0.15 + Math.random() * 0.3,
        color: COLORS[(Math.random() * COLORS.length) | 0],
      });
    }
  }

  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (raining && particles.length < 400) spawn(8);

    for (const p of particles) {
      p.sway += p.swaySpeed;
      p.x += p.vx + Math.sin(p.sway) * 1.2;
      p.y += p.vy;
      p.rot += p.rotSpeed;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      // scaling height by the sway simulates a fluttering flat strip
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, (-p.h / 2) * Math.abs(Math.cos(p.sway)), p.w, p.h * Math.abs(Math.cos(p.sway)));
      ctx.restore();
    }
    particles = particles.filter((p) => p.y < canvas.height + 30);

    if (raining || particles.length > 0) {
      rafId = requestAnimationFrame(frame);
    } else {
      rafId = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function start() {
    raining = true;
    spawn(120);
    if (rafId === null) rafId = requestAnimationFrame(frame);
  }

  function stop() {
    // stops the rain; particles already on screen fall out naturally
    raining = false;
  }

  function clear() {
    raining = false;
    particles = [];
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  return { start, stop, clear };
}
