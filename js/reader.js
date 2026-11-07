/* Page reader: fit-to-screen, auto-trim + crop window, joins with previous/next page,
   named masks (boxes + staircase section lines), RTL swipe, drawer panel. */
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var R = {
    p: 1, oy: 0, panel: true, sub: null, edit: false, tool: 'box', sel: -1, imgs: {}, Hu: 1000, items: [], drag: null, tmp: null,
    draft: null, ph: -1, style: { c: '#ffd400', o: 0.45, b: false }
  };
  var COLORS = ['#ffd400', '#ffb020', '#ff7a1a', '#ff5a5a', '#ff5fa2', '#e040fb', '#b061ff', '#6b6bff', '#3d8bff', '#2ec4f0', '#19c2b0', '#3ccf7a', '#9bd13c', '#a0703c', '#8a8f98'];
  // Last-used box style (colour, opacity, border) and the 3 most recent colours, remembered across the app.
  function boxDef() { var s = S.d.settings; return { c: s.boxC || '#ffd400', o: s.boxO != null ? s.boxO : 0.2, b: !!s.boxB }; }
  function recentC() { var r = (S.d.settings.recentC || []).slice(0, 3); COLORS.forEach(function (c) { if (r.length < 3 && r.indexOf(c) < 0) r.push(c); }); return r; }
  function rememberStyle(m) {
    var s = S.d.settings, r = (s.recentC || []).filter(function (c) { return c !== m.c; });
    r.unshift(m.c); s.recentC = r.slice(0, 3); s.boxC = m.c; s.boxO = m.o; s.boxB = !!m.b; S.saveSettings();
  }
  // Opened from the home-screen icon: already full screen, so the button (and Chrome's exit message) isn't needed.
  function installed() { return !!(window.matchMedia && (matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches)); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function r1(v) { return Math.round(v * 10) / 10; }
  function r4(v) { return Math.round(v * 10000) / 10000; }
  function buzz() { try { navigator.vibrate && navigator.vibrate(8); } catch (e) {} }
  function fitPage() { return S.d.settings.fit !== 'width'; }
  // Landscape-only zoom out (40–100%), so a wide screen doesn't blow the page up too far.
  function land() { return innerWidth > innerHeight; }
  function lzoom() { var z = S.d.settings.lz; return land() && z ? clamp(z, 40, 100) / 100 : 1; }
  function zoomChip() { var z = Math.round(lzoom() * 100); return '<div class="zchip"><button data-ract="zout" aria-label="Zoom out"' + (z <= 40 ? ' disabled' : '') + '>−</button><span>' + z + '%</span><button data-ract="zin" aria-label="Zoom in"' + (z >= 100 ? ' disabled' : '') + '>+</button></div>'; }

  /* ---------- crop / joins ---------- */
  function autoCrop(p) {
    var s = S.d.settings, mode = s.trim || 'full';
    if (mode === 'off' || !window.AUTOCROP) return { l: 0, t: 0, r: 0, b: 0 };
    var a = AUTOCROP[mode === 'frame' ? 'frame' : 'full'][p - 1], pad = s.trimPad == null ? 0.01 : s.trimPad;
    var sp = mode === 'frame' ? pad : 0; // sides are cut at the frame so margin markers (hizb/rub') never show
    return { l: Math.max(0, a[0] - sp), t: Math.max(0, a[1] - pad), r: Math.max(0, a[2] - sp), b: Math.max(0, a[3] - pad) };
  }
  function cropOf(p) { var c = S.get(p).crop; return c ? { l: c.l || 0, t: c.t || 0, r: c.r || 0, b: c.b || 0 } : autoCrop(p); }
  // Join belongs to a mask (so surahs sharing a page each keep their own joined view); None shows the plain page.
  function jnOf() { var am = activeMask(); return am && am.jn ? am.jn : null; }
  function setJn(fn) { var am = activeMask(); if (!am) return; saveMasks(function (ms) { ms.forEach(function (m) { if (m.id === am.id) { var j = fn(m.jn ? JSON.parse(JSON.stringify(m.jn)) : {}); if (j) m.jn = j; else delete m.jn; } }); }); }
  function joinOf(p, raw) { var j = (p === R.p && jnOf()) || {}; if (j.off && !raw) j = {}; return { prev: j.prev || 0, next: j.next || 0, trimT: j.trimT || 0, trimB: j.trimB || 0, prevCut: j.prevCut || 0, nextCut: j.nextCut || 0 }; }
  function segsFor(p) {
    if (R.sub === 'crop') return [{ p: p, y0: 0, y1: 1, raw: true }];
    var j = joinOf(p), s = [];
    if (j.prev > 0 && p > 1) s.push({ p: p - 1, y0: Math.max(0, 1 - j.prevCut - j.prev), y1: 1 - j.prevCut, role: 'prev' });
    s.push({ p: p, y0: j.trimT, y1: 1 - j.trimB, role: 'this' });
    if (j.next > 0 && p < 604) s.push({ p: p + 1, y0: j.nextCut, y1: Math.min(1, j.nextCut + j.next), role: 'next' });
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
    var am = S.get(R.p).am, items = shiftItems(R.items, -R.oy).map(function (m) { var c = {}; for (var k in m) c[k] = typeof m[k] === 'number' ? r1(m[k]) : m[k]; return c; });
    saveMasks(function (ms) { ms.forEach(function (m) { if (m.id === am) { m.items = items; if (m.sec > nDiv(items) + 1) m.sec = 0; } }); });
  }
  function nDiv(items) { return items.filter(function (m) { return m.k === 'div'; }).length; }
  function loadItems() { var m = activeMask(); R.items = shiftItems(m ? m.items || [] : [], R.oy); }
  // Boxes and lines are saved against the page itself, so joining or trimming never moves them off their words.
  function shiftItems(list, d) {
    return JSON.parse(JSON.stringify(list)).map(function (m) { if (m.k === 'box') m.y += d; else if (m.k === 'div') { m.y1 += d; m.y2 += d; } return m; });
  }

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
    // range: optional list of unit keys (from the Memorizing tab) — swiping/arrows then stay within those pages.
    open: function (p, n, range) {
      R.style = boxDef(); R.palOpen = false;
      p = clamp(p | 0, 1, 604); R.n = n || 0;
      R.range = range && range.length ? range.slice().sort(function (a, b) { return S.kp(a) - S.kp(b); }) : null;
      if (!Reader.isOpen()) history.pushState({ reader: 1 }, '', '#p' + p);
      $('#reader').classList.add('on'); document.body.style.overflow = 'hidden';
      go(p, 0);
    },
    close: function () {
      if (window.Timer) Timer.pause();
      $('#reader').classList.remove('on'); document.body.style.overflow = '';
      R.sub = null; R.edit = false; R.sel = -1; App.render(); if (window.Tally) Tally.render();
    },
    isOpen: function () { return $('#reader').classList.contains('on'); },
    page: function () { return R.p; },
    unit: function () { return R.k; },
    refresh: function () { if (Reader.isOpen()) renderPanel(); },
    relayout: function () { if (Reader.isOpen()) layout(); }
  };
  window.Reader = Reader;
  window.addEventListener('popstate', function () {
    if (!Reader.isOpen()) return;
    // An unsaved tally keeps the reader open until it is saved, edited or left.
    if (Tally.dirty()) { history.pushState({ reader: 1 }, '', '#p' + R.p); Tally.ask(function () { history.back(); }); return; }
    Reader.close();
  });

  // Next/previous page: the next listed page when opened from Memorizing, otherwise the adjacent mushaf page.
  function stepTo(dir) {
    if (!R.range) { var q = R.p + dir; return q >= 1 && q <= 604 ? { p: q } : null; }
    var r = R.range, i, k;
    if (dir > 0) { for (i = 0; i < r.length; i++) if (S.kp(r[i]) > R.p) { k = r[i]; break; } }
    else { for (i = r.length - 1; i >= 0; i--) if (S.kp(r[i]) < R.p) { k = r[i]; break; } }
    return k ? { p: S.kp(k), n: S.kn(k) } : null;
  }
  function step(dir) { var t = stepTo(dir); if (t) go(t.p, dir, t.n); return t; }
  function go(p, dir, n) {
    if (p < 1 || p > 604) return;
    var ss0 = S.onPage(p), n0 = n || R.n; if (ss0.indexOf(n0) < 0) n0 = dir < 0 ? ss0[ss0.length - 1] : ss0[0];
    if (Tally.dirty() && Tally.unit() !== S.uk(p, n0)) {
      Tally.ask(function () { go(p, dir, n); }, function () { var sh = $('#sheet'); sh.style.transition = 'transform .18s'; sh.style.transform = ''; renderPanel(); });
      return;
    }
    if (n) R.n = n;
    if (dir) buzz();
    // Which surah's portion of the page this is. A shared page keeps the surah you came from if it is on it;
    // otherwise moving forward lands on the first surah there, moving back on the last.
    var ss = S.onPage(p);
    if (ss.indexOf(R.n) < 0) R.n = dir < 0 ? ss[ss.length - 1] : ss[0];
    R.k = S.uk(p, R.n);
    if (p !== R.p) Tally.newPage();
    R.p = p; R.sel = -1; R.drag = null; R.edit = false; R.draft = null;
    // Every page opens on Mask 1 (created the first time it's needed).
    var ms0 = masksOf(p);
    if (!ms0.length) saveMasks(function (ms, o) { ms.push({ id: 'm' + Date.now().toString(36) + '1', name: 'Mask 1', items: [], sec: 0 }); o.am = ms[0].id; });
    else if (S.get(p).am !== ms0[0].id) setActive(ms0[0].id);
    if (R.sub === 'crop' || R.sub === 'join') R.sub = null;
    loadItems();
    S.setLast(p, R.k);
    if (history.state && history.state.reader) history.replaceState({ reader: 1 }, '', '#p' + p);
    renderPanel(); Tally.render();
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
      // Whole-page mode keeps the page's own width; a join that makes it taller than the screen scrolls instead of shrinking.
      var fitAll = R.sub === 'crop' || R.sub === 'join' || R.edit, W;
      if (fitAll) W = Math.min(vw, vh / U);
      else if (fitPage()) { var Ub = U; segs.forEach(function (s, i) { if (s.role === 'this') Ub = dims[i].ch / dims[i].cw; }); W = Math.min(vw, vh / Math.min(U, Ub)); }
      else W = Math.min(vw, 820);
      W = Math.max(120, Math.floor(W * lzoom()));
      var html = '';
      segs.forEach(function (s, i) {
        var d = dims[i], k = W / d.cw, sx = d.c.l * d.nw, sy = d.c.t * d.nh + s.y0 * d.ch;
        html += '<div class="pseg' + (s.p !== p ? ' side' : '') + (R.sub === 'join' ? ' jseg' + (s.role === R.jt ? ' jt' : '') : '') + '" style="height:' + (d.u * W).toFixed(2) + 'px"><img src="' + d.im.src + '" alt="" style="width:' + (d.nw * k).toFixed(2) + 'px;transform:translate(' + (-sx * k).toFixed(2) + 'px,' + (-sy * k).toFixed(2) + 'px)"></div>';
      });
      R.Hu = U * 1000; R.U = U;
      if (R.sub !== 'crop') {
        var oy = 0;
        for (var si = 0; si < segs.length; si++) { if (segs[si].role === 'this') { oy -= segs[si].y0 * 1000 * dims[si].ch / dims[si].cw; break; } oy += dims[si].u * 1000; }
        if (Math.abs(oy - R.oy) > 0.01) { R.items = shiftItems(R.items, oy - R.oy); R.oy = oy; }
      }
      var H = U * W, fit = (fitPage() || fitAll) && H <= vh + 2;
      sheet.style.width = W + 'px'; sheet.style.marginLeft = sheet.style.marginRight = 'auto';
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
      if (R.U !== R.fitU && dzCur() === 'fit') { R.fitU = R.U; fitRows(); if (measurePanel()) relayout(); }
    }).catch(function () {
      if (seq === layoutSeq) $('#sheet').innerHTML = '<div style="padding:40px;text-align:center;color:#666;background:#fff">Couldn’t load this page. Check your connection.</div>';
    });
  }
  function setZoom(d) { var s = S.d.settings; s.lz = clamp(Math.round(lzoom() * 100) + d, 40, 100); S.saveSettings(); afterPanel(); relayout(); }
  var rq = 0;
  function relayout() { cancelAnimationFrame(rq); rq = requestAnimationFrame(function () { layout(); }); }
  window.addEventListener('resize', function () { if (Reader.isOpen()) { measurePanel(); afterPanel(); relayout(); } });
  function measurePanel() { var pn = $('.rpanel'); var h = R.panel && pn ? pn.offsetHeight : 0; var ch = h !== R.ph; R.ph = h; return ch; }

  /* ---------- mask drawing ---------- */
  function dividers() {
    return R.items.map(function (m, i) { return { m: m, i: i }; }).filter(function (x) { return x.m.k === 'div'; })
      .sort(function (a, b) { return (a.m.y1 + a.m.y2) - (b.m.y1 + b.m.y2); });
  }
  function divPts(m) { return '1000,' + r1(m.y1) + ' ' + r1(m.x) + ',' + r1(m.y1) + ' ' + r1(m.x) + ',' + r1(m.y2) + ' 0,' + r1(m.y2); }
  function draw() {
    var ov = $('#ov'); if (!ov) return;
    var am = activeMask(), cov = S.d.settings.cover, divs = dividers(), H = R.Hu, s = '', tint = tallyTint();
    if (!am && !R.edit) { ov.innerHTML = tint; return; }
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
    s += tint;
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
      var g0 = g, ev = { clientX: e.clientX, clientY: e.clientY };
      if (activeMask() && R.items.length) g.lp = setTimeout(function () {
        if (g !== g0 || g.ax || !$('#ov')) return;
        var i = hitItem(P(ev)); if (i < 0) return;
        g = null; if (navigator.vibrate) try { navigator.vibrate(15); } catch (x) {}
        R.etool = R.items[i].k === 'box' ? 'box' : 'line'; startEdit(i); R.sel = i; draw(); renderPanel();
      }, 480);
    });
    sc.addEventListener('pointermove', function (e) {
      if (!g || e.pointerId !== g.id) return;
      var dx = e.clientX - g.x, dy = e.clientY - g.y;
      if (!g.ax && Math.abs(dx) + Math.abs(dy) > 12) { g.ax = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'; clearTimeout(g.lp); }
      if (g.ax === 'x') { var sh = $('#sheet'); sh.style.transition = 'none'; sh.style.transform = 'translateX(' + dx + 'px)'; }
    });
    sc.addEventListener('pointerup', function (e) {
      if (!g || e.pointerId !== g.id) return;
      clearTimeout(g.lp); var dx = e.clientX - g.x, dy = e.clientY - g.y, dt = Date.now() - g.t, ax = g.ax, sh = $('#sheet'); g = null;
      if (ax === 'x') {
        var dir = dx > 0 ? 1 : -1, nt = stepTo(dir);
        if (Math.abs(dx) > 60 && nt) {
          sh.style.transition = 'transform .13s ease-in'; sh.style.transform = 'translateX(' + (dir * innerWidth) + 'px)';
          setTimeout(function () { go(nt.p, dir, nt.n); }, 130); return;
        }
        sh.style.transition = 'transform .18s ease-out'; sh.style.transform = ''; return;
      }
      if (ax === 'y') {
        if (dy < -50 && !R.panel) togglePanel(true); else if (dy > 50 && R.panel && fitPage()) togglePanel(false);
        return;
      }
      // Tap hides the drawer; it comes back from the page number, or by tapping the page too if that's switched on in Settings.
      if (!ax && dt < 350) { if (R.panel) togglePanel(false); else if (S.d.settings.tapShow) togglePanel(true); }
    });
    sc.addEventListener('pointercancel', function (e) { if (g && e.pointerId === g.id) { g = null; var sh = $('#sheet'); sh.style.transition = 'transform .18s'; sh.style.transform = ''; } });
    document.addEventListener('keydown', function (e) {
      if (!Reader.isOpen() || /INPUT|SELECT|TEXTAREA/.test((e.target || {}).tagName)) return;
      if (e.key === 'ArrowLeft') step(1); else if (e.key === 'ArrowRight') step(-1); else if (e.key === 'Escape') history.back();
    });
  }
  function togglePanel(on) { R.panel = on; renderPanel(); }

  /* ---------- panel ---------- */
  var I = function (d) { return '<svg class="i" viewBox="0 0 24 24">' + d + '</svg>'; };
  var IC = {
    box: I('<rect x="3" y="6" width="18" height="12" rx="2"/>'), line: I('<path d="M3 9h10v6h8"/>'),
    crop: I('<path d="M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2"/>'), join: I('<path d="M4 4h16v5H4zM4 15h16v5H4zM12 9v6"/>'),
    heart: I('<path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z"/><path d="M12 8.5v6M9 11.5h6"/>'),
    clock: I('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M10 2h4"/>'), pause: I('<path d="M8 5v14M16 5v14"/>'),
    play: I('<path d="M7 4l13 8-13 8z"/>'), stop: I('<rect x="6" y="6" width="12" height="12" rx="1.5"/>'),
    tag: I('<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>'),
    full: I('<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>'),
    fitp: I('<rect x="6" y="3" width="12" height="18" rx="1.5"/><path d="M9 8h6M9 12h6M9 16h4"/>'), fitw: I('<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/>'),
    left: I('<path d="M15 18l-6-6 6-6"/>'), right: I('<path d="M9 18l6-6-6-6"/>'), check: I('<path d="M20 6L9 17l-5-5"/>'),
    pen: I('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'), up: I('<path d="M18 15l-6-6-6 6"/>'), down: I('<path d="M6 9l6 6 6-6"/>'), trash: I('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'), x: I('<path d="M6 6l12 12M18 6L6 18"/>'), back: I('<path d="M19 12H5M12 19l-7-7 7-7"/>'), tally: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10"/>')
  };
  function tb(id, label, icon, on, off) { return '<button class="tb' + (on ? ' on' : '') + '" data-ract="' + id + '"' + (off ? ' disabled' : '') + '>' + icon + label + '</button>'; }
  function navBtns(cls) {
    return '<button class="navb ' + cls + ' l" data-ract="next" aria-label="Next page"' + (!stepTo(1) ? ' disabled' : '') + '>' + IC.left + '</button>' +
      '<button class="navb ' + cls + ' r" data-ract="prev" aria-label="Previous page"' + (!stepTo(-1) ? ' disabled' : '') + '>' + IC.right + '</button>';
  }
  function renderPanel() {
    var host = $('#rui'), p = R.p, x = '';
    if (!R.panel) {
      var ta = Timer.active(), tr = Timer.state().run;
      // One bottom pill: expand handle, then (when a session exists) the stopwatch chip — tap it to pause/resume.
      x += navBtns('float') + '<div class="rhandle"><button class="rh-exp" data-ract="expand" aria-label="Show controls">' + IC.up + '<span>P. ' + p + '</span></button>';
      if (ta) x += '<button class="tchip' + (Timer.achieved() ? ' ach' : '') + (tr ? '' : ' paused') + '" data-ract="tGo" aria-label="' + (tr ? 'Pause' : 'Resume') + ' stopwatch">' +
        (Timer.achieved() ? IC.check : '<i class="tdot"></i>') + '<span class="tmr-t">' + Timer.fmt(Timer.state().secs) + '</span>' +
        (S.d.settings.sessT && !Timer.achieved() ? '<span class="tgl">/ ' + S.d.settings.sessT + ':00</span>' : '') + (tr ? IC.pause : IC.play) + '</button>';
      x += '</div>';
      host.innerHTML = x; afterPanel(); return;
    }
    var dz = dzCur();
    x += '<div class="rpanel dz-' + dz + '"><button class="grab" data-ract="dsz" aria-label="Resize controls">' + (dz === 'rib' ? IC.up : IC.down) + '</button>';
    if (R.sub === 'join') x += joinPanel();
    else if (R.sub === 'crop') x += cropPanel() + toolsRow();
    else if (R.edit) x += editPanel() + toolsRow();
    else x += mainPanel();
    x += '</div>';
    host.innerHTML = x; afterPanel();
  }
  /* Page strip under the surah name: the listed pages (Memorizing) or the surah's pages, current one centred.
     Scroll or drag the strip; whichever number settles in the centre opens. Tap a number to jump to it. */
  function stripKeys() {
    if (R.range) return R.range;
    var s = QURAN.S[R.n - 1], a = []; if (!s) return [String(R.p)];
    for (var q = s[3]; q <= s[4]; q++) a.push(S.uk(q, R.n));
    return a;
  }
  function pstrip() {
    // Right to left like the mushaf: later pages sit to the left. Spacers let the first/last page reach the centre.
    return '<div class="pswrap"><i class="pring"></i><div class="pstrip"><i class="psp"></i>' + stripKeys().slice().reverse().map(function (k) {
      var q = S.kp(k); return '<button class="pc' + (q === R.p ? ' cur' : '') + '" data-ract="pgo" data-p="' + q + '" data-n="' + S.kn(k) + '">' + q + '</button>';
    }).join('') + '<i class="psp"></i></div></div>';
  }
  function stripMid(ps) {
    var c = ps.scrollLeft + ps.clientWidth / 2, best = null, bd = 1e9;
    [].forEach.call(ps.querySelectorAll('.pc'), function (b) { var d = Math.abs(b.offsetLeft + b.offsetWidth / 2 - c); if (d < bd) { bd = d; best = b; } });
    return best;
  }
  function wireStrip() {
    var ps = document.querySelector('.rpanel .pstrip'); if (!ps) return;
    var cur = ps.querySelector('.cur');
    var centre = function () { if (cur) { R.stripSet = true; ps.scrollLeft = cur.offsetLeft + cur.offsetWidth / 2 - ps.clientWidth / 2; } };
    centre(); requestAnimationFrame(centre);
    var t = null;
    ps.addEventListener('scroll', function () {
      if (R.stripSet) { R.stripSet = false; return; }
      var m = stripMid(ps);
      [].forEach.call(ps.querySelectorAll('.pc'), function (b) { b.classList.toggle('cur', b === m); });
      clearTimeout(t);
      t = setTimeout(function () {
        var b = stripMid(ps); if (!b) return; var q = +b.dataset.p;
        if (q !== R.p) go(q, q > R.p ? 1 : -1, +b.dataset.n);
      }, 220);
    }, { passive: true });
  }
  function afterPanel() {
    wireStrip();
    var zc = $('#rui .zchip'); if (land()) { if (zc) zc.outerHTML = zoomChip(); else $('#rui').insertAdjacentHTML('beforeend', zoomChip()); } else if (zc) zc.remove();
    // Keep the active tool visible when the toolbar is wider than the screen.
    var on = document.querySelector('.rpanel .tools .tb.on'), row = on && on.parentNode;
    if (on && (on.offsetLeft < row.scrollLeft || on.offsetLeft + on.offsetWidth > row.scrollLeft + row.clientWidth)) row.scrollLeft = on.offsetLeft - row.clientWidth / 2 + on.offsetWidth / 2;
    if (R.scrollEnd) { R.scrollEnd = false; var tr = document.querySelector('.rpanel .rrow.tools'); if (tr) tr.scrollLeft = tr.scrollWidth; }
    fitRows();
    if (measurePanel()) relayout();
  }
  /* Drawer sizes: Full (all rows), Fit (shrinks to the gap under a full-width page), Ribbon (toolbar only).
     Tools that need room (Crop, Join, Box/Line) always open at Full. Rows for Health/Tags/Timer stay visible in every size. */
  var DZ = ['hide', 'rib', 'fit', 'full'];
  function dzCur() { return (R.sub === 'crop' || R.sub === 'join' || R.edit) ? 'full' : (S.d.settings.dsz || 'full'); }
  function setDz(z) {
    if (z === 'hide') { togglePanel(false); return; }
    S.d.settings.dsz = z; S.saveSettings(); R.fitU = R.U; R.panel = true; renderPanel();
  }
  function fitRows() {
    var pn = $('.rpanel'), host = $('#rui'); if (!pn) return;
    [].forEach.call(pn.querySelectorAll('.dzh'), function (e) { e.classList.remove('dzh'); });
    [].forEach.call(host.querySelectorAll('.navb.float'), function (e) { e.remove(); });
    var dz = dzCur(); if (dz === 'full') return;
    var rows = [].filter.call(pn.children, function (e) { return !e.matches('.grab,.tools,.rsub,.subrow'); });
    if (dz === 'rib') rows.forEach(function (e) { e.classList.add('dzh'); });
    else {
      var vw = ($('#rscroll') || {}).clientWidth || innerWidth, gap = R.U ? Math.floor(innerHeight - 16 - R.U * Math.min(vw, 820)) - 1 : 0;
      for (var i = 0; i < rows.length && pn.offsetHeight > gap; i++) rows[i].classList.add('dzh');
    }
    // With the nav row gone, keep the tactile page arrows floating just above the drawer.
    var nav = pn.querySelector('.rrow.nav');
    if (nav && nav.classList.contains('dzh')) {
      host.insertAdjacentHTML('beforeend', navBtns('float'));
      [].forEach.call(host.querySelectorAll('.navb.float'), function (b) { b.style.bottom = (pn.offsetHeight + 12) + 'px'; });
    }
  }
  // Hold the arrow and drag: up grows the drawer, down shrinks it (past Ribbon it hides); it snaps to the next size.
  document.addEventListener('pointerdown', function (e) {
    var gb = e.target.closest && e.target.closest('.rpanel .grab'); if (!gb) return;
    var pn = gb.parentNode, y0 = e.clientY, moved = false, id = e.pointerId;
    function mv(ev) { if (ev.pointerId !== id) return; var dy = ev.clientY - y0; if (Math.abs(dy) > 8) moved = true; pn.style.transition = 'none'; pn.style.transform = dy > 0 ? 'translateY(' + dy + 'px)' : ''; }
    function up(ev) {
      if (ev.pointerId !== id) return;
      document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
      pn.style.transform = ''; if (!moved) return;
      R.noTap = true; setTimeout(function () { R.noTap = false; }, 350);
      var dy = ev.clientY - y0; if (Math.abs(dy) < 40) return;
      var st = (dy < 0 ? 1 : -1) * (Math.abs(dy) > 160 ? 2 : 1), i = DZ.indexOf(dzCur());
      setDz(DZ[Math.max(0, Math.min(3, i + st))]);
    }
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
  });

  // On a page shared by several surahs, the title is a switch: each surah's part has its own memorizing state.
  function surahTitle(p) {
    var ss = S.onPage(p);
    if (ss.length < 2) return App.esc(App.pageTitle(p));
    return '<span class="sswitch">' + ss.map(function (n) { return '<button class="' + (n === R.n ? 'on' : '') + '" data-ract="surah" data-n="' + n + '">' + App.esc(QURAN.S[n - 1][0]) + '</button>'; }).join('') + '</span>';
  }
  function mainPanel() {
    var p = R.p, k = R.k, o = S.get(k), m = S.isMem(k), h = S.health(k), mc = S.monthCount(k), revToday = o.lr === S.today();
    var ms = masksOf(p), am = activeMask(), x = '';
    x += '<div class="rrow nav">' + navBtns('in') + '<div class="rtitle tcol"><div class="tname">' + surahTitle(p) + '</div>' + pstrip() + '</div></div>';
    x += '<div class="rrow scroll"><button class="pill' + (m ? ' on' : '') + '" data-ract="mem">' + (m ? IC.check + 'Memorizing' : '+ Memorize') + '</button>';
    if (m) x += '<button class="pill soft' + (revToday ? ' on' : '') + '" data-ract="rev">' + IC.check + 'Reviewed' + (mc ? ' · ' + mc + '×' : '') + '</button>' +
''; // Reviewed is a once-a-day toggle
    x += '</div>';
    // Three fixed mask slots per page; a slot's mask is created the first time it is opened.
    x += '<div class="rrow scroll"><span class="lbl">Masks</span>' + [0, 1, 2].map(function (k) {
      return '<button class="chip num' + (am && ms[k] && am.id === ms[k].id ? ' on' : '') + '" data-ract="mask" data-slot="' + k + '">' + (k + 1) + '</button>';
    }).join('') + '<button class="chip' + (!am ? ' on' : '') + '" data-ract="mask" data-slot="">None</button></div>';
    if (am) {
      var nd = nDiv(R.items), hasBox = R.items.some(function (q) { return q.k === 'box'; });
      if (nd || hasBox) {
        x += '<div class="rrow scroll">';
        if (nd) { x += '<button class="chip' + (!am.sec ? ' on' : '') + '" data-ract="sec" data-s="0">Whole page</button>'; for (var i = 1; i <= nd + 1; i++) x += '<button class="chip' + (am.sec === i ? ' on' : '') + '" data-ract="sec" data-s="' + i + '">Section ' + i + '</button>'; }
        if (hasBox) x += '<button class="chip' + (!am.hb ? ' on' : '') + '" data-ract="hb">Boxes ' + (am.hb ? 'off' : 'on') + '</button>';
        x += '</div>';
      }
    }
    // Health and Tags live in the bottom toolbar and expand their row just above it.
    if (m && R.sub === 'health') x += '<div class="rsub hsub"><span class="lbl">Health</span><span class="hctl big"><button data-ract="hminus" aria-label="Lower health">−</button><span style="color:' + (h ? App.hcol(h) : 'var(--muted)') + '">' + h + '%</span><button data-ract="hplus" aria-label="Raise health">+</button></span></div>';
    if (m && R.sub === 'tags') x += '<div class="rrow scroll subrow">' + App.allTags().map(function (t) { return '<button class="chip' + (S.hasTag(R.k, t.id) ? ' on' : '') + '" data-ract="tag" data-t="' + App.esc(t.id) + '">' + App.esc(t.name) + '</button>'; }).join('') + '</div>';
    if (R.sub === 'timer') x += timerPanel();
    if (R.sub === 'tally') x += tallyPanel();
    return x + toolsRow();
  }
  // The bottom toolbar stays put in every mode; each tool opens its row above it and a second tap closes it.
  function toolsRow() {
    var p = R.p, m = S.isMem(R.k), h = S.health(R.k), am = activeMask();
    // Editing tools (Crop, Join, Box, Line, Clear) live behind one Edit button; opening it expands them inside the same oval.
    var busy = R.sub === 'crop' || R.sub === 'join' || R.edit, open = R.edOpen || busy;
    var grp = '<div class="egrp' + (open ? ' open' : '') + '">' + (open ?
      tb('tCrop', 'Crop', IC.crop, R.sub === 'crop') + tb('join', 'Join', IC.join, R.sub === 'join', !am) +
      tb('tBox', 'Box', IC.box, R.edit && R.etool === 'box', !am) + tb('tLine', 'Line', IC.line, R.edit && R.etool === 'line', !am) +
      tb('delMask', 'Clear', IC.trash, false, !am || !R.items.length).replace('class="tb', 'class="tb danger') : '') +
      tb('edGrp', 'Edit', open ? IC.x : IC.pen, false).replace('class="tb', 'class="tb edbtn') + '</div>';
    return '<div class="rrow scroll tools">' + tb('home', 'Back', IC.back, false) +
      tb('health', m ? h + '%' : 'Health', IC.heart, R.sub === 'health', !m) + tb('tags', 'Tags', IC.tag, R.sub === 'tags', !m) +
      timerTool() + tb('tally', 'Tally', IC.tally, R.sub === 'tally') +
      (installed() ? '' : tb('fs', 'Full screen', IC.full, false)) + '<span style="flex:1"></span>' + grp + '</div>';
  }
  // Once a session is running, Timer expands into an oval with the running time and play/pause beside it.
  function timerTool() {
    var T = Timer.state(), b = tb('timer', 'Timer', IC.clock, R.sub === 'timer').replace('class="tb', 'class="tb' + (T.run ? ' live' : ''));
    if (!Timer.active() && R.sub !== 'timer') return b; // opened but not started: shows 0:00 with play
    return '<div class="egrp tgrp">' + b + '<span class="tgt tmr-t">' + Timer.fmt(T.secs) + '</span>' +
      '<button class="tb tgo" data-ract="tGo" aria-label="' + (T.run ? 'Pause' : 'Start') + '">' + (T.run ? IC.pause : IC.play) + '</button></div>';
  }
  // Pause box: the session time and this page's time, with Resume or Save. Tapping outside keeps it paused.
  function pauseBox() {
    var sc = document.getElementById('scrim'); if (!sc) return;
    var T = Timer.state(), p = R.p, md = Timer.modeOf(R.k) === 'r' ? 'review' : 'memorizing', ach = Timer.achieved();
    sc.innerHTML = '<div class="sheetm pbox"><div class="pbt">Paused</div>' +
      '<div class="tbig' + (ach ? ' ach' : '') + '"><span class="tmr-t">' + Timer.fmt(T.secs) + '</span></div>' +
      '<div class="small muted">' + (ach ? '<b class="tach">' + IC.check + 'Achieved</b> · ' : '') + md + ' · this page <span class="tmr-pg">' + Timer.fmt(Timer.pageToday(p)) + '</span></div>' +
      '<div class="pbtns"><button class="btn pdel" data-ract="tDel" aria-label="Delete session">' + IC.trash + '</button><button class="btn" data-ract="tSave">' + IC.check + 'Save</button><button class="btn pri" data-ract="tResume">' + IC.play + 'Resume</button></div></div>';
    sc.style.display = 'flex';
  }
  function closePause() { var sc = document.getElementById('scrim'); if (sc) { sc.style.display = 'none'; sc.innerHTML = ''; } }
  // Close crop (keeping the crop) or mask editing (keeping the shapes) before switching to another tool.
  function leaveModes() { if (R.edit) RACT.doneEdit(); if (R.sub === 'crop') RACT.cropApply(); }
  function timerPanel() {
    var T = Timer.state(), s = S.d.settings, p = R.p, dd = Timer.day(S.today()), g = s.goalDay, ach = Timer.achieved();
    var md = Timer.modeOf(R.k) === 'r' ? 'review' : 'memorizing';
    var on = Timer.active(); // while running, the time and play/pause sit in the toolbar oval instead
    // The session time and play/pause always live in the toolbar oval; pausing opens the Resume/Save box.
    var x = '<div class="rsub tsub">';
    var opts = [0, 5, 10, 15, 20, 30], cur = s.sessT || 0;
    if (opts.indexOf(cur) < 0) opts.push(cur);
    x += '<div class="rrow scroll"><span class="lbl">Target</span>' + opts.map(function (v) { return '<button class="chip' + (cur === v ? ' on' : '') + '" data-ract="tT" data-v="' + v + '">' + (v ? v + ' min' : 'None') + '</button>'; }).join('') +
      '<button class="chip" data-ract="tT" data-v="custom" aria-label="Custom target">+</button></div>';
    if (g) x += '<div class="rrow"><span class="small muted" style="white-space:nowrap">Today <span class="tmr-day">' + Math.floor(dd.t / 60) + '</span> / ' + g + ' min' + (dd.t >= g * 60 ? ' ✓' : '') + '</span><div class="hbar" style="flex:1;margin:0"><i class="tmr-bar" style="width:' + Math.min(100, dd.t / (g * 60) * 100) + '%;background:var(--acc)"></i></div></div>';
    return x + '</div>';
  }
  /* Tally row: sections from Mask 1's lines (tap one, then another to take a range), the live count with Edit/Save,
     and this page's reads per section (the page counts as read as many times as its least-read section). */
  function tallyPanel() {
    var ns = S.nSec(R.p), sc = Tally.scope(), T = Tally.state(), t = S.tally(R.k), x = '<div class="rsub tlsub">';
    if (ns > 1) {
      x += '<div class="rrow scroll"><button class="chip' + (!sc.from ? ' on' : '') + '" data-ract="tlySec" data-s="0">Whole page</button>';
      for (var i = 1; i <= ns; i++) x += '<button class="chip num' + (sc.from && i >= sc.from && i <= sc.to ? ' on' : '') + '" data-ract="tlySec" data-s="' + i + '">S' + i + '</button>';
      x += '</div>';
    }
    x += '<div class="rrow"><span class="lbl">Count</span><b class="tlyn">' + T.n + '</b><span style="flex:1"></span>' +
      '<button class="btn sm" data-ract="tlyEdit">Edit</button><button class="btn sm pri" data-ract="tlySave"' + (T.n ? '' : ' disabled') + '>Save</button>' +
      '<button class="icb" data-ract="tlyHide" aria-label="Hide counter">' + IC.x + '</button></div>';
    var parts = ns > 1 ? t.sec.map(function (v, j) { return 'S' + (j + 1) + ' ' + v; }).join(' · ') + ' · ' : '';
    x += '<div class="small muted" style="padding:0 4px 4px">' + parts + 'Page read <b>' + t.page + '×</b>';
    var g = S.d.settings.tDay;
    if (g) { var td = S.today(), dr = Tally.dayReads(function (d) { return d === td; }); x += ' · today ' + dr + ' / ' + g + (dr >= g ? ' ✓' : ''); }
    return x + '</div></div>';
  }
  function tallyTint() {
    var sc = Tally.scope(); if (R.sub !== 'tally' || !sc.from) return '';
    var m1 = masksOf(R.p)[0]; if (!m1) return '';
    var ds = shiftItems((m1.items || []).filter(function (q) { return q.k === 'div'; }), R.oy).sort(function (a, b) { return (a.y1 + a.y2) - (b.y1 + b.y2); });
    var above = ds[sc.from - 2], below = ds[sc.to - 1], H = r1(R.Hu);
    var top = above ? divPts(above) : '1000,0 0,0', bot = below ? divPts(below).split(' ').reverse().join(' ') : '0,' + H + ' 1000,' + H;
    return '<polygon points="' + top + ' ' + bot + '" style="fill:var(--acc);fill-opacity:.14;pointer-events:none"/>';
  }
  function editPanel() {
    var am = activeMask(), m = R.items[R.sel], x = '';
    x += '<div class="rrow etop">' +
      '<button class="pill soft" data-ract="addBox">+ ' + IC.box + 'Box</button><button class="pill soft" data-ract="addLine">+ ' + IC.line + 'Line</button>' +
      '<button class="icb danger" data-ract="del" aria-label="Delete selected"' + (m ? '' : ' disabled') + '>' + IC.trash + '</button>' +
      '<button class="icb" data-ract="cancelEdit" aria-label="Cancel changes">' + IC.x + '</button>' +
      '<button class="icb pri" data-ract="doneEdit" aria-label="Save">' + IC.check + '</button></div>';
    // The style row is always shown so the drawer keeps one height; with no box selected it sets the style for the next box.
    x += boxStyle(m && m.k === 'box' ? m : R.style, m && m.k === 'div');
    x += '<div class="hint ehint"><b>' + (am ? 'Mask ' + (masksOf(R.p).indexOf(am) + 1) : '') + '</b> · ' + (m ? (m.k === 'box' ? 'Drag the box to move it; drag a round handle to resize.' + '' : 'Drag to move. Side handles make a step; the middle one moves it.') + (m.k === 'div' ? ' <button class="addlink" data-ract="straight">Straighten</button>' : '')
      : 'Tap Box or Line to add one, or tap a shape to select it. Tip: long-press a shape while reading to edit it.') + '</div>';
    return x;
  }
  function cropPanel() {
    return '<div class="rrow"><div class="rtitle" style="text-align:left">Crop <span class="plabel">P. ' + R.p + '</span></div></div>' +
      '<div class="hint">Drag the edges or corners. Drag inside to move.</div>' +
      '<div class="rrow scroll"><button class="btn sm" data-ract="cropAuto">Auto</button><button class="btn sm" data-ract="cropNone">Whole page</button>' +
      (R.p > 1 ? '<button class="btn sm" data-ract="cropPrev">Same as P. ' + (R.p - 1) + '</button>' : '') +
      '<span style="flex:1"></span><button class="btn sm" data-ract="cropCancel">Cancel</button><button class="btn sm pri" data-ract="cropApply">Apply</button></div>';
  }
  // Compact Join panel (~25% of the screen): pick which part to edit, two shared sliders act on it,
  // and the whole joined page stays visible above, scaled to fit.
  function joinPanel() {
    var p = R.p, j = joinOf(p, true), t = R.jt, off = !!(jnOf() || {}).off;
    if ((t === 'prev' && p <= 1) || (t === 'next' && p >= 604)) t = R.jt = 'this';
    var opt = [];
    if (p > 1) opt.push(['prev', IC.up + 'P. ' + (p - 1)]);
    opt.push(['this', 'This page']);
    if (p < 604) opt.push(['next', '<span class="jdn">' + IC.up + '</span>P. ' + (p + 1)]);
    var x = '<div class="rrow jhead' + (off ? ' joff' : '') + '"><div class="seg jseg">' + opt.map(function (o) { return '<button class="' + (t === o[0] ? 'on' : '') + '" data-ract="jT" data-t="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div></div>';
    x += '<div class="jsl' + (off ? ' joff' : '') + '">';
    if (t === 'prev') x += slider('jn.prev', 'Show', j.prev, 60, 1) + slider('jn.prevCut', 'Cut bottom', j.prevCut, 30, 1);
    else if (t === 'next') x += slider('jn.next', 'Show', j.next, 60, 1) + slider('jn.nextCut', 'Cut top', j.nextCut, 30, 1);
    else x += slider('jn.trimT', 'Trim top', j.trimT, 60, 1) + slider('jn.trimB', 'Trim bottom', j.trimB, 60, 1);
    x += '</div>';
    return x + '<div class="rrow"><button class="jsw' + (off ? '' : ' on') + '" data-ract="joinOff" role="switch" aria-checked="' + !off + '"><i></i>Join ' + (off ? 'off' : 'on') + '</button><button class="btn sm" data-ract="joinReset">Reset</button><span style="flex:1"></span><button class="btn sm" data-ract="joinCancel">Cancel</button><button class="btn sm pri" data-ract="subDone">Done</button></div>';
  }
  function slider(key, label, val, max, step) {
    return '<div class="sl"><span>' + label + '</span><input type="range" min="0" max="' + max + '" step="' + step + '" value="' + (val * 100) + '" data-rin="' + key + '"><b>' + (Math.round(val * 1000) / 10) + '%</b></div>';
  }
  function boxStyle(m, off) {
    var list = R.palOpen ? COLORS : recentC();
    if (!R.palOpen && list.indexOf(m.c) < 0) list = [m.c].concat(list.slice(0, 2));
    var more = '<button class="sw-more" data-ract="pal" aria-label="' + (R.palOpen ? 'Fewer colours' : 'More colours') + '">' + (R.palOpen ? '‹' : '+') + '</button>';
    var sw = (R.palOpen ? more : '') + list.map(function (c) { return '<button class="sw-c' + (m.c === c ? ' on' : '') + '" style="background:' + c + '" data-ract="bc" data-c="' + c + '" aria-label="Colour"></button>'; }).join('') + (R.palOpen ? '' : more);
    return '<div class="rrow bstyle' + (off ? ' off' : '') + '"><div class="cscroll">' + sw + '</div>' +
      '<span class="hctl"><button data-ract="bo" data-d="-1" aria-label="Lighter">−</button><span>' + Math.round(m.o * 100) + '%</span><button data-ract="bo" data-d="1" aria-label="Darker">+</button></span>' +
      '<button class="pill soft' + (m.b ? ' on' : '') + '" data-ract="bb">Border</button></div>';
  }

  /* ---------- actions ---------- */
  function selBox() { var m = R.items[R.sel]; return (R.edit && m && m.k === 'box') ? m : R.style; }
  function afterStyle() { var m = selBox(); if (m !== R.style) { R.style.c = m.c; R.style.o = m.o; R.style.b = m.b; commitItems(); } rememberStyle(m); draw(); renderPanel(); }
  function startEdit(sel) {
    var am = activeMask(); if (!am) return false;
    if (!R.edit) { R.snap = { items: JSON.stringify(am.items || []), sec: am.sec || 0 }; R.edit = true; R.sub = null; R.sel = sel; renderPanel(); layout(); }
    return true;
  }
  // Long-press in read mode: which shape (if any) is under the finger.
  function hitItem(pt) {
    for (var i = R.items.length - 1; i >= 0; i--) {
      var m = R.items[i];
      if (m.k === 'box' && pt.x >= m.x - 15 && pt.x <= m.x + m.w + 15 && pt.y >= m.y - 15 && pt.y <= m.y + m.h + 15) return i;
      if (m.k === 'div' && Math.abs(pt.y - (pt.x >= m.x ? m.y1 : m.y2)) < 35) return i;
    }
    return -1;
  }
  function openOrAdd(k, add) {
    var i = -1; R.items.forEach(function (q, n) { if (q.k === k) i = n; });
    if (i < 0) { add(); return; }
    if (!startEdit(i)) return; R.sel = i; draw(); renderPanel();
  }
  function setActive(id) { saveMasks(function (ms, o) { o.am = id || ''; }); loadItems(); }
  var RACT = {
    home: function () { if (Tally.dirty()) Tally.ask(function () { history.back(); }); else history.back(); },
    tally: function () {
      leaveModes();
      if (!Tally.on()) { Tally.show(true); R.sub = 'tally'; } else R.sub = R.sub === 'tally' ? null : 'tally';
      renderPanel(); draw();
    },
    tlySec: function (el) {
      var i = +el.dataset.s, sc = Tally.scope();
      if (!i) Tally.setScope(0, 0);
      else if (sc.from && sc.from === sc.to && i !== sc.from) Tally.setScope(Math.min(i, sc.from), Math.max(i, sc.from));
      else Tally.setScope(i, i);
      renderPanel(); draw();
    },
    tlyEdit: function () { Tally.edit(); renderPanel(); },
    tlySave: function () { Tally.save(); renderPanel(); },
    tlyHide: function () {
      var hide = function () { Tally.show(false); R.sub = null; renderPanel(); draw(); };
      if (Tally.dirty()) Tally.ask(hide); else hide();
    },
    next: function () { step(1); }, prev: function () { step(-1); },
    pgo: function (el) { var q = +el.dataset.p; if (q !== R.p) go(q, q > R.p ? 1 : -1, +el.dataset.n); },
    collapse: function () { togglePanel(false); }, expand: function () { togglePanel(true); },
    dsz: function () { if (R.noTap) return; var z = dzCur(); setDz(z === 'full' ? 'fit' : z === 'fit' ? 'rib' : 'full'); },
    mem: function () { var on = !S.isMem(R.k); S.setMem(R.k, on); App.toast(on ? 'Added to Memorizing (New)' : 'Moved back to To Memorize'); renderPanel(); App.precache(); },
    hminus: function () { S.setHealth(R.k, S.health(R.k) - 5); renderPanel(); },
    hplus: function () { S.setHealth(R.k, S.health(R.k) + 5); renderPanel(); },
    surah: function (el) { if (Tally.dirty()) { Tally.ask(function () { RACT.surah(el); }); return; } R.n = +el.dataset.n; R.k = S.uk(R.p, R.n); S.setLast(R.p, R.k); renderPanel(); },
    rev: function () {
      var p = R.k;
      if (S.get(p).lr === S.today()) { S.unreviewToday(p); renderPanel(); App.toast('Review for today removed'); return; }
      S.reviewed(p); renderPanel();
      App.toast('Marked reviewed · ' + S.monthCount(p) + '× this month');
    },
    edGrp: function () {
      if (R.edOpen || R.sub === 'crop' || R.sub === 'join' || R.edit) {
        leaveModes(); if (R.sub === 'join') R.sub = null; R.edOpen = false;
      } else { R.edOpen = true; R.scrollEnd = true; }
      renderPanel();
    },
    tags: function () { leaveModes(); R.sub = R.sub === 'tags' ? null : 'tags'; renderPanel(); },
    timer: function () {
      leaveModes();
      // Tap opens the oval at 0:00 with play (nothing starts until play is pressed); tap again closes it.
      R.sub = R.sub === 'timer' ? null : 'timer';
      renderPanel();
    },
    zout: function () { setZoom(-10); },
    zin: function () { setZoom(10); },
    tGo: function () {
      if (Timer.state().run) { Timer.pause(); pauseBox(); } else Timer.start();
      renderPanel();
    },
    tResume: function () { closePause(); Timer.start(); renderPanel(); },
    tSave: function () { closePause(); Timer.stop(); renderPanel(); },
    tDel: function () { if (!confirm('Delete this session? Its time won’t be counted.')) return; closePause(); Timer.discard(); renderPanel(); },
    tT: function (el) {
      var v = el.dataset.v;
      if (v === 'custom') { v = parseInt(prompt('Session target in minutes', S.d.settings.sessT || 45), 10); if (!(v > 0)) return; }
      Timer.setTarget(+v); renderPanel();
    },
    health: function () { leaveModes(); R.sub = R.sub === 'health' ? null : 'health'; renderPanel(); },
    tag: function (el) { S.toggleTag(R.k, el.dataset.t); renderPanel(); },
    mask: function (el) {
      var k = el.dataset.slot;
      if (k === '') { setActive(''); loadItems(); renderPanel(); layout(); return; }
      k = +k;
      saveMasks(function (ms, o) {
        while (ms.length <= k) { var n = ms.length + 1; ms.push({ id: 'm' + Date.now().toString(36) + n, name: 'Mask ' + n, items: [], sec: 0 }); }
        o.am = ms[k].id;
      });
      loadItems(); renderPanel(); layout();
    },
    editMask: function () { startEdit(-1); },
    doneEdit: function () { R.edit = false; R.sel = -1; R.tmp = null; R.snap = null; renderPanel(); layout(); },
    cancelEdit: function () {
      // Put the mask back exactly as it was when editing started.
      var am = activeMask(), snap = R.snap;
      if (am && snap) saveMasks(function (ms) { ms.forEach(function (m) { if (m.id === am.id) { m.items = JSON.parse(snap.items); m.sec = snap.sec; } }); });
      loadItems(); R.edit = false; R.sel = -1; R.tmp = null; R.snap = null; draw(); renderPanel(); layout();
    },
    delMask: function () {
      var am = activeMask(); if (!am) return;
      var n = masksOf(R.p).indexOf(am) + 1;
      if (!confirm('Clear everything on Mask ' + n + '? Its boxes and lines will be removed.')) return;
      saveMasks(function (ms) { ms.forEach(function (m) { if (m.id === am.id) { m.items = []; m.sec = 0; } }); });
      loadItems(); R.edit = false; R.sel = -1; R.sub = null; draw(); renderPanel(); layout();
    },
    addBox: function () {
      if (!startEdit(-1)) return;
      var nb = R.items.filter(function (q) { return q.k === 'box'; }).length, off = (nb % 6) * 40;
      R.items.push({ k: 'box', x: 330 + off * 0.5, y: clamp(R.Hu * 0.3 + off, 0, R.Hu - 90), w: 340, h: 80, c: R.style.c, o: R.style.o, b: R.style.b });
      R.sel = R.items.length - 1; commitItems(); draw(); renderPanel();
    },
    addLine: function () {
      if (!startEdit(-1)) return;
      var ds = dividers(), last = ds.length ? ds[ds.length - 1].m : null, y = last ? Math.max(last.y1, last.y2) + 140 : R.Hu * 0.35;
      if (y > R.Hu - 40) y = R.Hu / 2;
      R.items.push({ k: 'div', x: 500, y1: y, y2: y }); R.sel = R.items.length - 1; commitItems(); draw(); renderPanel();
    },
    del: function () { if (R.sel < 0) return; R.items.splice(R.sel, 1); R.sel = -1; commitItems(); draw(); renderPanel(); },
    straight: function () { var m = R.items[R.sel]; if (!m) return; m.y2 = m.y1; m.x = 500; commitItems(); draw(); },
    sec: function (el) { var s = +el.dataset.s, am = activeMask(); saveMasks(function (ms) { ms.forEach(function (m) { if (m.id === am.id) m.sec = s; }); }); draw(); renderPanel(); },
    hb: function () { var am = activeMask(); saveMasks(function (ms) { ms.forEach(function (m) { if (m.id === am.id) m.hb = !m.hb; }); }); draw(); renderPanel(); },
    bc: function (el) { selBox().c = el.dataset.c; R.palOpen = false; afterStyle(); },
    bo: function (el) { var m = selBox(); m.o = clamp(Math.round(m.o * 20) / 20 + (+el.dataset.d) * 0.05, 0.05, 1); m.o = Math.round(m.o * 100) / 100; afterStyle(); },
    pal: function () { R.palOpen = !R.palOpen; renderPanel(); },
    bb: function () { var m = selBox(); m.b = !m.b; afterStyle(); },
    join: function () {
      if (!activeMask() && R.sub !== 'join') return;
      leaveModes(); R.sub = R.sub === 'join' ? null : 'join';
      // Remember the page's join settings so Cancel can put them back.
      if (R.sub === 'join') { R.jsnap = { p: R.p, jn: JSON.stringify(jnOf()) }; R.jt = R.jt || (R.p < 604 ? 'next' : 'this'); }
      renderPanel(); relayout();
    },
    joinCancel: function () {
      var sn = R.jsnap;
      if (sn && sn.p === R.p && JSON.stringify(jnOf()) !== sn.jn) { var jn = JSON.parse(sn.jn); setJn(function () { return jn; }); }
      R.jsnap = null; R.sub = null; renderPanel(); relayout();
    },
    joinOff: function () { setJn(function (j) { if (j.off) delete j.off; else j.off = true; return j; }); renderPanel(); relayout(); },
    jT: function (el) { R.jt = el.dataset.t; renderPanel(); relayout(); },
    subDone: function () { var j = R.sub === 'join'; R.sub = null; renderPanel(); if (j) relayout(); },
    joinReset: function () { setJn(function () { return null; }); renderPanel(); relayout(); },
    fit: function () { S.d.settings.fit = fitPage() ? 'width' : 'page'; S.saveSettings(); renderPanel(); layout(); },
    fs: function () {
      var d = document;
      if (d.fullscreenElement) d.exitFullscreen(); else if (d.documentElement.requestFullscreen) d.documentElement.requestFullscreen().catch(function () { App.toast('Install the app for full screen'); });
      else App.toast('Install the app for full screen');
    },
    crop: function () { R.draft = cropOf(R.p); R.sub = 'crop'; R.edit = false; renderPanel(); layout(); },
    tCrop: function () { if (R.sub === 'crop') { RACT.cropApply(); return; } leaveModes(); RACT.crop(); },
    tBox: function () { if (R.edit && R.etool === 'box') { RACT.doneEdit(); return; } if (R.sub === 'crop') RACT.cropApply(); R.etool = 'box'; openOrAdd('box', RACT.addBox); },
    tLine: function () { if (R.edit && R.etool === 'line') { RACT.doneEdit(); return; } if (R.sub === 'crop') RACT.cropApply(); R.etool = 'line'; openOrAdd('div', RACT.addLine); },
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
    if (parts[0] === 'jn') { setJn(function (j) { j[parts[1]] = v; if (/^trim/.test(parts[1]) && (j.trimT || 0) + (j.trimB || 0) > 0.8) j[parts[1]] = 0.8 - (parts[1] === 'trimT' ? (j.trimB || 0) : (j.trimT || 0)); return j; }); relayout(); return; }
    S.edit(R.p, function (o) {
      o[parts[0]] = o[parts[0]] || {}; o[parts[0]][parts[1]] = v;
      var j = o.jn; if (o.jn && /^trim/.test(parts[1]) && (j.trimT || 0) + (j.trimB || 0) > 0.8) j[parts[1]] = 0.8 - (parts[1] === 'trimT' ? (j.trimB || 0) : (j.trimT || 0));
    });
    relayout();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindGestures); else bindGestures();
})();
