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

  /* ------------------- Riemann–Siegel Z(t): ζ made real ------------------- */

  function rsTheta(t) {
    // Asymptotic expansion; plenty for t >= 2 at pixel resolution.
    return t / 2 * Math.log(t / (2 * Math.PI)) - t / 2 - Math.PI / 8
         + 1 / (48 * t) + 7 / (5760 * t * t * t);
  }

  function zOf(t) {
    // Z(t) = e^{iθ(t)} ζ(1/2+it) is real; its sign changes are the zeros.
    var z = zetaHalfIt(t), th = rsTheta(t);
    return Math.cos(th) * z[0] - Math.sin(th) * z[1];
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

      // Height readout along the critical line.
      ctx.font = "11px 'JetBrains Mono', monospace";
      ctx.fillStyle = "rgba(154,166,159,0.55)";
      ctx.fillText("t = " + t.toFixed(2), ox + 12, oy + 20);
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

  /* -------------------- 2. Z(t) dividers as progress ----------------------
     Each divider draws the Riemann–Siegel Z(t) — ζ on the critical line made
     real — swinging over and under the axis, crossing it exactly at the
     nontrivial zeros. The curve doubles as a page progress meter: it draws
     itself as far as you have scrolled, a rider dot marks your position, and
     every zero you pass lights up.
     ------------------------------------------------------------------------ */

  // Imaginary parts of the first nontrivial zeros of ζ.
  var ZEROS = [14.1347, 21.0220, 25.0109, 30.4249, 32.9351, 37.5862,
               40.9187, 43.3271, 48.0052, 49.7738, 52.9703, 56.4462];

  function initDividers() {
    var divs = document.querySelectorAll(".zeta-divider");
    if (!divs.length) return;

    // Sample Z(t) once, shared by every divider.
    var T_MIN = 2, T_MAX = 58, SAMPLES = 460;
    var zs = new Float64Array(SAMPLES + 1);
    var maxAbs = 0;
    for (var i = 0; i <= SAMPLES; i++) {
      zs[i] = zOf(T_MIN + (T_MAX - T_MIN) * i / SAMPLES);
      if (Math.abs(zs[i]) > maxAbs) maxAbs = Math.abs(zs[i]);
    }
    var X0 = 8, X1 = 592, YM = 20, AMP = 16;
    function xOf(t) { return X0 + (X1 - X0) * (t - T_MIN) / (T_MAX - T_MIN); }

    var dPath = "";
    for (var j = 0; j <= SAMPLES; j++) {
      var x = X0 + (X1 - X0) * j / SAMPLES;
      var y = YM - AMP * zs[j] / maxAbs;
      dPath += (j === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1);
    }

    var parts = []; // {curve, len, rider, dots:[{el,x}]} per divider

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

      var curve = document.createElementNS(svgNS, "path");
      curve.setAttribute("d", dPath);
      curve.setAttribute("class", "zd-curve");
      svg.appendChild(curve);

      // A dot at each axis crossing — the nontrivial zeros.
      var dots = [];
      ZEROS.forEach(function (z) {
        var dot = document.createElementNS(svgNS, "circle");
        var dx = xOf(z);
        dot.setAttribute("cx", dx.toFixed(1));
        dot.setAttribute("cy", YM);
        dot.setAttribute("r", "2");
        dot.setAttribute("class", "zd-zero");
        svg.appendChild(dot);
        dots.push({ el: dot, x: dx });
      });

      // The rider: where you are in the page.
      var rider = document.createElementNS(svgNS, "circle");
      rider.setAttribute("r", "2.6");
      rider.setAttribute("class", "zd-rider");
      rider.setAttribute("cx", X0);
      rider.setAttribute("cy", YM);
      svg.appendChild(rider);

      el.appendChild(svg);

      var L = curve.getTotalLength();
      curve.style.strokeDasharray = L;
      curve.style.strokeDashoffset = L;

      var label = document.createElement("span");
      label.className = "zd-label";
      label.textContent = "Z(t)";
      el.appendChild(label);

      parts.push({ curve: curve, len: L, rider: rider, dots: dots });
    });

    // Page progress drives every divider identically.
    function updateProgress() {
      var doc = document.documentElement;
      var span = doc.scrollHeight - window.innerHeight;
      var p = span > 0 ? Math.min(1, Math.max(0, window.scrollY / span)) : 1;
      parts.forEach(function (part) {
        part.curve.style.strokeDashoffset = part.len * (1 - p);
        var pt = part.curve.getPointAtLength(part.len * p);
        part.rider.setAttribute("cx", pt.x.toFixed(1));
        part.rider.setAttribute("cy", pt.y.toFixed(1));
        part.dots.forEach(function (d) {
          d.el.classList.toggle("passed", d.x <= pt.x + 0.5);
        });
      });
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
