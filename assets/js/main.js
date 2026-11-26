document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  var doc = document.documentElement;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = !!(window.gsap && window.ScrollTrigger);
  var MOTION = !reduced && hasGsap;
  doc.classList.toggle('motion', MOTION);
  doc.classList.toggle('no-motion', !MOTION);

  var yearEl = $('#year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------------------------------------------------------
     Blurred low-res placeholders
     --------------------------------------------------------- */
  // Resolve to absolute URLs: a relative url() inside a custom property would resolve against the stylesheet's folder.
  function abs(u) { try { return new URL(u, document.baseURI).href; } catch (e) { return u; } }
  $$('[data-lqip]').forEach(function (el) { el.style.setProperty('--lqip', 'url("' + abs(el.dataset.lqip) + '")'); });
  $$('[data-lqip-b]').forEach(function (el) { el.style.setProperty('--lqip-b', 'url("' + abs(el.dataset.lqipB) + '")'); });

  /* ---------------------------------------------------------
     Lazy media: load a section's media when it is within one
     viewport of the screen, so fast scrolling never hits an
     empty frame.
     --------------------------------------------------------- */
  var reelVisible = new WeakMap();

  function markLoaded(el) { el.classList.add('is-loaded'); }

  function loadEl(el) {
    var src = el.getAttribute('data-src');
    if (!src) return;
    el.removeAttribute('data-src');
    if (el.tagName === 'VIDEO') {
      var poster = el.getAttribute('data-poster');
      if (poster) {
        var pi = new Image();
        pi.onload = function () { el.poster = poster; markLoaded(el); };
        pi.src = poster;
      }
      el.addEventListener('loadeddata', function () { markLoaded(el); }, { once: true });
      if (el.preload === 'none') el.preload = 'metadata';
      el.src = src;
      el.load();
      if (reelVisible.get(el) && !reduced) el.play().catch(function () {});
    } else {
      el.decoding = 'async';
      el.addEventListener('load', function () { markLoaded(el); }, { once: true });
      el.src = src;
      if (el.complete && el.naturalWidth) markLoaded(el);
    }
  }
  function loadIn(root) { $$('[data-src]', root).forEach(loadEl); }

  // Reduced motion / no GSAP: the hero shows stills, so never fetch the scrub video.
  var heroVideo = $('#heroVideo');
  if (!MOTION && heroVideo) { heroVideo.removeAttribute('data-src'); heroVideo.parentNode.style.display = 'none'; }
  // Phones get the lighter encode of the walk-through.
  if (MOTION && heroVideo && heroVideo.dataset.srcSmall && window.innerWidth < 768) heroVideo.setAttribute('data-src', heroVideo.dataset.srcSmall);
  if (reduced) $$('.reel video').forEach(function (v) { v.controls = true; });

  if ('IntersectionObserver' in window) {
    var lazyIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { loadIn(e.target); lazyIO.unobserve(e.target); }
      });
    }, { rootMargin: '100% 0px 100% 0px' });
    $$('[data-lazy-section]').forEach(function (s) { lazyIO.observe(s); });
  } else {
    loadIn(document);
  }

  /* ---------------------------------------------------------
     Simple fade reveals
     --------------------------------------------------------- */
  if ('IntersectionObserver' in window) {
    var revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); revealIO.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    $$('.reveal').forEach(function (el) { revealIO.observe(el); });
  } else {
    $$('.reveal').forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------------------------------------------------------
     Smooth scrolling
     --------------------------------------------------------- */
  var lenis = null;
  if (MOTION) {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    if (window.Lenis) {
      lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    }
  }
  function scrollToY(y) {
    if (lenis) lenis.scrollTo(y, { duration: 1.4 });
    else window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
  }

  /* ---------------------------------------------------------
     Header: hide on scroll down, show on scroll up
     --------------------------------------------------------- */
  var header = $('#siteHeader');
  var lastY = window.scrollY, ticking = false;
  function onScroll() {
    var y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 8);
    if (!doc.classList.contains('menu-open')) {
      var dy = y - lastY;
      if (y < 120) header.classList.remove('is-hidden');
      else if (dy > 6) header.classList.add('is-hidden');
      else if (dy < -6) header.classList.remove('is-hidden');
    }
    if (Math.abs(y - lastY) > 6 || y < 120) lastY = y;
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  /* ---------------------------------------------------------
     Mobile menu
     --------------------------------------------------------- */
  var menuBtn = $('.menu-toggle'), menu = $('#menu'), menuLabel = $('.menu-toggle-label');
  function menuOpen() { return doc.classList.contains('menu-open'); }
  function openMenu() {
    doc.classList.add('menu-open');
    menuBtn.setAttribute('aria-expanded', 'true');
    menuLabel.textContent = 'Close';
    header.classList.remove('is-hidden');
    if (lenis) lenis.stop();
    setTimeout(function () { var a = $('a', menu); if (a) a.focus(); }, 60);
  }
  function closeMenu(returnFocus) {
    if (!menuOpen()) return;
    doc.classList.remove('menu-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuLabel.textContent = 'Menu';
    if (lenis) lenis.start();
    if (returnFocus) menuBtn.focus();
  }
  menuBtn.addEventListener('click', function () { menuOpen() ? closeMenu(true) : openMenu(); });
  document.addEventListener('keydown', function (e) {
    if (!menuOpen()) return;
    if (e.key === 'Escape') { closeMenu(true); return; }
    if (e.key === 'Tab') {
      var f = [menuBtn].concat($$('a, button', menu));
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  window.matchMedia('(min-width: 900px)').addEventListener('change', function (m) { if (m.matches) closeMenu(false); });

  /* ---------------------------------------------------------
     In-page anchors (aware of pinned sections)
     --------------------------------------------------------- */
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id.length < 2) return;
      var target = document.getElementById(id.slice(1));
      if (!target) return;
      e.preventDefault();
      closeMenu(false);
      var el = (target.parentElement && target.parentElement.classList.contains('pin-spacer')) ? target.parentElement : target;
      var y = id === '#top' ? 0 : el.getBoundingClientRect().top + window.scrollY;
      scrollToY(y);
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  });

  /* ---------------------------------------------------------
     Exclusive switcher — toggles .is-on on exactly one item.
     The CSS guarantees the outgoing item has fully faded out
     before the incoming one starts fading in.
     --------------------------------------------------------- */
  function switcher(items, onChange) {
    var current = -1;
    return function (i) {
      if (i === current) return;
      current = i;
      items.forEach(function (el, k) { el.classList.toggle('is-on', k === i); });
      if (onChange) onChange(i);
    };
  }

  /* ---------------------------------------------------------
     Hero walk-in: pinned for ~4 screens, video scrubs, chapter
     label switches exactly at each chapter's start time.
     --------------------------------------------------------- */
  /* Hero heading: the gold word cycles every 2s (rooms → kitchens → wardrobes → …).
     Old word slides up and out, the next slides up in and its underline draws.
     Paused while the hero is off screen or the tab is hidden; static for reduced motion. */
  (function heroRotator() {
    var words = $$('.rot-word');
    if (reduced || words.length < 2) return;
    var i = 0, timer = 0, visible = true, INTERVAL = 3000;
    function next() {
      var cur = words[i];
      i = (i + 1) % words.length;
      cur.classList.remove('is-on'); cur.classList.add('is-out');
      words[i].classList.remove('is-out'); words[i].classList.add('is-on');
      setTimeout(function () { cur.classList.remove('is-out'); }, 200); // park it below again, invisibly
    }
    function start() { if (!timer && visible && !document.hidden) timer = setInterval(next, INTERVAL); }
    function stop() { clearInterval(timer); timer = 0; }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; visible ? start() : stop(); })
        .observe($('.hero-title'));
    }
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
    setTimeout(start, 800); // let the intro animation settle first
  })();

  (function hero() {
    var heroEl = $('.hero');
    var stills = $$('.hero-still');
    var dots = $$('.chapter-dot');
    var counter = $('.chapter-count');
    // Chapter start times in seconds. Each chapter gets an equal share of the scroll,
    // and the video time is mapped linearly inside it, so the label switches on the exact
    // frame where its chapter begins.
    var starts = ((heroVideo && heroVideo.dataset.chapters) || '0').split(',').map(Number);
    var N = starts.length;

    var setChapter = switcher($$('.chapter'), function (i) {
      stills.forEach(function (s, k) { s.classList.toggle('is-active', k === i); });
      dots.forEach(function (d, k) {
        d.classList.toggle('is-active', k === i);
        if (k === i) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current');
      });
      if (counter) counter.textContent = '0' + (i + 1) + ' / 0' + starts.length;
    });

    if (!MOTION) { stills.forEach(function (s, k) { s.classList.toggle('is-active', k === stills.length - 1); }); return; }

    setChapter(0);
    var progress = 0, duration = 0;
    function chapterAt(p) { return Math.min(N - 1, Math.floor(p * N)); }
    function timeAt(p) {
      var i = chapterAt(p), local = p * N - i;
      var end = i + 1 < N ? starts[i + 1] : duration;
      return starts[i] + local * (end - starts[i]);
    }

    if (heroVideo) {
      var onMeta = function () { duration = heroVideo.duration || 0; };
      heroVideo.addEventListener('loadedmetadata', onMeta);
      heroVideo.addEventListener('loadeddata', function () {
        // iOS: a muted play/pause primes the decoder so seeking renders frames.
        var p = heroVideo.play(); if (p && p.then) p.then(function () { heroVideo.pause(); }).catch(function () {});
      }, { once: true });
      if (heroVideo.readyState >= 1) onMeta();
      gsap.ticker.add(function () {
        if (!duration || heroVideo.seeking) return;
        var t = Math.min(timeAt(progress), duration - 0.04);
        if (Math.abs(heroVideo.currentTime - t) > 0.016) heroVideo.currentTime = t;
      });
    }

    var st = ScrollTrigger.create({
      trigger: heroEl,
      start: 'top top',
      end: '+=300%',
      pin: true,
      anticipatePin: 1,
      onUpdate: function (self) { progress = self.progress; setChapter(chapterAt(progress)); }
    });

    dots.forEach(function (d, k) {
      d.addEventListener('click', function () { scrollToY(st.start + (st.end - st.start) * k / N + 2); });
    });
  })();

  /* ---------------------------------------------------------
     Statement: inline image pills scale up from 0
     --------------------------------------------------------- */
  if (MOTION) {
    $$('.inline-pill').forEach(function (pill, i) {
      gsap.fromTo(pill, { scale: 0 }, {
        scale: 1, duration: 1.1, ease: 'expo.out', delay: (i % 2) * 0.08,
        scrollTrigger: { trigger: pill, start: 'top 88%', once: true }
      });
    });
  } else {
    $$('.inline-pill').forEach(function (p) { p.classList.add('reveal'); revealIO && revealIO.observe(p); });
  }

  /* ---------------------------------------------------------
     Process: pinned, one step at a time, before → after
     --------------------------------------------------------- */
  /* All of it, one wall. Pinned for ~3.4 screens; every look is a custom property on the section:
       0.02–0.32  --open  the dimmed photo opens from a small rounded window to full width
       0.32–0.44  --sc    the screen lights up                         (key "Screen" on at 0.34)
       0.46–0.58  --so    the speakers and soundbar light up, rings pulse  (key "Sound" on at 0.48)
       0.60–0.76  --li    the whole wall's lighting comes on           (key "Light" on at 0.62)
       0.78–0.90  --end   scrim, heading and tag fade in */
  (function oneWall() {
    if (!MOTION) return;
    var one = $('.one'); if (!one) return;
    var keys = $$('.one-key', one);
    function seg(p, a, b) { return clamp((p - a) / (b - a), 0, 1); }
    function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
    function update(p) {
      var so = seg(p, 0.46, 0.58);
      one.style.setProperty('--open', (1 - easeOut(seg(p, 0.02, 0.32))).toFixed(4));
      one.style.setProperty('--sc', seg(p, 0.32, 0.44).toFixed(3));
      one.style.setProperty('--so', so.toFixed(3));
      one.style.setProperty('--ring', (so * (1 - seg(p, 0.6, 0.72))).toFixed(3));
      one.style.setProperty('--li', seg(p, 0.6, 0.76).toFixed(3));
      one.style.setProperty('--end', seg(p, 0.78, 0.9).toFixed(3));
      keys[0].classList.toggle('is-on', p > 0.34);
      keys[1].classList.toggle('is-on', p > 0.48);
      keys[2].classList.toggle('is-on', p > 0.62);
    }
    update(0);
    ScrollTrigger.create({
      trigger: one, start: 'top top', end: '+=240%', pin: true, anticipatePin: 1,
      onUpdate: function (self) { update(self.progress); }
    });
  })();

  /* One room, start to finish. Over the pinned scroll, four layers play on one stage:
       0.00–0.22  bare wall settles from 1.3× while a laser level sweeps across   (01 Consultation)
       0.22–0.47  the room dims and the design sketch draws itself line by line   (02 Design)
       0.47–0.72  the fit plays from 22 on-site frames, drawn to a canvas         (03 Making)
       0.72–1.00  the finished wall wipes up, settles from 1.16×, a sheen passes  (04 Install & reveal)
     The step text, caption and progress all switch on the same boundaries. */
  (function process() {
    if (!MOTION) return;
    var stage = $('.process-stage');
    var bar = $('.progress-bar');
    var ticks = $$('.progress-ticks li');
    var bare = $('.ps-bare'), shade = $('.ps-shade');
    var level = $('.ps-level'), lvx = $('.lv-x'), lvy = $('.lv-y');
    var sketch = $('.ps-sketch'), marks = $$('[data-i]', sketch);
    var canvas = $('.ps-fit'), ctx = canvas.getContext('2d');
    var done = $('.ps-done'), doneIn = $('.ps-done-in'), doneImg = $('img', done);
    var sheen = $('.ps-sheen');
    var B = [0, 0.22, 0.47, 0.72, 1];
    var N = parseInt(canvas.dataset.frames, 10), base = canvas.dataset.src;
    var frames = [], ready = [], shown = -1, W = 0, H = 0, lw = 0, lh = 0, lastDraw = -1;
    var setTag = switcher($$('.ps-tag'));
    var setStep = switcher($$('.step'), function (i) {
      ticks.forEach(function (t, k) { t.classList.toggle('is-active', k <= i); });
      setTag(i);
    });
    function seg(p, a, len) { return clamp((p - a) / len, 0, 1); }

    // Load the fit frames once the section is within ~1.5 screens.
    new IntersectionObserver(function (es, o) {
      if (!es[0].isIntersecting) return;
      o.disconnect();
      for (var i = 0; i < N; i++) (function (i) {
        var im = new Image(); im.decoding = 'async';
        im.onload = function () { ready[i] = true; shown = -1; paintFrame(lastP); };
        im.src = base + (i < 9 ? '0' : '') + (i + 1) + '.webp';
        frames[i] = im;
      })(i);
    }, { rootMargin: '150% 0px' }).observe(stage);

    function nearest(i) { for (var d = 0; d < N; d++) { if (ready[i - d]) return i - d; if (ready[i + d]) return i + d; } return -1; }
    function paintFrame(p) {
      var fi = nearest(Math.round(seg(p, 0.48, 0.23) * (N - 1)));
      if (fi < 0 || fi === shown || !W) return;
      var im = frames[fi], sc = Math.max(W / im.naturalWidth, H / im.naturalHeight);
      var dw = im.naturalWidth * sc, dh = im.naturalHeight * sc;
      ctx.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh);
      shown = fi;
    }
    function size() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.offsetWidth; H = canvas.offsetHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lw = level.offsetWidth; lh = level.offsetHeight;
      shown = -1; update(lastP);
    }
    function drawSketch(d) {
      if (Math.abs(d - lastDraw) < 0.001) return;
      lastDraw = d;
      var n = marks.length, head = d * (n + 8);
      marks.forEach(function (m, k) {
        var t = clamp((head - k) / 8, 0, 1);
        if (m.tagName === 'text') m.style.opacity = t.toFixed(3);
        else m.style.transform = (m.classList.contains('h') ? 'scaleX(' : 'scaleY(') + t.toFixed(3) + ')';
      });
    }

    var lastP = 0, ghost = $('.proc-ghost');
    function update(p) {
      lastP = p;
      var idx = p < B[1] ? 0 : p < B[2] ? 1 : p < B[3] ? 2 : 3;
      setStep(idx);
      bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      // green check on every step the bar has passed (the last one when the bar reaches the end)
      ticks.forEach(function (t, k) { t.classList.toggle('is-done', k < idx || (k === ticks.length - 1 && p >= 0.985)); });
      if (ghost) ghost.style.transform = 'translateX(' + (8 - p * 38).toFixed(2) + '%)';

      bare.style.transform = 'scale(' + (1.3 - 0.3 * seg(p, 0, 0.24)).toFixed(4) + ')';
      var e = seg(p, 0, 0.2);
      level.style.opacity = (seg(p, 0, 0.02) * (1 - seg(p, 0.2, 0.03))).toFixed(3);
      lvx.style.transform = 'translateY(' + (lh * (0.08 + 0.84 * e)).toFixed(1) + 'px)';
      lvy.style.transform = 'translateX(' + (lw * (0.92 - 0.84 * e)).toFixed(1) + 'px)';

      shade.style.opacity = (seg(p, 0.22, 0.06) * (1 - seg(p, 0.47, 0.05))).toFixed(3);
      drawSketch(p < 0.6 ? seg(p, 0.24, 0.19) : 1);
      // the sketch shows during design, then returns briefly over the finished wall as labels
      var sk = seg(p, 0.22, 0.03) * (1 - seg(p, 0.46, 0.05)) + seg(p, 0.78, 0.04) * (1 - seg(p, 0.87, 0.07));
      sketch.style.opacity = Math.min(1, sk).toFixed(3);

      canvas.style.opacity = (seg(p, 0.47, 0.04) * (1 - seg(p, 0.75, 0.04))).toFixed(3);
      paintFrame(p);

      var w = seg(p, 0.72, 0.08);
      done.style.transform = 'translateY(' + ((1 - w) * 100).toFixed(2) + '%)';
      doneIn.style.transform = 'translateY(' + (-(1 - w) * 100).toFixed(2) + '%)';
      doneImg.style.transform = 'scale(' + (1.16 - 0.16 * seg(p, 0.72, 0.28)).toFixed(4) + ')';
      sheen.style.transform = 'translateX(' + (-170 + 430 * seg(p, 0.86, 0.1)).toFixed(1) + '%) skewX(-12deg)';
    }

    new ResizeObserver(size).observe(canvas);
    size();
    ScrollTrigger.create({
      trigger: stage, start: 'top top', end: '+=380%', pin: true, anticipatePin: 1,
      onUpdate: function (self) { update(self.progress); }
    });
  })();

  /* ---------------------------------------------------------
     Selected work: vertical scroll drives horizontal gallery
     --------------------------------------------------------- */
  (function work() {
    if (!MOTION) return;
    var section = $('.work');
    var track = $('.work-track');
    function distance() { return Math.max(0, track.scrollWidth - doc.clientWidth); }
    gsap.to(track, {
      x: function () { return -distance(); },
      ease: 'none',
      scrollTrigger: {
        trigger: section, start: 'top top',
        end: function () { return '+=' + distance(); },
        pin: true, scrub: true, anticipatePin: 1, invalidateOnRefresh: true
      }
    });
  })();

  /* ---------------------------------------------------------
     Before / after slider (pointer, touch, keyboard)
     --------------------------------------------------------- */
  (function beforeAfter() {
    var ba = $('#ba'); if (!ba) return;
    var knob = $('.ba-knob', ba);
    var pos = 0.5, raf = 0, mode = null, sx = 0, sy = 0;
    function render() {
      raf = 0;
      ba.style.setProperty('--p', pos.toFixed(4));
      var pct = Math.round(pos * 100);
      knob.setAttribute('aria-valuenow', String(pct));
      knob.setAttribute('aria-valuetext', 'Showing ' + pct + '% before, ' + (100 - pct) + '% after');
    }
    function set(p) { pos = clamp(p, 0, 1); if (!raf) raf = requestAnimationFrame(render); }
    function fromEvent(e) { var r = ba.getBoundingClientRect(); set((e.clientX - r.left) / r.width); }

    ba.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      sx = e.clientX; sy = e.clientY;
      if (e.pointerType === 'mouse' || e.target.closest('.ba-knob')) {
        mode = 'drag'; ba.classList.add('is-dragging');
        try { ba.setPointerCapture(e.pointerId); } catch (err) {}
        fromEvent(e);
        if (e.pointerType === 'mouse') e.preventDefault();
      } else {
        mode = 'pending'; // touch on the image: wait to see if it's a horizontal drag
      }
    });
    ba.addEventListener('pointermove', function (e) {
      if (mode === 'pending') {
        var dx = Math.abs(e.clientX - sx), dy = Math.abs(e.clientY - sy);
        if (dx > 6 && dx > dy) { mode = 'drag'; ba.classList.add('is-dragging'); try { ba.setPointerCapture(e.pointerId); } catch (err) {} }
        else if (dy > 10) mode = null;
      }
      if (mode === 'drag') fromEvent(e);
    });
    function end() { mode = null; ba.classList.remove('is-dragging'); }
    ba.addEventListener('pointerup', end);
    ba.addEventListener('pointercancel', end);
    ba.addEventListener('lostpointercapture', end);

    knob.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 0.1 : 0.05, handled = true;
      switch (e.key) {
        case 'ArrowLeft': case 'ArrowDown': set(pos - step); break;
        case 'ArrowRight': case 'ArrowUp': set(pos + step); break;
        case 'PageDown': set(pos - 0.2); break;
        case 'PageUp': set(pos + 0.2); break;
        case 'Home': set(0); break;
        case 'End': set(1); break;
        default: handled = false;
      }
      if (handled) e.preventDefault();
    });
    render();
  })();

  /* ---------------------------------------------------------
     Details accordion
     --------------------------------------------------------- */
  (function details() {
    var panels = $$('.panel');
    var desk = window.matchMedia('(min-width: 900px)');
    var hover = window.matchMedia('(hover: hover)');
    function activate(i, fromClick) {
      panels.forEach(function (p, k) {
        var on;
        if (k !== i) on = false;
        else if (fromClick && !desk.matches) on = !p.classList.contains('is-active'); // mobile: tap toggles
        else on = true;
        p.classList.toggle('is-active', on);
        $('.panel-btn', p).setAttribute('aria-expanded', on ? 'true' : 'false');
      });
    }
    panels.forEach(function (p, i) {
      var btn = $('.panel-btn', p);
      btn.addEventListener('click', function () { activate(i, true); });
      btn.addEventListener('focus', function () { if (desk.matches) activate(i, false); });
      p.addEventListener('mouseenter', function () { if (desk.matches && hover.matches) activate(i, false); });
    });
    desk.addEventListener('change', function () {
      if (desk.matches && !panels.some(function (p) { return p.classList.contains('is-active'); })) activate(0, false);
    });
  })();

  /* ---------------------------------------------------------
     Social reel: autoplay muted only while visible
     --------------------------------------------------------- */
  /* Social reel: a drifting loop of the project clips.
     The four originals are repeated until they fill the screen, then that set is doubled so a
     CSS translateX(-50%) loop is seamless. Copies are hidden from assistive tech and keyboard.
     Each video gets its source only when it first comes on screen, and plays only while visible,
     so the repeats don't multiply downloads. */
  (function reels() {
    if (reduced || !('IntersectionObserver' in window)) return;
    var reel = $('.reel'), track = $('.reel-track', reel);
    var originals = $$('.reel-card', track);
    var SPEED = 38; // px per second

    // Take reel videos out of the section-wide lazy loader: they load on first sight instead.
    function claim(v) {
      if (v.dataset.src) { v.dataset.reelSrc = v.dataset.src; v.removeAttribute('data-src'); }
      var poster = v.dataset.poster;
      if (poster && !v.poster) {
        var im = new Image();
        im.onload = function () { v.poster = poster; v.classList.add('is-loaded'); };
        im.src = poster;
      }
    }
    function ensureSrc(v) {
      if (v.dataset.reelSrc && !v.getAttribute('src')) {
        v.preload = 'auto'; v.src = v.dataset.reelSrc; v.load();
      }
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target, vis = e.isIntersecting && e.intersectionRatio >= 0.5;
        reelVisible.set(v, vis);
        if (vis) { ensureSrc(v); if (!document.hidden) v.play().catch(function () {}); }
        else v.pause();
      });
    }, { threshold: [0, 0.5] });

    function build() {
      $$('video', track).forEach(function (v) { io.unobserve(v); });
      $$('.reel-card.is-clone', track).forEach(function (c) { c.remove(); });
      var setW = originals.reduce(function (w, c) { return w + c.getBoundingClientRect().width; }, 0);
      if (!setW) return;
      var vw = doc.clientWidth;
      // one "group" must be at least a screen wide (+1 card) so the loop never shows a gap
      var reps = Math.max(1, Math.ceil((vw + setW / originals.length) / setW));
      var group = [];
      for (var r = 0; r < reps; r++) originals.forEach(function (c) { group.push(c); });
      var all = group.concat(group);
      all.forEach(function (c, k) {
        var card = k < originals.length ? c : c.cloneNode(true);
        if (k >= originals.length) {
          card.classList.add('is-clone');
          card.setAttribute('aria-hidden', 'true');
          card.setAttribute('inert', '');
          var v = $('video', card); v.removeAttribute('src'); v.pause && v.pause();
          track.appendChild(card);
        }
        card.style.setProperty('--k', Math.min(k, 8));
      });
      $$('video', track).forEach(function (v) { claim(v); io.observe(v); });
      reel.style.setProperty('--reel-dur', ((setW * reps) / SPEED).toFixed(1) + 's');
    }
    reel.classList.add('is-marquee');
    build();

    var lastW = doc.clientWidth, rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { if (doc.clientWidth !== lastW) { lastW = doc.clientWidth; build(); } }, 200);
    });

    // touch: tap to pause / resume the drift
    reel.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') reel.classList.toggle('is-paused'); });

    // entrance, once
    new IntersectionObserver(function (es, o) {
      if (es[0].isIntersecting) { reel.classList.add('is-in'); o.disconnect(); }
    }, { rootMargin: '0px 0px -15% 0px' }).observe(reel);

    document.addEventListener('visibilitychange', function () {
      $$('video', track).forEach(function (v) {
        if (document.hidden) v.pause();
        else if (reelVisible.get(v) && v.getAttribute('src')) v.play().catch(function () {});
      });
    });
  })();

  /* ---------------------------------------------------------
     CTA headline: word-by-word reveal
     --------------------------------------------------------- */
  (function cta() {
    var words = $$('.cta-title .w > span');
    if (MOTION) {
      gsap.fromTo(words, { yPercent: 110, opacity: 0 }, {
        yPercent: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.1,
        scrollTrigger: { trigger: '.cta-title', start: 'top 82%', once: true }
      });
      // slow zoom-out of the background photo as the section scrolls through
      gsap.fromTo('.cta-bg img', { scale: 1.16 }, {
        scale: 1, ease: 'none',
        scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom top', scrub: true }
      });
    } else {
      words.forEach(function (w, i) { w.classList.add('reveal'); w.style.transitionDelay = (i * 0.1) + 's'; revealIO && revealIO.observe(w); });
    }
  })();

  /* ---------------------------------------------------------
     Footer: live UK studio time, and the big wordmark rising in
     --------------------------------------------------------- */
  (function footer() {
    var t = $('#ukTime');
    if (t && window.Intl) {
      var fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' });
      var tick = function () { var d = new Date(); t.textContent = fmt.format(d); t.setAttribute('datetime', d.toISOString()); };
      tick(); setInterval(tick, 20000);
    }
    var mega = $('.ft-mega');
    if (mega && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (es, o) {
        if (es[0].isIntersecting) { mega.classList.add('is-in'); o.disconnect(); }
      }, { threshold: 0.2 }).observe(mega);
    } else if (mega) { mega.classList.add('is-in'); }
  })();

  /* Re-measure once web fonts have arrived */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { if (MOTION) ScrollTrigger.refresh(); });
  }
  window.addEventListener('load', function () { if (MOTION) ScrollTrigger.refresh(); });
});
