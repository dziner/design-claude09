import * as THREE from 'three';

/* ============================================================
   MILI AI — app.js  (CINEMATIC motion variant)
   Deep-blue universe with a heavy, weighty, film-like camera
   ============================================================ */

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------------------------------------------------------
   1. WEBGL CINEMATIC UNIVERSE
   Slow, weighty camera. Scroll drives a heavy, inertial dolly
   through a slowly drifting deep-blue field.
   --------------------------------------------------------------- */
function initUniverse() {
  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020510, 0.021);

  const camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.1, 400);
  camera.position.set(0, 0, 0);

  const DEPTH = 230;      // how far the field extends ahead (−Z)
  const SPREAD = 62;      // lateral spread

  /* ---- Streaming starfield (the fly-through) ---- */
  const COUNT = reduced ? 2600 : 9000;
  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const vel = new Float32Array(COUNT);
  const drift = new Float32Array(COUNT * 2);

  // tight blue family — deep electric → icy white
  const palette = [
    new THREE.Color(0xdfefff), // near white
    new THREE.Color(0x9fdcff), // icy
    new THREE.Color(0x9fdcff),
    new THREE.Color(0x4fa8ff), // azure
    new THREE.Color(0x4fa8ff),
    new THREE.Color(0x2f6bff), // electric blue
  ];

  for (let i = 0; i < COUNT; i++) {
    positions[i * 3]     = (Math.random() * 2 - 1) * SPREAD;
    positions[i * 3 + 1] = (Math.random() * 2 - 1) * SPREAD * 0.6;
    positions[i * 3 + 2] = -Math.random() * DEPTH;
    const c = palette[(Math.random() * palette.length) | 0];
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    vel[i] = 0.55 + Math.random() * 0.95;
    drift[i * 2]     = (Math.random() * 2 - 1) * 0.05;
    drift[i * 2 + 1] = (Math.random() * 2 - 1) * 0.05;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const sprite = makeSprite();
  const mat = new THREE.PointsMaterial({
    size: 0.55, map: sprite, vertexColors: true, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, opacity: 0.95,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  /* ---- Wireframe rings you fly through ---- */
  const rings = [];
  for (let i = 0; i < 6; i++) {
    const r = new THREE.Mesh(
      new THREE.TorusGeometry(9 + Math.random() * 6, 0.10, 8, 72),
      new THREE.MeshBasicMaterial({ color: 0x2f6bff, wireframe: true, transparent: true, opacity: 0.16 })
    );
    r.position.set((Math.random() * 2 - 1) * 9, (Math.random() * 2 - 1) * 6, -26 - i * (DEPTH / 6));
    r.rotation.z = Math.random() * Math.PI;
    r.userData.spin = (Math.random() * 2 - 1) * 0.004;
    rings.push(r); scene.add(r);
  }

  /* ---- Iridescent crystalline centerpiece (fly past it) ---- */
  const crystalGeo = new THREE.OctahedronGeometry(9, 0);
  crystalGeo.scale(1, 1.8, 1);            // elongated shard
  const crystal = new THREE.Mesh(
    crystalGeo,
    new THREE.MeshNormalMaterial({ flatShading: true, transparent: true, opacity: 0.55 })
  );
  crystal.position.z = -DEPTH * 0.75;
  scene.add(crystal);
  // faint wireframe cage around the crystal
  const cage = new THREE.Mesh(
    new THREE.IcosahedronGeometry(12, 1),
    new THREE.MeshBasicMaterial({ color: 0x4fa8ff, wireframe: true, transparent: true, opacity: 0.10 })
  );
  scene.add(cage);

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
  const BASE = 4.4;       // slow, majestic drift (was a fast fly-through)
  let sN = 0;             // heavily-eased scroll (inertia)

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // weighty easing everywhere
    pointer.x += (pointer.tx - pointer.x) * 0.02;
    pointer.y += (pointer.ty - pointer.y) * 0.02;
    sN += (scrollN - sN) * 0.035;             // heavy scroll inertia

    const warp = 1 + sN * 2.2;                // gentle acceleration
    const camZ = -sN * 48;                    // slow cinematic dolly inward

    // slowly stream particles toward the camera, recycle relative to it
    const recycleAt = camera.position.z + 6;
    for (let i = 0; i < COUNT; i++) {
      const iz = i * 3 + 2;
      pos[iz] += BASE * vel[i] * warp * dt;
      pos[i * 3]     += drift[i * 2] * warp;
      pos[i * 3 + 1] += drift[i * 2 + 1] * warp;
      if (pos[iz] > recycleAt) {
        pos[iz] = camera.position.z - DEPTH;
        pos[i * 3]     = (Math.random() * 2 - 1) * SPREAD;
        pos[i * 3 + 1] = (Math.random() * 2 - 1) * SPREAD * 0.6;
      }
    }
    geo.attributes.position.needsUpdate = true;

    for (const r of rings) {
      r.position.z += BASE * 0.65 * warp * dt;
      r.rotation.z += r.userData.spin * (0.5 + sN * 1.5);
      if (r.position.z > camera.position.z + 8) {
        r.position.z -= DEPTH;
        r.position.x = (Math.random() * 2 - 1) * 9;
        r.position.y = (Math.random() * 2 - 1) * 6;
      }
    }
    // grand, slow crystal that stays ahead of the camera
    crystal.rotation.x = t * 0.05; crystal.rotation.y = t * 0.07;
    crystal.position.z += BASE * 0.24 * warp * dt;
    if (crystal.position.z > camera.position.z + 16) crystal.position.z = camera.position.z - DEPTH;
    cage.position.z = crystal.position.z;
    cage.rotation.x = -t * 0.03; cage.rotation.y = t * 0.04;

    // heavy, slow camera — steers a touch with the pointer, dollies with scroll
    camera.position.x += (pointer.x * 4 - camera.position.x) * 0.02;
    camera.position.y += (-pointer.y * 3 - camera.position.y) * 0.02;
    camera.position.z += (camZ - camera.position.z) * 0.02;
    camera.lookAt(camera.position.x * 0.3, camera.position.y * 0.3, camera.position.z - 26);
    camera.rotation.z += (-pointer.x * 0.05 - camera.rotation.z) * 0.02;

    mat.size = 0.62 + sN * 0.22;              // soft bokeh, minimal streak
    mat.opacity = 0.9;

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
  g.addColorStop(0.25, 'rgba(220,238,255,0.85)');
  g.addColorStop(0.5, 'rgba(160,210,255,0.22)');
  g.addColorStop(1, 'rgba(160,210,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
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
    x += (tx - x) * 0.12; y += (ty - y) * 0.12;   // heavier, weightier lag
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
    grad.addColorStop(0, '#7fe0ff'); grad.addColorStop(0.5, '#4fa8ff'); grad.addColorStop(1, '#2f6bff');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2 * devicePixelRatio;
    ctx.shadowBlur = 12; ctx.shadowColor = '#4fa8ff';
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
      const fmt = (v) => Math.floor(v).toLocaleString('en-US');
      (function run() {
        n += step;
        if (n >= target) { el.textContent = target.toLocaleString('en-US') + suffix; return; }
        el.textContent = fmt(n) + suffix;
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
  setInterval(() => { el.textContent = new Date().toLocaleTimeString('en-GB'); }, 1000);
  el.textContent = new Date().toLocaleTimeString('en-GB');
}

/* ---------------------------------------------------------------
   10b. HERO PARALLAX EXIT (cinematic)
   --------------------------------------------------------------- */
function initHeroParallax() {
  if (reduced) return;
  const hero = document.querySelector('.hero');
  if (!hero) return;
  let y = 0, ty = 0;
  window.addEventListener('scroll', () => { ty = window.scrollY; }, { passive: true });
  (function loop() {
    requestAnimationFrame(loop);
    y += (ty - y) * 0.08;                      // heavy inertia
    const p = Math.min(y / (window.innerHeight * 0.9), 1);
    hero.style.transform = `translate3d(0, ${(y * 0.28).toFixed(1)}px, 0)`;
    hero.style.opacity = String(1 - p * 0.92);
  })();
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
    note.textContent = '◈ TRANSMISSION RECEIVED — 신병 훈련소 좌표를 전송했습니다.';
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
  initHeroParallax();
  initNavigation();
});
