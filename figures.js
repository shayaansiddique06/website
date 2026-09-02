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

     y^2 = x^3 + ax + b, and the chord-and-tangent group law that makes its
     points a group. Birch and Swinnerton-Dyer is a question about how many
     rational points that group contains.
     ---------------------------------------------------------------------- */

  function elliptic(canvas) {
    var d = fit(canvas), ctx = d.ctx, w = d.w, h = d.h;
    var a = -2, b = 2.6;
    var xMin = -2.1, xMax = 3.4;
    var sy = (h * 0.40) / 5.2;
    var sx = Math.min(sy * 3.4, (w * 0.72) / (xMax - xMin));
    var cx = w / 2, cy = h / 2;

    function px(x) { return cx + (x - (xMin + xMax) / 2) * sx; }
    function py(y) { return cy - y * sy; }
    function f(x)  { return x * x * x + a * x + b; }

    var upper = [], lower = [];
    for (var x = xMin; x <= xMax; x += 0.006) {
      var v = f(x);
      if (v < 0) continue;
      var r = Math.sqrt(v);
      upper.push([px(x), py(r)]); lower.push([px(x), py(-r)]);
    }

    function onCurve(x) { return [x, Math.sqrt(Math.max(f(x), 0))]; }
    var P = onCurve(-1.4), Q = onCurve(0.35);

    function add(p, q) {
      var m = (q[1] - p[1]) / (q[0] - p[0]);
      var xr = m * m - p[0] - q[0];
      var yr = m * (xr - p[0]) + p[1];
      return { r: [xr, yr], sum: [xr, -yr], m: m };
    }

    var phase = 0, tAnim = 0, raf = 0, res = add(P, Q);

    function curve() {
      ctx.strokeStyle = "rgba(15,20,18,0.30)";
      ctx.lineWidth = 1.5; ctx.lineJoin = "round";
      ctx.beginPath();
      upper.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
      ctx.stroke();
      ctx.beginPath();
      lower.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
      ctx.stroke();
    }
    function dot(pt, colour, r) {
      ctx.fillStyle = colour;
      ctx.beginPath(); ctx.arc(px(pt[0]), py(pt[1]), r || 3.2, 0, 6.2832); ctx.fill();
    }

    function paint() {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(15,20,18,0.08)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();
      curve();

      dot(P, DEEP); dot(Q, DEEP);

      if (phase >= 1) {
        var g = Math.min(tAnim, 1);
        var x1 = P[0], y1 = P[1];
        var x2 = x1 + (res.r[0] - x1) * (phase >= 2 ? 1 : g);
        var y2 = y1 + (res.r[1] - y1) * (phase >= 2 ? 1 : g);
        ctx.strokeStyle = "rgba(21,122,67,0.55)"; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(px(x1), py(y1)); ctx.lineTo(px(x2), py(y2)); ctx.stroke();
      }
      if (phase >= 2) {
        dot(res.r, "rgba(15,20,18,0.45)", 2.8);
        var g2 = Math.min(tAnim, 1);
        var yv = res.r[1] + (res.sum[1] - res.r[1]) * (phase >= 3 ? 1 : g2);
        ctx.strokeStyle = "rgba(21,196,106,0.5)";
        ctx.setLineDash([3, 3]); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(px(res.r[0]), py(res.r[1]));
        ctx.lineTo(px(res.r[0]), py(yv)); ctx.stroke();
        ctx.setLineDash([]);
      }
      if (phase >= 3) dot(res.sum, GREEN, 3.6);
    }

    function frame() {
      tAnim += 0.022;
      if (tAnim >= 1.35) {
        tAnim = 0; phase++;
        if (phase > 4) {
          phase = 0;
          P = res.sum[1] > -4 && Math.abs(res.sum[0]) < 3 ? [res.sum[0], -res.sum[1]] : onCurve(-1.4);
          Q = onCurve(0.35 + (Math.abs(P[0]) % 0.9) * 0.5);
          res = add(P, Q);
          if (!isFinite(res.sum[0]) || !isFinite(res.sum[1])) { P = onCurve(-1.4); Q = onCurve(0.35); res = add(P, Q); }
        }
      }
      paint();
      raf = requestAnimationFrame(frame);
    }

    if (REDUCED) { phase = 3; tAnim = 1; paint(); return { stop: function () {} }; }
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

  /* ------------------------------------------------------- figure wiring */

  var BUILDERS = { zeta: zeta, elliptic: elliptic, flow: flow, shorten: shorten };

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

     The bars ship at width 0 and grow to their data-w when the figure comes
     into view, so the chart reads as a measurement being taken rather than a
     static graphic. Reduced motion gets the final widths immediately. */

  (function () {
    var fig = document.querySelector(".rates");
    if (!fig) return;
    var bars = Array.prototype.slice.call(fig.querySelectorAll(".rb"));
    if (!bars.length) return;

    function grow() {
      bars.forEach(function (b, i) {
        b.style.transitionDelay = (i * 70) + "ms";
        b.setAttribute("width", b.getAttribute("data-w"));
      });
    }
    if (REDUCED) {
      bars.forEach(function (b) {
        b.style.transition = "none";
        b.setAttribute("width", b.getAttribute("data-w"));
      });
      return;
    }
    var done = false;
    watchers.push(function (vh) {
      if (done) return;
      var r = fig.getBoundingClientRect();
      if (r.top < vh * 0.88 && r.bottom > 0) { done = true; grow(); }
    });
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
