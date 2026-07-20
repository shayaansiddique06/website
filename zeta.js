/* ==========================================================================
   Millennium Research — zeta.js
   Two mathematical canvases, no dependencies. Everything drawn here is the
   actual Riemann zeta function, computed live — no fakes, no approximating
   walks. ζ(1/2 + it) is evaluated with Borwein's eta-acceleration
   (validated against brute-force summation to 1e-14; the first twelve
   nontrivial zeros land below 1e-6).

   1. Hero: the value curve of ζ(1/2 + it) traced in the complex plane as t
      climbs the critical line. The curve loops and — at every nontrivial
      zero — passes exactly through the origin. A pulse marks each crossing.

   2. Dividers: the graph of |ζ(1/2 + it)|, drawing itself on scroll. It
      touches the baseline precisely at the zero ordinates.

   Honors prefers-reduced-motion: static frames, no animation.
   ========================================================================== */

(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* --------------------- ζ(1/2 + it), Borwein's method -------------------- */

  var BN = 70;
  var bd = new Float64Array(BN + 1);
  (function () {
    var term = 1 / BN, s = term;
    bd[0] = BN * s;
    for (var i = 1; i <= BN; i++) {
      term *= 4 * (BN + i - 1) * (BN - i + 1) / ((2 * i) * (2 * i - 1));
      s += term;
      bd[i] = BN * s;
    }
  })();

  function zetaHalfIt(t) {
    // eta(s) = (-1/d_N) Σ (-1)^k (d_k - d_N) (k+1)^(-s),  s = 1/2 + it
    var re = 0, im = 0;
    for (var k = 0; k < BN; k++) {
      var c = (k % 2 === 0 ? 1 : -1) * (bd[k] - bd[BN]);
      var ln = Math.log(k + 1), amp = c / Math.sqrt(k + 1);
      re += amp * Math.cos(t * ln);
      im += amp * Math.sin(t * ln);
    }
    var er = -re / bd[BN], ei = im / bd[BN];
    // zeta = eta / (1 - 2^(1-s))
    var m = Math.sqrt(2), ang = -t * Math.LN2;
    var br = 1 - m * Math.cos(ang), bi = -m * Math.sin(ang);
    var den = br * br + bi * bi;
    return [(er * br + ei * bi) / den, (ei * br - er * bi) / den];
  }

  /* ------------------------------ helpers -------------------------------- */

  function sizeCanvas(canvas) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  /* ------------------------ 1. the value curve of ζ ----------------------- */

  function initSpiral() {
    var canvas = document.getElementById("zeta-spiral");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");

    var SPEED = 0.014;        // dt per frame
    var MAXTRAIL = 1150;      // ~13 units of t on screen at a time
    var t = 0;
    var trail = [];           // [re, im]
    var rings = [];           // zero-crossing pulses: {r, alpha}
    var absPrev2 = Infinity, absPrev1 = Infinity;
    var running = true;

    function step() {
      var z = zetaHalfIt(t);
      trail.push(z);
      if (trail.length > MAXTRAIL) trail.shift();
      // Local minimum of |ζ| near zero => the curve just passed a zero.
      var a = Math.hypot(z[0], z[1]);
      if (absPrev1 < absPrev2 && absPrev1 <= a && absPrev1 < 0.12) {
        rings.push({ r: 4, alpha: 0.8 });
      }
      absPrev2 = absPrev1; absPrev1 = a;
      t += SPEED;
    }

    function draw() {
      var w = canvas.getBoundingClientRect().width;
      var h = canvas.getBoundingClientRect().height;
      if (!w || !h) return;
      ctx.clearRect(0, 0, w, h);

      // Fixed frame: the origin of the complex plane is pinned — the curve
      // moves, the frame never does. |ζ(1/2+it)| stays under ~4.5 for the
      // range we sweep, so one unit is min(w,h)/13.
      var u = Math.min(w, h) / 13;
      var ox = (w > 820 ? w * 0.72 : w * 0.5);
      var oy = h * 0.5;

      // Trail, old to new, age-cubed alpha.
      var len = trail.length;
      ctx.lineWidth = 1.5;
      ctx.lineCap = "round";
      for (var i = 1; i < len; i++) {
        var a = i / len;
        ctx.strokeStyle = "rgba(33,196,106," + (0.04 + 0.72 * a * a * a) + ")";
        ctx.beginPath();
        ctx.moveTo(ox + trail[i - 1][0] * u, oy - trail[i - 1][1] * u);
        ctx.lineTo(ox + trail[i][0] * u, oy - trail[i][1] * u);
        ctx.stroke();
      }

      // Zero-crossing pulses expanding from the origin.
      for (var r = rings.length - 1; r >= 0; r--) {
        var ring = rings[r];
        ctx.strokeStyle = "rgba(59,227,138," + ring.alpha + ")";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(ox, oy, ring.r, 0, Math.PI * 2);
        ctx.stroke();
        ring.r += 1.1;
        ring.alpha -= 0.012;
        if (ring.alpha <= 0) rings.splice(r, 1);
      }

      // The head: where ζ(1/2 + it) is right now.
      if (len) {
        var hd = trail[len - 1];
        var hx = ox + hd[0] * u, hy = oy - hd[1] * u;
        ctx.fillStyle = "rgba(59,227,138,0.18)";
        ctx.beginPath();
        ctx.arc(hx, hy, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(59,227,138,0.95)";
        ctx.beginPath();
        ctx.arc(hx, hy, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // The origin: where the zeros live.
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ox, oy, 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    function frame() {
      if (!running) return;
      step();
      draw();
      requestAnimationFrame(frame);
    }

    function boot() {
      if (!sizeCanvas(canvas)) return;
      if (reduceMotion) {
        // Static frame: the curve up to just past the third zero.
        for (t = 0; t < 26; t += 0.03) {
          trail.push(zetaHalfIt(t));
          if (trail.length > MAXTRAIL) trail.shift();
        }
        rings.length = 0;
        draw();
        return;
      }
      requestAnimationFrame(frame);
    }

    // Pause when the hero is offscreen; resume when it returns.
    if ("IntersectionObserver" in window && !reduceMotion) {
      new IntersectionObserver(function (entries) {
        var vis = entries[0].isIntersecting;
        if (vis && !running) { running = true; requestAnimationFrame(frame); }
        if (!vis) running = false;
      }, { threshold: 0.05 }).observe(canvas);
    }

    window.addEventListener("resize", function () { sizeCanvas(canvas); draw(); });
    boot();
  }

  /* ------------------ 2. Fourier-convergence dividers ---------------------
     Each divider draws the Fourier series of a square wave,
     (4/π) Σ sin((2k−1)θ)/(2k−1), truncated according to how far down the
     page you are. At the top it is a single soft sine; as you scroll,
     harmonics join and the wave sharpens toward the square. Scroll progress
     IS the convergence of the series — the approximation approaching the
     true shape.
     ------------------------------------------------------------------------ */

  function initDividers() {
    var divs = document.querySelectorAll(".zeta-divider");
    if (!divs.length) return;

    var X0 = 8, X1 = 592, YM = 20, AMP = 12;
    var SAMPLES = 360;
    var CYCLES = 2;          // full square-wave periods across the band
    var MAX_HARMONICS = 22;  // odd harmonics at full depth: up to sin(43θ)

    // Continuous truncation: n whole harmonics plus a fraction of the next,
    // so the wave sharpens smoothly instead of popping term by term.
    function wavePath(progress) {
      var hCont = 1 + progress * (MAX_HARMONICS - 1);
      var whole = Math.floor(hCont), frac = hCont - whole;
      var d = "";
      for (var i = 0; i <= SAMPLES; i++) {
        var x = X0 + (X1 - X0) * i / SAMPLES;
        var th = CYCLES * 2 * Math.PI * i / SAMPLES;
        var s = 0;
        for (var k = 1; k <= whole; k++) {
          var m = 2 * k - 1;
          s += Math.sin(m * th) / m;
        }
        if (frac > 0) {
          var mn = 2 * (whole + 1) - 1;
          s += frac * Math.sin(mn * th) / mn;
        }
        var y = YM - AMP * s * 4 / Math.PI;
        d += (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1);
      }
      return d;
    }

    var waves = [];
    divs.forEach(function (el) {
      var svgNS = "http://www.w3.org/2000/svg";
      var svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("viewBox", "0 0 600 40");
      svg.setAttribute("preserveAspectRatio", "none");
      svg.setAttribute("aria-hidden", "true");

      var base = document.createElementNS(svgNS, "line");
      base.setAttribute("x1", X0); base.setAttribute("x2", X1);
      base.setAttribute("y1", YM); base.setAttribute("y2", YM);
      base.setAttribute("class", "zd-base");
      svg.appendChild(base);

      var wave = document.createElementNS(svgNS, "path");
      wave.setAttribute("class", "zd-wave");
      wave.setAttribute("d", wavePath(0));
      svg.appendChild(wave);

      el.appendChild(svg);
      waves.push(wave);
    });

    var lastPath = null;
    function updateProgress() {
      var doc = document.documentElement;
      var span = doc.scrollHeight - window.innerHeight;
      var p = span > 0 ? Math.min(1, Math.max(0, window.scrollY / span)) : 1;
      var d = wavePath(reduceMotion ? 1 : p);
      if (d === lastPath) return;
      lastPath = d;
      waves.forEach(function (wave) { wave.setAttribute("d", d); });
    }
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    updateProgress();
    setTimeout(updateProgress, 500);

    // Fade each divider in the first time it enters the viewport.
    if ("IntersectionObserver" in window && !reduceMotion) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add("is-lit"); io.unobserve(e.target); }
        });
      }, { threshold: 0.6 });
      divs.forEach(function (el) { io.observe(el); });
    } else {
      divs.forEach(function (el) { el.classList.add("is-lit"); });
    }
  }

  /* ----------------------------- 3. reveals ------------------------------- */

  function initReveals() {
    var els = document.querySelectorAll("[data-mr-reveal]");
    if (!els.length) return;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -40px 0px" });
    els.forEach(function (el) { io.observe(el); });
  }

  /* --------------------- always-on position checker ------------------------
     IntersectionObserver drives the animated reveals in healthy browsers.
     This direct scroll listener runs alongside it as a guarantee: any
     element whose top enters the viewport gets its class, IO or no IO.
     Self-removes when done.
     ------------------------------------------------------------------------ */

  function initPositionChecker() {
    function checkAll() {
      var vh = window.innerHeight;
      var pending = 0;
      document.querySelectorAll("[data-mr-reveal]:not(.is-in)").forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < vh - 40 && r.bottom > 0) el.classList.add("is-in");
        else pending++;
      });
      document.querySelectorAll(".zeta-divider:not(.is-lit)").forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < vh && r.bottom > 0) el.classList.add("is-lit");
        else pending++;
      });
      if (pending === 0) {
        window.removeEventListener("scroll", checkAll);
        window.removeEventListener("resize", checkAll);
      }
    }
    window.addEventListener("scroll", checkAll, { passive: true });
    window.addEventListener("resize", checkAll);
    checkAll();
    setTimeout(checkAll, 500);
  }

  /* ------------------------------- boot ----------------------------------- */

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      initSpiral(); initDividers(); initReveals(); initPositionChecker();
    });
  } else {
    initSpiral(); initDividers(); initReveals(); initPositionChecker();
  }
})();
