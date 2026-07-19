/* Millennium Research — main.js
   Vanilla interaction layer: hero particle canvas, scroll reveals, scroll-spy,
   sticky nav, mobile menu, pipeline scene, dataset viewer.
   No dependencies beyond KaTeX (CDN, deferred, decoupled via __mathReady). */

'use strict';

/* ------------------------------------------------------------------------ *
 * Dataset snapshot — single source of truth for the corpus numbers.        *
 * Edit these constants to update the site without touching layout.         *
 * ------------------------------------------------------------------------ */
const DATASET = {
  faithful: 500,
  unfaithful: 2000,
};

const COUNT_UP_MS = 2000;

/* Verdict → particle color mix. Echoes the corpus palette while keeping the
   logo predominantly green; pending stays sparse and dim. */
const PARTICLE_MIX = [
  { color: '#21C46A', weight: 0.44 },  /* faithful */
  { color: '#3BE38A', weight: 0.30 },  /* faithful — bright variant */
  { color: '#E5484D', weight: 0.12 },  /* unfaithful */
  { color: '#E8B339', weight: 0.05 },  /* uncertain */
  { color: '#5A6B63', weight: 0.09 },  /* pending — inert */
];

/* ------------------------------- Utilities ------------------------------- */
const $  = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const mobileMQ = window.matchMedia('(max-width: 767px)');

/* Set synchronously by intro.js (loaded first) when the Manifold intro will
   play: the hero then starts already assembled, so the intro's logo hands
   off to it seamlessly instead of re-scattering. */
const INTRO_ACTIVE = document.documentElement.dataset.intro === 'active';

const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/* ========================================================================== *
 *  Hero particle canvas                                                      *
 *  Alpha-mask sampling of an offscreen lemniscate → scatter-and-assemble.    *
 * ========================================================================== */
function initHero() {
  const canvas = $('#hero-canvas');
  const hero = $('.hero');
  const bloom = $('#hero-bloom');
  if (!canvas || !hero) return;
  const ctx = canvas.getContext('2d');

  let particles = [];
  let rafId = null;
  let logoImg = null;   /* the real mark (assets/logo-mark.png) once loaded */
  let cssW = 0, cssH = 0;
  let inView = true, tabVisible = !document.hidden;
  let assembleT0 = 0;
  let frameCount = 0, fpsAccum = 0, lastFrame = 0, adapted = false;
  let degrade = 1;   /* persists across rebuilds once the FPS sampler trips */
  const mouse = { x: -9999, y: -9999 };

  function pickColor() {
    let r = Math.random();
    for (const { color, weight } of PARTICLE_MIX) {
      if ((r -= weight) <= 0) return color;
    }
    return PARTICLE_MIX[0].color;
  }

  /* Offscreen mask of the real Millennium Research mark. The artwork sits on a
     black backdrop, so the mask is luminance, not alpha. Falls back to a
     parametric lemniscate only if the image fails to load. */
  function drawLogoMask() {
    const ow = 440;
    const off = document.createElement('canvas');
    if (logoImg) {
      const oh = Math.round(ow * logoImg.naturalHeight / logoImg.naturalWidth);
      off.width = ow; off.height = oh;
      const octx = off.getContext('2d', { willReadFrequently: true });
      octx.drawImage(logoImg, 0, 0, ow, oh);
      return { data: octx.getImageData(0, 0, ow, oh), ow, oh, byLum: true };
    }
    const oh = 252;
    off.width = ow; off.height = oh;
    const octx = off.getContext('2d');
    octx.fillStyle = '#fff';
    const halfW = ow * 0.46;
    const baseR = ow * 0.045;
    for (let t = 0; t < Math.PI * 2; t += 0.008) {
      const s = Math.sin(t), c = Math.cos(t);
      const d = 1 + s * s;
      const x = ow / 2 + (halfW * c) / d;
      const y = oh / 2 + (halfW * 1.12 * s * c) / d;
      const r = baseR * (0.42 + 0.58 * Math.abs(c));
      octx.beginPath();
      octx.arc(x, y, r, 0, Math.PI * 2);
      octx.fill();
    }
    return { data: octx.getImageData(0, 0, ow, oh), ow, oh, byLum: false };
  }

  /* Pixel acceptance for either mask mode; returns 0 (reject) or the pixel's
     brightness 0–1 so the artwork's ribbon shading survives as particle size. */
  function maskValue(px, idx, byLum) {
    if (byLum) {
      const lum = 0.2126 * px[idx] + 0.7152 * px[idx + 1] + 0.0722 * px[idx + 2];
      return lum > 46 ? lum / 255 : 0;
    }
    return px[idx + 3] > 128 ? 1 : 0;
  }

  /* Where the assembled logo sits on the visible canvas. Desktop measures
     the copy block so the logo never collides with the headline at narrow
     widths. The CSS bloom layer gets the same geometry via positionBloom. */
  function targetBox() {
    if (mobileMQ.matches) {
      const w = cssW * 0.86;
      return { cx: cssW * 0.5, cy: cssH * 0.30, w };
    }
    let copyRight = 0;
    /* Measure content boxes, not full-width rows (.hero-ctas spans the
       container; its children are the real content edge). */
    const parts = hero.querySelectorAll('.hero-copy h1, .hero-copy .hero-sub, .hero-copy .hero-ctas > *');
    for (const el of parts) {
      copyRight = Math.max(copyRight, el.getBoundingClientRect().right);
    }
    const left = Math.max(copyRight + 32, cssW * 0.5);
    const avail = Math.max(cssW - left - 24, 240);
    const w = Math.min(avail, 680);
    return { cx: left + avail / 2, cy: cssH * 0.5, w };
  }

  function positionBloom(box, scale, oh) {
    if (!bloom) return;
    const h = oh * scale;
    bloom.style.left = `${box.cx - box.w / 2}px`;
    bloom.style.top = `${box.cy - h / 2}px`;
    bloom.style.width = `${box.w}px`;
    bloom.style.height = `${h}px`;
  }

  function buildParticles(firstBuild) {
    const { data, ow, oh, byLum } = drawLogoMask();
    const px = data.data;

    /* Count accepted pixels, then derive stride for the particle budget. */
    let opaque = 0;
    for (let i = 0; i < px.length; i += 4) if (maskValue(px, i, byLum)) opaque++;
    const isMobile = mobileMQ.matches;
    const budget = Math.round((isMobile ? 850 : 2600) * degrade);
    let stride = Math.ceil(Math.sqrt(opaque / budget));
    stride = isMobile ? Math.min(6, Math.max(5, stride))
                      : Math.min(4, Math.max(3, stride));

    const box = targetBox();
    const scale = box.w / ow;
    positionBloom(box, scale, oh);
    const left = box.cx - box.w / 2;
    const top = box.cy - (oh * scale) / 2;

    const next = [];
    for (let y = 0; y < oh; y += stride) {
      for (let x = 0; x < ow; x += stride) {
        const bright = maskValue(px, (y * ow + x) * 4, byLum);
        if (!bright) continue;
        const tx = left + x * scale + (Math.random() - 0.5);
        const ty = top + y * scale + (Math.random() - 0.5);
        next.push({
          x: firstBuild && !INTRO_ACTIVE ? Math.random() * cssW : tx,
          y: firstBuild && !INTRO_ACTIVE ? Math.random() * cssH : ty,
          baseX: tx,
          baseY: ty,
          /* brighter ribbon → larger particle, so the mark's shading reads */
          size: (1 + Math.random() * 2) * (0.55 + 0.65 * bright),
          color: pickColor(),
          ease: 0.08 + Math.random() * 0.04,
          density: Math.random() * 30 + 1,
          /* top-to-bottom cascade on first assemble (none under the intro) */
          delay: INTRO_ACTIVE ? 0 : (y / oh) * 500 + Math.random() * 120,
        });
      }
    }
    /* Trim random extras if the stride clamp overshot the budget. */
    while (next.length > budget * 1.25) {
      next.splice((Math.random() * next.length) | 0, 1);
    }
    /* On rebuilds (resize, font swap) keep live positions so particles
       glide to their new homes instead of snapping. */
    if (!firstBuild) {
      const n = Math.min(particles.length, next.length);
      for (let i = 0; i < n; i++) {
        next[i].x = particles[i].x;
        next[i].y = particles[i].y;
      }
    }
    particles = next;
  }

  function sizeCanvas() {
    const rect = hero.getBoundingClientRect();
    cssW = Math.round(rect.width);
    cssH = Math.round(rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, mobileMQ.matches ? 1.5 : 2);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);   /* absolute — no compounding */
  }

  function drawStatic() {
    ctx.clearRect(0, 0, cssW, cssH);
    for (const p of particles) {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.baseX, p.baseY, p.size, p.size);
    }
  }

  function tick(now) {
    rafId = requestAnimationFrame(tick);

    /* FPS sample over ~30 frame deltas → one-shot adaptive degrade.
       Only frames with a valid previous timestamp count, so loop pauses
       (offscreen, tab blur) neither skew the average nor skip finalize. */
    if (!adapted) {
      if (lastFrame) {
        frameCount++;
        if (frameCount > 5 && frameCount <= 35) {
          fpsAccum += now - lastFrame;
          if (frameCount === 35) {
            const avg = fpsAccum / 30;
            if (avg > 1000 / 55) {
              degrade = 0.65;
              particles = particles.filter((_, i) => i % 3 !== 0);
            }
            adapted = true;
          }
        }
      }
      lastFrame = now;
    }

    ctx.clearRect(0, 0, cssW, cssH);
    const radius = mobileMQ.matches ? 100 : 150;
    const elapsed = now - assembleT0;

    for (const p of particles) {
      if (elapsed > p.delay) {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < radius && dist > 0.001) {
          const force = (radius - dist) / radius;      /* 1 at cursor → 0 at edge */
          p.x -= (dx / dist) * force * p.density;      /* push AWAY */
          p.y -= (dy / dist) * force * p.density;
        } else {
          p.x += (p.baseX - p.x) * p.ease;             /* ease home */
          p.y += (p.baseY - p.y) * p.ease;
        }
      }
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
  }

  function running() { return rafId !== null; }
  function stop() {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  }
  function maybeRun() {
    if (reducedMotion.matches) { stop(); drawStatic(); return; }
    if (inView && tabVisible && !running()) {
      lastFrame = 0;
      rafId = requestAnimationFrame(tick);
    } else if ((!inView || !tabVisible) && running()) {
      stop();
    }
  }

  function boot(firstBuild) {
    sizeCanvas();
    buildParticles(firstBuild);
    if (reducedMotion.matches) { drawStatic(); return; }
    if (firstBuild) assembleT0 = performance.now();
    maybeRun();
  }

  /* Load the real mark, then boot; fall back to the parametric shape.
     Until the image settles, rebuild triggers below stay inert so the
     fallback never flashes before the artwork arrives. */
  let imageSettled = false;
  const img = new Image();
  img.onload = () => { logoImg = img; imageSettled = true; boot(true); };
  img.onerror = () => { imageSettled = true; boot(true); };
  img.src = 'assets/logo-mark.png';

  /* Pause when the hero leaves the viewport. */
  new IntersectionObserver((entries) => {
    inView = entries[0].isIntersecting;
    maybeRun();
  }, { threshold: 0.1 }).observe(canvas);

  document.addEventListener('visibilitychange', () => {
    tabVisible = !document.hidden;
    maybeRun();
  });

  hero.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  hero.addEventListener('pointerleave', () => {
    mouse.x = -9999; mouse.y = -9999;
  });

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!imageSettled) return;
      stop();
      boot(false);   /* rebuild in place — no re-scatter on resize */
    }, 150);
  });

  reducedMotion.addEventListener('change', () => {
    if (!imageSettled) return;
    stop();
    boot(false);
  });

  /* Rebuild once webfonts land: the copy block's measured width changes,
     and targetBox derives the logo position from it. */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { if (imageSettled) boot(false); });
  }
}

/* ========================================================================== *
 *  Scroll reveals                                                            *
 * ========================================================================== */
function initReveals() {
  /* Auto-index children of stagger groups (80ms per child via CSS). */
  $$('[data-reveal-group]').forEach((group) => {
    $$('[data-reveal]', group).forEach((el, i) => el.style.setProperty('--i', i));
  });

  /* Once an element has fully entered, drop its data-reveal attribute so the
     reveal rules stop competing with state styles (e.g. .card.is-out). */
  function settle(el) {
    el.removeAttribute('data-reveal');
    el.style.removeProperty('--i');
  }

  const els = $$('[data-reveal]');
  if (reducedMotion.matches) {
    els.forEach((el) => { el.classList.add('is-visible'); settle(el); });
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const el = entry.target;
        el.classList.add('is-visible');
        io.unobserve(el);
        const timer = setTimeout(() => { onEnd(); }, 2000);
        function onEnd(e) {
          /* transitionend bubbles and fires per property — settle only on
             the element's own opacity transition (or the timeout backstop). */
          if (e && (e.target !== el || e.propertyName !== 'opacity')) return;
          clearTimeout(timer);
          el.removeEventListener('transitionend', onEnd);
          settle(el);
        }
        el.addEventListener('transitionend', onEnd);
      }
    }
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  els.forEach((el) => io.observe(el));
}

/* ========================================================================== *
 *  Sticky nav shading + scroll-spy                                           *
 * ========================================================================== */
function initNav() {
  const nav = $('#site-nav');
  const heroEl = $('.hero') || $('#intro');
  /* "Scrolled" = the first screen's bottom has moved 40px past its resting
     point — independent of how tall the intro runway above it is. */
  const onScroll = () => {
    const scrolled = heroEl
      ? heroEl.getBoundingClientRect().bottom < window.innerHeight - 40
      : window.scrollY > 40;
    nav.classList.toggle('is-scrolled', scrolled);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const links = new Map($$('.nav-links a[data-spy]').map((a) => [a.dataset.spy, a]));
  const intersecting = new Set();
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) intersecting.add(entry.target.id);
      else intersecting.delete(entry.target.id);
    }
    let active = null;
    for (const id of links.keys()) if (intersecting.has(id)) active = id;
    links.forEach((a, id) => a.classList.toggle('is-active', id === active));
  }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
  links.forEach((_, id) => {
    const section = document.getElementById(id);
    if (section) io.observe(section);
  });
}

/* ========================================================================== *
 *  Mobile menu — overlay, focus trap, inert background                       *
 * ========================================================================== */
function initMenu() {
  const toggle = $('#nav-toggle');
  const overlay = $('#menu-overlay');
  const wordmark = $('.wordmark');
  if (!toggle || !overlay) return;
  let open = false;
  let hideTimer = null;

  function setOpen(next, refocus = true) {
    open = next;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.documentElement.classList.toggle('menu-open', open);
    $$('main, footer').forEach((el) => { el.inert = open; });
    if (wordmark) wordmark.tabIndex = open ? -1 : 0;
    if (open) {
      clearTimeout(hideTimer);          /* cancel a pending close-hide */
      overlay.hidden = false;
      requestAnimationFrame(() => { if (open) overlay.classList.add('is-open'); });
    } else {
      overlay.classList.remove('is-open');
      const done = () => { overlay.hidden = true; };
      if (reducedMotion.matches) done();
      else hideTimer = setTimeout(done, 300);
      if (refocus) toggle.focus();
    }
  }

  toggle.addEventListener('click', () => setOpen(!open));

  /* Close on link choice, then let the anchor scroll. */
  $$('a', overlay).forEach((a) =>
    a.addEventListener('click', () => setOpen(false, false)));

  document.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key !== 'Tab') return;
    /* Trap: cycle between the toggle button and the overlay links. */
    const focusables = [toggle, ...$$('a', overlay)];
    const idx = focusables.indexOf(document.activeElement);
    let nextIdx;
    if (idx === -1) nextIdx = 0;
    else if (e.shiftKey) nextIdx = (idx - 1 + focusables.length) % focusables.length;
    else nextIdx = (idx + 1) % focusables.length;
    e.preventDefault();
    focusables[nextIdx].focus();
  });

  /* Leaving mobile breakpoint closes the menu. */
  mobileMQ.addEventListener('change', () => { if (open && !mobileMQ.matches) setOpen(false, false); });
}

/* ========================================================================== *
 *  Pipeline sticky scene                                                     *
 * ========================================================================== */
function initPipeline() {
  const stages = $$('#pipeline-stages .stage');
  const nodes = $$('#pl-nodes .pl-node');
  const dot = $('#pl-dot');
  const fill = $('#pl-fill');
  const rail = $('.pl-rail');
  if (!stages.length) return;

  let centers = [];
  function measure() {
    if (!rail || !nodes.length) return;
    const railTop = rail.getBoundingClientRect().top;
    centers = nodes.map((node) => {
      const num = $('.pl-num', node);
      const r = (num || node).getBoundingClientRect();
      return r.top + r.height / 2 - railTop - 4;   /* 4 = dot half-height */
    });
  }

  /* Continuous verdict pulse: the dot travels the rail with scroll and the
     fill trails it; nodes still gate through setActive. Reduced motion keeps
     the original stepped transitions. */
  const continuous = !reducedMotion.matches && !!(dot && fill && rail);
  if (continuous) {
    dot.style.transition = 'none';
    fill.style.transition = 'none';
  }

  let current = -1;
  function applyTransforms() {
    if (current < 0 || continuous) return;
    if (fill) fill.style.transform = `scaleY(${current / (stages.length - 1)})`;
    if (dot && centers[current] !== undefined) {
      dot.style.transform = `translateY(${centers[current]}px)`;
    }
  }
  function setActive(i) {
    if (i === current) return;
    current = i;
    stages.forEach((s, k) => s.classList.toggle('is-active', k === i));
    nodes.forEach((n, k) => n.classList.toggle('is-active', k <= i));
    applyTransforms();
  }

  measure();
  window.addEventListener('resize', () => { measure(); applyTransforms(); });

  if (continuous) {
    const drive = () => {
      if (!centers.length) return;
      const vh = window.innerHeight;
      const firstR = stages[0].getBoundingClientRect();
      const lastR = stages[stages.length - 1].getBoundingClientRect();
      if (lastR.bottom < -vh * 0.5 || firstR.top > vh * 1.5) return;   /* offscreen */
      const mid = vh * 0.45;
      /* Piecewise position between consecutive stage-row centers → t ∈ [0,3]. */
      const rowC = stages.map((s) => {
        const r = s.getBoundingClientRect();
        return r.top + r.height / 2;
      });
      let t;
      if (mid <= rowC[0]) t = 0;
      else if (mid >= rowC[rowC.length - 1]) t = rowC.length - 1;
      else {
        let k = 0;
        while (k < rowC.length - 2 && mid > rowC[k + 1]) k++;
        t = k + (mid - rowC[k]) / Math.max(1, rowC[k + 1] - rowC[k]);
      }
      const i = Math.min(centers.length - 2, Math.floor(t));
      const y = centers[i] + (centers[i + 1] - centers[i]) * (t - i);
      dot.style.transform = `translateY(${y}px)`;
      const railH = rail.clientHeight || 1;
      fill.style.transform = `scaleY(${Math.min(1, Math.max(0, y / railH))})`;
    };
    window.addEventListener('scroll', drive, { passive: true });
    window.addEventListener('resize', drive);
    drive();
  }

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        measure();
        setActive(Number(entry.target.dataset.stage));
      }
    }
  }, { rootMargin: '-40% 0px -45% 0px', threshold: 0 });
  stages.forEach((s) => io.observe(s));
}

/* ========================================================================== *
 *  Dataset viewer — count-up stats, filters, Lean highlighting               *
 * ========================================================================== */
function formatNum(n) { return n.toLocaleString('en-US'); }

function initStats() {
  const targets = {
    faithful: DATASET.faithful,
    unfaithful: DATASET.unfaithful,
  };

  const els = $$('.stat-num').filter((el) => targets[el.dataset.stat] !== undefined);
  els.forEach((el) => { el.textContent = formatNum(targets[el.dataset.stat]) + '+'; });

  if (reducedMotion.matches) return;   /* final values, no animation */

  const stats = $('#stats');
  if (!stats) return;
  /* Start at zero so a slow scroll never shows final values pre-animation. */
  els.forEach((el) => { el.textContent = '0'; });
  const io = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) return;
    io.disconnect();                    /* fire exactly once */
    const t0 = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - t0) / COUNT_UP_MS);
      const k = easeOutExpo(t);
      els.forEach((el) => {
        el.textContent = formatNum(Math.round(targets[el.dataset.stat] * k)) + '+';
      });
      if (t < 1) requestAnimationFrame(frame);
    }
    els.forEach((el) => { el.textContent = '0'; });
    requestAnimationFrame(frame);
  }, { threshold: 0.4 });
  io.observe(stats);
}

function initFilters() {
  const chips = $$('.chip');
  const cards = $$('#cards .card');
  const status = $('#filter-status');
  if (!chips.length) return;

  function apply(filter) {
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.filter === filter)));
    const list = $('#cards');
    if (list) list.classList.toggle('is-filtered', filter !== 'all');
    let shown = 0;
    cards.forEach((card) => {
      const show = filter === 'all' || card.dataset.verdict === filter;
      if (show) shown++;
      clearTimeout(card._filterTimer);
      if (show) {
        if (card.hidden) {
          card.hidden = false;
          card.classList.add('is-out');
          /* Commit the start state synchronously — no async callback that a
             rapid re-toggle could leave stale. */
          void card.offsetWidth;
          card.classList.remove('is-out');
        } else {
          card.classList.remove('is-out');
        }
      } else if (!card.hidden) {
        card.classList.add('is-out');
        const hide = () => { card.hidden = true; };
        if (reducedMotion.matches) hide();
        else card._filterTimer = setTimeout(hide, 300);
      }
    });
    if (status) {
      status.textContent = `${shown} theorem ${shown === 1 ? 'sample' : 'samples'} shown`;
    }
  }

  chips.forEach((chip) =>
    chip.addEventListener('click', () => apply(chip.dataset.filter)));
}

/* ---- Hand-rolled Lean 4 tokenizer (custom green-on-black theme) ---------- */
const LEAN_TOKEN_RE = new RegExp([
  /* 1: comment  */ '(--[^\\n]*|\\/-[\\s\\S]*?-\\/)',
  /* 2: bad      */ '\\b(sorry|admit)\\b',
  /* 3: keyword  */ '(\\b(?:theorem|lemma|example|def|abbrev|structure|class|instance|by|fun|let|have|show|from|match|with|where|open|import|namespace|end|variable|universe|calc|do|if|then|else)\\b|[∀∃λ↦]|:=|=>)',
  /* 4: tactic   */ '\\b(intro|intros|rintro|obtain|rcases|refine|exact|apply|rw|rewrite|simp|simpa|norm_num|ring_nf|ring|linarith|nlinarith|positivity|omega|decide|aesop|gcongr|constructor|use|field_simp)\\b',
  /* 5: type     */ '([ℝℕℤℚℂ]|\\b(?:Real|Nat|Int|Rat|Complex|Prop|Type|Fin|Finset|Set|SimpleGraph|EuclideanSpace|Odd|Even|Decidable|DecidableRel)\\b)',
].join('|'), 'gu');

const TOKEN_CLASS = ['', 'tok-com', 'tok-bad', 'tok-kw', 'tok-tac', 'tok-type'];

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightLean(src) {
  let out = '';
  let last = 0;
  LEAN_TOKEN_RE.lastIndex = 0;
  let m;
  while ((m = LEAN_TOKEN_RE.exec(src)) !== null) {
    out += escapeHtml(src.slice(last, m.index));
    let cls = '';
    for (let g = 1; g <= 5; g++) {
      if (m[g] !== undefined) { cls = TOKEN_CLASS[g]; break; }
    }
    out += `<span class="${cls}">${escapeHtml(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + escapeHtml(src.slice(last));
}

function initLean() {
  $$('code.language-lean').forEach((code) => {
    code.innerHTML = highlightLean(code.textContent);
  });
}

/* ---- KaTeX — deferred CDN; render once available, reveal on completion --- */
function renderMath() {
  const scope = $('#dataset');
  if (!scope || typeof window.renderMathInElement !== 'function') return;
  window.renderMathInElement(scope, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '\\(', right: '\\)', display: false },
      { left: '\\[', right: '\\]', display: true },
    ],
    throwOnError: false,
  });
  scope.classList.add('math-ready');
}

function initMath() {
  window.__mathReady = renderMath;
  if (typeof window.renderMathInElement === 'function') renderMath();
  /* CDN failure fallback: reveal raw statements rather than hide content. */
  setTimeout(() => {
    const scope = $('#dataset');
    if (scope && !scope.classList.contains('math-ready')) {
      scope.classList.add('math-ready');
    }
  }, 3500);
}

/* ========================================================================== *
 *  Page progress — the intro's loader bar lives on as reading progress       *
 * ========================================================================== */
function initProgress() {
  const bar = $('#page-progress');
  if (!bar) return;
  const intro = document.getElementById('intro');
  const onScroll = () => {
    const vh = window.innerHeight;
    const start = intro ? Math.max(0, intro.offsetHeight - vh) : 0;
    const range = Math.max(1, document.documentElement.scrollHeight - vh - start);
    const p = Math.min(1, Math.max(0, (window.scrollY - start) / range));
    bar.style.transform = `scaleX(${p})`;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();
}

/* ========================================================================== *
 *  Typecheck sweep — Lean panels "compile" on first reveal                   *
 * ========================================================================== */
function initTypecheck() {
  const cards = $$('#cards .card');
  if (!cards.length || reducedMotion.matches) return;
  cards.forEach((c) => c.classList.add('pre-check'));

  function runSweep(card) {
    const panel = $('.panel-lean', card);
    if (!panel || !panel.animate) { card.classList.remove('pre-check'); return; }
    const scan = document.createElement('div');
    scan.className = 'lean-scan';
    panel.appendChild(scan);
    const anim = scan.animate(
      [
        { transform: 'translateY(0)' },
        { transform: `translateY(${panel.clientHeight}px)` },
      ],
      { duration: 600, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
    );
    anim.onfinish = () => {
      scan.remove();
      card.classList.remove('pre-check');   /* tokens tint, badge stamps */
    };
  }

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const card = entry.target;
      io.unobserve(card);
      /* Slight offset between the two columns of the grid. */
      const delay = (Array.prototype.indexOf.call(card.parentNode.children, card) % 2) * 120;
      setTimeout(() => runSweep(card), 250 + delay);
    }
  }, { threshold: 0.35 });
  cards.forEach((c) => io.observe(c));
}

/* ========================================================================== *
 *  Reveal fallback — never leave content stuck invisible                     *
 *  The scroll-triggered enhancements above (content reveals, stat count-ups, *
 *  typecheck sweep, pipeline highlight) are driven by IntersectionObserver.  *
 *  In environments where IO never reports intersections — offscreen or       *
 *  transform-scaled preview frames, some embedded webviews — those elements  *
 *  would stay at their hidden start state. Probe whether IO actually fires;   *
 *  if it doesn't, snap everything to its finished state so the page still     *
 *  shows its content. When IO works, this stays completely out of the way.   *
 * ========================================================================== */
function initRevealFallback() {
  function finish() {
    $$('[data-reveal]').forEach((el) => {
      el.classList.add('is-visible');
      el.removeAttribute('data-reveal');
      el.style.removeProperty('--i');
    });
    $$('.stat-num').forEach((el) => {
      const k = el.dataset.stat;
      if (DATASET[k] !== undefined) el.textContent = formatNum(DATASET[k]);
    });
    $$('#cards .card.pre-check').forEach((c) => c.classList.remove('pre-check'));
    $$('#pipeline-stages .stage').forEach((s) => s.classList.add('is-active'));
    $$('#pl-nodes .pl-node').forEach((n) => n.classList.add('is-active'));
    const ds = $('#dataset');
    if (ds) ds.classList.add('math-ready');
  }

  if (!('IntersectionObserver' in window)) { finish(); return; }

  const probeEls = $$('[data-reveal]').slice(0, 8);
  if (!probeEls.length) return;     /* nothing reveal-driven on this page */

  let fired = false;
  const probe = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { fired = true; probe.disconnect(); }
  }, { threshold: 0 });
  probeEls.forEach((el) => probe.observe(el));

  window.setTimeout(() => {
    if (fired) return;              /* IO reports here — leave the animations alone */
    probe.disconnect();
    finish();
  }, 600);
}

/* ------------------------------- Boot ------------------------------------- */
initNav();
initProgress();
initMenu();
initReveals();
initHero();
initPipeline();
initStats();
initFilters();
initLean();
initTypecheck();
initMath();
initRevealFallback();
