import * as THREE from 'three';

/* ============================================================
   AETHER — app.js
   WebGL particle universe + experimental UI systems
   ============================================================ */

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------------------------------------------------------
   1. WEBGL PARTICLE UNIVERSE
   --------------------------------------------------------------- */
function initUniverse() {
  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x04060f, 0.055);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 14);

  const group = new THREE.Group();
  scene.add(group);

  /* ---- Particle field (fluid drifting stardust) ---- */
  const COUNT = reduced ? 2200 : 7000;
  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const seeds = new Float32Array(COUNT);
  const speeds = new Float32Array(COUNT);

  const palette = [
    new THREE.Color(0x38f0ff),
    new THREE.Color(0x8a5cff),
    new THREE.Color(0xff4bd8),
    new THREE.Color(0x7dffb2),
  ];

  for (let i = 0; i < COUNT; i++) {
    // distribute in a soft spherical shell for a "nebula" feel
    const r = 6 + Math.random() * 16;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = (r * Math.cos(phi)) * 0.6;
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

    const c = palette[(Math.random() * palette.length) | 0].clone();
    c.multiplyScalar(0.6 + Math.random() * 0.6);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;

    seeds[i] = Math.random() * Math.PI * 2;
    speeds[i] = 0.2 + Math.random() * 0.8;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // soft round sprite texture
  const sprite = makeSprite();
  const mat = new THREE.PointsMaterial({
    size: 0.14,
    map: sprite,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    opacity: 0.9,
  });
  const points = new THREE.Points(geo, mat);
  group.add(points);

  /* ---- Distant faint star haze ---- */
  const hazeGeo = new THREE.BufferGeometry();
  const HAZE = reduced ? 800 : 2500;
  const hp = new Float32Array(HAZE * 3);
  for (let i = 0; i < HAZE; i++) {
    hp[i * 3]     = (Math.random() - 0.5) * 90;
    hp[i * 3 + 1] = (Math.random() - 0.5) * 60;
    hp[i * 3 + 2] = (Math.random() - 0.5) * 90 - 20;
  }
  hazeGeo.setAttribute('position', new THREE.BufferAttribute(hp, 3));
  const haze = new THREE.Points(hazeGeo, new THREE.PointsMaterial({
    size: 0.08, color: 0x9fb0d6, transparent: true, opacity: 0.35,
    map: sprite, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  scene.add(haze);

  /* ---- Glowing wireframe orb (abstract 3D environment) ---- */
  const orb = new THREE.Mesh(
    new THREE.IcosahedronGeometry(3.4, 2),
    new THREE.MeshBasicMaterial({ color: 0x38f0ff, wireframe: true, transparent: true, opacity: 0.09 })
  );
  group.add(orb);

  const orb2 = new THREE.Mesh(
    new THREE.IcosahedronGeometry(4.8, 1),
    new THREE.MeshBasicMaterial({ color: 0x8a5cff, wireframe: true, transparent: true, opacity: 0.06 })
  );
  group.add(orb2);

  /* ---- Interaction state ---- */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let scrollN = 0;

  window.addEventListener('pointermove', (e) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  });
  window.addEventListener('scroll', () => {
    const max = document.body.scrollHeight - window.innerHeight;
    scrollN = max > 0 ? window.scrollY / max : 0;
  }, { passive: true });

  const clock = new THREE.Clock();
  const pos = geo.attributes.position.array;
  const base = positions.slice();

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    // smooth pointer easing
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;

    // fluid motion — curl-like displacement per particle
    if (!reduced) {
      for (let i = 0; i < COUNT; i++) {
        const ix = i * 3;
        const s = seeds[i];
        const sp = speeds[i];
        pos[ix]     = base[ix]     + Math.sin(t * 0.3 * sp + s) * 0.6;
        pos[ix + 1] = base[ix + 1] + Math.cos(t * 0.25 * sp + s) * 0.6;
        pos[ix + 2] = base[ix + 2] + Math.sin(t * 0.2 * sp + s * 1.3) * 0.6;
      }
      geo.attributes.position.needsUpdate = true;
    }

    // group rotation reacts to pointer + scroll (camera-like drift)
    group.rotation.y += 0.0006 + pointer.x * 0.0015;
    group.rotation.x += pointer.y * 0.0006;
    group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, group.rotation.y, 1);

    orb.rotation.x = t * 0.08; orb.rotation.y = t * 0.05;
    orb2.rotation.y = -t * 0.04; orb2.rotation.z = t * 0.03;
    haze.rotation.y = t * 0.01;

    // camera glides forward on scroll — "descend" through the field
    camera.position.z = 14 - scrollN * 8;
    camera.position.x += (pointer.x * 2.2 - camera.position.x) * 0.04;
    camera.position.y += (-pointer.y * 1.6 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);

    // hue drift on particles for living neon
    mat.size = 0.14 + Math.sin(t * 0.8) * 0.02;

    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function makeSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.25)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

/* ---------------------------------------------------------------
   2. BOOT SEQUENCE
   --------------------------------------------------------------- */
function initBoot() {
  const boot = document.getElementById('boot');
  const fill = document.getElementById('bootFill');
  const pct = document.getElementById('bootPct');
  let p = 0;
  const tick = setInterval(() => {
    p += Math.random() * 16 + 6;
    if (p >= 100) { p = 100; clearInterval(tick); setTimeout(done, 450); }
    fill.style.width = p + '%';
    pct.textContent = Math.floor(p);
  }, 160);
  function done() {
    boot.classList.add('hidden');
    document.body.classList.add('ready');
    revealHero();
  }
}

/* ---------------------------------------------------------------
   3. REVEAL ON SCROLL
   --------------------------------------------------------------- */
function initReveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.14 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
}
function revealHero() {
  document.querySelectorAll('.hero .reveal').forEach((el, i) => {
    setTimeout(() => el.classList.add('in'), 120 + i * 120);
  });
}

/* ---------------------------------------------------------------
   4. CUSTOM CURSOR
   --------------------------------------------------------------- */
function initCursor() {
  if (window.matchMedia('(hover:none)').matches) return;
  const cur = document.getElementById('cursor');
  let x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y;
  window.addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; });
  (function loop() {
    x += (tx - x) * 0.2; y += (ty - y) * 0.2;
    cur.style.transform = `translate(${x}px, ${y}px)`;
    requestAnimationFrame(loop);
  })();
  const hot = 'a, button, input, .card, .module, [data-scroll]';
  document.querySelectorAll(hot).forEach((el) => {
    el.addEventListener('pointerenter', () => cur.classList.add('is-hover'));
    el.addEventListener('pointerleave', () => cur.classList.remove('is-hover'));
  });
}

/* ---------------------------------------------------------------
   5. TILT (layered depth on cards)
   --------------------------------------------------------------- */
function initTilt() {
  if (window.matchMedia('(hover:none)').matches) return;
  document.querySelectorAll('.tilt').forEach((card) => {
    const glow = card.querySelector('.card__glow');
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const rx = (py - 0.5) * -12;
      const ry = (px - 0.5) * 14;
      card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-6px)`;
      if (glow) { glow.style.left = px * 100 + '%'; glow.style.top = py * 100 + '%'; }
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  });
}

/* ---------------------------------------------------------------
   6. WAVEFORM MODULE (oscilloscope)
   --------------------------------------------------------------- */
function initWave() {
  const canvas = document.getElementById('wave');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  function size() {
    const r = canvas.getBoundingClientRect();
    canvas.width = r.width * devicePixelRatio;
    canvas.height = r.height * devicePixelRatio;
  }
  size();
  window.addEventListener('resize', size);
  let t = 0;
  (function draw() {
    requestAnimationFrame(draw);
    if (reduced) return;
    t += 0.05;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#38f0ff'); grad.addColorStop(0.5, '#8a5cff'); grad.addColorStop(1, '#ff4bd8');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2 * devicePixelRatio;
    ctx.shadowBlur = 12; ctx.shadowColor = '#38f0ff';
    ctx.beginPath();
    for (let x = 0; x <= w; x += 4) {
      const n = x / w;
      const y = h / 2 +
        Math.sin(n * 10 + t) * h * 0.18 * Math.sin(t * 0.4) +
        Math.sin(n * 22 - t * 1.4) * h * 0.10;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  })();
}

/* ---------------------------------------------------------------
   7. FLUX BARS random heights (module viz)
   --------------------------------------------------------------- */
function initBars() {
  document.querySelectorAll('.viz-bars i').forEach((b) => {
    b.style.animationDelay = (Math.random() * 1.6).toFixed(2) + 's';
    b.style.height = (20 + Math.random() * 60) + '%';
  });
}

/* ---------------------------------------------------------------
   8. COUNTERS
   --------------------------------------------------------------- */
function initCounters() {
  const els = document.querySelectorAll('[data-count]');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const target = +el.dataset.count;
      const suffix = el.dataset.suffix || '';
      let n = 0;
      const step = target / 60;
      (function run() {
        n += step;
        if (n >= target) { el.textContent = target + suffix; return; }
        el.textContent = Math.floor(n) + suffix;
        requestAnimationFrame(run);
      })();
      io.unobserve(el);
    });
  }, { threshold: 0.6 });
  els.forEach((el) => io.observe(el));
}

/* ---------------------------------------------------------------
   9. CLOCK
   --------------------------------------------------------------- */
function initClock() {
  const el = document.getElementById('clock');
  setInterval(() => {
    el.textContent = new Date().toLocaleTimeString('en-GB');
  }, 1000);
  el.textContent = new Date().toLocaleTimeString('en-GB');
}

/* ---------------------------------------------------------------
   10. SMOOTH SCROLL BUTTONS + FORM
   --------------------------------------------------------------- */
function initNavigation() {
  document.querySelectorAll('[data-scroll]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelector(btn.dataset.scroll)?.scrollIntoView({ behavior: 'smooth' });
    });
  });
  const form = document.getElementById('accessForm');
  const note = document.getElementById('accessNote');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    note.textContent = '◈ SIGNAL RECEIVED — COORDINATES DISPATCHED';
    form.reset();
    setTimeout(() => { note.textContent = ''; }, 4200);
  });
}

/* ---------------------------------------------------------------
   BOOT ALL
   --------------------------------------------------------------- */
window.addEventListener('DOMContentLoaded', () => {
  try { initUniverse(); } catch (err) { console.warn('WebGL unavailable', err); }
  initBoot();
  initReveal();
  initCursor();
  initTilt();
  initWave();
  initBars();
  initCounters();
  initClock();
  initNavigation();
});
