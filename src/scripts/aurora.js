/*
 * AURORA · runtime visual layer.
 * Adds decorative atmosphere (sky, grain, motes, cursor light, parallax) and classifies existing
 * surfaces so the theme can restyle them. It never adds, removes, reorders or rewrites content:
 * it only appends two decorative, aria-hidden layers and toggles .au-* classes / colours.
 */
(function () {
  'use strict';
  if (window.__aurora) return;
  window.__aurora = true;

  var doc = document, root = doc.documentElement, body = doc.body;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  var mobile = window.innerWidth < 768;
  // low-power devices keep the aurora but freeze its motion
  var lite = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) || (navigator.deviceMemory && navigator.deviceMemory <= 2) ||
    (navigator.connection && navigator.connection.saveData);
  if (lite) root.classList.add('au-lite');
  var CHROME = '#hwnav, #hwann, .hwf, #au-sky, #au-grain';
  var MOVING = '.swiper, .slick-slider, .swiper-wrapper, [class*="marquee"], [class*="ticker"], [class*="carousel"], [class*="slider"], [class*="scroller"], .elementor-invisible, .animated, [data-settings*="_animation"]';

  /* ---------- 1. atmosphere ------------------------------------------------------ */
  function el(tag, cls, parent) { var e = doc.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }
  var sky = el('div'); sky.id = 'au-sky'; sky.setAttribute('aria-hidden', 'true');
  var farLayer = el('div', 'au-par', sky), nearLayer = el('div', 'au-par', sky);
  el('div', 'au-stars', farLayer);
  ['b1', 'b2', 'b3', 'b4', 'b5'].forEach(function (b) { el('div', 'au-blob ' + b, farLayer); });
  el('div', 'au-ribbon r1', nearLayer); el('div', 'au-ribbon r2', nearLayer);
  if (!reduce && !lite) {
    var motes = mobile ? 5 : 10;
    for (var i = 0; i < motes; i++) {
      var m = el('span', 'au-mote', nearLayer), s = 2 + Math.random() * 4;
      m.style.cssText = 'left:' + (Math.random() * 100).toFixed(1) + '%;width:' + s.toFixed(1) + 'px;height:' + s.toFixed(1) +
        'px;animation-duration:' + (18 + Math.random() * 22).toFixed(1) + 's;animation-delay:-' + (Math.random() * 30).toFixed(1) +
        's;--au-dx:' + (Math.random() * 120 - 60).toFixed(0) + 'px';
    }
  }
  var cursor = el('div', 'au-cursor', sky);
  body.insertBefore(sky, body.firstChild);
  var grain = el('div'); grain.id = 'au-grain'; grain.setAttribute('aria-hidden', 'true'); body.appendChild(grain);

  /* ---------- 2. smooth parallax + cursor light (rAF, transform only) ------------ */
  if (!reduce) {
    var ticking = false, mx = -9999, my = -9999, cx = mx, cy = my;
    var frame = function () {
      ticking = false;
      var y = window.pageYOffset || 0, h = root.scrollHeight - innerHeight || 1, p = Math.min(1, y / h);
      farLayer.style.transform = 'translate3d(0,' + (-p * 6).toFixed(2) + 'vh,0)';
      nearLayer.style.transform = 'translate3d(0,' + (-p * 14).toFixed(2) + 'vh,0)';
      if (finePointer && mx > -9999) {
        cx += (mx - cx) * 0.12; cy += (my - cy) * 0.12;
        cursor.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
        if (Math.abs(mx - cx) > 0.5 || Math.abs(my - cy) > 0.5) request();
      }
    };
    var request = function () { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
    addEventListener('scroll', request, { passive: true });
    addEventListener('resize', request, { passive: true });
    if (finePointer) {
      addEventListener('pointermove', function (e) {
        if (cx === -9999) { cx = e.clientX; cy = e.clientY; }
        mx = e.clientX; my = e.clientY; sky.classList.add('au-has-cursor'); request();
      }, { passive: true });
      doc.addEventListener('mouseleave', function () { sky.classList.remove('au-has-cursor'); });
    }
    request();
  }

  /* ---------- 3. colour helpers ---------------------------------------------------- */
  function parse(c) {
    var m = /rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?/.exec(c);
    if (!m) return null;
    var a = m[4] == null ? 1 : (m[4].slice(-1) === '%' ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
    return { r: +m[1], g: +m[2], b: +m[3], a: a };
  }
  function lum(c) {
    var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function sat(c) {
    var r = c.r / 255, g = c.g / 255, b = c.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    return mx === mn ? 0 : (l > 0.5 ? (mx - mn) / (2 - mx - mn) : (mx - mn) / (mx + mn));
  }

  /* ---------- 4. surface classification ------------------------------------------- */
  var vw = Math.max(320, innerWidth);
  // The page "ground" decides the mode: dark pages open onto the aurora sky, light pages become pearl.
  var darkGround = true;
  function ground() {
    var b = parse(getComputedStyle(body).backgroundColor), h = parse(getComputedStyle(root).backgroundColor);
    var g = b && b.a > 0.5 ? b : (h && h.a > 0.5 ? h : { r: 255, g: 255, b: 255, a: 1 });
    darkGround = lum(g) < 0.2;
    root.classList.add(darkGround ? 'au-dark-ground' : 'au-light-ground');
    if (!darkGround) body.classList.add('au-pearl');
  }
  // nearest opaque background behind an element (dark ground when none)
  function backdropIsDark(e) {
    for (var a = e.parentElement; a && a !== body && a !== root; a = a.parentElement) {
      var c = parse(getComputedStyle(a).backgroundColor);
      if (getComputedStyle(a).backgroundImage !== 'none') return true;
      if (c && c.a >= 0.85) return lum(c) < 0.2;
    }
    return darkGround;
  }
  function classify(scope) {
    var walker = doc.createTreeWalker(scope, NodeFilter.SHOW_ELEMENT, {
      acceptNode: function (n) {
        if (n.id === 'hwnav' || n.id === 'hwann' || n.id === 'au-sky' || n.id === 'au-grain' || (n.classList && n.classList.contains('hwf'))) return NodeFilter.FILTER_REJECT;
        var t = n.tagName;
        if (t === 'SCRIPT' || t === 'STYLE' || t === 'svg' || t === 'SVG' || t === 'NOSCRIPT' || t === 'IFRAME' || t === 'VIDEO' || t === 'CANVAS' || t === 'IMG' || t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA' || t === 'BUTTON') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n, list = [];
    while ((n = walker.nextNode())) list.push(n);
    // read phase
    var jobs = [];
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.classList.contains('au-veil') || e.classList.contains('au-pearl') || e.classList.contains('au-card')) continue;
      var cs = getComputedStyle(e);
      if (cs.backgroundImage !== 'none') continue;
      var c = parse(cs.backgroundColor);
      if (!c || c.a < 0.85) continue;
      var w = e.offsetWidth, h = e.offsetHeight;
      if (!w || !h) continue;
      var L = lum(c), radius = parseFloat(cs.borderTopLeftRadius) || 0;
      var wide = w >= vw * 0.62 && h >= 120;
      if (L < 0.07) {
        if (wide && radius < 24) { if (backdropIsDark(e)) jobs.push([e, 'veil', c]); }
        else if (h >= 60 && w >= 120 && (radius >= 6 || cs.borderTopStyle !== 'none')) jobs.push([e, 'card-dark', c, cs.transform]);
      } else if (L > 0.82) {
        if (wide && radius < 24) jobs.push([e, 'pearl']);
        else if (h >= 60 && w >= 120 && w < vw * 0.9 && radius >= 6) jobs.push([e, 'card-light', c, cs.transform]);
      }
    }
    // write phase
    jobs.forEach(function (j) {
      var e = j[0], kind = j[1], c = j[2];
      if (kind === 'veil') {
        e.classList.add('au-veil');
        e.style.setProperty('background-color', 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',0.5)', 'important');
      } else if (kind === 'pearl') {
        e.classList.add('au-pearl');
      } else {
        e.classList.add('au-card', kind === 'card-dark' ? 'au-card--dark' : 'au-card--light');
        if (kind === 'card-dark') e.style.setProperty('background-color', 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',0.62)', 'important');
        if (j[3] === 'none' && !e.closest(MOVING)) e.classList.add('au-lift');
      }
    });
  }

  /* ---------- 5. aurora gradient on accent words in headings ---------------------- */
  function gradientText(scope) {
    var heads = scope.querySelectorAll('h1, h2, h3, .elementor-heading-title'), tune = [];
    for (var q = 0; q < heads.length; q++) {
      var hs = getComputedStyle(heads[q]), fs = parseFloat(hs.fontSize) || 16, ls = parseFloat(hs.letterSpacing);
      if (heads[q].closest(CHROME) || heads[q].dataset.auTuned) continue;
      tune.push([heads[q], !isNaN(ls) && ls < -0.008 * fs, parseInt(hs.fontWeight, 10) >= 700]);
    }
    // other display-style text (card titles etc.) only gets its over-tight tracking relaxed
    var titles = scope.querySelectorAll('h4, h5, h6, [class*="title"], [class*="-h "], [class$="-h"], [class*="heading"], [class*="name"]');
    for (var z = 0; z < titles.length; z++) {
      var te = titles[z];
      if (te.dataset.auTuned || te.closest(CHROME)) continue;
      var ts = getComputedStyle(te), tf = parseFloat(ts.fontSize) || 16, tl = parseFloat(ts.letterSpacing);
      if (tf >= 16 && !isNaN(tl) && tl < -0.012 * tf) tune.push([te, true, false]);
    }
    tune.forEach(function (t) {
      t[0].dataset.auTuned = '1';
      if (t[1]) t[0].style.setProperty('letter-spacing', '-0.008em', 'important');
      if (t[2]) t[0].style.setProperty('font-weight', '600', 'important');
    });
    for (var i = 0; i < heads.length; i++) {
      var h = heads[i];
      if (h.closest(CHROME) || h.classList.contains('au-gt')) continue;
      var hc = parse(getComputedStyle(h).color);
      var cand = [h].concat([].slice.call(h.querySelectorAll('span, em, strong, b, mark, i:not([class])')));
      for (var k = 0; k < cand.length; k++) {
        var t = cand[k], cs = getComputedStyle(t);
        if (t.closest('.au-gt') || !t.textContent.trim() || cs.backgroundImage !== 'none' || cs.webkitTextFillColor && cs.webkitTextFillColor !== cs.color) continue;
        var c = parse(cs.color);
        if (!c || c.a < 0.9 || sat(c) < 0.38) continue;
        if (t !== h && hc && Math.abs(c.r - hc.r) + Math.abs(c.g - hc.g) + Math.abs(c.b - hc.b) < 30) continue;
        if (t === h && t.children.length && t.querySelector('span, em, strong')) continue;
        var L = lum(c);
        if (L < 0.08 || (t !== h && t.children.length > 2)) continue;
        t.classList.add('au-gt');
        if (L < 0.32) t.classList.add('au-gt--deep');
      }
    }
  }

  function accentText(scope) {
    var els = scope.querySelectorAll('p > em, p > strong, p > span, p > b, blockquote em, blockquote strong');
    for (var i = 0; i < els.length; i++) {
      var t = els[i];
      if (t.closest(CHROME) || t.closest('.au-gt') || t.children.length || !t.textContent.trim()) continue;
      var cs = getComputedStyle(t), c = parse(cs.color);
      if (!c || cs.backgroundImage !== 'none' || sat(c) < 0.45 || lum(c) < 0.3) continue; // bright accent = dark surface
      t.classList.add('au-gt');
    }
  }

  // safety: if a page rule beats the gradient, a transparent fill would hide the text, so undo it
  function verifyGradients() {
    var g = doc.querySelectorAll('.au-gt');
    for (var i = 0; i < g.length; i++) {
      var cs = getComputedStyle(g[i]);
      if (cs.backgroundImage.indexOf('gradient') < 0 || cs.backgroundClip.indexOf('text') < 0 && (cs.webkitBackgroundClip || '').indexOf('text') < 0) g[i].classList.remove('au-gt', 'au-gt--deep');
    }
  }

  /* ---------- 6. card spotlight follows the pointer -------------------------------- */
  if (finePointer && !reduce) {
    doc.addEventListener('pointermove', function (e) {
      var card = e.target.closest && e.target.closest('.au-card');
      if (!card) return;
      var r = card.getBoundingClientRect();
      card.style.setProperty('--au-mx', (e.clientX - r.left).toFixed(0) + 'px');
      card.style.setProperty('--au-my', (e.clientY - r.top).toFixed(0) + 'px');
      card.classList.add('au-spot');
    }, { passive: true });
  }

  /* ---------- 7. fluid scroll reveals ---------------------------------------------- */
  function reveals(scope) {
    if (reduce || !('IntersectionObserver' in window)) return;
    var sel = '.au-card, h1, h2, h3, h4, p, .elementor-widget-image img, .elementor-button-wrapper, blockquote, ul.elementor-icon-list-items, figure';
    var items = scope.querySelectorAll(sel), picked = [];
    for (var i = 0; i < items.length; i++) {
      var e = items[i];
      if (e.closest(CHROME) || e.closest(MOVING) || e.classList.contains('au-rv')) continue;
      if (e.parentElement && e.parentElement.closest('.au-rv, .au-card')) continue; // one reveal per block
      if (!e.offsetWidth || !e.offsetHeight) continue;
      var cs = getComputedStyle(e);
      if (cs.opacity !== '1' || cs.animationName !== 'none' || cs.position === 'fixed' || cs.position === 'sticky') continue;
      if (/opacity|transform|translate|all/.test(cs.transitionProperty) && parseFloat(cs.transitionDuration) > 0 && !e.classList.contains('au-card')) continue;
      // skip if an ancestor is mid-animation or hidden by a page's own reveal script
      var a = e.parentElement, skip = false, d = 0;
      while (a && a !== body && d++ < 14) { var ac = getComputedStyle(a); if (ac.opacity !== '1' || ac.animationName !== 'none') { skip = true; break; } a = a.parentElement; }
      if (skip) continue;
      picked.push([e, cs.filter === 'none']);
    }
    var io = new IntersectionObserver(function (entries) {
      var batch = 0;
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var t = en.target; io.unobserve(t);
        t.style.setProperty('--au-d', Math.min(batch++ * 70, 420) + 'ms');
        t.classList.add('au-in');
        setTimeout(function () { t.classList.remove('au-rv', 'au-in', 'au-blur'); t.style.removeProperty('--au-d'); }, 1700);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    picked.forEach(function (p) {
      var e = p[0];
      e.classList.add('au-rv');
      if (p[1] && /^H[1-3]$/.test(e.tagName)) e.classList.add('au-blur');
      io.observe(e);
    });
    // failsafe: never leave content hidden (e.g. a tab shown later without scrolling)
    setTimeout(function () {
      doc.querySelectorAll('.au-rv:not(.au-in)').forEach(function (e) {
        var r = e.getBoundingClientRect();
        if (r.top < innerHeight && r.bottom > 0) e.classList.add('au-in');
      });
    }, 3500);
  }

  /* ---------- run ------------------------------------------------------------------- */
  function run() {
    try { ground(); } catch (e) {}
    try { classify(body); } catch (e) { /* decorative only */ }
    try { gradientText(body); } catch (e) {}
    try { accentText(body); verifyGradients(); } catch (e) {}
    try { reveals(body); } catch (e) {}
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', run); else run();
  // late-rendered blocks (forms, blog grids, tabs) get surfaces/gradients too, never reveals
  addEventListener('load', function () { try { classify(body); gradientText(body); accentText(body); verifyGradients(); } catch (e) {} });
})();
