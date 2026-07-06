/* Millennium Research — intro.js
   The "Manifold" scene IS the first page. A glowing point-grid surface
   graphs live equations while the loader narrates the four-stage
   faithfulness pipeline; the surface then calms, the mark resolves, and the
   hero copy rises in over the same scene — the page continues from there.

   Adapted from the standalone Manifold intro (Three.js r128, local at
   vendor/three.min.js with a CDN fallback).

   Modes — set INTRO_MODE, or override per-load with ?intro=…, or use the
   preview switcher chip (SHOW_MODE_SWITCHER):
     scrub  — scroll drives everything; scrolling back rewinds it
     timed  — plays on its own (~3s, no loader HUD); scrolling skips to the hero
     hybrid — plays on its own; scrolling fast-forwards through it

   Progressive: if WebGL, Three.js, or motion preferences say no, the section
   converts to a static hero (copy + mark, no animation) via .intro-fallback. */

'use strict';

(function () {
  const INTRO_MODE = 'timed';
  const MODES = ['scrub', 'timed', 'hybrid'];
  const SHOW_MODE_SWITCHER = false;  /* preview aid — set false to remove the chip */
  const LOAD_SECONDS = 1.2;          /* seconds the surface breathes before it calms */

  /* Phase boundaries on the master progress `raw` (0…1):
     0 → LOAD_END: loader + equations; → CALM span: surface calms, mark
     resolves; COPY_START → 1: hero copy rises, mark glides to its column. */
  const LOAD_END = 0.72;
  const COPY_START = 0.86;

  /* The loader narrates the site's four-stage faithfulness pipeline. */
  const STAGES = ['Compile', 'Symbolic equivalence', 'Back-translation', 'LLM tie-breaker'];

  const EQUATIONS = [
    'z = sin(2.6r \u2212 t) / (1 + 0.55r)',
    'z = (x\u00B2 \u2212 y\u00B2) / 13.3',
    'z = sin(1.3x + t)\u00B7cos(1.3y \u2212 t)',
  ];

  /* Shared displacement field: three functions cross-faded by uMorph, damped
     to a near-flat breathing surface by uCalm. */
  const FIELD = `
    uniform float uTime; uniform float uMorph; uniform float uCalm;
    float fRipple(vec2 p){ float r = length(p); return sin(r * 2.6 - uTime * 1.5) * 0.55 / (1.0 + r * 0.55); }
    float fSaddle(vec2 p){ return (p.x * p.x - p.y * p.y) * 0.075 + sin(p.x * 1.5 + uTime * 0.8) * 0.06; }
    float fWave(vec2 p){ return sin(p.x * 1.3 + uTime * 0.9) * cos(p.y * 1.3 - uTime * 0.7) * 0.42; }
    float field(vec2 p){
      float m = mod(uMorph, 3.0);
      float w0 = max(0.0, 1.0 - min(abs(m - 0.0), 3.0 - m));
      float w1 = max(0.0, 1.0 - abs(m - 1.0));
      float w2 = max(0.0, 1.0 - abs(m - 2.0));
      float z = fRipple(p) * w0 + fSaddle(p) * w1 + fWave(p) * w2;
      float calmField = sin(length(p) * 1.2 - uTime * 0.6) * 0.12;
      return mix(z, calmField, uCalm);
    }`;

  const docEl = document.documentElement;
  const section = document.getElementById('intro');
  if (!section) { docEl.classList.remove('intro-running'); return; }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobileMQ = window.matchMedia('(max-width: 767px)');

  const param = new URLSearchParams(location.search).get('intro');
  const mode = MODES.includes(param) ? param : INTRO_MODE;

  /* ------------------------------- DOM ------------------------------------ */
  const stage = document.getElementById('intro-stage');
  const bgEl = document.getElementById('intro-bg');
  const canvas = document.getElementById('intro-canvas');
  const uiEl = document.getElementById('intro-ui');
  const eqEl = document.getElementById('intro-eq');
  const numEl = document.getElementById('intro-stage-num');
  const nameEl = document.getElementById('intro-stage-name');
  const pctEl = document.getElementById('intro-pct');
  const barEl = document.getElementById('intro-bar');
  const logoEl = document.getElementById('intro-logo');
  const copyEl = document.getElementById('intro-copy');
  const ctasEl = document.getElementById('intro-ctas');
  const scrollBtn = document.getElementById('intro-scroll');
  const copyParts = copyEl ? Array.from(copyEl.querySelectorAll('.hero-copy > *')) : [];

  const ac = new AbortController();
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const rise = (t) => 1 - Math.pow(1 - clamp01(t), 3);

  let dead = false;
  let raf = null;
  let io = null, ro = null;
  let renderer = null;

  /* Convert the section into the static hero and stop everything. */
  function toFallback() {
    if (dead) return;
    dead = true;
    if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
    ac.abort();
    if (io) io.disconnect();
    if (ro) ro.disconnect();
    if (renderer) renderer.dispose();
    for (const el of [logoEl, uiEl, barEl, canvas, bgEl, copyEl]) {
      if (el) el.removeAttribute('style');
    }
    for (const el of copyParts) el.removeAttribute('style');
    if (ctasEl) ctasEl.inert = false;
    if (scrollBtn) scrollBtn.classList.remove('is-visible');
    section.classList.add('intro-fallback');
    docEl.classList.remove('intro-running');
    delete docEl.dataset.intro;
    delete docEl.dataset.introMode;
  }

  function webglOK() {
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
    } catch (_) { return false; }
  }

  /* ------------------------- capability gate ------------------------------ */
  if (reducedMotion.matches || !webglOK()) { toFallback(); return; }

  docEl.dataset.intro = 'active';
  docEl.dataset.introMode = mode;   /* styles.css: runway height per mode */
  if (ctasEl) ctasEl.inert = true;  /* unfocusable until the copy is live */

  /* Professional intro: drop the loader HUD — the percent counter, progress
     bar, and pipeline-stage narration. The living surface, the mark resolving,
     and the hero copy rising carry the moment on their own. */
  if (uiEl) uiEl.style.display = 'none';
  if (barEl) barEl.style.display = 'none';

  /* ------------------------------ geometry -------------------------------- */
  let VH = 1, sectionTop = 0, runway = 1, homeW = 320;
  let finalBox = null;

  function measureFinalBox() {
    const W = stage.clientWidth, H = stage.clientHeight;
    if (mobileMQ.matches) return { cx: W / 2, cy: H * 0.30, w: W * 0.86 };
    /* Measure content boxes, not full-width rows — .hero-ctas spans the
       container; its children are the real content edge. */
    let right = 0;
    const parts = copyEl.querySelectorAll('.hero-copy h1, .hero-copy .hero-sub, .hero-copy .hero-ctas > *');
    for (const el of parts) {
      right = Math.max(right, el.getBoundingClientRect().right);
    }
    const left = Math.max(right + 32, W / 2);
    const avail = Math.max(W - left - 24, 240);
    return { cx: left + avail / 2, cy: H * 0.52, w: Math.min(avail, 680) };
  }

  function measure() {
    VH = window.innerHeight || 1;
    sectionTop = section.offsetTop;
    const stageH = stage.offsetHeight || VH;
    runway = Math.max(1, section.offsetHeight - stageH);
    homeW = Math.min(stage.clientWidth * 0.44, 560);
    logoEl.style.width = homeW + 'px';
    finalBox = measureFinalBox();
  }

  /* ------------------------- logo: JPG → alpha -----------------------------
     The mark ships as a JPG on black. Convert to a real alpha PNG so it
     composites cleanly over the scene; on failure the mix-blend fallback
     still reads correctly. */
  function makeAlphaLogo() {
    if (logoEl.classList.contains('is-alpha')) return;
    try {
      if (!logoEl.naturalWidth) return;
      const c = document.createElement('canvas');
      c.width = logoEl.naturalWidth; c.height = logoEl.naturalHeight;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(logoEl, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height);
      const px = d.data;
      for (let i = 0; i < px.length; i += 4) {
        const m = Math.max(px[i], px[i + 1], px[i + 2]);
        if (m < 10) { px[i + 3] = 0; continue; }
        const s = 255 / m;
        px[i]     = Math.min(255, px[i] * s);
        px[i + 1] = Math.min(255, px[i + 1] * s);
        px[i + 2] = Math.min(255, px[i + 2] * s);
        px[i + 3] = m;
      }
      g.putImageData(d, 0, 0);
      logoEl.classList.add('is-alpha');
      logoEl.src = c.toDataURL('image/png');
    } catch (_) { /* keep the mix-blend JPG */ }
  }
  if (logoEl.complete && logoEl.naturalWidth) makeAlphaLogo();
  else logoEl.addEventListener('load', makeAlphaLogo, { once: true, signal: ac.signal });

  /* ------------------------------- state ---------------------------------- */
  let visibleFlag = true;
  let sceneAt = 0;
  const bootAt = performance.now();
  let timerStart = null;             /* timed / hybrid */
  let skipLatch = false;
  let lastPct = -1, lastStage = -1, eqIdx = -1, calmShown = false;
  let navShown = false;

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

  /* ------------------------------ three scene ----------------------------- */
  let scene3 = null, camera = null, ptsMat = null, wireMat = null;

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = res;
      s.onerror = () => { s.remove(); rej(new Error('failed: ' + src)); };
      document.head.appendChild(s);
    });
  }
  async function ensureThree() {
    if (window.THREE) return;
    try { await loadScript('vendor/three.min.js'); }
    catch (_) { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'); }
    if (!window.THREE) throw new Error('THREE missing');
  }

  function initScene() {
    if (dead) return;
    const T = window.THREE;
    renderer = new T.WebGLRenderer({ canvas, antialias: true });
    renderer.setClearColor(0x0A0C0B, 1);            /* --bg */
    scene3 = new T.Scene();
    scene3.fog = new T.FogExp2(0x0A0C0B, 0.075);
    camera = new T.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.set(0, 2.4, 6.4);

    const isMobile = mobileMQ.matches;
    const SIZE = 15;
    const SEG = isMobile ? 96 : 150;
    const uniforms = () => ({
      uTime: { value: 0 }, uMorph: { value: 0 }, uCalm: { value: 0 }, uScale: { value: 1 },
    });

    /* Glowing points — brand-mapped greens. */
    ptsMat = new T.ShaderMaterial({
      transparent: true, blending: T.AdditiveBlending, depthWrite: false,
      uniforms: uniforms(),
      vertexShader: FIELD + `
        uniform float uScale;
        varying float vH; varying float vR;
        void main(){
          vec3 p = position;
          float z = field(p.xy);
          p.z = z;
          vH = z; vR = length(position.xy);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (14.0 + smoothstep(0.0, 0.6, z) * 22.0) * uScale * (1.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vH; varying float vR;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.05, d);
          float hi = smoothstep(-0.1, 0.55, vH);
          vec3 col = mix(vec3(0.010, 0.28, 0.17), vec3(0.23, 0.89, 0.54), hi);
          float fade = smoothstep(7.5, 4.5, vR);
          gl_FragColor = vec4(col, a * (0.25 + hi * 0.65) * fade);
        }`
    });
    const pts = new T.Points(new T.PlaneBufferGeometry(SIZE, SIZE, SEG, SEG), ptsMat);
    pts.rotation.x = -Math.PI / 2;
    scene3.add(pts);

    /* Faint wireframe of the same surface. */
    wireMat = new T.ShaderMaterial({
      transparent: true, blending: T.AdditiveBlending, depthWrite: false, wireframe: true,
      uniforms: uniforms(),
      vertexShader: FIELD + `
        varying float vH; varying float vR;
        void main(){
          vec3 p = position;
          p.z = field(p.xy);
          vH = p.z; vR = length(position.xy);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        varying float vH; varying float vR;
        void main(){
          float hi = smoothstep(-0.1, 0.55, vH);
          float fade = smoothstep(7.5, 4.0, vR);
          gl_FragColor = vec4(mix(vec3(0.008, 0.14, 0.09), vec3(0.02, 0.50, 0.33), hi), 0.14 * fade);
        }`
    });
    const wire = new T.Mesh(new T.PlaneBufferGeometry(SIZE, SIZE, isMobile ? 40 : 60, 60), wireMat);
    wire.rotation.x = -Math.PI / 2;
    wire.position.y = -0.012;
    scene3.add(wire);

    resizeRenderer();
    sceneAt = performance.now();

    if (mode !== 'scrub') {
      timerStart = sceneAt;
      /* Reload landed mid-page: settle instantly instead of replaying. */
      if (window.scrollY - sectionTop > VH * 0.4) skipLatch = true;
    }
  }

  function resizeRenderer() {
    if (!renderer) return;
    const w = Math.max(2, stage.clientWidth), h = Math.max(2, stage.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, mobileMQ.matches ? 1.25 : 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    ptsMat.uniforms.uScale.value = (Math.min(w, h) / 640) * dpr;
  }

  function setEq(i, calm) {
    if (eqIdx === i && calmShown === calm) return;
    eqIdx = i; calmShown = calm;
    eqEl.textContent = calm ? 'z \u2192 0    \u2200(x, y)' : EQUATIONS[i];
    if (eqEl.animate) eqEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500 });
  }

  function setStage(i) {
    if (i === lastStage) return;
    lastStage = i;
    numEl.textContent = '0' + (i + 1);
    nameEl.textContent = STAGES[i];
    if (nameEl.animate) nameEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
  }

  /* Timed/hybrid master progress from elapsed seconds: the loader runs
     LOAD_SECONDS, then calm + copy complete over a further ~2.5s. */
  function rawFromTime(t) {
    if (t <= LOAD_SECONDS) return LOAD_END * (t / LOAD_SECONDS);
    return Math.min(1, LOAD_END + (1 - LOAD_END) * ((t - LOAD_SECONDS) / 1.6));
  }

  /* ------------------------------ choreography ---------------------------- */
  function update(nowMs) {
    const sy = Math.max(0, window.scrollY - sectionTop);

    /* Master progress. */
    let raw;
    if (mode === 'scrub') {
      raw = runway > 4 ? clamp01(sy / runway) : 1;
    } else {
      const t = timerStart === null ? 0 : (nowMs - timerStart) / 1000;
      raw = rawFromTime(t);
      if (mode === 'hybrid' && runway > 4) raw = Math.max(raw, clamp01(sy / runway));
      if (mode === 'timed' && !skipLatch && raw < 1 && sy > VH * 0.25) skipLatch = true;
      if (skipLatch) raw = 1;
    }

    const load = clamp01(raw / LOAD_END);
    const calm = easeInOut(clamp01((raw - LOAD_END) / 0.14));
    const reveal = easeInOut(clamp01((raw - (LOAD_END + 0.02)) / 0.16));
    const c = clamp01((raw - COPY_START) / (1 - COPY_START));

    /* Percent + progress bar. */
    const pct = Math.round((mode === 'scrub' ? load : easeInOut(load)) * 100);
    if (pct !== lastPct) {
      lastPct = pct;
      pctEl.textContent = pct;
      barEl.style.transform = 'scaleX(' + (pct / 100) + ')';
    }

    /* Equation morph + pipeline-stage label. */
    const phase = mode === 'scrub'
      ? load * 3
      : (timerStart === null ? 0 : (((nowMs - timerStart) / 1000) / 2) % 3);
    setEq(Math.round(phase) % 3, calm > 0.3);
    if (calm < 0.3) setStage(Math.min(3, Math.floor(load * 4)));

    /* Loader UI fades as the surface calms. */
    const uiFade = 1 - easeInOut(clamp01(calm / 0.5));
    uiEl.style.opacity = uiFade.toFixed(3);
    barEl.style.opacity = uiFade.toFixed(3);
    const fadeIn = sceneAt ? easeInOut(clamp01((nowMs - sceneAt) / 600)) : 0;
    canvas.style.opacity = fadeIn.toFixed(3);

    /* Logo: resolve center-stage, then glide to its hero column. */
    let cx = stage.clientWidth / 2;
    let cy = stage.clientHeight * 0.42;
    let w = homeW;
    if (c > 0 && finalBox) {
      const k = easeInOut(c);
      cx += (finalBox.cx - cx) * k;
      cy += (finalBox.cy - cy) * k;
      w += (finalBox.w - w) * k;
    }
    const ar = logoEl.naturalHeight && logoEl.naturalWidth
      ? logoEl.naturalHeight / logoEl.naturalWidth : 330 / 480;
    const h0 = homeW * ar;
    const s = (0.9 + 0.1 * reveal) * (w / homeW);
    logoEl.style.transform =
      'translate(' + (cx - homeW / 2).toFixed(1) + 'px,' + (cy - h0 / 2).toFixed(1) + 'px) scale(' + s.toFixed(4) + ')';
    logoEl.style.opacity = reveal.toFixed(3);
    logoEl.style.filter = 'blur(' + (6 * (1 - reveal)).toFixed(1) + 'px)';

    /* Hero copy rises in, staggered. */
    if (copyParts.length) {
      const ks = [rise(c / 0.6), rise((c - 0.12) / 0.6), rise((c - 0.24) / 0.6)];
      copyParts.forEach((el, i) => {
        const k = ks[Math.min(i, ks.length - 1)];
        el.style.opacity = k.toFixed(3);
        el.style.transform = 'translateY(' + (24 * (1 - k)).toFixed(1) + 'px)';
      });
      const live = c > 0.5;
      if (ctasEl && ctasEl.inert === live) ctasEl.inert = !live;
    }

    /* Scroll cue. */
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const cueOn = nowMs - bootAt > 900 && scrollable > window.innerHeight * 0.5 &&
      (mode === 'timed' ? c > 0.85 : raw < 0.04);
    scrollBtn.classList.toggle('is-visible', cueOn);

    /* Nav fades in with the copy (hysteresis avoids flicker). */
    if (!navShown && c > 0.15) { navShown = true; docEl.classList.remove('intro-running'); }
    else if (navShown && c < 0.05) { navShown = false; docEl.classList.add('intro-running'); }

    /* Render. */
    if (renderer) {
      mouse.x += (mouse.tx - mouse.x) * 0.04;
      mouse.y += (mouse.ty - mouse.y) * 0.04;
      const now = nowMs / 1000;
      for (const m of [ptsMat, wireMat]) {
        m.uniforms.uTime.value = now;
        m.uniforms.uMorph.value = phase;
        m.uniforms.uCalm.value = calm;
      }
      const drift = Math.sin(now * 0.09) * 0.8;
      camera.position.x = drift + mouse.x * 0.6;
      camera.position.y = 2.4 - calm * 0.9 - mouse.y * 0.3;
      camera.position.z = 6.4 - Math.sin(now * 0.05) * 0.4 - calm * 0.6;
      camera.lookAt(0, 0.1 + calm * 0.5, 0);
      renderer.render(scene3, camera);
    }
  }

  /* ------------------------------- run loop -------------------------------- */
  function loop(nowMs) {
    raf = requestAnimationFrame(loop);
    update(nowMs);
  }
  function maybeRun() {
    const should = !dead && visibleFlag && !document.hidden;
    if (should && raf === null) raf = requestAnimationFrame(loop);
    else if (!should && raf !== null) { cancelAnimationFrame(raf); raf = null; }
  }

  function skip() {
    if (runway > 4) {
      window.scrollTo({ top: sectionTop + runway, behavior: 'smooth' });
    } else {
      const next = document.querySelector('.belt, main .section') || document.getElementById('thesis');
      if (next) window.scrollTo({ top: next.getBoundingClientRect().top + window.scrollY - 8, behavior: 'smooth' });
      skipLatch = true;
    }
  }

  /* ------------------------------ listeners -------------------------------- */
  io = new IntersectionObserver((es) => {
    visibleFlag = es[0].isIntersecting;
    maybeRun();
  }, { threshold: 0 });
  io.observe(section);

  ro = new ResizeObserver(() => { measure(); resizeRenderer(); });
  ro.observe(stage);
  ro.observe(section);

  document.addEventListener('visibilitychange', maybeRun, { signal: ac.signal });

  window.addEventListener('pointermove', (e) => {
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true, signal: ac.signal });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && window.scrollY - sectionTop < runway) skip();
  }, { signal: ac.signal });

  scrollBtn.addEventListener('click', skip, { signal: ac.signal });

  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) toFallback();
  }, { signal: ac.signal });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { if (!dead) measure(); });
  }

  /* ---------------------- preview mode-switcher chip ----------------------- */
  function buildSwitcher() {
    let hidden = false;
    try { hidden = sessionStorage.getItem('introChipHidden') === '1'; } catch (_) {}
    if (hidden) return;
    const chip = document.createElement('div');
    chip.className = 'intro-modes';
    chip.setAttribute('role', 'group');
    chip.setAttribute('aria-label', 'Intro scroll mode (preview)');
    const label = document.createElement('span');
    label.className = 'intro-modes-label';
    label.textContent = 'Intro';
    chip.appendChild(label);
    for (const m of MODES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = m;
      b.setAttribute('aria-pressed', String(m === mode));
      b.addEventListener('click', () => {
        const u = new URL(location.href);
        u.searchParams.set('intro', m);
        u.hash = '';
        location.href = u.toString();
      });
      chip.appendChild(b);
    }
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'intro-modes-x';
    x.setAttribute('aria-label', 'Hide switcher');
    x.textContent = '\u00D7';
    x.addEventListener('click', () => {
      try { sessionStorage.setItem('introChipHidden', '1'); } catch (_) {}
      chip.remove();
    });
    chip.appendChild(x);
    document.body.appendChild(chip);
  }

  /* -------------------------------- boot ----------------------------------- */
  measure();
  setEq(0, false);
  setStage(0);
  if (SHOW_MODE_SWITCHER) buildSwitcher();
  maybeRun();
  ensureThree().then(initScene).catch(toFallback);

  /* Handoff watchdog: guarantee the hero always resolves. If the choreography
     hasn't handed off to the page (nav + copy revealed) within a few seconds
     — a stalled or throttled animation loop, a lost WebGL context, a
     backgrounded/hidden render target — drop to the static hero so the copy,
     mark, and nav are never left invisible. A normal run hands off in ~2s, so
     this never fires when the animation is actually playing. */
  setTimeout(() => {
    if (!dead && !navShown) toFallback();
  }, 5000);
})();
