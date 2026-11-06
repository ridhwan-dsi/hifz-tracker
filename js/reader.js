/* Page reader: fit-to-screen, auto-trim + crop window, joins with previous/next page,
   named masks (boxes + staircase section lines), RTL swipe, drawer panel. */
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var R = {
    p: 1, panel: true, sub: null, edit: false, tool: 'box', sel: -1, imgs: {}, Hu: 1000, items: [], drag: null, tmp: null,
    draft: null, ph: -1, style: { c: '#ffd400', o: 0.45, b: false }
  };
  var COLORS = ['#ffd400', '#ff5a5a', '#3ccf7a', '#3d8bff', '#b061ff', '#111111', '#ffffff'];
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function r1(v) { return Math.round(v * 10) / 10; }
  function r4(v) { return Math.round(v * 10000) / 10000; }
  function buzz() { try { navigator.vibrate && navigator.vibrate(8); } catch (e) {} }
  function fitPage() { return S.d.settings.fit !== 'width'; }

  /* ---------- crop / joins ---------- */
  function autoCrop(p) {
    var s = S.d.settings, mode = s.trim || 'full';
    if (mode === 'off' || !window.AUTOCROP) return { l: 0, t: 0, r: 0, b: 0 };
    var a = AUTOCROP[mode === 'frame' ? 'frame' : 'full'][p - 1], pad = s.trimPad == null ? 0.01 : s.trimPad;
    var sp = mode === 'frame' ? pad : 0; // sides are cut at the frame so margin markers (hizb/rub') never show
    return { l: Math.max(0, a[0] - sp), t: Math.max(0, a[1] - pad), r: Math.max(0, a[2] - sp), b: Math.max(0, a[3] - pad) };
  }
  function cropOf(p) { var c = S.get(p).crop; return c ? { l: c.l || 0, t: c.t || 0, r: c.r || 0, b: c.b || 0 } : autoCrop(p); }
  function joinOf(p) { var j = S.get(p).jn || {}; return { prev: j.prev || 0, next: j.next || 0, trimT: j.trimT || 0, trimB: j.trimB || 0 }; }
  function segsFor(p) {
    if (R.sub === 'crop') return [{ p: p, y0: 0, y1: 1, raw: true }];
    var j = joinOf(p), s = [];
    if (j.prev > 0 && p > 1) s.push({ p: p - 1, y0: 1 - j.prev, y1: 1 });
    s.push({ p: p, y0: j.trimT, y1: 1 - j.trimB });
    if (j.next > 0 && p < 604) s.push({ p: p + 1, y0: 0, y1: j.next });
    return s;
  }

  /* ---------- masks (named sets per page) ---------- */
  function masksOf(p) {
    var o = S.get(p);
    if (o.mk) return o.mk;
    if (o.masks && o.masks.length) return [{ id: 'm1', name: 'Mask 1', items: o.masks, sec: o.sec || 0, hb: !!o.hb }];
    return [];
  }
  function activeMask() { var o = S.get(R.p), ms = masksOf(R.p); if (!o.am) return null; for (var i = 0; i < ms.length; i++) if (ms[i].id === o.am) return ms[i]; return null; }
  function saveMasks(fn) {
    var p = R.p, ms = JSON.parse(JSON.stringify(masksOf(p)));
    S.edit(p, function (o) { fn(ms, o); o.mk = ms; delete o.masks; delete o.sec; delete o.hb; });
  }
  function commitItems() {
    var am = S.get(R.p).am, items = R.items.map(function (m) { var c = {}; for (var k in m) c[k] = typeof m[k] === 'number' ? r1(m[k]) : m[k]; return c; });
    saveMasks(function (ms) { ms.forEach(function (m) { if (m.id === am) { m.items = items; if (m.sec > nDiv(items) + 1) m.sec = 0; } }); });
  }
  function nDiv(items) { return items.filter(function (m) { return m.k === 'div'; }).length; }
  function loadItems() { var m = activeMask(); R.items = m ? JSON.parse(JSON.stringify(m.items || [])) : []; }

  function img(q) {
    if (!R.imgs[q]) {
      R.imgs[q] = new Promise(function (res, rej) {
        var im = new Image(); im.decoding = 'async';
        im.onload = function () { res(im); }; im.onerror = function () { delete R.imgs[q]; rej(new Error('img ' + q)); };
        im.src = 'pages/p' + String(q).padStart(3, '0') + '.jpg';
      });
      var keys = Object.keys(R.imgs);
      if (keys.length > 14) keys.forEach(function (k) { if (Math.abs(k - R.p) > 3) delete R.imgs[k]; });
    }
    return R.imgs[q];
  }

  /* ---------- open / close ---------- */
  var Reader = {
    open: function (p) {
      p = clamp(p | 0, 1, 604);
      if (!Reader.isOpen()) history.pushState({ reader: 1 }, '', '#p' + p);
      $('#reader').classList.add('on'); document.body.style.overflow = 'hidden';
      go(p, 0);
    },
    close: function () {
      $('#reader').classList.remove('on'); document.body.style.overflow = '';
      R.sub = null; R.edit = false; R.sel = -1; App.render();
    },
    isOpen: function () { return $('#reader').classList.contains('on'); },
    relayout: function () { if (Reader.isOpen()) layout(); }
  };
  window.Reader = Reader;
  window.addEventListener('popstate', function () { if (Reader.isOpen()) Reader.close(); });

  function go(p, dir) {
    if (p < 1 || p > 604) return;
    if (dir) buzz();
    R.p = p; R.sel = -1; R.drag = null; R.edit = false; R.draft = null;
    if (R.sub === 'crop' || R.sub === 'join') R.sub = null;
    loadItems();
    S.setLast(p);
    if (history.state && history.state.reader) history.replaceState({ reader: 1 }, '', '#p' + p);
    renderPanel();
    layout(dir);
    [p - 1, p + 1, p + 2, p - 2].forEach(function (q) { if (q >= 1 && q <= 604) img(q).catch(function () {}); });
  }

  /* ---------- layout ---------- */
  var layoutSeq = 0;
  function layout(dir) {
    var seq = ++layoutSeq, p = R.p, segs = segsFor(p);
    return Promise.all(segs.map(function (s) { return img(s.p); })).then(function (ims) {
      if (seq !== layoutSeq) return;
      var sc = $('#rscroll'), sheet = $('#sheet');
      var dims = segs.map(function (s, i) {
        var im = ims[i], c = s.raw ? { l: 0, t: 0, r: 0, b: 0 } : cropOf(s.p), nw = im.naturalWidth, nh = im.naturalHeight;
        var cw = (1 - c.l - c.r) * nw, ch = (1 - c.t - c.b) * nh;
        return { im: im, c: c, nw: nw, nh: nh, cw: cw, ch: ch, u: (s.y1 - s.y0) * ch / cw };
      });
      var U = dims.reduce(function (a, d) { return a + d.u; }, 0);
      var vw = sc.clientWidth || innerWidth, top = 8, vh = innerHeight - R.ph - top * 2;
      var W = (fitPage() || R.sub === 'crop' || R.edit) ? Math.min(vw, vh / U) : Math.min(vw, 820);
      W = Math.max(120, Math.floor(W));
      var html = '';
      segs.forEach(function (s, i) {
        var d = dims[i], k = W / d.cw, sx = d.c.l * d.nw, sy = d.c.t * d.nh + s.y0 * d.ch;
        html += '<div class="pseg' + (s.p !== p ? ' side' : '') + '" style="height:' + (d.u * W).toFixed(2) + 'px"><img src="' + d.im.src + '" alt="" style="width:' + (d.nw * k).toFixed(2) + 'px;transform:translate(' + (-sx * k).toFixed(2) + 'px,' + (-sy * k).toFixed(2) + 'px)"></div>';
      });
      R.Hu = U * 1000;
      var H = U * W, fit = fitPage() || R.sub === 'crop' || R.edit;
      sheet.style.width = W + 'px';
      sheet.style.marginTop = (fit ? Math.max(top, (innerHeight - R.ph - H) / 2) : 0) + 'px';
      sheet.style.transition = 'none'; sheet.style.transform = '';
      sheet.innerHTML = html + '<svg id="ov" viewBox="0 0 1000 ' + R.Hu.toFixed(1) + '" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"></svg>';
      $('#rpad').style.height = fit ? '0px' : (R.ph + 20) + 'px';
      sc.style.overflowY = fit ? 'hidden' : 'auto';
      sc.style.touchAction = fit || R.edit ? 'none' : 'pan-y';
      if (dir && sheet.animate) sheet.animate([{ transform: 'translateX(' + (-dir * 60) + 'px)', opacity: 0.2 }, { transform: 'none', opacity: 1 }], { duration: 170, easing: 'ease-out' });
      if (dir) sc.scrollTop = 0;
      if (R.sub === 'crop') drawCrop(); else draw();
      bindOv();
    }).catch(function () {
      if (seq === layoutSeq) $('#sheet').innerHTML = '<div style="padding:40px;text-align:center;color:#666;background:#fff">Couldn’t load this page. Check your connection.</div>';
    });
  }
  var rq = 0;
  function relayout() { cancelAnimationFrame(rq); rq = requestAnimationFrame(function () { layout(); }); }
  window.addEventListener('resize', function () { if (Reader.isOpen()) { measurePanel(); relayout(); } });
  function measurePanel() { var pn = $('.rpanel'); var h = R.panel && pn ? pn.offsetHeight : 0; var ch = h !== R.ph; R.ph = h; return ch; }

  /* ---------- mask drawing ---------- */
  function dividers() {
    return R.items.map(function (m, i) { return { m: m, i: i }; }).filter(function (x) { return x.m.k === 'div'; })
      .sort(function (a, b) { return (a.m.y1 + a.m.y2) - (b.m.y1 + b.m.y2); });
  }
  function divPts(m) { return '1000,' + r1(m.y1) + ' ' + r1(m.x) + ',' + r1(m.y1) + ' ' + r1(m.x) + ',' + r1(m.y2) + ' 0,' + r1(m.y2); }
  function draw() {
    var ov = $('#ov'); if (!ov) return;
    var am = activeMask(), cov = S.d.settings.cover, divs = dividers(), H = R.Hu, s = '';
    if (!am && !R.edit) { ov.innerHTML = ''; return; }
    var sec = R.edit ? 0 : (am.sec || 0), hb = !R.edit && am.hb;
    if (sec > divs.length + 1) sec = 0;
    if (!hb) R.items.forEach(function (m, i) {
      if (m.k !== 'box') return;
      s += '<rect data-i="' + i + '" class="' + (R.edit && R.sel === i ? 'sel' : '') + '" x="' + r1(m.x) + '" y="' + r1(m.y) + '" width="' + r1(m.w) + '" height="' + r1(m.h) + '" rx="4" fill="' + m.c + '" fill-opacity="' + m.o + '"' + (m.b ? ' stroke="' + m.c + '" stroke-width="4"' : '') + '/>';
    });
    if (sec && divs.length) {
      var above = divs[sec - 2], below = divs[sec - 1];
      if (above) s += '<polygon points="0,0 1000,0 ' + divPts(above.m) + '" fill="' + cov + '"/>';
      if (below) s += '<polygon points="' + divPts(below.m) + ' 0,' + r1(H) + ' 1000,' + r1(H) + '" fill="' + cov + '"/>';
    }
    if (R.edit) divs.forEach(function (x) {
      s += '<polyline class="div' + (R.sel === x.i ? ' sel' : '') + '" points="' + divPts(x.m) + '" style="pointer-events:none"/><polyline class="hit" data-i="' + x.i + '" points="' + divPts(x.m) + '"/>';
    });
    else if (!sec) divs.forEach(function (x) { s += '<polyline class="div view" points="' + divPts(x.m) + '"/>'; });
    var m = R.items[R.sel];
    if (R.edit && m) {
      if (m.k === 'box') s += '<circle class="hd" data-h="tl" cx="' + r1(m.x) + '" cy="' + r1(m.y) + '" r="18"/><circle class="hd" data-h="br" cx="' + r1(m.x + m.w) + '" cy="' + r1(m.y + m.h) + '" r="18"/>';
      else s += '<circle class="hd" data-h="r" cx="' + r1((1000 + m.x) / 2) + '" cy="' + r1(m.y1) + '" r="18"/>' +
        '<circle class="hd" data-h="l" cx="' + r1(m.x / 2) + '" cy="' + r1(m.y2) + '" r="18"/>' +
        '<circle class="hd" data-h="s" cx="' + r1(m.x) + '" cy="' + r1((m.y1 + m.y2) / 2) + '" r="15"/>';
    }
    if (R.tmp) s += '<rect x="' + r1(R.tmp.x) + '" y="' + r1(R.tmp.y) + '" width="' + r1(R.tmp.w) + '" height="' + r1(R.tmp.h) + '" fill="' + R.style.c + '" fill-opacity="' + R.style.o + '" stroke="#1d6fe0" stroke-width="3" stroke-dasharray="8 6"/>';
    ov.innerHTML = s;
  }

  /* ---------- crop window ---------- */
  function drawCrop() {
    var ov = $('#ov'); if (!ov) return;
    var d = R.draft, H = R.Hu, x0 = d.l * 1000, y0 = d.t * H, x1 = (1 - d.r) * 1000, y1 = (1 - d.b) * H, s = '';
    s += '<path fill="rgba(0,0,0,.55)" fill-rule="evenodd" d="M0 0H1000V' + r1(H) + 'H0Z M' + r1(x0) + ' ' + r1(y0) + 'V' + r1(y1) + 'H' + r1(x1) + 'V' + r1(y0) + 'Z"/>';
    s += '<rect x="' + r1(x0) + '" y="' + r1(y0) + '" width="' + r1(x1 - x0) + '" height="' + r1(y1 - y0) + '" fill="none" stroke="#fff" stroke-width="3"/>';
    for (var i = 1; i < 3; i++) {
      s += '<line x1="' + r1(x0 + (x1 - x0) * i / 3) + '" y1="' + r1(y0) + '" x2="' + r1(x0 + (x1 - x0) * i / 3) + '" y2="' + r1(y1) + '" stroke="rgba(255,255,255,.35)" stroke-width="1.5"/>';
      s += '<line x1="' + r1(x0) + '" y1="' + r1(y0 + (y1 - y0) * i / 3) + '" x2="' + r1(x1) + '" y2="' + r1(y0 + (y1 - y0) * i / 3) + '" stroke="rgba(255,255,255,.35)" stroke-width="1.5"/>';
    }
    var L = 46, w = 9;
    [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]].forEach(function (c) {
      s += '<path d="M' + r1(c[0]) + ' ' + r1(c[1] + c[3] * L) + 'V' + r1(c[1]) + 'H' + r1(c[0] + c[2] * L) + '" fill="none" stroke="#fff" stroke-width="' + w + '" stroke-linecap="round"/>';
    });
    [[(x0 + x1) / 2, y0, 1, 0], [(x0 + x1) / 2, y1, 1, 0], [x0, (y0 + y1) / 2, 0, 1], [x1, (y0 + y1) / 2, 0, 1]].forEach(function (c) {
      s += '<line x1="' + r1(c[0] - c[2] * 26) + '" y1="' + r1(c[1] - c[3] * 26) + '" x2="' + r1(c[0] + c[2] * 26) + '" y2="' + r1(c[1] + c[3] * 26) + '" stroke="#fff" stroke-width="' + w + '" stroke-linecap="round"/>';
    });
    ov.innerHTML = s;
  }

  /* ---------- pointer on the overlay (mask edit + crop) ---------- */
  function P(e) { var r = $('#ov').getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * 1000, y: (e.clientY - r.top) / r.width * 1000 }; }
  function bindOv() {
    var ov = $('#ov'); if (!ov) return;
    var active = R.edit || R.sub === 'crop';
    ov.style.pointerEvents = active ? 'auto' : 'none';
    ov.style.touchAction = 'none';
    ov.onpointerdown = function (e) {
      if (!active) return;
      e.preventDefault(); e.stopPropagation();
      try { ov.setPointerCapture(e.pointerId); } catch (x) {}
      var pt = P(e), ds = e.target.dataset || {};
      if (R.sub === 'crop') {
        var d = R.draft, H = R.Hu, x0 = d.l * 1000, y0 = d.t * H, x1 = (1 - d.r) * 1000, y1 = (1 - d.b) * H, near = 70, ed = {};
        if (Math.abs(pt.x - x0) < near) ed.l = 1; else if (Math.abs(pt.x - x1) < near) ed.r = 1;
        if (Math.abs(pt.y - y0) < near) ed.t = 1; else if (Math.abs(pt.y - y1) < near) ed.b = 1;
        var inside = pt.x > x0 && pt.x < x1 && pt.y > y0 && pt.y < y1;
        if (!Object.keys(ed).length && !inside) return;
        R.drag = { k: 'crop', ed: ed, move: !Object.keys(ed).length, pt: pt, orig: JSON.parse(JSON.stringify(d)) };
        return;
      }
      if (ds.h != null && R.sel >= 0) { R.drag = { k: 'h', h: ds.h, i: R.sel }; return; }
      if (ds.i != null) { R.sel = +ds.i; R.drag = { k: 'move', i: +ds.i, pt: pt, orig: JSON.parse(JSON.stringify(R.items[+ds.i])) }; draw(); renderPanel(); return; }
      if (R.sel >= 0) { R.sel = -1; draw(); renderPanel(); }
    };
    ov.onpointermove = function (e) {
      var d = R.drag; if (!d) return;
      var pt = P(e), m;
      if (d.k === 'crop') {
        var o = d.orig, H = R.Hu, dx = (pt.x - d.pt.x) / 1000, dy = (pt.y - d.pt.y) / H, n = R.draft, MIN = 0.2;
        if (d.move) {
          var ddx = clamp(dx, -o.l, o.r), ddy = clamp(dy, -o.t, o.b);
          n.l = o.l + ddx; n.r = o.r - ddx; n.t = o.t + ddy; n.b = o.b - ddy;
        } else {
          if (d.ed.l) n.l = clamp(o.l + dx, 0, 1 - o.r - MIN); if (d.ed.r) n.r = clamp(o.r - dx, 0, 1 - o.l - MIN);
          if (d.ed.t) n.t = clamp(o.t + dy, 0, 1 - o.b - MIN); if (d.ed.b) n.b = clamp(o.b - dy, 0, 1 - o.t - MIN);
        }
        drawCrop(); return;
      }
      if (d.k === 'new') { R.tmp = { x: Math.min(d.x0, pt.x), y: Math.min(d.y0, pt.y), w: Math.abs(pt.x - d.x0), h: Math.abs(pt.y - d.y0) }; draw(); return; }
      if (d.k === 'move') {
        m = R.items[d.i]; var mx = pt.x - d.pt.x, my = pt.y - d.pt.y;
        if (m.k === 'box') { m.x = d.orig.x + mx; m.y = d.orig.y + my; } else { m.y1 = d.orig.y1 + my; m.y2 = d.orig.y2 + my; }
        draw(); return;
      }
      if (d.k === 'h') {
        m = R.items[d.i]; if (!m) return;
        if (d.h === 'br') { m.w = Math.max(12, pt.x - m.x); m.h = Math.max(12, pt.y - m.y); }
        else if (d.h === 'tl') { var rx = m.x + m.w, by = m.y + m.h; m.x = Math.min(pt.x, rx - 12); m.y = Math.min(pt.y, by - 12); m.w = rx - m.x; m.h = by - m.y; }
        else if (d.h === 'r') m.y1 = clamp(pt.y, 0, R.Hu); else if (d.h === 'l') m.y2 = clamp(pt.y, 0, R.Hu); else if (d.h === 's') m.x = clamp(pt.x, 15, 985);
        draw();
      }
    };
    ov.onpointercancel = function () { R.drag = null; R.tmp = null; if (R.sub !== 'crop') draw(); };
    ov.onpointerup = function (e) {
      var d = R.drag; R.drag = null; if (!d) return;
      var pt = P(e);
      if (d.k === 'crop') return;
      if (d.k === 'new') {
        var t = R.tmp; R.tmp = null;
        if (t && t.w > 10 && t.h > 10) { R.items.push({ k: 'box', x: t.x, y: t.y, w: t.w, h: t.h, c: R.style.c, o: R.style.o, b: R.style.b }); R.sel = R.items.length - 1; commitItems(); renderPanel(); }
        draw(); return;
      }
      if (d.k === 'line') {
        if (Math.abs(pt.y - d.y0) < 40 && Math.abs(pt.x - d.x0) < 40) {
          R.items.push({ k: 'div', x: 500, y1: pt.y, y2: pt.y }); R.sel = R.items.length - 1; commitItems(); renderPanel();
        }
        draw(); return;
      }
      commitItems(); draw();
    };
  }

  /* ---------- page gestures (read mode) ---------- */
  function bindGestures() {
    var sc = $('#rscroll'), g = null;
    sc.addEventListener('pointerdown', function (e) {
      if (R.edit || R.sub === 'crop' || (e.pointerType === 'mouse' && e.button !== 0)) return;
      g = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId, ax: null };
    });
    sc.addEventListener('pointermove', function (e) {
      if (!g || e.pointerId !== g.id) return;
      var dx = e.clientX - g.x, dy = e.clientY - g.y;
      if (!g.ax && Math.abs(dx) + Math.abs(dy) > 12) g.ax = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (g.ax === 'x') { var sh = $('#sheet'); sh.style.transition = 'none'; sh.style.transform = 'translateX(' + dx + 'px)'; }
    });
    sc.addEventListener('pointerup', function (e) {
      if (!g || e.pointerId !== g.id) return;
      var dx = e.clientX - g.x, dy = e.clientY - g.y, dt = Date.now() - g.t, ax = g.ax, sh = $('#sheet'); g = null;
      if (ax === 'x') {
        var dir = dx > 0 ? 1 : -1, np = R.p + dir;
        if (Math.abs(dx) > 60 && np >= 1 && np <= 604) {
          sh.style.transition = 'transform .13s ease-in'; sh.style.transform = 'translateX(' + (dir * innerWidth) + 'px)';
          setTimeout(function () { go(np, dir); }, 130); return;
        }
        sh.style.transition = 'transform .18s ease-out'; sh.style.transform = ''; return;
      }
      if (ax === 'y') {
        if (dy < -50 && !R.panel) togglePanel(true); else if (dy > 50 && R.panel && fitPage()) togglePanel(false);
        return;
      }
      if (!ax && dt < 350) togglePanel(!R.panel);
    });
    sc.addEventListener('pointercancel', function (e) { if (g && e.pointerId === g.id) { g = null; var sh = $('#sheet'); sh.style.transition = 'transform .18s'; sh.style.transform = ''; } });
    document.addEventListener('keydown', function (e) {
      if (!Reader.isOpen() || /INPUT|SELECT|TEXTAREA/.test((e.target || {}).tagName)) return;
      if (e.key === 'ArrowLeft') go(R.p + 1, 1); else if (e.key === 'ArrowRight') go(R.p - 1, -1); else if (e.key === 'Escape') history.back();
    });
  }
  function togglePanel(on) { R.panel = on; renderPanel(); }

  /* ---------- panel ---------- */
  var I = function (d) { return '<svg class="i" viewBox="0 0 24 24">' + d + '</svg>'; };
  var IC = {
    box: I('<rect x="3" y="6" width="18" height="12" rx="2"/>'), line: I('<path d="M3 9h10v6h8"/>'),
    crop: I('<path d="M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2"/>'), join: I('<path d="M4 4h16v5H4zM4 15h16v5H4zM12 9v6"/>'),
    tag: I('<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>'),
    full: I('<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>'),
    fitp: I('<rect x="6" y="3" width="12" height="18" rx="1.5"/><path d="M9 8h6M9 12h6M9 16h4"/>'), fitw: I('<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/>'),
    left: I('<path d="M15 18l-6-6 6-6"/>'), right: I('<path d="M9 18l6-6-6-6"/>'), check: I('<path d="M20 6L9 17l-5-5"/>'),
    pen: I('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'), up: I('<path d="M18 15l-6-6-6 6"/>'), trash: I('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>')
  };
  function tb(id, label, icon, on) { return '<button class="tb' + (on ? ' on' : '') + '" data-ract="' + id + '">' + icon + label + '</button>'; }
  function navBtns(cls) {
    return '<button class="navb ' + cls + ' l" data-ract="next" aria-label="Next page"' + (R.p >= 604 ? ' disabled' : '') + '>' + IC.left + '</button>' +
      '<button class="navb ' + cls + ' r" data-ract="prev" aria-label="Previous page"' + (R.p <= 1 ? ' disabled' : '') + '>' + IC.right + '</button>';
  }
  function renderPanel() {
    var host = $('#rui'), p = R.p, x = '<button class="rback" data-ract="home" aria-label="Home">' + IC.left + '</button>';
    if (!R.panel) {
      x += navBtns('float') + '<button class="rhandle" data-ract="expand" aria-label="Show controls">' + IC.up + '<span>P. ' + p + '</span></button>';
      host.innerHTML = x; afterPanel(); return;
    }
    x += '<div class="rpanel"><button class="grab" data-ract="collapse" aria-label="Hide controls"><i></i></button>';
    if (R.sub === 'crop') x += cropPanel();
    else if (R.edit) x += editPanel();
    else x += mainPanel();
    x += '</div>';
    host.innerHTML = x; afterPanel();
  }
  function afterPanel() { if (measurePanel()) relayout(); }

  function mainPanel() {
    var p = R.p, o = S.get(p), m = S.isMem(p), h = S.health(p), mc = S.monthCount(p), revToday = o.lr === S.today();
    var ms = masksOf(p), am = activeMask(), x = '';
    x += '<div class="rrow nav">' + navBtns('in') + '<div class="rtitle"><span class="plabel">P. ' + p + '</span>' + App.esc(App.pageTitle(p)) + '</div></div>';
    x += '<div class="rrow scroll"><button class="pill' + (m ? ' on' : '') + '" data-ract="mem">' + (m ? IC.check + 'Memorizing' : '+ Memorize') + '</button>';
    if (m) x += '<span class="hctl"><button data-ract="hminus" aria-label="Lower health">−</button><span style="color:' + (h ? App.hcol(h) : 'var(--muted)') + '">' + h + '%</span><button data-ract="hplus" aria-label="Raise health">+</button></span>' +
      '<button class="pill soft' + (revToday ? ' on' : '') + '" data-ract="rev">' + IC.check + 'Reviewed' + (mc ? ' · ' + mc + '×' : '') + '</button>' +
      '<button class="pill soft' + (R.sub === 'tags' ? ' on' : '') + '" data-ract="tags">' + IC.tag + 'Tags</button>';
    x += '</div>';
    if (R.sub === 'tags') x += '<div class="rrow scroll">' + App.allTags().map(function (t) { return '<button class="chip' + (S.hasTag(p, t.id) ? ' on' : '') + '" data-ract="tag" data-t="' + App.esc(t.id) + '">' + App.esc(t.name) + '</button>'; }).join('') + '</div>';
    x += '<div class="rrow scroll"><span class="lbl">Masks</span><button class="chip' + (!am ? ' on' : '') + '" data-ract="mask" data-id="">None</button>' +
      ms.map(function (mm) { return '<button class="chip' + (am && am.id === mm.id ? ' on' : '') + '" data-ract="mask" data-id="' + mm.id + '">' + App.esc(mm.name) + '</button>'; }).join('') +
      (am ? '<button class="chip" data-ract="editMask">' + IC.pen + 'Edit</button><button class="chip' + (R.sub === 'maskmenu' ? ' on' : '') + '" data-ract="maskMenu" aria-label="Mask options">⋯</button>' : '') + '<button class="chip add" data-ract="newMask">+ New</button></div>';
    if (am && R.sub === 'maskmenu') x += '<div class="rrow"><button class="btn sm" data-ract="renameMask">Rename “' + App.esc(am.name) + '”</button><span style="flex:1"></span><button class="btn sm danger" data-ract="delMask">' + IC.trash + 'Delete mask</button></div>';
    if (am) {
      var nd = nDiv(R.items), hasBox = R.items.some(function (q) { return q.k === 'box'; });
      if (nd || hasBox) {
        x += '<div class="rrow scroll">';
        if (nd) { x += '<button class="chip' + (!am.sec ? ' on' : '') + '" data-ract="sec" data-s="0">Whole page</button>'; for (var i = 1; i <= nd + 1; i++) x += '<button class="chip' + (am.sec === i ? ' on' : '') + '" data-ract="sec" data-s="' + i + '">Section ' + i + '</button>'; }
        if (hasBox) x += '<button class="chip' + (!am.hb ? ' on' : '') + '" data-ract="hb">Boxes ' + (am.hb ? 'off' : 'on') + '</button>';
        x += '</div>';
      }
    }
    if (R.sub === 'join') {
      var j = joinOf(p);
      x += '<div class="rsub"><div class="hint">Show part of the neighbouring pages, and trim this page to make room.</div>' +
        slider('jn.prev', 'From P. ' + (p - 1), j.prev, 60, 2.5) + slider('jn.next', 'From P. ' + (p + 1), j.next, 60, 2.5) +
        slider('jn.trimT', 'Trim top', j.trimT, 60, 2.5) + slider('jn.trimB', 'Trim bottom', j.trimB, 60, 2.5) +
        '<div class="rrow"><button class="btn sm" data-ract="joinReset">Reset</button><span style="flex:1"></span><button class="btn sm pri" data-ract="subDone">Done</button></div></div>';
    }
    x += '<div class="rrow scroll tools">' + tb('crop', 'Crop', IC.crop, false) + tb('join', 'Join', IC.join, R.sub === 'join') +
      tb('fit', fitPage() ? 'Fit page' : 'Fit width', fitPage() ? IC.fitp : IC.fitw, false) + tb('fs', 'Full screen', IC.full, false) + '</div>';
    return x;
  }
  function editPanel() {
    var am = activeMask(), m = R.items[R.sel], x = '';
    x += '<div class="rrow"><div class="rtitle" style="text-align:left">Editing <b>' + App.esc(am ? am.name : '') + '</b></div><button class="btn sm pri" data-ract="doneEdit">Done</button></div>';
    x += '<div class="rrow scroll"><button class="pill soft" data-ract="addBox">' + IC.box + '+ Box</button><button class="pill soft" data-ract="addLine">' + IC.line + '+ Line</button>' +
      '<span style="flex:1"></span><button class="btn sm danger" data-ract="del"' + (m ? '' : ' disabled style="opacity:.4"') + '>' + IC.trash + 'Delete</button></div>';
    if (m && m.k === 'box') x += boxStyle(m);
    x += '<div class="hint">' + (m ? (m.k === 'box' ? 'Drag the box to move it; drag a round handle to resize.' + '' : 'Drag the line to move it. Drag a side handle to make a step; the middle handle moves the step.') + (m.k === 'div' ? ' <button class="addlink" data-ract="straight">Straighten</button>' : '')
      : 'Tap + Box or + Line to add one. Tap a box or line to select it.') + '</div>';
    return x;
  }
  function cropPanel() {
    return '<div class="rrow"><div class="rtitle" style="text-align:left">Crop <span class="plabel">P. ' + R.p + '</span></div></div>' +
      '<div class="hint">Drag the edges or corners. Drag inside to move.</div>' +
      '<div class="rrow scroll"><button class="btn sm" data-ract="cropAuto">Auto</button><button class="btn sm" data-ract="cropNone">Whole page</button>' +
      (R.p > 1 ? '<button class="btn sm" data-ract="cropPrev">Same as P. ' + (R.p - 1) + '</button>' : '') +
      '<span style="flex:1"></span><button class="btn sm" data-ract="cropCancel">Cancel</button><button class="btn sm pri" data-ract="cropApply">Apply</button></div>';
  }
  function slider(key, label, val, max, step) {
    return '<div class="sl"><span>' + label + '</span><input type="range" min="0" max="' + max + '" step="' + step + '" value="' + (val * 100) + '" data-rin="' + key + '"><b>' + (Math.round(val * 1000) / 10) + '%</b></div>';
  }
  function boxStyle(m) {
    return '<div class="rrow scroll">' + COLORS.map(function (c) { return '<button class="sw-c' + (m.c === c ? ' on' : '') + '" style="background:' + c + '" data-ract="bc" data-c="' + c + '" aria-label="Colour"></button>'; }).join('') +
      '<span class="hctl" style="margin-left:4px">' + [0.25, 0.45, 0.7, 1].map(function (v) { return '<button style="width:auto;padding:0 8px;font-size:12.5px' + (Math.abs(m.o - v) < 0.01 ? ';color:var(--acc)' : '') + '" data-ract="bo" data-o="' + v + '">' + Math.round(v * 100) + '%</button>'; }).join('') + '</span>' +
      '<button class="pill soft' + (m.b ? ' on' : '') + '" data-ract="bb">Border</button></div>';
  }

  /* ---------- actions ---------- */
  function selBox() { var m = R.items[R.sel]; return (R.edit && m && m.k === 'box') ? m : R.style; }
  function afterStyle() { var m = selBox(); if (m !== R.style) { R.style.c = m.c; R.style.o = m.o; R.style.b = m.b; commitItems(); } draw(); renderPanel(); }
  function setActive(id) { saveMasks(function (ms, o) { o.am = id || ''; }); loadItems(); }
  var RACT = {
    home: function () { history.back(); },
    next: function () { go(R.p + 1, 1); }, prev: function () { go(R.p - 1, -1); },
    collapse: function () { togglePanel(false); }, expand: function () { togglePanel(true); },
    mem: function () { var on = !S.isMem(R.p); S.setMem(R.p, on); App.toast(on ? 'Added to Memorizing (New)' : 'Moved back to To Memorize'); renderPanel(); App.precache(); },
    hminus: function () { S.setHealth(R.p, S.health(R.p) - 5); renderPanel(); },
    hplus: function () { S.setHealth(R.p, S.health(R.p) + 5); renderPanel(); },
    rev: function () {
      var o = S.get(R.p), prev = { lr: o.lr, rv: JSON.parse(JSON.stringify(o.rv || {})), h: o.h }, p = R.p;
      S.reviewed(p); renderPanel();
      App.toast('Marked reviewed · ' + S.monthCount(p) + '× this month', function () { S.unreview(p, prev); if (R.p === p) renderPanel(); });
    },
    tags: function () { R.sub = R.sub === 'tags' ? null : 'tags'; renderPanel(); },
    tag: function (el) { S.toggleTag(R.p, el.dataset.t); renderPanel(); },
    mask: function (el) { setActive(el.dataset.id); draw(); renderPanel(); },
    newMask: function () {
      var id = 'm' + Date.now().toString(36), n = masksOf(R.p).length + 1;
      saveMasks(function (ms, o) { ms.push({ id: id, name: 'Mask ' + n, items: [], sec: 0 }); o.am = id; });
      loadItems(); R.edit = true; R.sel = -1; R.sub = null; renderPanel(); layout();
    },
    editMask: function () { if (!activeMask()) return; R.edit = true; R.sel = -1; R.sub = null; renderPanel(); layout(); },
    doneEdit: function () { R.edit = false; R.sel = -1; R.tmp = null; renderPanel(); layout(); },
    renameMask: function () {
      var am = activeMask(); if (!am) return; var n = (prompt('Mask name', am.name) || '').trim(); if (!n) return;
      saveMasks(function (ms) { ms.forEach(function (m) { if (m.id === am.id) m.name = n; }); }); renderPanel();
    },
    delMask: function () {
      var am = activeMask(); if (!am || !confirm('Delete “' + am.name + '”?')) return;
      saveMasks(function (ms, o) { o.am = ''; ms.splice(0, ms.length, ...ms.filter(function (m) { return m.id !== am.id; })); });
      loadItems(); R.edit = false; R.sel = -1; R.sub = null; renderPanel(); layout();
    },
    addBox: function () {
      var nb = R.items.filter(function (q) { return q.k === 'box'; }).length, off = (nb % 6) * 40;
      R.items.push({ k: 'box', x: 330 + off * 0.5, y: clamp(R.Hu * 0.3 + off, 0, R.Hu - 90), w: 340, h: 80, c: R.style.c, o: R.style.o, b: R.style.b });
      R.sel = R.items.length - 1; commitItems(); draw(); renderPanel();
    },
    addLine: function () {
      var ds = dividers(), last = ds.length ? ds[ds.length - 1].m : null, y = last ? Math.max(last.y1, last.y2) + 140 : R.Hu * 0.35;
      if (y > R.Hu - 40) y = R.Hu / 2;
      R.items.push({ k: 'div', x: 500, y1: y, y2: y }); R.sel = R.items.length - 1; commitItems(); draw(); renderPanel();
    },
    maskMenu: function () { R.sub = R.sub === 'maskmenu' ? null : 'maskmenu'; renderPanel(); },
    del: function () { if (R.sel < 0) return; R.items.splice(R.sel, 1); R.sel = -1; commitItems(); draw(); renderPanel(); },
    straight: function () { var m = R.items[R.sel]; if (!m) return; m.y2 = m.y1; m.x = 500; commitItems(); draw(); },
    sec: function (el) { var s = +el.dataset.s, am = activeMask(); saveMasks(function (ms) { ms.forEach(function (m) { if (m.id === am.id) m.sec = s; }); }); draw(); renderPanel(); },
    hb: function () { var am = activeMask(); saveMasks(function (ms) { ms.forEach(function (m) { if (m.id === am.id) m.hb = !m.hb; }); }); draw(); renderPanel(); },
    bc: function (el) { selBox().c = el.dataset.c; afterStyle(); },
    bo: function (el) { selBox().o = +el.dataset.o; afterStyle(); },
    bb: function () { var m = selBox(); m.b = !m.b; afterStyle(); },
    join: function () { R.sub = R.sub === 'join' ? null : 'join'; renderPanel(); },
    subDone: function () { R.sub = null; renderPanel(); },
    joinReset: function () { S.edit(R.p, function (o) { delete o.jn; }); renderPanel(); relayout(); },
    fit: function () { S.d.settings.fit = fitPage() ? 'width' : 'page'; S.saveSettings(); renderPanel(); layout(); },
    fs: function () {
      var d = document;
      if (d.fullscreenElement) d.exitFullscreen(); else if (d.documentElement.requestFullscreen) d.documentElement.requestFullscreen().catch(function () { App.toast('Install the app for full screen'); });
      else App.toast('Install the app for full screen');
    },
    crop: function () { R.draft = cropOf(R.p); R.sub = 'crop'; R.edit = false; renderPanel(); layout(); },
    cropAuto: function () { R.draft = autoCrop(R.p); drawCrop(); },
    cropNone: function () { R.draft = { l: 0, t: 0, r: 0, b: 0 }; drawCrop(); },
    cropPrev: function () { R.draft = cropOf(R.p - 1); drawCrop(); },
    cropCancel: function () { R.sub = null; R.draft = null; renderPanel(); layout(); },
    cropApply: function () {
      var d = R.draft, a = autoCrop(R.p), same = ['l', 't', 'r', 'b'].every(function (k) { return Math.abs(d[k] - a[k]) < 0.0005; });
      S.edit(R.p, function (o) { if (same) delete o.crop; else o.crop = { l: r4(d.l), t: r4(d.t), r: r4(d.r), b: r4(d.b) }; });
      R.sub = null; R.draft = null; renderPanel(); layout();
    }
  };

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-ract]'); if (!el) return;
    var f = RACT[el.dataset.ract]; if (f) { e.preventDefault(); if (el.classList.contains('navb')) buzz(); f(el, e); }
  });
  document.addEventListener('input', function (e) {
    var k = e.target.dataset && e.target.dataset.rin; if (!k) return;
    var parts = k.split('.'), v = +e.target.value / 100;
    e.target.nextElementSibling.textContent = (Math.round(v * 1000) / 10) + '%';
    S.edit(R.p, function (o) {
      o[parts[0]] = o[parts[0]] || {}; o[parts[0]][parts[1]] = v;
      var j = o.jn; if ((j.trimT || 0) + (j.trimB || 0) > 0.8) j[parts[1]] = 0.8 - (parts[1] === 'trimT' ? (j.trimB || 0) : (j.trimT || 0));
    });
    relayout();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindGestures); else bindGestures();
})();
