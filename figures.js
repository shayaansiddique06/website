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

  /* --------------------------------------- figure 1 · sieve of Eratosthenes

     Integers laid out left to right, wrapping into rows. Take each prime in
     turn and strike out its multiples. What survives is the primes.          */

  function sieve(canvas) {
    var d = fit(canvas), ctx = d.ctx, w = d.w, h = d.h;

    var cell = w > 900 ? 13 : (w > 560 ? 11 : 9);
    var rows = Math.max(3, Math.floor((h - 30) / cell));
    var cols = Math.floor((w - 40) / cell);
    var total = rows * cols;
    var x0 = (w - cols * cell) / 2;
    var y0 = (h - rows * cell) / 2 - 4;

    var state = new Uint8Array(total + 2);   // 0 unknown, 1 struck, 2 prime
    var primes = [];
    for (var i = 2; i <= total + 1; i++) {
      if (!state[i]) {
        primes.push(i);
        for (var j = i * i; j <= total + 1; j += i) state[j] = 1;
      }
    }
    state = new Uint8Array(total + 2);        // replay it for the animation
    state[0] = state[1] = 1;

    var pi = 0, mult = 0, raf = 0, tick = 0, done = false;

    function xy(n) {
      var k = n - 2;
      return [x0 + (k % cols) * cell, y0 + Math.floor(k / cols) * cell];
    }

    function paint(active) {
      ctx.clearRect(0, 0, w, h);
      for (var n = 2; n <= total + 1; n++) {
        var p = xy(n);
        if (p[1] > h - 6) break;
        var s = state[n];
        if (s === 1) {
          ctx.fillStyle = "rgba(15,20,18,0.09)";
          ctx.fillRect(p[0] + 1, p[1] + 1, cell - 3, cell - 3);
        } else if (s === 2) {
          ctx.fillStyle = DEEP;
          ctx.fillRect(p[0] + 1, p[1] + 1, cell - 3, cell - 3);
        } else {
          ctx.fillStyle = "rgba(15,20,18,0.24)";
          ctx.fillRect(p[0] + 1, p[1] + 1, cell - 3, cell - 3);
        }
      }
      if (active) {
        var a = xy(active);
        if (a[1] <= h - 6) {
          ctx.fillStyle = GREEN;
          ctx.fillRect(a[0], a[1], cell - 1, cell - 1);
        }
      }
    }

    function advance() {
      if (pi >= primes.length) { done = true; return 0; }
      var p = primes[pi];
      if (mult === 0) { state[p] = 2; mult = p * p; return p; }
      if (mult > total + 1) { pi++; mult = 0; return 0; }
      if (state[mult] !== 2) state[mult] = 1;
      var at = mult;
      mult += p;
      return at;
    }

    function frame() {
      var active = 0;
      var budget = 3 + Math.floor(pi / 2);
      for (var k = 0; k < budget && !done; k++) active = advance() || active;
      paint(active);
      if (!done) raf = requestAnimationFrame(frame);
      else {
        setTimeout(function () {
          state = new Uint8Array(total + 2); state[0] = state[1] = 1;
          pi = 0; mult = 0; done = false;
          raf = requestAnimationFrame(frame);
        }, 2600);
      }
    }

    if (REDUCED) {
      for (var q = 0; q < primes.length; q++) {
        state[primes[q]] = 2;
        for (var m = primes[q] * primes[q]; m <= total + 1; m += primes[q]) {
          if (state[m] !== 2) state[m] = 1;
        }
      }
      paint(0);
      return { stop: function () {} };
    }
    raf = requestAnimationFrame(frame);
    return { stop: function () { cancelAnimationFrame(raf); done = true; } };
  }

  /* -------------------------------------------- figure 2 · Fourier epicycles

     A chain of rotating vectors whose tip traces a closed curve. The radii and
     frequencies below give a clean lobed figure; the trail is the drawing.    */

  function fourier(canvas) {
    var d = fit(canvas), ctx = d.ctx, w = d.w, h = d.h;
    var terms = [
      { r: 1.00, f:  1, p: 0 },
      { r: 0.42, f: -3, p: 0.6 },
      { r: 0.20, f:  5, p: 1.1 },
      { r: 0.11, f: -7, p: 2.2 },
      { r: 0.06, f:  9, p: 0.3 }
    ];
    var scale = Math.min(w, h) * 0.30;
    var cx = w / 2, cy = h / 2;
    var trail = [], t = 0, raf = 0;

    function point(time) {
      var px = cx, py = cy;
      for (var i = 0; i < terms.length; i++) {
        var a = terms[i].f * time + terms[i].p;
        px += Math.cos(a) * terms[i].r * scale;
        py += Math.sin(a) * terms[i].r * scale;
      }
      return [px, py];
    }

    function frame() {
      ctx.clearRect(0, 0, w, h);

      var px = cx, py = cy;
      ctx.lineWidth = 1;
      for (var i = 0; i < terms.length; i++) {
        var a = terms[i].f * t + terms[i].p;
        var nx = px + Math.cos(a) * terms[i].r * scale;
        var ny = py + Math.sin(a) * terms[i].r * scale;
        ctx.strokeStyle = "rgba(15,20,18,0.13)";
        ctx.beginPath();
        ctx.arc(px, py, terms[i].r * scale, 0, 6.2832);
        ctx.stroke();
        ctx.strokeStyle = "rgba(15,20,18,0.30)";
        ctx.beginPath();
        ctx.moveTo(px, py); ctx.lineTo(nx, ny);
        ctx.stroke();
        px = nx; py = ny;
      }

      trail.push([px, py]);
      if (trail.length > 620) trail.shift();

      ctx.lineWidth = 1.6;
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (var k = 0; k < trail.length; k++) {
        if (k === 0) ctx.moveTo(trail[k][0], trail[k][1]);
        else ctx.lineTo(trail[k][0], trail[k][1]);
      }
      ctx.strokeStyle = DEEP;
      ctx.stroke();

      ctx.fillStyle = GREEN;
      ctx.beginPath(); ctx.arc(px, py, 3, 0, 6.2832); ctx.fill();

      t += 0.016;
      raf = requestAnimationFrame(frame);
    }

    if (REDUCED) {
      for (var s = 0; s < 620; s++) trail.push(point(s * 0.016));
      t = 620 * 0.016;
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1.6; ctx.strokeStyle = DEEP; ctx.beginPath();
      trail.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
      ctx.stroke();
      return { stop: function () {} };
    }
    raf = requestAnimationFrame(frame);
    return { stop: function () { cancelAnimationFrame(raf); } };
  }

  /* ------------------------------------------------ figure 3 · Lorenz system

     dx/dt = s(y-x), dy/dt = x(r-z)-y, dz/dt = xy-bz. Two particles start a
     thousandth apart and separate. Projected on the x-z plane.               */

  function lorenz(canvas) {
    var d = fit(canvas), ctx = d.ctx, w = d.w, h = d.h;
    var s = 10, r = 28, b = 8 / 3, dt = 0.0045;
    var A = { x: 0.1, y: 0, z: 0 };
    var B = { x: 0.101, y: 0, z: 0 };
    /* Plotted as x against time rather than as the butterfly. The point of the
       figure is that two nearly identical starts come apart, and divergence
       over time is a shape that suits a band far wider than it is tall. */
    var A2 = { x: 0.1, y: 0, z: 0 };
    var B2 = { x: 0.1001, y: 0, z: 0 };
    var seriesA = [], seriesB = [], raf = 0;
    var span = Math.max(240, Math.round(w));      // one sample per pixel column
    var amp = h * 0.40, mid = h / 2;

    function stepX(p) {
      var dx = s * (p.y - p.x);
      var dy = p.x * (r - p.z) - p.y;
      var dz = p.x * p.y - b * p.z;
      p.x += dx * dt; p.y += dy * dt; p.z += dz * dt;
      return mid - (p.x / 20) * amp;
    }

    function draw(series, colour, width) {
      if (series.length < 2) return;
      var x0 = w - series.length;
      ctx.lineWidth = width;
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.beginPath();
      for (var i = 0; i < series.length; i++) {
        var px = x0 + i, py = series[i];
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = colour;
      ctx.stroke();
    }

    function push(n) {
      for (var k = 0; k < n; k++) {
        for (var q = 0; q < 4; q++) { stepX(A2); stepX(B2); }   // 4 sub-steps
        seriesA.push(stepX(A2));
        seriesB.push(stepX(B2));
      }
      if (seriesA.length > span) seriesA.splice(0, seriesA.length - span);
      if (seriesB.length > span) seriesB.splice(0, seriesB.length - span);
    }

    function paint() {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(15,20,18,0.10)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();
      draw(seriesA, "rgba(15,20,18,0.34)", 1.1);
      draw(seriesB, DEEP, 1.4);
      if (seriesB.length) {
        ctx.fillStyle = GREEN;
        ctx.beginPath();
        ctx.arc(w - 1, seriesB[seriesB.length - 1], 2.6, 0, 6.2832);
        ctx.fill();
      }
    }

    function frame() {
      push(2);
      paint();
      raf = requestAnimationFrame(frame);
    }

    if (REDUCED) { push(span); paint(); return { stop: function () {} }; }
    push(Math.round(span * 0.55));
    raf = requestAnimationFrame(frame);
    return { stop: function () { cancelAnimationFrame(raf); } };
  }

  /* ------------------------------------------- figure 4 · covering system

     Each row is a congruence class a mod m. A column is covered when some row
     claims it. This is the object behind the odd covering paper: the question
     is whether a set of moduli can leave nothing uncovered.                  */

  function covering(canvas) {
    var d = fit(canvas), ctx = d.ctx, w = d.w, h = d.h;
    var mods = [2, 3, 4, 6, 12];
    var offs = [0, 0, 1, 1, 7];
    var rowH = Math.min(20, (h - 34) / (mods.length + 1));
    var cell = Math.max(9, Math.min(15, w / 74));
    var cols = Math.floor((w - 48) / cell);
    var x0 = (w - cols * cell) / 2;
    var y0 = (h - rowH * (mods.length + 1)) / 2 + 2;

    var covered = new Uint8Array(cols);
    var row = 0, col = 0, raf = 0, tick = 0;

    function paint() {
      ctx.clearRect(0, 0, w, h);

      for (var rIdx = 0; rIdx < mods.length; rIdx++) {
        var m = mods[rIdx], a = offs[rIdx];
        var y = y0 + rIdx * rowH;
        for (var c = 0; c < cols; c++) {
          var hit = (c % m) === (a % m);
          var done = rIdx < row || (rIdx === row && c <= col);
          if (!hit) {
            ctx.fillStyle = "rgba(15,20,18,0.05)";
            ctx.fillRect(x0 + c * cell + 1, y + 1, cell - 2, rowH - 3);
          } else {
            ctx.fillStyle = done ? DEEP : "rgba(21,196,106,0.20)";
            ctx.fillRect(x0 + c * cell + 1, y + 1, cell - 2, rowH - 3);
          }
        }
      }

      var yb = y0 + mods.length * rowH + 4;
      for (var c2 = 0; c2 < cols; c2++) {
        ctx.fillStyle = covered[c2] ? GREEN : "rgba(15,20,18,0.10)";
        ctx.fillRect(x0 + c2 * cell + 1, yb, cell - 2, 3);
      }
    }

    function advance() {
      var m = mods[row], a = offs[row];
      if ((col % m) === (a % m)) covered[col] = 1;
      col++;
      if (col >= cols) { col = 0; row++; }
      if (row >= mods.length) { row = 0; col = 0; covered = new Uint8Array(cols); }
    }

    function frame() {
      if (++tick % 3 === 0) { advance(); paint(); }
      raf = requestAnimationFrame(frame);
    }

    if (REDUCED) {
      row = mods.length; col = cols;
      for (var c = 0; c < cols; c++) {
        for (var i = 0; i < mods.length; i++) {
          if ((c % mods[i]) === (offs[i] % mods[i])) covered[c] = 1;
        }
      }
      row = mods.length - 1; col = cols - 1;
      paint();
      return { stop: function () {} };
    }
    paint();
    raf = requestAnimationFrame(frame);
    return { stop: function () { cancelAnimationFrame(raf); } };
  }

  /* ------------------------------------------------------- figure wiring */

  var BUILDERS = { spiral: sieve, sieve: sieve, fourier: fourier, lorenz: lorenz, covering: covering };

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
