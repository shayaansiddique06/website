/* ==========================================================================
   Millennium Research — zeta.js
   Two mathematical canvases, no dependencies.

   1. Hero: the zeta spiral. Partial sums S_N(t) = Σ n^(-1/2 - it) traced in
      the complex plane while t drifts upward along the critical line. Each
      term rotates faster than the last, so the path curls into nested
      spirals that unwind as t moves — the actual geometry of ζ(1/2 + it).

   2. Dividers: the critical line. A horizontal rule ticked at the imaginary
      parts of the first nontrivial zeros, each tick pulsing once when the
      divider scrolls into view.

   Honors prefers-reduced-motion: the spiral renders one static frame and
   the ticks appear without animation.
   ========================================================================== */

(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  /* --------------------------- 1. zeta spiral ----------------------------- */

  function initSpiral() {
    var canvas = document.getElementById("zeta-spiral");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");

    var TERMS = 220;          // partial-sum length
    var t = 14.134725;        // start at the first zero, for the mythology
    var SPEED = 0.0035;       // dt per frame
    var running = true;

    // Precomputed per-term values, refreshed when t changes.
    var logn = new Float64Array(TERMS + 1);
    var invsqrt = new Float64Array(TERMS + 1);
    for (var n = 1; n <= TERMS; n++) {
      logn[n] = Math.log(n);
      invsqrt[n] = 1 / Math.sqrt(n);
    }

    function pathPoints(tv) {
      // Returns the walk of partial sums of n^(-1/2) * e^(-i t ln n).
      var pts = new Array(TERMS + 1);
      var re = 0, im = 0;
      pts[0] = [0, 0];
      for (var n = 1; n <= TERMS; n++) {
        var ang = -tv * logn[n];
        re += invsqrt[n] * Math.cos(ang);
        im += invsqrt[n] * Math.sin(ang);
        pts[n] = [re, im];
      }
      return pts;
    }

    function draw() {
      var w = canvas.getBoundingClientRect().width;
      var h = canvas.getBoundingClientRect().height;
      if (!w || !h) return;

      ctx.clearRect(0, 0, w, h);

      var pts = pathPoints(t);

      // Fit: center on the walk's bounding box so the whole figure — drift
      // arm and curling head together — sits as one balanced object.
      var head = pts[TERMS];
      var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
      for (var i = 0; i <= TERMS; i++) {
        if (pts[i][0] < minX) minX = pts[i][0];
        if (pts[i][0] > maxX) maxX = pts[i][0];
        if (pts[i][1] < minY) minY = pts[i][1];
        if (pts[i][1] > maxY) maxY = pts[i][1];
      }
      var span = Math.max(maxX - minX, maxY - minY, 0.75);
      // The figure claims ~55% of the shorter viewport side.
      var scale = (Math.min(w, h) * 0.55) / span;
      // Sit the spiral in the right third on wide screens, center on narrow.
      var anchorX = w > 820 ? w * 0.72 : w * 0.5;
      var cx = anchorX - ((minX + maxX) / 2) * scale;
      var cy = h * 0.5 + ((minY + maxY) / 2) * scale;

      // Trail: age-cubed alpha — the early drift arm stays a whisper, the
      // curling head carries the light.
      ctx.lineWidth = 1.6;
      ctx.lineCap = "round";
      for (var n = 1; n <= TERMS; n++) {
        var a = n / TERMS;
        ctx.strokeStyle = "rgba(33,196,106," + (0.05 + 0.8 * a * a * a) + ")";
        ctx.beginPath();
        ctx.moveTo(cx + pts[n - 1][0] * scale, cy - pts[n - 1][1] * scale);
        ctx.lineTo(cx + pts[n][0] * scale, cy - pts[n][1] * scale);
        ctx.stroke();
      }

      // The head: a brighter point with a soft halo where the sum lands.
      var hx = cx + head[0] * scale, hy = cy - head[1] * scale;
      ctx.fillStyle = "rgba(59,227,138,0.18)";
      ctx.beginPath();
      ctx.arc(hx, hy, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(59,227,138,0.95)";
      ctx.beginPath();
      ctx.arc(hx, hy, 3, 0, Math.PI * 2);
      ctx.fill();

      // Origin marker: where ζ would sit if the sum vanished (a zero).
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    function frame() {
      if (!running) return;
      t += SPEED;
      draw();
      requestAnimationFrame(frame);
    }

    function boot() {
      if (!sizeCanvas(canvas)) return;
      draw();
      if (!reduceMotion) requestAnimationFrame(frame);
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

  /* ------------------------- 2. critical-line dividers -------------------- */

  // Imaginary parts of the first nontrivial zeros of ζ.
  var ZEROS = [14.1347, 21.0220, 25.0109, 30.4249, 32.9351, 37.5862,
               40.9187, 43.3271, 48.0052, 49.7738, 52.9703, 56.4462];

  function initDividers() {
    var divs = document.querySelectorAll(".zeta-divider");
    if (!divs.length) return;

    divs.forEach(function (el) {
      var svgNS = "http://www.w3.org/2000/svg";
      var svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("viewBox", "0 0 600 24");
      svg.setAttribute("preserveAspectRatio", "none");
      svg.setAttribute("aria-hidden", "true");

      var line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", "0"); line.setAttribute("x2", "600");
      line.setAttribute("y1", "12"); line.setAttribute("y2", "12");
      line.setAttribute("class", "zd-line");
      svg.appendChild(line);

      var span = ZEROS[ZEROS.length - 1] - ZEROS[0];
      ZEROS.forEach(function (z, i) {
        var x = 30 + 540 * (z - ZEROS[0]) / span;
        var tick = document.createElementNS(svgNS, "line");
        tick.setAttribute("x1", x); tick.setAttribute("x2", x);
        tick.setAttribute("y1", "5"); tick.setAttribute("y2", "19");
        tick.setAttribute("class", "zd-tick");
        tick.style.transitionDelay = (reduceMotion ? 0 : i * 70) + "ms";
        svg.appendChild(tick);
      });

      el.appendChild(svg);

      var label = document.createElement("span");
      label.className = "zd-label";
      label.textContent = "Re(s) = 1/2";
      el.appendChild(label);
    });

    if ("IntersectionObserver" in window) {
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
     Fourteen elements, no rAF, negligible cost. Self-removes when done.
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
