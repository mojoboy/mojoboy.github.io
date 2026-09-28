/* David Babafemi · portfolio interactions.
   Everything here is an enhancement: without JavaScript (or with reduced motion)
   the page shows all of its content, just without the motion. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var raf = window.requestAnimationFrame.bind(window);

  function wait(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  /* ------------------------------------------------ intro curtain, then the hero plays */
  var markLoaded;
  var loaded = new Promise(function (resolve) { markLoaded = resolve; });
  var fontsReady = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, wait(1800)]) : Promise.resolve();

  var started = false;
  function start() {
    if (started) return;
    started = true;
    root.classList.add('loaded');
    try { sessionStorage.setItem('intro-seen', '1'); } catch (e) { /* private mode: show the intro again next time */ }
    markLoaded();
    var loader = document.querySelector('.loader');
    if (loader) setTimeout(function () { loader.remove(); }, 1300);
  }

  var counter = document.querySelector('[data-loader-count]');
  setTimeout(start, 3000);  // never keep the page behind the curtain, even if animation frames are paused
  if (root.classList.contains('no-intro') || !counter) {
    fontsReady.then(function () { setTimeout(start, 30); });
  } else {
    var t0 = performance.now();
    var duration = 1000;
    (function tick(now) {
      var p = clamp((now - t0) / duration, 0, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      counter.textContent = String(Math.round(eased * 100)).padStart(2, '0');
      if (p < 1) raf(tick);
      else fontsReady.then(function () { setTimeout(start, 140); });
    })(t0);
  }

  /* ------------------------------------------------ smooth scrolling */
  var lenis = null;
  if (!reduce && typeof window.Lenis === 'function') {
    try {
      lenis = new window.Lenis({ autoRaf: true, lerp: 0.095, anchors: { offset: -80 } });
    } catch (e) { lenis = null; }
  }

  /* ------------------------------------------------ stagger groups */
  document.querySelectorAll('[data-stagger]').forEach(function (group) {
    Array.prototype.forEach.call(group.querySelectorAll('.reveal'), function (el, i) {
      el.style.setProperty('--d', (i * 90) + 'ms');
    });
  });

  /* ------------------------------------------------ count-ups */
  function countUp(el) {
    var target = Number(el.getAttribute('data-count'));
    var format = function (n) { return n.toLocaleString('en-US'); };
    if (reduce || !target) { el.textContent = format(target); return; }
    var begin = performance.now();
    var length = 1700;
    (function step(now) {
      var p = clamp((now - begin) / length, 0, 1);
      var eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      el.textContent = format(Math.round(target * eased));
      if (p < 1) raf(step);
    })(begin);
  }
  document.querySelectorAll('[data-count]').forEach(function (el) {
    if (!reduce) el.textContent = '0';
  });

  /* ------------------------------------------------ scroll reveals */
  var revealTargets = document.querySelectorAll('.reveal, [data-count]');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        io.unobserve(el);
        loaded.then(function () {
          el.classList.add('in');
          if (el.hasAttribute('data-count')) setTimeout(function () { countUp(el); }, 250);
        });
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealTargets.forEach(function (el) { io.observe(el); });
  } else {
    revealTargets.forEach(function (el) {
      el.classList.add('in');
      if (el.hasAttribute('data-count')) el.textContent = Number(el.getAttribute('data-count')).toLocaleString('en-US');
    });
  }

  /* ------------------------------------------------ marquees: steady drift, faster (and reversible) with scroll */
  var marquees = [];
  document.querySelectorAll('[data-marquee]').forEach(function (track) {
    Array.prototype.slice.call(track.children).forEach(function (node) {
      var copy = node.cloneNode(true);
      copy.setAttribute('aria-hidden', 'true');
      track.appendChild(copy);
    });
    if (reduce) return;
    var m = {
      track: track, x: 0, half: 0, visible: true,
      speed: Number(track.getAttribute('data-speed') || 50),
      dir: track.hasAttribute('data-reverse') ? 1 : -1
    };
    m.base = m.dir;
    if (m.dir === 1) m.x = -1;  // start mid-loop so the reversed band isn't empty on the left
    marquees.push(m);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) { m.visible = entries[0].isIntersecting; }).observe(track.parentElement);
    }
  });
  function measureMarquees() { marquees.forEach(function (m) { m.half = m.track.scrollWidth / 2; if (m.x === -1) m.x = -m.half / 2; }); }
  measureMarquees();
  window.addEventListener('resize', measureMarquees);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureMarquees);
  if (marquees.length) {
    var last = performance.now();
    (function frame(now) {
      var dt = Math.min(64, now - last) / 1000;
      last = now;
      var velocity = lenis ? lenis.velocity : 0;
      marquees.forEach(function (m) {
        if (!m.visible || !m.half) return;
        if (Math.abs(velocity) > 0.3) m.dir = velocity > 0 ? m.base : -m.base;
        var speed = m.speed + Math.min(700, Math.abs(velocity) * 22);
        m.x += m.dir * speed * dt;
        if (m.x <= -m.half) m.x += m.half;
        if (m.x > 0) m.x -= m.half;
        m.track.style.transform = 'translate3d(' + m.x.toFixed(2) + 'px,0,0)';
      });
      raf(frame);
    })(last);
  }

  /* ------------------------------------------------ scroll-linked: progress bar, nav, timeline, parallax */
  var nav = document.querySelector('[data-nav]');
  var bar = document.querySelector('.progress');
  var timeline = document.querySelector('[data-timeline]');
  var floats = document.querySelectorAll('[data-parallax]');
  var lastY = window.scrollY;
  var ticking = false;

  function onScroll() {
    ticking = false;
    var y = window.scrollY;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.transform = 'scaleX(' + (max > 0 ? clamp(y / max, 0, 1) : 0).toFixed(4) + ')';
    if (nav) {
      nav.classList.toggle('scrolled', y > 40);
      if (Math.abs(y - lastY) > 4) nav.classList.toggle('hidden', y > lastY && y > 480);
    }
    lastY = y;
    if (timeline) {
      var r = timeline.getBoundingClientRect();
      var p = clamp((window.innerHeight * 0.7 - r.top) / r.height, 0, 1);
      timeline.style.setProperty('--fill', p.toFixed(3));
    }
    if (!reduce) {
      floats.forEach(function (el) {
        var box = el.getBoundingClientRect();
        var offset = box.top + box.height / 2 - window.innerHeight / 2;
        var shift = clamp(-offset * Number(el.getAttribute('data-parallax')), -60, 60);
        el.style.setProperty('--parallax', shift.toFixed(1) + 'px');
      });
    }
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; raf(onScroll); }
  }, { passive: true });
  onScroll();

  /* ------------------------------------------------ nav: highlight the section on screen */
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav-links a'));
  if ('IntersectionObserver' in window && links.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id); });  // the intro matches no link, so it clears them
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['intro', 'work', 'experience', 'skills', 'contact'].forEach(function (id) {
      var section = document.getElementById(id);
      if (section) spy.observe(section);
    });
  }

  /* ------------------------------------------------ pointer effects (mouse and trackpad only) */
  if (finePointer && !reduce) {
    var glow = document.querySelector('.glow');
    var label = document.querySelector('.cursor-label');
    var labelText = label && label.querySelector('span');
    var pointer = { x: window.innerWidth / 2, y: window.innerHeight / 3 };
    var glowPos = { x: pointer.x, y: pointer.y };
    var labelPos = { x: pointer.x, y: pointer.y };
    var moving = false;

    window.addEventListener('pointermove', function (e) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      if (glow) glow.classList.add('on');
      if (!moving) { moving = true; raf(follow); }
    }, { passive: true });

    function follow() {
      glowPos.x += (pointer.x - glowPos.x) * 0.1;
      glowPos.y += (pointer.y - glowPos.y) * 0.1;
      labelPos.x += (pointer.x - labelPos.x) * 0.22;
      labelPos.y += (pointer.y - labelPos.y) * 0.22;
      if (glow) glow.style.transform = 'translate3d(' + glowPos.x.toFixed(1) + 'px,' + glowPos.y.toFixed(1) + 'px,0)';
      if (label) label.style.transform = 'translate3d(' + labelPos.x.toFixed(1) + 'px,' + labelPos.y.toFixed(1) + 'px,0)';
      var settled = Math.abs(pointer.x - glowPos.x) < 0.3 && Math.abs(pointer.y - glowPos.y) < 0.3;
      if (settled) { moving = false; return; }
      raf(follow);
    }

    document.querySelectorAll('.spot').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });

    document.querySelectorAll('[data-tilt]').forEach(function (wrap) {
      var target = wrap.querySelector('.browser');
      if (!target) return;
      wrap.addEventListener('pointermove', function (e) {
        var r = wrap.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        target.style.setProperty('--ry', (px * 7).toFixed(2) + 'deg');
        target.style.setProperty('--rx', (-py * 5).toFixed(2) + 'deg');
      });
      wrap.addEventListener('pointerleave', function () {
        target.style.setProperty('--ry', '0deg');
        target.style.setProperty('--rx', '0deg');
      });
    });

    document.querySelectorAll('.magnetic').forEach(function (btn) {
      btn.addEventListener('pointermove', function (e) {
        var r = btn.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        btn.style.transform = 'translate(' + (dx * 0.2).toFixed(1) + 'px,' + (dy * 0.3).toFixed(1) + 'px)';
      });
      btn.addEventListener('pointerleave', function () { btn.style.transform = ''; });
    });

    document.querySelectorAll('[data-cursor]').forEach(function (el) {
      el.addEventListener('pointerenter', function () {
        if (!label) return;
        labelText.textContent = el.getAttribute('data-cursor');
        labelPos.x = pointer.x; labelPos.y = pointer.y;
        label.classList.add('show');
      });
      el.addEventListener('pointerleave', function () { if (label) label.classList.remove('show'); });
    });
  }

  /* ------------------------------------------------ footer: local time in Maryland, current year */
  var clock = document.querySelector('[data-clock]');
  if (clock && window.Intl) {
    var fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
    var tickClock = function () { clock.textContent = fmt.format(new Date()); };
    tickClock();
    setInterval(tickClock, 20000);
  }
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });
})();
