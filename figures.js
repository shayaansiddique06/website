/* ============================================================================
   Millennium Research — one-page behaviour
   Nav state, scroll-spy, reveals, waiting list, and four canvas figures.
   Every figure runs real mathematics, pauses off-screen, and degrades to a
   single static frame when the visitor prefers reduced motion.
   ========================================================================== */
(function () {
  "use strict";

  var REDUCED = window.matchMedia &&
                window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var INK    = "#0F1412";
  var GREEN  = "#21C46A";
  var DEEP   = "#157A43";
  var FAINT  = "rgba(15,20,18,0.16)";

  /* ------------------------------------------------------------------ nav */

  var nav = document.getElementById("nav");
  var burger = document.getElementById("burger");
  var menu = document.getElementById("menu");

  function onScroll() {
    if (nav) nav.classList.toggle("is-stuck", window.scrollY > 8);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (burger && menu) {
    burger.addEventListener("click", function () {
      var open = burger.getAttribute("aria-expanded") === "true";
      burger.setAttribute("aria-expanded", String(!open));
      menu.hidden = open;
    });
    menu.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        burger.setAttribute("aria-expanded", "false");
        menu.hidden = true;
      }
    });
  }

  /* ------------------------------------------------------- viewport helper

     Everything below is driven by getBoundingClientRect rather than
     IntersectionObserver. IO is silently inert in a few environments — an
     embedded pane, a background tab, a zero-height viewport — and a page whose
     content never appears is a worse failure than a few cheap rect reads.    */

  var watchers = [];
  var queued = false;
  var lastPass = 0;

  function pass() {
    lastPass = Date.now();
    var vh = window.innerHeight || document.documentElement.clientHeight || 0;
    for (var i = 0; i < watchers.length; i++) watchers[i](vh);
  }

  /* Deliberately not requestAnimationFrame. rAF stops entirely in a hidden or
     occluded page, and copy that only appears on a frame callback is copy that
     sometimes never appears. setTimeout is throttled in the background but it
     still fires. */
  function schedule() {
    var since = Date.now() - lastPass;
    if (since >= 16) { pass(); return; }
    if (queued) return;
    queued = true;
    setTimeout(function () { queued = false; pass(); }, 16 - since);
  }

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  window.addEventListener("load", schedule);
  document.addEventListener("visibilitychange", schedule);

  /* A slow safety net. Scroll events can be missed — a restored scroll
     position, an embedded frame, a page that was hidden while it loaded — and
     the cost of six rect reads twice a second is nothing next to a section
     that never shows up. */
  setInterval(schedule, 500);

  function top(el) { return el.getBoundingClientRect().top; }
  function bottom(el) { return el.getBoundingClientRect().bottom; }

  /* ----------------------------------------------------------- scroll-spy */

  var links = Array.prototype.slice.call(
    document.querySelectorAll('.nav-links a[href^="#"]')
  );
  var targets = links
    .map(function (a) { return document.querySelector(a.getAttribute("href")); })
    .filter(Boolean);

  if (targets.length) {
    watchers.push(function (vh) {
      var best = null, bestTop = -Infinity, line = vh * 0.4;
      for (var i = 0; i < targets.length; i++) {
        var t = top(targets[i]);
        if (t <= line && t > bestTop) { bestTop = t; best = targets[i]; }
      }
      var id = best ? "#" + best.id : null;
      for (var k = 0; k < links.length; k++) {
        links[k].classList.toggle("is-current", links[k].getAttribute("href") === id);
      }
    });
  }

  /* -------------------------------------------------------------- reveals */

  var reveals = Array.prototype.slice.call(document.querySelectorAll(".reveal"));

  if (REDUCED) {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    reveals.forEach(function (el) {
      var group = el.closest("[data-stagger]");
      if (group) {
        var kids = Array.prototype.slice.call(group.querySelectorAll(".reveal"));
        el.style.transitionDelay = (Math.min(kids.indexOf(el), 5) * 90) + "ms";
      }
    });
    watchers.push(function (vh) {
      var pending = false;
      for (var i = 0; i < reveals.length; i++) {
        var el = reveals[i];
        if (el.classList.contains("is-in")) continue;
        if (top(el) < vh * 0.92 && bottom(el) > 0) el.classList.add("is-in");
        else pending = true;
      }
      if (!pending) reveals.length = 0;
    });
  }

  /* --------------------------------------------------------- canvas setup */

  function fit(canvas) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = canvas.getBoundingClientRect();
    canvas.width  = Math.max(1, Math.round(r.width  * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: r.width, h: r.height };
  }

  /* ---------------------------------------------- figure 1 · Riemann zeta

     The Riemann-Siegel Z function on the critical line. Z is real valued and
     shares its zeros with zeta at Re(s) = 1/2, so every crossing of the axis
     is a zero of the zeta function.
        theta(t) = t/2 ln(t/2pi) - t/2 - pi/8 + 1/(48t) + 7/(5760 t^3)
        Z(t)     = 2 sum_{n=1}^{N} n^-1/2 cos(theta(t) - t ln n) + R(t)
     with N = floor(sqrt(t/2pi)) and R the first Riemann-Siegel correction.
     ---------------------------------------------------------------------- */

  function zeta(canvas) {
    var d = fit(canvas), ctx = d.ctx, w = d.w, h = d.h;
    var T0 = 6, T1 = 52;                    // through the first ten zeros
    var mid = h / 2, amp = h * 0.34;

    function theta(t) {
      return t / 2 * Math.log(t / (2 * Math.PI)) - t / 2 - Math.PI / 8
           + 1 / (48 * t) + 7 / (5760 * t * t * t);
    }
    function Z(t) {
      var u = Math.sqrt(t / (2 * Math.PI));
      var N = Math.floor(u), p = u - N;
      var th = theta(t), sum = 0;
      for (var n = 1; n <= N; n++) sum += Math.cos(th - t * Math.log(n)) / Math.sqrt(n);
      sum *= 2;
      /* First Riemann-Siegel correction. Without it the truncated main sum is
         out by up to 0.5 in t and invents a zero below the first real one. */
      var C0 = Math.cos(2 * Math.PI * (p * p - p - 1 / 16)) / Math.cos(2 * Math.PI * p);
      return sum + (N % 2 ? 1 : -1) * Math.pow(u, -0.5) * C0;
    }

    var pts = [], zeros = [], prev = null;
    for (var i = 0; i <= w; i++) {
      var t = T0 + (T1 - T0) * (i / w);
      var v = Z(t);
      pts.push(v);
      if (prev !== null && ((prev < 0) !== (v < 0))) zeros.push(i);
      prev = v;
    }
    var peak = 1;
    for (var k = 0; k < pts.length; k++) peak = Math.max(peak, Math.abs(pts[k]));

    var shown = 0, raf = 0;

    function paint() {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(15,20,18,0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();

      var lim = Math.min(shown, pts.length);
      ctx.lineWidth = 1.6; ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.strokeStyle = DEEP;
      ctx.beginPath();
      for (var i = 0; i < lim; i++) {
        var y = mid - (pts[i] / peak) * amp;
        if (i === 0) ctx.moveTo(i, y); else ctx.lineTo(i, y);
      }
      ctx.stroke();

      for (var z = 0; z < zeros.length; z++) {
        if (zeros[z] > lim) break;
        ctx.strokeStyle = "rgba(21,196,106,0.55)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(zeros[z], mid - 9); ctx.lineTo(zeros[z], mid + 9); ctx.stroke();
        ctx.fillStyle = GREEN;
        ctx.beginPath(); ctx.arc(zeros[z], mid, 2.8, 0, 6.2832); ctx.fill();
      }
      if (lim > 0 && lim < pts.length) {
        ctx.fillStyle = DEEP;
        ctx.beginPath();
        ctx.arc(lim - 1, mid - (pts[lim - 1] / peak) * amp, 2.4, 0, 6.2832);
        ctx.fill();
      }
    }

    function frame() {
      shown += Math.max(3, w / 320);
      paint();
      if (shown < pts.length) raf = requestAnimationFrame(frame);
      else setTimeout(function () { shown = 0; raf = requestAnimationFrame(frame); }, 3200);
    }

    if (REDUCED) { shown = pts.length; paint(); return { stop: function () {} }; }
    raf = requestAnimationFrame(frame);
    return { stop: function () { cancelAnimationFrame(raf); } };
  }

  /* ------------------------------------------- figure 2 · elliptic curve

     y^2 = x^3 - 3x + 1. The discriminant is positive, so the cubic has three
     real roots and the curve comes in two pieces: a closed oval and an
     unbounded branch. Successive multiples of a generator are plotted by the
     chord-and-tangent group law. Birch and Swinnerton-Dyer is the question of
     how many independent points that construction can reach.
     ---------------------------------------------------------------------- */

  function elliptic(canvas) {
    var d = fit(canvas), ctx = d.ctx, w = d.w, h = d.h;
    var A = -3, B = 1;
    function f(x) { return x * x * x + A * x + B; }

    var xMin = -2.3, xMax = 3.1, yMax = 3.4;
    var sy = (h * 0.44) / yMax;
    /* Stretched horizontally to fill a band far wider than it is tall. An
       affine scaling preserves the chord-and-tangent construction, so the
       group law drawn here is still the group law. */
    var sx = Math.min(sy * 3.6, (w * 0.62) / (xMax - xMin));
    var cx = w / 2, cy = h / 2;
    function PX(x) { return cx + (x - (xMin + xMax) / 2) * sx; }
    function PY(y) { return cy - y * sy; }

    /* The two real components, sampled where f >= 0 and the branch stays
       inside the frame. Sampling past that point drags the curve off canvas
       and leaves a straight edge where the path closes. */
    var yCap = yMax * yMax;
    var comps = [], run = null;
    for (var x = xMin; x <= xMax; x += 0.004) {
      var v = f(x);
      if (v >= 0 && v <= yCap) { if (!run) { run = []; comps.push(run); } run.push(x); }
      else run = null;
    }

    function drawCurve() {
      ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(15,20,18,0.34)";
      for (var c = 0; c < comps.length; c++) {
        var xs = comps[c];
        var closed = Math.abs(f(xs[0])) < 0.02 && Math.abs(f(xs[xs.length - 1])) < 0.02;
        if (closed) {                       /* the oval: one closed outline */
          ctx.beginPath();
          for (var i = 0; i < xs.length; i++) ctx.lineTo(PX(xs[i]), PY(Math.sqrt(Math.max(f(xs[i]), 0))));
          for (var j = xs.length - 1; j >= 0; j--) ctx.lineTo(PX(xs[j]), PY(-Math.sqrt(Math.max(f(xs[j]), 0))));
          ctx.closePath(); ctx.stroke();
        } else {                            /* the branch: two open arms */
          for (var sgn = 1; sgn >= -1; sgn -= 2) {
            ctx.beginPath();
            for (var k = 0; k < xs.length; k++) {
              var y = sgn * Math.sqrt(Math.max(f(xs[k]), 0));
              k ? ctx.lineTo(PX(xs[k]), PY(y)) : ctx.moveTo(PX(xs[k]), PY(y));
            }
            ctx.stroke();
          }
        }
      }
    }

    function dbl(p) {                       // tangent at P
      var m = (3 * p[0] * p[0] + A) / (2 * p[1]);
      var xr = m * m - 2 * p[0];
      return { pt: [xr, -(m * (xr - p[0]) + p[1])], m: m, via: [xr, m * (xr - p[0]) + p[1]] };
    }
    function addP(p, q) {                   // chord through P and Q
      if (Math.abs(p[0] - q[0]) < 1e-9) return null;
      var m = (q[1] - p[1]) / (q[0] - p[0]);
      var xr = m * m - p[0] - q[0];
      return { pt: [xr, -(m * (xr - p[0]) + p[1])], m: m, via: [xr, m * (xr - p[0]) + p[1]] };
    }

    /* Successive multiples of a generator leave the frame almost at once --
       2G already sits at y = -59 -- so the figure instead shows the group law
       on pairs chosen to stay in view, accumulating each sum. */
    var xsAll = [];
    for (var c2 = 0; c2 < comps.length; c2++) {
      for (var i2 = 0; i2 < comps[c2].length; i2 += 7) xsAll.push(comps[c2][i2]);
    }
    var seed = 12345;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    function pick() {
      var x = xsAll[Math.floor(rnd() * xsAll.length)];
      var y = Math.sqrt(Math.max(f(x), 0));
      return [x, rnd() < 0.5 ? y : -y];
    }

    var pts, cur, step, tAnim, raf = 0;

    function restart() { pts = []; step = null; tAnim = 0; }
    restart();

    function inView(p) {
      return isFinite(p[0]) && isFinite(p[1]) &&
             p[0] > xMin - 0.4 && p[0] < xMax + 0.4 && Math.abs(p[1]) < yMax + 0.6;
    }

    function dot(p, colour, r) {
      ctx.fillStyle = colour;
      ctx.beginPath(); ctx.arc(PX(p[0]), PY(p[1]), r, 0, 6.2832); ctx.fill();
    }

    function paint() {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(15,20,18,0.07)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();
      drawCurve();

      if (step) {
        dot(step.from, "rgba(15,20,18,0.55)", 3.4);
        dot(step.other, "rgba(15,20,18,0.55)", 3.4);
        var g = Math.min(tAnim / 0.5, 1);
        var from = step.from, to = step.via;
        ctx.strokeStyle = "rgba(21,122,67,0.45)"; ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(PX(from[0]), PY(from[1]));
        ctx.lineTo(PX(from[0] + (to[0] - from[0]) * g), PY(from[1] + (to[1] - from[1]) * g));
        ctx.stroke();
        if (tAnim > 0.5) {
          var g2 = Math.min((tAnim - 0.5) / 0.4, 1);
          ctx.strokeStyle = "rgba(21,196,106,0.55)";
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(PX(to[0]), PY(to[1]));
          ctx.lineTo(PX(to[0]), PY(to[1] + (step.pt[1] - to[1]) * g2));
          ctx.stroke(); ctx.setLineDash([]);
        }
      }

      for (var i = 0; i < pts.length; i++) {
        var fresh = i === pts.length - 1;
        dot(pts[i], fresh ? GREEN : DEEP, fresh ? 4 : 3);
      }
    }

    function advance() {
      for (var tries = 0; tries < 40; tries++) {
        var P = pick(), Q = pick();
        if (Math.abs(P[0] - Q[0]) < 0.25) continue;
        var r = addP(P, Q);
        if (!r || !inView(r.pt) || !inView(r.via)) continue;
        step = { from: P, other: Q, via: r.via, pt: r.pt };
        pts.push(r.pt.slice());
        if (pts.length > 8) pts.shift();
        return;
      }
      restart();
    }

    function frame() {
      tAnim += 0.018;
      if (tAnim >= 1.25) { tAnim = 0; advance(); }
      paint();
      raf = requestAnimationFrame(frame);
    }

    if (REDUCED) {
      for (var k = 0; k < 7; k++) advance();
      step = null; paint();
      return { stop: function () {} };
    }
    advance();
    raf = requestAnimationFrame(frame);
    return { stop: function () { cancelAnimationFrame(raf); } };
  }

  /* ------------------------------------------------- figure 3 · vortex street

     Tracer particles carried past a cylinder, shedding the alternating wake
     that a real flow produces. Navier-Stokes asks whether the equations
     governing this always have smooth solutions.
     ---------------------------------------------------------------------- */

  function flow(canvas) {
    var d = fit(canvas), ctx = d.ctx, w = d.w, h = d.h;
    var obsX = w * 0.17, obsY = h / 2, obsR = Math.min(h * 0.15, 26);
    var N = Math.round(Math.min(700, w * 0.55));
    var parts = [], raf = 0, clock = 0;
    var shed = h * 0.16, freq = 0.055, speed = w / 460;

    function seed(p, spread) {
      p.x = spread ? Math.random() * w : -Math.random() * w * 0.2;
      p.y = Math.random() * h;
      p.life = 0;
    }
    for (var i = 0; i < N; i++) { var p = {}; seed(p, true); parts.push(p); }

    function vel(x, y, t) {
      var dx = x - obsX, dy = y - obsY;
      var r2 = dx * dx + dy * dy, r = Math.sqrt(r2) || 1;
      var vx = speed, vy = 0;
      if (r < obsR * 1.05) return null;                       // inside the cylinder
      var k = (obsR * obsR) / r2;                             // potential-flow deflection
      vx += speed * k * (dy * dy - dx * dx) / r2;
      vy += speed * k * (-2 * dx * dy) / r2;
      if (x > obsX) {                                         // alternating wake
        var age = (x - obsX) / w;
        var env = Math.exp(-Math.pow((y - obsY) / (h * 0.42), 2)) * Math.min(age * 3.2, 1);
        vy += Math.sin(t * freq - (x - obsX) * 0.022) * shed * 0.030 * env;
        vx += Math.cos(t * freq - (x - obsX) * 0.022) * 0.16 * env;
      }
      return [vx, vy];
    }

    function paint() {
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        var v = vel(p.x, p.y, clock);
        if (!v) { seed(p); continue; }
        var nx = p.x + v[0] * 2.2, ny = p.y + v[1] * 2.2;
        var fade = Math.min(p.life / 18, 1) * (p.x > w * 0.9 ? (w - p.x) / (w * 0.1) : 1);
        ctx.strokeStyle = "rgba(21,122,67," + (0.30 * Math.max(fade, 0)).toFixed(3) + ")";
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny); ctx.stroke();
        p.x = nx; p.y = ny; p.life++;
        if (p.x > w + 4 || p.y < -4 || p.y > h + 4) seed(p);
      }
      ctx.fillStyle = "rgba(15,20,18,0.82)";
      ctx.beginPath(); ctx.arc(obsX, obsY, obsR, 0, 6.2832); ctx.fill();
      clock++;
    }

    function frame() { paint(); raf = requestAnimationFrame(frame); }

    if (REDUCED) { for (var s2 = 0; s2 < 120; s2++) paint(); return { stop: function () {} }; }
    for (var s3 = 0; s3 < 40; s3++) paint();
    raf = requestAnimationFrame(frame);
    return { stop: function () { cancelAnimationFrame(raf); } };
  }

  /* --------------------------------------------- figure 4 · curve shortening

     A closed curve moved by its own curvature. Every embedded curve becomes
     convex and then a round point. The same idea in one dimension higher,
     Ricci flow, is how Poincare was settled.
     ---------------------------------------------------------------------- */

  function shorten(canvas) {
    var d = fit(canvas), ctx = d.ctx, w = d.w, h = d.h;
    var STAGES = w > 900 ? 5 : (w > 560 ? 4 : 3);
    var slot = w / STAGES;
    var R = Math.min(h * 0.30, slot * 0.30);
    var M = 150;

    function seedCurve() {
      var c = [];
      var a1 = 0.34 + Math.random() * 0.18, a2 = 0.22 + Math.random() * 0.16;
      var k1 = 3, k2 = 5, ph = Math.random() * 6.28;
      for (var i = 0; i < M; i++) {
        var th = (i / M) * 6.2832;
        var r = 1 + a1 * Math.sin(k1 * th + ph) + a2 * Math.sin(k2 * th + ph * 1.7);
        c.push([Math.cos(th) * r, Math.sin(th) * r]);
      }
      return c;
    }

    function step(c, amount) {
      var out = [];
      for (var i = 0; i < c.length; i++) {
        var p = c[(i - 1 + c.length) % c.length], q = c[i], n = c[(i + 1) % c.length];
        out.push([q[0] + (p[0] + n[0] - 2 * q[0]) * amount,
                  q[1] + (p[1] + n[1] - 2 * q[1]) * amount]);
      }
      return out;
    }

    var curves = [], raf = 0, tick = 0;
    function reset() {
      curves = [];
      var c = seedCurve();
      for (var s = 0; s < STAGES; s++) {
        curves.push(c.slice());
        for (var k = 0; k < 26; k++) c = step(c, 0.22);
      }
    }
    reset();

    function draw() {
      ctx.clearRect(0, 0, w, h);
      for (var s = 0; s < curves.length; s++) {
        var c = curves[s];
        var ox = slot * (s + 0.5), oy = h / 2;
        var last = s === curves.length - 1;
        ctx.lineWidth = last ? 1.8 : 1.4;
        ctx.strokeStyle = last ? GREEN : "rgba(21,122,67," + (0.30 + 0.13 * s).toFixed(2) + ")";
        ctx.lineJoin = "round";
        ctx.beginPath();
        for (var i = 0; i <= c.length; i++) {
          var p = c[i % c.length];
          var x = ox + p[0] * R, y = oy + p[1] * R;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath(); ctx.stroke();
      }
    }

    function frame() {
      if (++tick % 2 === 0) {
        for (var s = 0; s < curves.length; s++) curves[s] = step(curves[s], 0.055);
      }
      draw();
      if (tick > 900) { tick = 0; reset(); }
      raf = requestAnimationFrame(frame);
    }

    if (REDUCED) { draw(); return { stop: function () {} }; }
    raf = requestAnimationFrame(frame);
    return { stop: function () { cancelAnimationFrame(raf); } };
  }

  /* ------------------------------------------- figure 5 · travelling salesman

     A tour through every city, improved by 2-opt: take two edges, reverse the
     path between them, keep the swap if the tour got shorter. Finding the
     shortest tour is NP-hard, and whether that can ever be done efficiently is
     what P versus NP asks.
     ---------------------------------------------------------------------- */

  function tsp(canvas) {
    var d = fit(canvas), ctx = d.ctx, w = d.w, h = d.h;
    var N = w > 1100 ? 34 : (w > 700 ? 26 : 18);
    var padX = w * 0.06, padY = h * 0.16;
    var seed = 987654321;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

    var cities, tour, raf = 0, settled = 0;

    function build() {
      cities = [];
      for (var i = 0; i < N; i++) {
        cities.push([padX + rnd() * (w - padX * 2), padY + rnd() * (h - padY * 2)]);
      }
      tour = cities.map(function (_, i) { return i; });
      for (var k = tour.length - 1; k > 0; k--) {          // shuffle into a tangle
        var j = Math.floor(rnd() * (k + 1));
        var t = tour[k]; tour[k] = tour[j]; tour[j] = t;
      }
      settled = 0;
    }
    build();

    function dist(a, b) {
      var dx = cities[a][0] - cities[b][0], dy = cities[a][1] - cities[b][1];
      return Math.sqrt(dx * dx + dy * dy);
    }

    /* one 2-opt improvement per call; returns false when none is left */
    function improve() {
      var n = tour.length;
      for (var i = 0; i < n - 1; i++) {
        var a = tour[i], b = tour[(i + 1) % n];
        for (var j = i + 2; j < n; j++) {
          if (i === 0 && j === n - 1) continue;
          var c = tour[j], e = tour[(j + 1) % n];
          if (dist(a, c) + dist(b, e) + 1e-9 < dist(a, b) + dist(c, e)) {
            for (var lo = i + 1, hi = j; lo < hi; lo++, hi--) {
              var t2 = tour[lo]; tour[lo] = tour[hi]; tour[hi] = t2;
            }
            return true;
          }
        }
      }
      return false;
    }

    function paint() {
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1.4; ctx.lineJoin = "round";
      ctx.strokeStyle = settled ? DEEP : "rgba(21,122,67,0.45)";
      ctx.beginPath();
      for (var i = 0; i <= tour.length; i++) {
        var p = cities[tour[i % tour.length]];
        i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
      }
      ctx.stroke();
      for (var k = 0; k < cities.length; k++) {
        ctx.fillStyle = settled ? GREEN : "rgba(15,20,18,0.55)";
        ctx.beginPath(); ctx.arc(cities[k][0], cities[k][1], 2.8, 0, 6.2832); ctx.fill();
      }
    }

    function frame() {
      if (!settled) {
        if (!improve()) { settled = 1; setTimeout(build, 2600); }
      }
      paint();
      raf = requestAnimationFrame(frame);
    }

    if (REDUCED) {
      var guard = 0;
      while (improve() && guard++ < 4000) {}
      settled = 1; paint();
      return { stop: function () {} };
    }
    paint();
    raf = requestAnimationFrame(frame);
    return { stop: function () { cancelAnimationFrame(raf); } };
  }

  /* ------------------------------------------------------- figure wiring */

  var BUILDERS = { zeta: zeta, elliptic: elliptic, flow: flow, shorten: shorten, tsp: tsp };

  Array.prototype.forEach.call(document.querySelectorAll(".band"), function (band) {
    var canvas = band.querySelector("canvas");
    var kind = band.getAttribute("data-fig");
    var build = BUILDERS[kind];
    if (!canvas || !build) return;

    var run = null;
    var lastWidth = 0;

    function start() {
      if (run) return;
      band.classList.add("is-live");
      lastWidth = canvas.getBoundingClientRect().width;
      run = build(canvas);
    }
    function stop() {
      if (!run) return;
      run.stop();
      run = null;
    }

    watchers.push(function (vh) {
      var r = band.getBoundingClientRect();
      var near = r.top < vh + 140 && r.bottom > -140;
      if (near) start(); else stop();
    });

    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        var w = canvas.getBoundingClientRect().width;
        if (!run || Math.abs(w - lastWidth) < 2) return;
        stop();
        start();
      }, 220);
    }, { passive: true });
  });

  /* ------------------------------------------------------- rate bars

     The bars carry their final width in the markup, so the chart is correct
     with no JavaScript at all. The growth is added on top: collapse them at
     load, then restore when the chart scrolls into view. If a transition never
     runs -- a hidden tab freezes them, as it freezes requestAnimationFrame --
     the reader still sees the data rather than seven empty tracks. */

  (function () {
    var fig = document.querySelector(".rates");
    if (!fig) return;
    var bars = Array.prototype.slice.call(fig.querySelectorAll(".rt i"));
    if (!bars.length || REDUCED) return;

    var finals = bars.map(function (b) { return b.style.width; });
    bars.forEach(function (b) { b.style.width = "0%"; });

    var done = false;
    watchers.push(function (vh) {
      if (done) return;
      var r = fig.getBoundingClientRect();
      if (r.top < vh * 0.9 && r.bottom > 0) {
        done = true;
        bars.forEach(function (b, i) {
          b.style.transitionDelay = (i * 80) + "ms";
          b.style.width = finals[i];
        });
        fig.classList.add("is-grown");
      }
    });

    /* Failsafe: if the bars are still collapsed a beat after they should have
       grown, put them straight to their final width. */
    setTimeout(function () {
      if (done) return;
      var r = fig.getBoundingClientRect();
      if (r.top < (window.innerHeight || 0) * 1.5) {
        done = true;
        bars.forEach(function (b, i) { b.style.transition = "none"; b.style.width = finals[i]; });
      }
    }, 4000);
  })();

  /* Kick everything once the layout exists, and again after fonts settle. */
  schedule();
  setTimeout(schedule, 60);
  setTimeout(schedule, 400);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);

  /* ----------------------------------------------------------- waitlist */

  (function () {
    var ENDPOINT = "";
    var FALLBACK = "shayaan@millenniumresearch.ai,ibrahimnmian@gmail.com";

    var form = document.getElementById("wl-form");
    if (!form) return;
    var input = document.getElementById("wl-email");
    var status = document.getElementById("wl-status");
    var button = form.querySelector("button[type=submit]");

    function say(msg, ok) {
      status.textContent = msg;
      status.classList.toggle("ok", ok === true);
      status.classList.toggle("err", ok === false);
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (form.company.value) return;
      var email = input.value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        say("That does not look like an email address.", false);
        input.focus();
        return;
      }
      if (!ENDPOINT) {
        window.location.href = "mailto:" + FALLBACK +
          "?subject=" + encodeURIComponent("Waiting list") +
          "&body=" + encodeURIComponent("Please add " + email + " to the waiting list.");
        say("Opening your mail app to send the request.", true);
        return;
      }
      button.disabled = true;
      say("Adding you...");
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ email: email })
      }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        form.reset();
        say("You are on the list. We will be in touch.", true);
      }).catch(function () {
        say("That did not go through. Email us instead and we will add you by hand.", false);
      }).then(function () {
        button.disabled = false;
      });
    });
  })();

})();
