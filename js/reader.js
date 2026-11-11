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
  /* Two separate experiences. Mobile view (default) is the phone reader with its drawer, unchanged.
     Web view is opt-in (Settings → Web view, offered only on wide screens): one thin bar across the bottom,
     page arrows at the screen edges, optional two facing pages. If the window gets narrow it falls back to mobile. */
  function wideScreen() { return innerWidth >= 1000; }
  function desk() { return S.d.settings.view === 'web' && wideScreen(); }
  var EDGE = 88; // room kept at each side for the edge arrows
  function partner(p) { return p % 2 ? p + 1 : p - 1; } // Madani mushaf: odd pages on the right, even on the left
  function spreadOn(segs) { return desk() && S.d.settings.spread !== false && R.sub !== 'join' && segs.length === 1; }
  // Where the facing page leads when clicked: null if it is not in the list this page was opened from.
  function faceTarget(q) {
    if (!R.range) return { p: q };
    var ks = R.range.filter(function (u) { return S.kp(u) === q; }); if (!ks.length) return null;
    var k = ks.filter(function (u) { return S.kn(u) === R.n; })[0] || ks[0];
    return { p: q, n: S.kn(k) };
  }
  // The facing page wears the same mask slot as the open page (Mask 1 on both, or None on both).
  function staticMask(q, Hu) {
    migrateMasks(q);
    var m = masksOf(q)[0]; if (!m || !m.items || !m.items.length) return '';
    var it = viewItems(m, q), s = '', cov = (S.d.settings.hideCol || '#f3e9d4');
    var ds = it.filter(function (x) { return x.k === 'div'; }).sort(function (a, b) { return (a.y1 + a.y2) - (b.y1 + b.y2); });
    var sec = m.sec || 0, sec2 = sec; if (sec2 > ds.length + 1) sec = sec2 = 0; var hl = !!m.hl;
    if (!m.hb) it.forEach(function (x) { if (x.k === 'box') s += '<rect x="' + r1(x.x) + '" y="' + r1(x.y) + '" width="' + r1(x.w) + '" height="' + r1(x.h) + '" rx="4" fill="' + x.c + '" fill-opacity="' + x.o + '"' + (x.b ? ' stroke="' + x.c + '" stroke-width="4"' : '') + '/>'; });
    if (sec && ds.length) {
      var above = ds[sec - 2], below = ds[sec2 - 1];
      if (above) s += '<polygon points="0,0 1000,0 ' + divPts(above) + '" fill="' + cov + '"/>';
      if (below) s += '<polygon points="' + divPts(below) + ' 0,' + r1(Hu) + ' 1000,' + r1(Hu) + '" fill="' + cov + '"/>';
    } else if (!hl) ds.forEach(function (x) { s += '<polyline points="' + divPts(x) + '" style="fill:none;stroke:#e0662c;stroke-width:2.5;stroke-dasharray:10 7;opacity:.75"/>'; });
    return s;
  }
  function zkey() { return desk() ? 'lz' : 'lzm'; } // mobile view and web view each keep their own zoom
  function zmax() { return desk() ? 300 : 100; } // web view can zoom past the fitted page; mobile stops at full width
  function lzoom() { var z = S.d.settings[zkey()]; return land() && z ? clamp(z, 40, zmax()) / 100 : 1; }
  function zoomChip() { var z = Math.round(lzoom() * 100); return '<div class="zchip"><button data-ract="zout" aria-label="Zoom out"' + (z <= 40 ? ' disabled' : '') + '>−</button><span>' + z + '%</span><button data-ract="zin" aria-label="Zoom in"' + (z >= zmax() ? ' disabled' : '') + '>+</button></div>'; }

  /* ---------- crop / joins ---------- */
  function baseCrop(p) {
    var s = S.d.settings, mode = s.trim || 'full';
    if (mode === 'off' || !window.AUTOCROP) return { l: 0, t: 0, r: 0, b: 0 };
    var a = AUTOCROP[mode === 'frame' ? 'frame' : 'full'][p - 1], pad = s.trimPad == null ? 0.01 : s.trimPad;
    var sp = mode === 'frame' ? pad : 0; // sides are cut at the frame so margin markers (hizb/rub') never show
    return { l: Math.max(0, a[0] - sp), t: Math.max(0, a[1] - pad), r: Math.max(0, a[2] - sp), b: Math.max(0, a[3] - pad) };
  }
  /* Default crop profile (Settings): saved from one page as edge offsets relative to that page's auto-trim,
     then laid over every page's own auto-trim, so odd/even page differences still line up. "Auto" = this. */
  function autoCrop(p) {
    var a = baseCrop(p), d = S.d.settings.cropDef; if (!d) return a;
    var o = { l: a.l + d.l, t: a.t + d.t, r: a.r + d.r, b: a.b + d.b };
    ['l', 't', 'r', 'b'].forEach(function (k) { o[k] = clamp(o[k], 0, 0.4); });
    return o;
  }
  function cropOf(p) { if (desk() && !S.d.settings.webTrim && R.sub !== 'crop') return { l: 0, t: 0, r: 0, b: 0 }; var c = S.get(p).crop; return c ? { l: c.l || 0, t: c.t || 0, r: c.r || 0, b: c.b || 0 } : autoCrop(p); }
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
  /* v102: no masks — each page has one layer of boxes and lines (the old Mask 1; Masks 2–5 stay stored but unused). */
  function activeMask() { return R.rec ? null : masksOf(R.p)[0] || null; }
  function ensureLayer() { if (!masksOf(R.p).length) { saveMasks(function (ms) { ms.push(newMask(1)); }); loadItems(); } return activeMask(); }
  function saveMasks(fn) {
    var p = R.p, ms = JSON.parse(JSON.stringify(masksOf(p)));
    S.edit(p, function (o) { fn(ms, o); o.mk = ms; delete o.masks; delete o.sec; delete o.hb; });
  }
  /* Boxes and lines are stored in page units (1000 = the full, uncropped page width, measured from the page
     image's top-left) and turned into on-screen units with the current crop, so changing a crop or the default
     crop never moves or resizes them. Older masks (no pg flag) were saved in on-screen units of the crop they were
     drawn with: the page's own crop if it had one, else the plain auto-trim (there was no default crop then). */
  function aspect(p) { return p <= 61 ? 1177 / 750 : 1072 / 750; } // pages 1–61 are taller in this mushaf
  function conv(list, c, p, toView) {
    var f = 1 - c.l - c.r, ox = c.l * 1000, oy = c.t * aspect(p) * 1000;
    var X = toView ? function (v) { return (v - ox) / f; } : function (v) { return v * f + ox; };
    var Y = toView ? function (v) { return (v - oy) / f; } : function (v) { return v * f + oy; };
    var L = toView ? function (v) { return v / f; } : function (v) { return v * f; };
    return JSON.parse(JSON.stringify(list || [])).map(function (m) {
      if (m.k === 'box') { m.x = X(m.x); m.y = Y(m.y); m.w = L(m.w); m.h = L(m.h); }
      else if (m.k === 'div') { m.x = X(m.x); m.y1 = Y(m.y1); m.y2 = Y(m.y2); }
      return m;
    });
  }
  function viewItems(m, p) { return conv(m.items, cropOf(p), p, true); }
  function migrateMasks(p) {
    var o = S.get(p), ms = masksOf(p);
    if (!ms.some(function (m) { return !m.pg && m.items && m.items.length; })) return;
    var lc = o.crop ? { l: o.crop.l || 0, t: o.crop.t || 0, r: o.crop.r || 0, b: o.crop.b || 0 } : baseCrop(p);
    ms = JSON.parse(JSON.stringify(ms));
    ms.forEach(function (m) { if (!m.pg) { m.items = conv(m.items, lc, p, false).map(rnd); m.pg = 1; } });
    S.edit(p, function (o) { o.mk = ms; delete o.masks; delete o.sec; delete o.hb; });
  }
  // New-box height tracks the text: 80 on-screen units under the plain auto-trim, scaled for any tighter or looser crop.
  function boxH() { var b = baseCrop(R.p), c = cropOf(R.p); return 80 * (1 - b.l - b.r) / Math.max(0.2, 1 - c.l - c.r); }
  function rnd(m) { var c = {}; for (var k in m) c[k] = typeof m[k] === 'number' ? r1(m[k]) : m[k]; return c; }
  function commitItems() {
    var am0 = activeMask(), am = am0 ? am0.id : null, items = conv(shiftItems(R.items, -R.oy), cropOf(R.p), R.p, false).map(function (m) { var c = {}; for (var k in m) c[k] = typeof m[k] === 'number' ? r1(m[k]) : m[k]; return c; });
    saveMasks(function (ms) { ms.forEach(function (m) { if (m.id === am) { m.items = items; m.pg = 1; if (Math.max(m.sec || 0, m.sec2 || 0) > nDiv(items) + 1) m.sec = m.sec2 = 0; } }); });
  }
  function nDiv(items) { return items.filter(function (m) { return m.k === 'div'; }).length; }
  function loadItems() { var m = activeMask(); R.items = shiftItems(m ? viewItems(m, R.p) : [], R.oy); }
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
    // v116: rec = Recitation mode — plain pages (no boxes, lines, joins or sections), free swipe, Timer + Back only.
    open: function (p, n, range, tag, rec) {
      R.rec = !!rec; R.rtag = S.d.ui.rtag || 'def'; if (R.rec) { range = null; tag = null; R.sub = R.sub === 'timer' ? 'timer' : null; R.edOpen = false; }
      R.style = boxDef(); R.palOpen = false; R.wasDesk = desk();
      if (!Reader.isOpen()) { R.wasPL = phoneLand(); if (R.wasPL) { R.panel = false; R.dszL = 'rib'; } } R.stat = false; R.pstat = false; R.tag = tag || null; // custom tag: counts shown for the tag, not the month
      p = clamp(p | 0, 1, 604); R.n = n || 0;
      R.range = range && range.length ? range.slice().sort(function (a, b) { return S.kp(a) - S.kp(b) || S.kn(a) - S.kn(b); }) : null;
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
    rec: function () { return !!R.rec && Reader.isOpen(); },
    desk: function () { return desk(); },
    page: function () { return R.p; },
    unit: function () { return R.k; },
    refresh: function () { if (Reader.isOpen()) renderPanel(); },
    // v114: where the open drawer starts, and the counter's home spot (right side, just above the expanded drawer).
    drawerTop: function () { var pn = R.panel && $('.rpanel'); return pn ? pn.getBoundingClientRect().top : innerHeight; },
    counterHome: function (w) { var o = ori(), ph = (R.phX || {})[o] || (o === 'l' ? 96 : innerHeight * 0.32); return { x: innerWidth - w / 2 - 14, y: innerHeight - ph - w / 2 - 14 }; },
    relayout: function () { if (Reader.isOpen()) layout(); }
  };
  window.Reader = Reader;
  window.addEventListener('popstate', function () {
    if (!Reader.isOpen()) return;
    if (R.stat) { R.stat = false; renderPanel(); return; } // v109: phone back closes the Stat page first
    // v117: leaving Recitation on a page other than the bookmark asks whether to bookmark it. Either answer closes.
    if (R.rec && R.asking) { App.dialogClose(); return; }
    if (R.rec && R.noAsk) { R.noAsk = false; Reader.close(); return; }
    if (R.rec && S.bm(R.rtag).p !== R.p) {
      R.asking = true; if (window.Timer) Timer.pause();
      App.dialog({ title: 'Bookmark this page?', always: true, btns: [['yes', 'Bookmark', 'pri'], ['no', 'Exit']] }, function (v, w) {
        R.asking = false; if (w === 'yes') { S.setBm(R.p, R.n, R.rtag); App.toast('Bookmarked P. ' + R.p); }
        Reader.close();
      });
      return;
    }
    // v97: leaving the reader keeps an unsaved tally for later on its page (no question).
    if (Tally.dirty()) Tally.park();
    document.body.classList.remove('statopen'); Reader.close();
  });

  // Next/previous page: the next listed page when opened from Memorizing, otherwise the adjacent mushaf page.
  // Listed pages run in (page, surah) order. Swiping never jumps to another surah unless that surah comes
  // right after/before this one and continues on the same or the next page — and only with the
  // "Swipe on into the next surah" setting on. Otherwise swiping stops at the end of the surah.
  function stepTo(dir, say) {
    if (!R.range) { var q = R.p + dir; return q >= 1 && q <= 604 ? { p: q } : null; }
    var r = R.range, i, k, c = R.p * 1000 + R.n, v = function (u) { return S.kp(u) * 1000 + S.kn(u); };
    if (dir > 0) { for (i = 0; i < r.length; i++) if (v(r[i]) > c) { k = r[i]; break; } }
    else { for (i = r.length - 1; i >= 0; i--) if (v(r[i]) < c) { k = r[i]; break; } }
    if (!k) return null;
    var p = S.kp(k), n = S.kn(k);
    if (n !== R.n) {
      var ok = S.d.settings.swipeSur !== false && Math.abs(n - R.n) === 1 && Math.abs(p - R.p) <= 1;
      if (!ok) { if (say) App.toast('End of ' + (QURAN.S[R.n - 1] ? QURAN.S[R.n - 1][0] : 'surah')); return null; }
    }
    return { p: p, n: n };
  }
  function step(dir) { var t = stepTo(dir, 1); if (t) go(t.p, dir, t.n); return t; }
  function go(p, dir, n) {
    if (p < 1 || p > 604) return;
    var ss0 = S.onPage(p), n0 = n || R.n; if (ss0.indexOf(n0) < 0) n0 = dir < 0 ? ss0[ss0.length - 1] : ss0[0];
    // v99: an unsaved count stays with its page (no question); opening that page again brings it back.
    if (Tally.dirty() && Tally.unit() !== S.uk(p, n0)) Tally.park();
    if (n) R.n = n;
    if (dir) buzz();
    // Which surah's portion of the page this is. A shared page keeps the surah you came from if it is on it;
    // otherwise moving forward lands on the first surah there, moving back on the last.
    var ss = S.onPage(p);
    if (ss.indexOf(R.n) < 0) R.n = dir < 0 ? ss[ss.length - 1] : ss[0];
    R.k = S.uk(p, R.n);
    if (p !== R.p) Tally.newPage();
    R.p = p; R.sel = -1; R.drag = null; R.edit = false; R.draft = null;
    migrateMasks(p);
    // v102: one layer per page, nothing to choose on open.
    if (R.sub === 'crop' || R.sub === 'join') R.sub = null;
    loadItems();
    syncSec(); // the page's section, then that section's waiting count (if any)
    if (R.rec) { S.d.rlast = { p: p, n: R.n, t: Date.now() }; S.persist(); } else S.setLast(p, R.k);
    if (history.state && history.state.reader) history.replaceState({ reader: 1 }, '', '#p' + p);
    renderPanel(); Tally.render();
    layout(dir);
    [p - 1, p + 1, p + 2, p - 2].forEach(function (q) { if (q >= 1 && q <= 604) img(q).catch(function () {}); });
  }

  /* ---------- layout ---------- */
  var layoutSeq = 0;
  function layout(dir) {
    var seq = ++layoutSeq, p = R.p, segs = segsFor(p), two = spreadOn(segs), fp = partner(p);
    return Promise.all(segs.map(function (s) { return img(s.p); }).concat(two ? [img(fp)] : [])).then(function (ims) {
      if (seq !== layoutSeq) return;
      var sc = $('#rscroll'), sheet = $('#sheet'), spr = $('#spr'), face = $('#face'), fim = two ? ims.pop() : null;
      var dims = segs.map(function (s, i) {
        var im = ims[i], c = s.raw ? { l: 0, t: 0, r: 0, b: 0 } : cropOf(s.p), nw = im.naturalWidth, nh = im.naturalHeight;
        var cw = (1 - c.l - c.r) * nw, ch = (1 - c.t - c.b) * nh;
        return { im: im, c: c, nw: nw, nh: nh, cw: cw, ch: ch, u: (s.y1 - s.y0) * ch / cw };
      });
      var U = dims.reduce(function (a, d) { return a + d.u; }, 0);
      var vw = sc.clientWidth || innerWidth, top = 8, vh = innerHeight - R.ph - top * 2, GAP = 12;
      var vhW = !desk() && R.panel && R.ribH ? innerHeight - Math.min(R.ph, R.ribH) - top * 2 : vh; // v111: page size ignores the expanded drawer
      if (desk()) vw = Math.max(240, vw - 2 * EDGE);
      if (two) vw = (vw - GAP) / 2; // each page gets half the width
      // Whole-page mode keeps the page's own width; a join that makes it taller than the screen scrolls instead of shrinking.
      var fitAll = R.sub === 'crop' || R.sub === 'join' || (R.edit && desk()), W; // v113: Box/Line editing on the phone keeps the page size
      if (fitAll) W = Math.min(vw, vh / U);
      // Phone on its side (mobile view): fit the width and scroll down the page; the zoom chip scales from there.
      else if (land() && !desk() && innerHeight < 600) W = vw;
      else if (fitPage()) { var Ub = U; segs.forEach(function (s, i) { if (s.role === 'this') Ub = dims[i].ch / dims[i].cw; }); W = Math.min(vw, vhW / Math.min(U, Ub)); }
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
      var H = U * W;
      // Facing page: shown beside this one at the same width, with its own crop and the same mask slot.
      var key = two ? Math.min(p, fp) : null, same = two && R.sprK === key;
      R.sprK = key; spr.classList.toggle('two', two);
      if (two) {
        var fc = cropOf(fp), fnw = fim.naturalWidth, fnh = fim.naturalHeight, fcw = (1 - fc.l - fc.r) * fnw, fch = (1 - fc.t - fc.b) * fnh, fk = W / fcw, Hf = fch / fcw * 1000;
        var ft = faceTarget(fp);
        face.className = 'sheet face' + (ft ? '' : ' out'); face.title = ft ? 'Open P. ' + fp : 'P. ' + fp + ' isn’t in this list';
        face.style.width = W + 'px'; face.style.order = p % 2 ? 0 : 2; // odd page sits on the right
        face.innerHTML = '<div class="pseg" style="height:' + (fch * fk).toFixed(2) + 'px"><img src="' + fim.src + '" alt="" style="width:' + (fnw * fk).toFixed(2) + 'px;transform:translate(' + (-fc.l * fnw * fk).toFixed(2) + 'px,' + (-fc.t * fnh * fk).toFixed(2) + 'px)"></div>' +
          '<svg class="fov" viewBox="0 0 1000 ' + Hf.toFixed(1) + '" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">' + staticMask(fp, Hf) + '</svg>';
        H = Math.max(H, fch * fk);
      } else face.innerHTML = '';
      sheet.style.order = 1;
      var fit = (fitPage() || fitAll) && H <= (desk() || fitAll ? vh : innerHeight - R.ph) + 2;
      sheet.style.width = W + 'px'; sheet.style.marginLeft = sheet.style.marginRight = sheet.style.marginTop = '';
      // v91: only web view centres the page vertically; the phone reader keeps it at the top, leaving the space below free (e.g. for the tally button)
      spr.style.marginTop = (fit && document.body.classList.contains('web') ? Math.max(top, (innerHeight - R.ph - H) / 2) : 0) + 'px';
      spr.style.transition = 'none'; spr.style.transform = '';
      sheet.innerHTML = html + '<svg id="ov" viewBox="0 0 1000 ' + R.Hu.toFixed(1) + '" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"></svg>';
      $('#rpad').style.height = fit ? '0px' : (R.ph + 20) + 'px';
      // v113: the Expanded drawer fills exactly the empty space under the page, so every tool's drawer starts where the page ends.
      if (!desk() && !fitAll) { var dh = Math.round(innerHeight - (sheet.getBoundingClientRect().bottom + sc.scrollTop)); if (dh !== R.dh) { R.dh = dh; $('#reader').style.setProperty('--dh', Math.max(0, dh) + 'px'); requestAnimationFrame(function () { if (measurePanel()) relayout(); }); } }
      sc.style.overflowY = fit ? 'hidden' : 'auto';
      sc.style.overflowX = desk() && !fit ? 'auto' : ''; // web view zoomed past the screen width scrolls sideways too
      sc.style.touchAction = fit || R.edit ? 'none' : 'pan-y';
      if (dir && !same && spr.animate) spr.animate([{ transform: 'translateX(' + (-dir * 60) + 'px)', opacity: 0.2 }, { transform: 'none', opacity: 1 }], { duration: 170, easing: 'ease-out' });
      if (dir && !same) sc.scrollTop = 0;
      if (R.sub === 'crop') drawCropMode(); else draw();
      bindOv();
      if (R.U !== R.fitU && dzCur() === 'fit') { R.fitU = R.U; fitRows(); if (measurePanel()) relayout(); }
    }).catch(function () {
      if (seq === layoutSeq) $('#sheet').innerHTML = '<div style="padding:40px;text-align:center;color:#666;background:#fff">Couldn’t load this page. Check your connection.</div>';
    });
  }
  function setZoom(d) { var s = S.d.settings; s[zkey()] = clamp(Math.round(lzoom() * 100) + d, 40, zmax()); S.saveSettings(); afterPanel(); relayout(); }
  /* Web view: the mouse wheel zooms (10% a notch), keeping the spot under the pointer in place. */
  var wheelSave = 0;
  function wheelZoom(e) {
    if (!desk() || !land()) return;
    e.preventDefault();
    var sc = $('#rscroll'), s = S.d.settings, z0 = Math.round(lzoom() * 100), z = clamp(z0 + (e.deltaY < 0 ? 10 : -10), 40, zmax());
    if (z === z0) return;
    var r = sc.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    var fx = (sc.scrollLeft + mx) / Math.max(1, sc.scrollWidth), fy = (sc.scrollTop + my) / Math.max(1, sc.scrollHeight);
    s.lz = z; clearTimeout(wheelSave); wheelSave = setTimeout(function () { S.saveSettings(); }, 600);
    afterPanel();
    layout().then(function () { sc.scrollLeft = fx * sc.scrollWidth - mx; sc.scrollTop = fy * sc.scrollHeight - my; });
  }
  var rq = 0;
  function relayout() { cancelAnimationFrame(rq); rq = requestAnimationFrame(function () { layout(); }); }
  window.addEventListener('resize', function () { if (Reader.isOpen()) { if (R.wasDesk !== desk()) { R.wasDesk = desk(); loadItems(); renderPanel(); }
      if (R.wasPL !== phoneLand()) { R.wasPL = phoneLand(); if (R.wasPL && !R.edit && R.sub !== 'crop' && R.sub !== 'join') { R.panel = false; R.dszL = 'rib'; } else R.panel = true; renderPanel(); } measurePanel(); afterPanel(); relayout(); } });
  function ori() { return innerWidth > innerHeight ? 'l' : 'p'; }
  /* v114: the stopwatch chip can be dragged out of the bottom pill to any spot (one per orientation, this device);
     dropped close to its place in the pill it snaps back in like a magnet. */
  var TPK = 'hifz.tpos', TP = {};
  try { TP = JSON.parse(localStorage.getItem(TPK)) || {}; } catch (e) {}
  function keepTP() { try { localStorage.setItem(TPK, JSON.stringify(TP)); } catch (e) {} }
  function tHome() { var ex = $('#rui .rh-exp'), rh = $('#rui .rhandle'); if (!ex || !rh) return null; var r = rh.getBoundingClientRect(); return { x: innerWidth / 2 + ex.offsetWidth / 2, y: r.top + r.height / 2 }; }
  function putChip(el, cx, cy) { var w = el.offsetWidth, h = el.offsetHeight; el.style.left = Math.max(4, Math.min(innerWidth - w - 4, cx - w / 2)) + 'px'; el.style.top = Math.max(4, Math.min(innerHeight - h - 4, cy - h / 2)) + 'px'; }
  function wireTchip() {
    var el = $('#rui .tchip'); if (!el) return;
    var q = TP[ori()];
    if (q && el.classList.contains('tfloat')) putChip(el, q.x * innerWidth, q.y * innerHeight);
    var g = null;
    el.addEventListener('pointerdown', function (e) { var r = el.getBoundingClientRect(); g = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: e.clientX - r.left - r.width / 2, oy: e.clientY - r.top - r.height / 2, drag: false }; try { el.setPointerCapture(e.pointerId); } catch (x) {} });
    el.addEventListener('pointermove', function (e) {
      if (!g || e.pointerId !== g.id) return;
      if (!g.drag && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 8) {
        g.drag = true; R.tdrag = true;
        // Moving the element itself out of the pill would drop the pointer, so a floating copy follows the finger
        // and the chip's slot in the pill stays empty (the spot it snaps back to).
        if (el.classList.contains('tfloat')) g.px = el;
        else { g.px = el.cloneNode(true); g.px.classList.add('tfloat'); g.px.removeAttribute('data-ract'); $('#rui').appendChild(g.px); el.style.visibility = 'hidden'; }
        g.px.classList.remove('snap');
      }
      if (g.drag) { e.preventDefault(); putChip(g.px, e.clientX - g.ox, e.clientY - g.oy); }
    });
    function up(e) {
      if (!g || e.pointerId !== g.id) return; var d = g.drag, px = g.px; g = null; if (!d) return;
      var r = px.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, h = tHome();
      var stop = function (ev) { ev.stopPropagation(); ev.preventDefault(); }; // a drag is not a tap on pause/play
      addEventListener('click', stop, { capture: true, once: true }); setTimeout(function () { removeEventListener('click', stop, true); }, 400);
      if (h && Math.hypot(cx - h.x, cy - h.y) < 56) {
        delete TP[ori()]; keepTP(); try { navigator.vibrate && navigator.vibrate(15); } catch (x) {}
        px.classList.add('snap'); putChip(px, h.x, h.y);
        setTimeout(function () { R.tdrag = false; renderPanel(); }, 210); return;
      }
      TP[ori()] = { x: cx / innerWidth, y: cy / innerHeight }; keepTP(); R.tdrag = false; renderPanel();
    }
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }
  /* v115: with the stopwatch chip moved out, the page pill (and in landscape the zoom chip) fade out after 2 s
     without a touch; any touch except on the counter brings them back for another 2 s. */
  var UH = null;
  function uiIdle() { var h = $('#rui'); if (!h) return; h.classList.remove('uihide'); clearTimeout(UH); UH = setTimeout(function () { h.classList.add('uihide'); }, 2000); }
  document.addEventListener('pointerdown', function (e) { if (Reader.isOpen() && !(e.target.closest && e.target.closest('#tally'))) uiIdle(); }, true);
  function measurePanel() {
    var pn = $('.rpanel'); var h = R.panel && pn ? pn.offsetHeight : 0;
    // v111: the Ribbon height (drawer minus everything between the arrow and the toolbar) sets the page size on the phone,
    // so expanding the drawer uses the empty space below the page instead of shrinking the page.
    var gb = pn && pn.querySelector('.grab'), tr = pn && pn.querySelector(':scope > .rrow.tools');
    if (h && gb && tr) R.ribH = h - Math.max(0, tr.offsetTop - gb.offsetTop - gb.offsetHeight); if (h && R.panel) (R.phX || (R.phX = {}))[ori()] = h; var ch = h !== R.ph; R.ph = h; $('#reader').style.setProperty('--ph', h + 'px'); return ch; }

  /* ---------- mask drawing ---------- */
  function dividers() {
    return R.items.map(function (m, i) { return { m: m, i: i }; }).filter(function (x) { return x.m.k === 'div'; })
      .sort(function (a, b) { return (a.m.y1 + a.m.y2) - (b.m.y1 + b.m.y2); });
  }
  function divPts(m) { return '1000,' + r1(m.y1) + ' ' + r1(m.x) + ',' + r1(m.y1) + ' ' + r1(m.x) + ',' + r1(m.y2) + ' 0,' + r1(m.y2); }
  function draw() {
    var ov = $('#ov'); if (!ov) return;
    var am = activeMask(), cov = (S.d.settings.hideCol || '#f3e9d4'), divs = dividers(), H = R.Hu, s = '', tint = tallyTint();
    if (!am && !R.edit) { ov.innerHTML = tint; return; }
    var sec = R.edit ? 0 : (am.sec || 0), sec2 = sec, hb = !R.edit && am.hb;
    if (sec2 > divs.length + 1) sec = sec2 = 0;
    var lockB = R.edit && R.etool === 'line', lockL = R.edit && R.etool === 'box'; // v93: only the tool being edited is touchable
    if (!hb) R.items.forEach(function (m, i) {
      if (m.k !== 'box') return;
      s += '<rect' + (lockB ? ' style="pointer-events:none"' : ' data-i="' + i + '"') + ' class="' + (R.edit && R.sel === i ? 'sel' : '') + '" x="' + r1(m.x) + '" y="' + r1(m.y) + '" width="' + r1(m.w) + '" height="' + r1(m.h) + '" rx="4" fill="' + m.c + '" fill-opacity="' + m.o + '"' + (m.b ? ' stroke="' + m.c + '" stroke-width="4"' : '') + '/>';
    });
    if (sec && divs.length) {
      var above = divs[sec - 2], below = divs[sec2 - 1];
      if (above) s += '<polygon points="0,0 1000,0 ' + divPts(above.m) + '" fill="' + cov + '"/>';
      if (below) s += '<polygon points="' + divPts(below.m) + ' 0,' + r1(H) + ' 1000,' + r1(H) + '" fill="' + cov + '"/>';
    }
    if (R.edit && !lockL) divs.forEach(function (x) {
      s += '<polyline class="div' + (R.sel === x.i ? ' sel' : '') + '" points="' + divPts(x.m) + '" style="pointer-events:none"/><polyline class="hit" data-i="' + x.i + '" points="' + divPts(x.m) + '"/>';
    });
    else if ((!sec || lockL) && !(am.hl && !R.edit)) divs.forEach(function (x) { s += '<polyline class="div view" points="' + divPts(x.m) + '"/>'; });
    var m = R.items[R.sel];
    if (R.edit && m && kindOK(m)) {
      // Handles are sized in screen pixels (not page units) so they stay easy to hold on a phone.
      var hr = 18, ad = R.drag && R.drag.k === 'h' ? R.drag.h : '';
      handlesOf(m).forEach(function (h) {
        if (h.h === 'g') { // up/down grip at the right end: the only place that moves a line
          var u = pxU(), gw = GRIP_W * u, gh = GRIP_H * u, gx = h.x - gw / 2, gy = h.y - gh / 2, a = 5 * u;
          s += '<g class="grip' + (ad === 'g' ? ' on' : '') + '"><rect x="' + r1(gx) + '" y="' + r1(gy) + '" width="' + r1(gw) + '" height="' + r1(gh) + '" rx="' + r1(gw / 2) + '"/>' +
            '<path d="M' + r1(h.x - a) + ' ' + r1(h.y - 5 * u) + 'L' + r1(h.x) + ' ' + r1(h.y - 12 * u) + 'L' + r1(h.x + a) + ' ' + r1(h.y - 5 * u) + 'M' + r1(h.x - a) + ' ' + r1(h.y + 5 * u) + 'L' + r1(h.x) + ' ' + r1(h.y + 12 * u) + 'L' + r1(h.x + a) + ' ' + r1(h.y + 5 * u) + '"/></g>';
          return;
        }
        s += '<circle class="hd' + (ad === h.h ? ' on' : '') + '" data-h="' + h.h + '" cx="' + r1(h.x) + '" cy="' + r1(h.y) + '" r="' + (h.h === 's' ? 15 : hr) + '"/>';
      });
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
  function drawCropMode() {
    if (R.cmode === 'custom') return drawCrop();
    var ov = $('#ov'); if (!ov) return;
    var d = R.draft, H = R.Hu, x0 = d.l * 1000, y0 = d.t * H, x1 = (1 - d.r) * 1000, y1 = (1 - d.b) * H;
    ov.innerHTML = '<path fill="rgba(0,0,0,.55)" fill-rule="evenodd" d="M0 0H1000V' + r1(H) + 'H0Z M' + r1(x0) + ' ' + r1(y0) + 'V' + r1(y1) + 'H' + r1(x1) + 'V' + r1(y0) + 'Z"/>' +
      '<rect x="' + r1(x0) + '" y="' + r1(y0) + '" width="' + r1(x1 - x0) + '" height="' + r1(y1 - y0) + '" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="14 10"/>';
  }

  /* ---------- pointer on the overlay (mask edit + crop) ---------- */
  function P(e) { var r = $('#ov').getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * 1000, y: (e.clientY - r.top) / r.width * 1000 }; }
  function bindOv() {
    var ov = $('#ov'); if (!ov) return;
    var active = R.edit || (R.sub === 'crop' && R.cmode === 'custom'); // v114: crop handles only in Custom
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
      // A touch anywhere near a handle of the selected shape grabs that handle (nearest wins), before the line or box itself.
      var nh = R.sel >= 0 && kindOK(R.items[R.sel]) ? nearHandle(R.items[R.sel], pt) : null;
      if (nh) { R.drag = { k: 'h', h: nh, i: R.sel, pt: pt, orig: JSON.parse(JSON.stringify(R.items[R.sel])) }; draw(); return; }
      if (ds.i != null && R.items[+ds.i].k === 'div') { R.sel = +ds.i; draw(); renderPanel(); return; } // touching a line only selects it
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
        var lk = hLock();
        if (d.h === 'br') { m.w = Math.max(12, pt.x - m.x); if (!lk) m.h = Math.max(12, pt.y - m.y); }
        else if (d.h === 'tl') { var rx = m.x + m.w, by = m.y + m.h; m.x = Math.min(pt.x, rx - 12); m.w = rx - m.x; if (!lk) { m.y = Math.min(pt.y, by - 12); m.h = by - m.y; } }
        else if (d.h === 'g') { var dy = pt.y - d.pt.y, lo = -Math.min(d.orig.y1, d.orig.y2), hi = R.Hu - Math.max(d.orig.y1, d.orig.y2); dy = clamp(dy, lo, hi); m.y1 = d.orig.y1 + dy; m.y2 = d.orig.y2 + dy; }
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

  var HD_R = 13, HD_GRAB = 60, GRIP_W = 24, GRIP_H = 40; // handle radius and grab radius, in screen px
  function pxU() { var ov = $('#ov'), w = ov ? ov.getBoundingClientRect().width : 0; return w ? 1000 / w : 2.5; } // page units per screen px
  function handlesOf(m) {
    if (!m) return [];
    if (m.k === 'box') { // height locked (default): handles sit mid-edge and only change the width
      var lk = hLock(), hy = m.y + m.h / 2;
      return [{ h: 'tl', x: m.x, y: lk ? hy : m.y }, { h: 'br', x: m.x + m.w, y: lk ? hy : m.y + m.h }];
    }
    var gx = 1000 - (GRIP_W / 2 + 4) * pxU(); // grip hugs the right edge of the page, on the right-hand part of the line
    return [{ h: 'r', x: (1000 + m.x) / 2, y: m.y1 }, { h: 'l', x: m.x / 2, y: m.y2 }, { h: 's', x: m.x, y: (m.y1 + m.y2) / 2 }, { h: 'g', x: gx, y: m.y1 }];
  }
  function nearHandle(m, pt) {
    var best = null, u = pxU(), bd = HD_GRAB * u;
    // Inside a box the big grab zone would swallow a narrow box, leaving no place to drag it: there a handle wins
    // only right on its dot, and never in the box's middle third, which always moves the box.
    if (m.k === 'box' && pt.x > m.x && pt.x < m.x + m.w && pt.y > m.y && pt.y < m.y + m.h) bd = Math.min((HD_R + 8) * u, m.w / 3);
    handlesOf(m).forEach(function (h) { var d = Math.hypot(pt.x - h.x, pt.y - h.y); if (d <= bd) { bd = d; best = h.h; } });
    return best;
  }
  // v93: while editing boxes, lines are view-only, and while editing lines, boxes are view-only.
  function kindOK(m) { return !m || !R.etool || (R.etool === 'box') === (m.k === 'box'); }
  function hLock() { return S.d.settings.boxHLock !== false; } // Settings → Lock box height (on by default)

  /* ---------- page gestures (read mode) ---------- */
  function bindGestures() {
    var sc = $('#rscroll'), g = null, pz = null;
    sc.addEventListener('wheel', wheelZoom, { passive: false });
    /* Two-finger pinch, phone on its side (mobile view) only: scales the page live, then sets the same zoom as the
       − / + chip (40–100%, 100% = full width) when the fingers lift. */
    function pinchOK() { return land() && !desk() && innerHeight < 600 && !R.edit && R.sub !== 'crop' && R.sub !== 'join'; }
    function fd(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
    sc.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 2 || !pinchOK()) return;
      if (g) { clearTimeout(g.lp); g = null; }
      var sp = $('#spr'), r = sp.getBoundingClientRect(), t = e.touches;
      sp.style.transition = 'none';
      sp.style.transformOrigin = ((t[0].clientX + t[1].clientX) / 2 - r.left) + 'px ' + ((t[0].clientY + t[1].clientY) / 2 - r.top) + 'px';
      pz = { d0: fd(t) || 1, z0: lzoom(), f: 1 };
    }, { passive: true });
    sc.addEventListener('touchmove', function (e) {
      if (!pz || e.touches.length !== 2) return;
      e.preventDefault();
      pz.f = clamp(fd(e.touches) / pz.d0, 0.4 / pz.z0, 1 / pz.z0);
      $('#spr').style.transform = 'scale(' + pz.f + ')';
    }, { passive: false });
    function pinchEnd() {
      if (!pz) return; var z = pz.z0 * pz.f; pz = null;
      var sp = $('#spr'); sp.style.transform = ''; sp.style.transformOrigin = '';
      S.d.settings[zkey()] = clamp(Math.round(z * 100), 40, 100); S.saveSettings(); afterPanel(); relayout();
    }
    sc.addEventListener('touchend', function (e) { if (e.touches.length < 2) pinchEnd(); });
    sc.addEventListener('touchcancel', pinchEnd);
    sc.addEventListener('pointerdown', function (e) {
      if (pz) return;
      if (R.edit || R.sub === 'crop' || (e.pointerType === 'mouse' && e.button !== 0)) return;
      g = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId, ax: null };
      // Web view, page bigger than the screen: dragging with the mouse moves the page instead of turning it.
      if (desk() && e.pointerType === 'mouse' && (sc.scrollHeight > sc.clientHeight + 2 || sc.scrollWidth > sc.clientWidth + 2)) g.pan = { sl: sc.scrollLeft, st: sc.scrollTop };
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
      if (g.pan) { if (!g.ax && Math.abs(dx) + Math.abs(dy) > 12) { g.ax = 'p'; clearTimeout(g.lp); sc.classList.add('panning'); } if (g.ax === 'p') { sc.scrollLeft = g.pan.sl - dx; sc.scrollTop = g.pan.st - dy; } return; }
      if (!g.ax && Math.abs(dx) + Math.abs(dy) > 12) { g.ax = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'; clearTimeout(g.lp); }
      if (g.ax === 'x') { var sh = $('#spr'); sh.style.transition = 'none'; sh.style.transform = 'translateX(' + dx + 'px)'; }
    });
    sc.addEventListener('pointerup', function (e) {
      if (!g || e.pointerId !== g.id) return;
      clearTimeout(g.lp); var dx = e.clientX - g.x, dy = e.clientY - g.y, dt = Date.now() - g.t, ax = g.ax, sh = $('#spr'); g = null;
      sc.classList.remove('panning');
      if (ax === 'p') return;
      if (ax === 'x') {
        var dir = dx > 0 ? 1 : -1, nt = stepTo(dir, Math.abs(dx) > 60);
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
      // Single tap hides the drawer (page number brings it back), or with the Settings switch on, double-tap toggles it.
      if (!ax && dt < 350) {
        var fe = e.target.closest && e.target.closest('#face');
        if (fe && $('#spr').classList.contains('two')) { openFace(); return; }
        if (!S.d.settings.tapShow && !desk()) { if (R.panel) togglePanel(false); return; }
        var now = Date.now(); if (now - (R.lastTap || 0) < 320) { R.lastTap = 0; togglePanel(!R.panel); } else R.lastTap = now;
      }
    });
    sc.addEventListener('pointercancel', function (e) { if (g && e.pointerId === g.id) { g = null; var sh = $('#spr'); sh.style.transition = 'transform .18s'; sh.style.transform = ''; } });
    document.addEventListener('keydown', function (e) {
      if (!Reader.isOpen() || /INPUT|SELECT|TEXTAREA/.test((e.target || {}).tagName)) return;
      if (e.key === 'ArrowLeft') step(1); else if (e.key === 'ArrowRight') step(-1); else if (e.key === 'Escape') history.back();
    });
  }
  function togglePanel(on) { if (on && !R.panel && phoneLand()) R.dszL = 'rib'; R.panel = on; renderPanel(); }
  /* Phone on its side (mobile view): the drawer starts hidden, and each time it is brought back it comes as the thin
     ribbon; its arrow makes it bigger. This size is kept apart from the portrait drawer size. */
  function phoneLand() { return land() && !desk() && innerHeight < 600; }
  function openFace() {
    if (R.edit || R.sub === 'crop' || R.sub === 'join') return; // finish editing this page first
    var q = partner(R.p), t = faceTarget(q);
    if (!t) { App.toast('P. ' + q + ' isn’t in this list'); return; }
    go(t.p, q > R.p ? 1 : -1, t.n);
  }

  /* ---------- panel ---------- */
  var I = function (d) { return '<svg class="i" viewBox="0 0 24 24">' + d + '</svg>'; };
  var IC = {
    box: I('<rect x="3" y="6" width="18" height="12" rx="2"/>'), line: I('<path d="M3 9h10v6h8"/>'),
    crop: I('<path d="M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2"/>'), join: I('<path d="M4 4h16v5H4zM4 15h16v5H4zM12 9v6"/>'),
    plus: I('<path d="M12 5v14M5 12h14"/>'),
    stat: I('<path d="M5 20V11M11 20V5M17 20v-7M3 20h18"/>'),
    heart: I('<path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z"/><path d="M12 8.5v6M9 11.5h6"/>'),
    clock: I('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M10 2h4"/>'), pause: I('<path d="M8 5v14M16 5v14"/>'),
    play: I('<path d="M7 4l13 8-13 8z"/>'), stop: I('<rect x="6" y="6" width="12" height="12" rx="1.5"/>'),
    tag: I('<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>'),
    full: I('<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>'),
    fitp: I('<rect x="6" y="3" width="12" height="18" rx="1.5"/><path d="M9 8h6M9 12h6M9 16h4"/>'), fitw: I('<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/>'),
    left: I('<path d="M15 18l-6-6 6-6"/>'), right: I('<path d="M9 18l6-6-6-6"/>'), check: I('<path d="M20 6L9 17l-5-5"/>'),
    pen: I('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'), up: I('<path d="M18 15l-6-6-6 6"/>'), down: I('<path d="M6 9l6 6 6-6"/>'), trash: I('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'), x: I('<path d="M6 6l12 12M18 6L6 18"/>'), back: I('<path d="M19 12H5M12 19l-7-7 7-7"/>'), tally: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10"/>'),
    phone: I('<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M11 18.5h2"/>'),
    bmk: I('<path d="M6.5 3h11v18l-5.5-4.2L6.5 21z"/>'), bmgo: I('<path d="M5 3h9v18l-4.5-3.4L5 21z"/><path d="M15 12h6M18.5 9l2.5 3-2.5 3"/>'),
    hash: I('<path d="M9 3L7 21M17 3l-2 18M4 8.5h17M3 15.5h17"/>'),
    book: I('<path d="M2 5.5C4.5 4.3 7.5 4.3 12 6c4.5-1.7 7.5-1.7 10-.5v13c-2.5-1.2-5.5-1.2-10 .5-4.5-1.7-7.5-1.7-10-.5zM12 6v13.5"/>')
  };
  function tb(id, label, icon, on, off) { return '<button class="tb' + (on ? ' on' : '') + '" data-ract="' + id + '"' + (off ? ' disabled' : '') + '>' + icon + label + '</button>'; }
  function navBtns(cls) {
    if (cls !== 'edge') return ''; // v109: swiping and the page strip are the only page navigation on mobile
    return '<button class="navb ' + cls + ' l" data-ract="next" aria-label="Next page"' + (!stepTo(1) ? ' disabled' : '') + '>' + IC.left + '</button>' +
      '<button class="navb ' + cls + ' r" data-ract="prev" aria-label="Previous page"' + (!stepTo(-1) ? ' disabled' : '') + '>' + IC.right + '</button>';
  }
  function renderPanel() {
    if (R.tdrag) return; // the stopwatch chip is being dragged; it re-renders on drop
    var host = $('#rui'), p = R.p, x = '';
    document.body.classList.toggle('statopen', !!R.stat);
    if (R.stat) { host.innerHTML = statPage(); return; } // v109: page stats open as a full page over the reader
    if (!R.panel) {
      var ta = Timer.active(), tr = Timer.state().run;
      // One bottom pill: expand handle, then (when a session exists) the stopwatch chip — tap it to pause/resume.
      var fl = !!TP[ori()], chip = '';
      x += navBtns('float') + '<div class="rhandle' + (fl && ta ? ' fl' : '') + '"><button class="rh-exp" data-ract="expand" aria-label="Show controls">' + IC.up + '<span>P. ' + p + '</span></button>';
      if (ta) chip += '<button class="tchip' + (fl ? ' tfloat' : '') + (Timer.achieved() ? ' ach' : '') + (tr ? '' : ' paused') + '" data-ract="tGo" aria-label="' + (tr ? 'Pause' : 'Resume') + ' stopwatch">' +
        (Timer.achieved() ? IC.check : '<i class="tdot"></i>') + '<span class="tmr-t">' + Timer.shown(Timer.state().secs) + '</span>' +
        (S.d.settings.sessT && !Timer.achieved() ? '<span class="tgl">/ ' + S.d.settings.sessT + ':00</span>' : '') + (tr ? IC.pause : IC.play) + '</button>';
      x += (fl ? '' : chip) + '</div>' + (fl ? chip : '');
      host.innerHTML = x; afterPanel(); return;
    }
    var before = toolPos();
    var dz = dzCur();
    x += '<div class="rpanel dz-' + dz + (R.sub === 'join' || R.sub === 'crop' ? ' cj' : '') + (R.sub === 'join' || R.sub === 'crop' || R.edit ? '' : ' mainp') + '"><button class="grab" data-ract="dsz" aria-label="Resize controls">' + (dz === 'rib' ? IC.up : IC.down) + '</button>';
    if (R.sub === 'join') x += joinPanel();
    else if (R.sub === 'crop') x += cropPanel() + toolsRow();
    else if (R.edit) x += editPanel() + toolsRow();
    else x += mainPanel();
    x += '</div>';
    host.innerHTML = x; afterPanel(); slideTools(before);
  }
  // Toolbar icons glide to their new spots when an oval opens or closes, instead of jumping.
  function toolPos() {
    var o = {}; [].forEach.call(document.querySelectorAll('.rpanel .tools [data-ract]'), function (b) { o[b.dataset.ract] = b.getBoundingClientRect().left; }); return o;
  }
  function slideTools(before) {
    [].forEach.call(document.querySelectorAll('.rpanel .tools [data-ract]'), function (b) {
      var x0 = before[b.dataset.ract]; if (x0 == null || !b.animate) return;
      var d = x0 - b.getBoundingClientRect().left; if (Math.abs(d) < 1) return;
      b.animate([{ transform: 'translateX(' + d + 'px)' }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.2,.7,.3,1)' });
    });
  }
  /* Page strip under the surah name: the listed pages (Memorizing) or the surah's pages, current one centred.
     Scroll or drag the strip; whichever number settles in the centre opens. Tap a number to jump to it. */
  function stripKeys() {
    // v128 (SL12): Recitation with a target date — the strip holds only the plan section this page is in (today's set first).
    var sec = recSec();
    if (sec) { var a = []; for (var q = sec.a; q <= sec.b; q++) a.push(q === R.p ? R.k : S.uk(q, S.onPage(q)[0])); return a; }
    // Memorizing: only this surah's listed pages — the strip, like swiping, never shows another surah's pages.
    if (R.range) { var m = R.range.filter(function (u) { return S.kn(u) === R.n; }); return m.length ? m : [R.k]; }
    var s = QURAN.S[R.n - 1], a = []; if (!s) return [String(R.p)];
    for (var q = s[3]; q <= s[4]; q++) a.push(S.uk(q, R.n));
    return a;
  }
  function recPlan() { return R.rec ? S.plan(R.rtag) : null; }
  function recSec() { var pl = recPlan(), i = S.planSec(pl, R.p); return i >= 0 ? pl.secs[i] : null; }
  function pstrip() {
    // Right to left like the mushaf: later pages sit to the left. Spacers let the first/last page reach the centre.
    // v128 (SL12): after the section's last page (far left) comes "Continue to next section".
    var pl = recPlan(), si = S.planSec(pl, R.p), nx = si >= 0 && pl.secs[si + 1];
    return '<div class="pswrap"><i class="pring"></i><div class="pstrip"><i class="psp"></i>' + (nx ? '<button class="pnext" data-ract="nextSec">Continue to next section</button>' : '') + stripKeys().slice().reverse().map(function (k) {
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
    var t = null, lastU = 0, mark = function () { lastU = Date.now(); };
    // v102: only a scroll the person makes (touch, drag, wheel, then its momentum) may open another page.
    // Layout shifts after a panel re-render also scroll the strip; those used to jump several pages.
    ['pointerdown', 'pointermove', 'touchstart', 'touchmove', 'wheel'].forEach(function (ev) { ps.addEventListener(ev, mark, { passive: true }); });
    ps.addEventListener('scroll', function () {
      if (R.stripSet) { R.stripSet = false; return; }
      if (Date.now() - lastU > 1500) { centre(); return; }
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
    $('#reader').classList.toggle('desk', desk());
    var vs = $('#rui .vsw'); if (vs) vs.remove();
    if (wideScreen()) $('#rui').insertAdjacentHTML('beforeend', '<button class="vsw rv' + (desk() ? ' on' : '') + '" data-ract="viewFlip" title="Mobile view / Web view" aria-label="Switch between mobile view and web view"><span class="vm"><svg class="i" viewBox="0 0 24 24"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg></span><span class="vd"><svg class="i" viewBox="0 0 24 24"><rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8.5 21h7M12 17v4"/></svg></span></button>');
    wireStrip(); wireWheel(); wireCropWheel(); wireTchip();
    var zc = $('#rui .zchip'); if (land()) { if (zc) zc.outerHTML = zoomChip(); else $('#rui').insertAdjacentHTML('beforeend', zoomChip()); } else if (zc) zc.remove();
    // Keep the active tool visible when the toolbar is wider than the screen.
    var on = document.querySelector('.rpanel .tools .tb.on'), row = on && on.parentNode;
    if (on && (on.offsetLeft < row.scrollLeft || on.offsetLeft + on.offsetWidth > row.scrollLeft + row.clientWidth)) row.scrollLeft = on.offsetLeft - row.clientWidth / 2 + on.offsetWidth / 2;
    if (R.scrollEnd) { R.scrollEnd = false; var tr = document.querySelector('.rpanel .rrow.tools'); if (tr) tr.scrollLeft = tr.scrollWidth; }
    fitRows();
    if (measurePanel()) relayout();
    if (UH === null) uiIdle();
    if (window.Tally) Tally.render(); // v114: a counter left where the drawer opened goes back home
  }
  /* Drawer sizes: Full (all rows), Fit (shrinks to the gap under a full-width page), Ribbon (toolbar only).
     Tools that need room (Crop, Join, Box/Line) always open at Full. Rows for Health/Tags/Timer stay visible in every size. */
  var DZ = ['hide', 'rib', 'full']; // v109: two sizes — Ribbon and Expanded (one fixed height for every tool)
  function dzCur() { return (R.sub === 'crop' || R.sub === 'join' || R.edit) ? 'full' : dzOk(phoneLand() ? (R.dszL || 'rib') : (S.d.settings.dsz || 'full')); }
  function dzOk(z) { return DZ.indexOf(z) > 0 ? z : 'full'; } // older 'fit'/'exp' read as Expanded // v108: sizes saved by v106/v107 ('exp') read as Full
  function setDz(z) {
    if (z === 'hide') { togglePanel(false); return; }
    if (phoneLand()) R.dszL = z; else { S.d.settings.dsz = z; S.saveSettings(); } R.fitU = R.U; R.panel = true; renderPanel();
  }
  /* v98: in Ribbon the tool rows are hidden, so tapping Tally / Timer / Health there opens that row and grows the
     drawer to Fit (which keeps tool rows) instead of toggling a row nobody can see. Returns the new R.sub. */
  function toolSub(name) {
    if (!desk() && R.panel && dzCur() === 'rib') { if (phoneLand()) R.dszL = 'full'; else { S.d.settings.dsz = 'full'; S.saveSettings(); } R.fitU = R.U; return name; }
    return R.sub === name ? null : name;
  }
  function fitRows() {
    var pn = $('.rpanel'), host = $('#rui'); if (!pn) return;
    [].forEach.call(pn.querySelectorAll('.dzh'), function (e) { e.classList.remove('dzh'); });
    [].forEach.call(host.querySelectorAll('.navb.float,.navb.edge'), function (e) { e.remove(); });
    if (desk()) { host.insertAdjacentHTML('beforeend', navBtns('edge')); return; } // one bar, no drawer sizes; arrows at the screen edges
    var dz = dzCur(); if (dz !== 'rib') return;
    var rows = [].filter.call(pn.children, function (e) { return !e.matches('.grab,.tools,.rsub,.subrow'); });
    if (dz === 'rib') {
      // v96: Ribbon is the thinnest size — only the arrow and the icon toolbar; an open tool row (Tally, Timer, Health) hides too.
      [].forEach.call(pn.children, function (e) { if (!e.matches('.grab,.tools')) e.classList.add('dzh'); });
    }
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
      setDz(DZ[Math.max(0, Math.min(2, i + st))]);
    }
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
  });

  // On a page shared by several surahs, the title is a switch: each surah's part has its own memorizing state.
  /* Surah row, right to left like the mushaf (later surahs on the left). It holds the surahs on this page (a switch on a
     shared page) and, at the first or last listed page of this surah, a chip for the neighbouring surah in the same list
     (or the mushaf, from To Memorize) — tapping it moves into that surah's pages. Opened from a list, surahs with no
     listed pages are left out. */
  function hasMore(dir) {
    if (R.range) return R.range.some(function (u) { return S.kn(u) === R.n && (dir > 0 ? S.kp(u) > R.p : S.kp(u) < R.p); });
    var s = QURAN.S[R.n - 1]; return s ? (dir > 0 ? R.p < s[4] : R.p > s[3]) : false;
  }
  function nbSurah(dir) {
    if (!R.range) { var n = R.n + dir; return n >= 1 && n <= 114 ? n : 0; }
    var best = 0; R.range.forEach(function (u) { var n = S.kn(u); if (dir > 0 ? n > R.n && (!best || n < best) : n < R.n && n > best) best = n; });
    return best;
  }
  function surahTitle(p) {
    var ss = S.onPage(p).filter(function (n) { return n === R.n || !R.range || R.range.indexOf(S.uk(p, n)) >= 0; });
    var nx = hasMore(1) ? 0 : nbSurah(1), pv = hasMore(-1) ? 0 : nbSurah(-1);
    if (ss.indexOf(nx) >= 0) nx = 0; if (ss.indexOf(pv) >= 0) pv = 0;
    if (ss.length < 2 && !nx && !pv) return App.esc(App.pageTitle(p));
    var nm = function (n) { return App.esc(QURAN.S[n - 1][0]); };
    return '<span class="sswitch">' +
      (nx ? '<button class="nb" data-ract="nbS" data-n="' + nx + '" data-d="1" aria-label="Next surah">‹ ' + nm(nx) + '</button>' : '') +
      ss.slice().reverse().map(function (n) { return '<button class="' + (n === R.n ? 'on' : '') + '" data-ract="surah" data-n="' + n + '">' + nm(n) + '</button>'; }).join('') +
      (pv ? '<button class="nb" data-ract="nbS" data-n="' + pv + '" data-d="-1" aria-label="Previous surah">' + nm(pv) + ' ›</button>' : '') + '</span>';
  }
  /* Section oval (1 2 3 … All, greyed when there are no lines). */
  function maskRows() {
    var am = activeMask(), it = R.items, nb = it.some(function (q) { return q.k === 'box'; }), nd = nDiv(it);
    function tg(act, on, has, ic, lbl) {
      return '<button class="vtog' + (on ? ' on' : '') + (has ? '' : ' none') + '" data-ract="' + act + '" role="switch" aria-checked="' + on + '" aria-label="' + lbl + (on ? ' shown' : ' hidden') + '"' + (has ? '' : ' disabled') + '>' + ic + '</button>';
    }
    // v104: Box / Line show-hide switches live in their own rows (bottom bar); this row is the Section oval only.
    var r = '<div class="rrow wrap mwrap"><div class="mrow scroll">';
    var f = am ? am.sec || 0 : 0; if (f > nd + 1) f = 0;
    r += '<span class="soval' + (nd ? '' : ' off') + '"><span class="sovl">Section</span>';
    for (var i = 1; i <= nd + 1 && nd; i++) r += '<button class="' + (f === i ? 'on' : '') + '" data-ract="sec" data-s="' + i + '">' + i + '</button>';
    r += '<button class="' + (!f ? 'on' : '') + '" data-ract="sec" data-s="0"' + (nd ? '' : ' disabled') + '>All</button></span>';
    return r + '</div></div>';
  }
  function mainPanel() {
    var p = R.p, k = R.k, o = S.get(k), m = S.isMem(k), h = S.health(k);
    var ms = masksOf(p), am = activeMask(), x = '';
    if (R.sub === 'health') R.sub = null; // v109: health moved to the Stat page
    var tool = R.sub === 'timer' || R.sub === 'tally' || R.sub === 'box' || R.sub === 'line';
    // v110: one swap area of fixed height — the surah name and page strip, or the open tool's row in their place.
    if (R.rec && R.pstat && !tool) return planStats() + toolsRow();
    x += '<div class="rswap">';
    if (!tool || desk()) x += '<div class="rrow nav">' + navBtns('in') + '<div class="rtitle tcol"><div class="tname">' + surahTitle(p) + '</div>' + pstrip() + '</div></div>';
    if (tool) { x += '<div class="rslot">';
      if (R.sub === 'timer') x += timerPanel();
      if (R.sub === 'tally') x += tallyPanel();
      if (R.sub === 'box' || R.sub === 'line') x += kindPanel(R.sub);
      x += '</div>'; }
    x += '</div>';
    // No Memorizing toggle here (pages are added/removed from the home tabs only, so nothing is removed by accident).
    // Page stats are automatic: tally reads, stopwatch time, days read (5 min or a tally that day).
    // v109: read/time numbers live only on the Stat page.
    if (!R.rec) x += maskRows();
    else if (!tool) x += planLine();
    // Health and Tags live in the bottom toolbar and expand their row just above it.
    return x + toolsRow();
  }
  /* v128 (SL11/SL12) Daily plan line under the page strip (Recitation, reading with a target date). */
  function fmtD(k, wd) { return new Date(k + 'T00:00:00').toLocaleDateString(undefined, wd ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short' }); }
  function pr(a, b) { return a === b ? 'P. ' + a : 'P. ' + a + '–' + b; }
  function planLine() {
    var pl = recPlan(); if (!pl) return '';
    var si = S.planSec(pl, R.p), dl = pl.dl + ' day' + (pl.dl === 1 ? '' : 's') + ' left', t;
    if (pl.passed) t = '<b>Target date passed</b> · ' + pl.left + ' pages left';
    else if (si > 0) t = '<b>' + fmtD(pl.secs[si].d, 1) + ':</b> ' + pr(pl.secs[si].a, pl.secs[si].b) + ' · ' + (pl.secs[si].b - pl.secs[si].a + 1) + ' pages';
    else if (pl.done) t = '<b class="pdone">' + IC.check + 'Today ' + pr(pl.s0, pl.e0) + ' done</b>' + (pl.next ? ' · next ' + pr(pl.next.a, pl.next.b) : '');
    else t = '<b>Today:</b> ' + pr(pl.s0, pl.e0) + ' · ' + pl.q + ' page' + (pl.q === 1 ? '' : 's') + ' · ' + dl;
    return '<div class="rplan"><span class="rpt">' + t + '</span><button class="rpsee" data-ract="planStat">See stats</button></div>';
  }
  // "See stats": the drawer grows to half the screen with the plan's numbers; tap again (or the arrow) to fold it.
  function planStats() {
    var pl = recPlan(); if (!pl) { R.pstat = false; return ''; }
    var tl = function (l, v, sub) { return '<div class="stile"><span>' + l + '</span><b>' + v + '</b>' + (sub ? '<i>' + sub + '</i>' : '') + '</div>'; };
    var pd = function (n) { return n + ' page' + (n === 1 ? '' : 's'); };
    return '<div class="rpstats"><div class="rphd"><b>' + App.esc(S.rtag(R.rtag).name) + ' · daily plan</b><button class="icb" data-ract="planStat" aria-label="Close stats">' + IC.x + '</button></div>' +
      '<div class="rpsub">' + (pl.passed ? 'Target ' + fmtD(pl.target) + ' has passed' : 'Today ' + pr(pl.s0, pl.e0) + ' · target ' + fmtD(pl.target)) + '</div>' +
      '<div class="sgrid">' + tl('Pages read today', pl.readToday, pl.done ? 'today\'s set done' : pd(pl.todayLeft) + ' to go') + tl('Daily average', pl.avg, 'pages a day since ' + fmtD(pl.since)) +
      tl('Original daily target', pd(pl.orig)) + tl('Current daily target', pd(pl.q), pl.q > pl.orig ? 'behind plan' : pl.q < pl.orig ? 'ahead of plan' : 'on plan') +
      tl('Days left', pl.passed ? 0 : pl.dl, 'incl. today') + tl('Pages left', pl.left) + '</div></div>';
  }
  // The bottom toolbar stays put in every mode; each tool opens its row above it and a second tap closes it.
  function toolsRow() {
    var p = R.p, m = S.isMem(R.k), h = S.health(R.k), am = activeMask();
    // Editing tools (Crop, Join, Box, Line, Clear) live behind one Edit button; opening it expands them inside the same oval.
    // v104: Edit holds Crop, Join and Health; Box and Line are their own tools (no Clear).
    var busy = R.sub === 'crop' || R.sub === 'join', open = (R.edOpen || busy) && !R.edit;
    var grp = '<div class="egrp' + (open ? ' open' : '') + '">' + (open ?
      tb('tCrop', 'Crop', IC.crop, R.sub === 'crop') + tb('join', 'Join', IC.join, R.sub === 'join') : '') +
      tb('edGrp', 'Edit', open ? IC.x : IC.pen, false).replace('class="tb', 'class="tb edbtn') + '</div>';
    // While Edit is open, the other tools step aside so all edit tools and Back fit on screen.
    // v117: Recitation toolbar — Bookmark sits in the exact centre (thumb's home); tools left and right of it spread evenly.
    // v119: Stat, Timer | Bookmark | Crop, Back. The Timer stays a plain icon until it is running or tapped open;
    // while its wide oval shows, Stat moves to the right side so each half still fits.
    if (R.rec) {
      var bm = S.bm(R.rtag), here = bm.p === p, oval = recOval(), stat = tb('statOpen', 'Stat', IC.stat, false);
      return '<div class="rrow tools rtools"><div class="rside">' + (oval ? '' : stat) + timerTool() +
        (desk() ? tb('spread', '2 pages', IC.book, S.d.settings.spread !== false) : '') + '</div>' +
        '<button class="tb bmk' + (here ? ' on' : '') + '" data-ract="bmSet" aria-label="' + (here ? 'Bookmarked page' : 'Bookmark this page') + '"><span class="bmc">' + IC.bmk + '</span>' + (here ? 'Marked' : 'Bookmark') + '</button>' +
        // v123 (SL8): on the last page, Complete (mark the khatm) sits next to Bookmark in Crop's place.
        '<div class="rside">' + (oval ? stat : '') + (p === 604 && !S.rtag(R.rtag).done ? tb('khatm', 'Complete', IC.check, false) : tb('tCrop', 'Crop', IC.crop, R.sub === 'crop')) + tb('home', 'Back', IC.back, false) + '</div></div>';
    }
    return '<div class="rrow scroll tools' + (open ? ' edopen' : '') + '">' + (open ? '' :
      tb('statOpen', 'Stat', IC.stat, false) + tb('tLine', 'Line', IC.line, R.sub === 'line' || (R.edit && R.etool === 'line')) + tb('tBox', 'Box', IC.box, R.sub === 'box' || (R.edit && R.etool === 'box')) +
      timerTool() + tb('tally', (Tally.kept(R.k) || (Tally.dirty() && Tally.unit() === R.k) ? '<i class="tkdot"></i>' : '') + 'Tally', IC.tally, R.sub === 'tally') +
      (desk() ? tb('spread', '2 pages', IC.book, S.d.settings.spread !== false) : '') +
      (installed() ? '' : tb('fs', 'Full screen', IC.full, false))) + grp + tb('home', 'Back', IC.back, false) + '</div>';
  }
  // Once a session is running, Timer expands into an oval with the running time and play/pause beside it.
  // v119: in Recitation the oval shows only while the stopwatch runs or its row is open; a paused session keeps an amber dot.
  function recOval() { return Timer.state().run || R.sub === 'timer'; }
  function timerTool() {
    var T = Timer.state(), b = tb('timer', 'Timer', IC.clock, R.sub === 'timer').replace('class="tb', 'class="tb' + (T.run ? ' live' : ''));
    if (R.rec && !recOval()) return Timer.active() ? b.replace(IC.clock, '<i class="tkdot"></i>' + IC.clock) : b;
    if (!Timer.active() && R.sub !== 'timer') return b; // opened but not started: shows 0:00 with play
    return '<div class="egrp tgrp">' + b + (Timer.rem() ? '<span class="tgst"><span class="tgt tmr-t">' + Timer.shown(T.secs) + '</span><span class="tgl2">/ ' + Timer.rem() + ':00</span></span>' : '<span class="tgt tmr-t">' + Timer.shown(T.secs) + '</span>') +
      '<button class="tb tgo" data-ract="tGo" aria-label="' + (T.run ? 'Pause' : 'Start') + '">' + (T.run ? IC.pause : IC.play) + '</button></div>';
  }
  // Pause box: the session time and this page's time, with Resume or Save. Tapping outside keeps it paused.
  function pauseBox() {
    var sc = document.getElementById('scrim'); if (!sc) return;
    var T = Timer.state(), p = R.p, md = Timer.modeOf(R.k) === 'r' ? 'review' : 'memorizing', ach = Timer.achieved();
    sc.innerHTML = '<div class="sheetm pbox"><div class="pbt">Paused</div>' +
      '<div class="tbig' + (ach ? ' ach' : '') + '"><span class="tmr-t">' + Timer.shown(T.secs) + '</span>' + (Timer.rem() ? '<span class="tgl">/ ' + Timer.rem() + ':00</span>' : '') + '</div>' +
      '<div class="small muted">' + (ach ? '<b class="tach">' + IC.check + 'Achieved</b> · ' : '') + md + ' · this page <span class="tmr-pg">' + Timer.fmt(Timer.pageToday(p)) + '</span></div>' +
      '<div class="pbtns"><button class="btn pdel" data-ract="tDel" aria-label="Delete session">' + IC.trash + '</button><button class="btn" data-ract="tSave">' + IC.check + 'Save</button><button class="btn pri" data-ract="tResume">' + IC.play + 'Resume</button></div></div>';
    sc.style.display = 'flex';
  }
  function closePause() { var sc = document.getElementById('scrim'); if (sc) { sc.style.display = 'none'; sc.innerHTML = ''; } }
  // Close crop (keeping the crop) or mask editing (keeping the shapes) before switching to another tool.
  function leaveModes() { if (R.edit) RACT.doneEdit(); if (R.sub === 'crop') RACT.cropApply(); }
  /* v109 Timer row: one line — target wheel (left), pause actions when paused (centre), Time left switch (right).
     No "None": the wheel shows one value and scrolls vertically; the daily goal moved to the Stat page. */
  var WHEEL = [5, 10, 15, 20, 25, 30, 45, 60];
  function timerPanel() {
    var T = Timer.state(), s = S.d.settings, on = Timer.active();
    if (!s.sessT) Timer.setTarget(5);
    var cur = s.sessT, opts = WHEEL.slice(); if (opts.indexOf(cur) < 0) { opts.push(cur); opts.sort(function (a, b) { return a - b; }); }
    var wh = '<div class="twheel" aria-label="Session target"><i class="wsp"></i>' + opts.map(function (v) { return '<b class="wv' + (v === cur ? ' on' : '') + '" data-v="' + v + '">' + v + ' min</b>'; }).join('') +
      '<b class="wv wc" data-v="custom">Other…</b><i class="wsp"></i></div>';
    var mid = on && !T.run ? '<button class="icb danger" data-ract="tDel" aria-label="Delete paused session">' + IC.trash + '</button><button class="icb pri" data-ract="tSave" aria-label="Save paused session">' + IC.check + '</button>' : '';
    var rm = !!s.tRem;
    return '<div class="rsub tsub"><div class="trow3"><span class="t3l"><span class="lbl">Target</span>' + wh + '</span><span class="t3m">' + mid + '</span>' +
      '<span class="t3r"><button class="jsw' + (rm ? ' on' : '') + '" data-ract="tRem" role="switch" aria-checked="' + rm + '"><i></i>Time left</button></span></div></div>';
  }
  function wireWheel() {
    var w = document.querySelector('.rpanel .twheel:not(.cwheel)'); if (!w) return; // v115: not the Crop wheel
    var on = w.querySelector('.wv.on'), t = null, lastU = 0, mark = function () { lastU = Date.now(); };
    ['pointerdown', 'pointermove', 'touchstart', 'touchmove', 'wheel'].forEach(function (ev) { w.addEventListener(ev, mark, { passive: true }); });
    var mid = function () { var c = w.scrollTop + w.clientHeight / 2, best = null, bd = 1e9; [].forEach.call(w.querySelectorAll('.wv'), function (b) { var d = Math.abs(b.offsetTop + b.offsetHeight / 2 - c); if (d < bd) { bd = d; best = b; } }); return best; };
    if (on) w.scrollTop = on.offsetTop + on.offsetHeight / 2 - w.clientHeight / 2;
    w.addEventListener('scroll', function () {
      if (Date.now() - lastU > 1500) return; // only the person's own scroll changes the target
      var m = mid(); [].forEach.call(w.querySelectorAll('.wv'), function (b) { b.classList.toggle('on', b === m); });
      clearTimeout(t);
      t = setTimeout(function () {
        var b = mid(); if (!b) return; var v = b.dataset.v;
        if (v === 'custom') { v = parseInt(prompt('Session target in minutes', S.d.settings.sessT || 45), 10); if (!(v > 0)) { renderPanel(); return; } }
        if (+v !== S.d.settings.sessT) { Timer.setTarget(+v); renderPanel(); }
      }, 250);
    }, { passive: true });
    w.addEventListener('click', function (e) { var b = e.target.closest('.wv'); if (b) w.scrollTo({ top: b.offsetTop + b.offsetHeight / 2 - w.clientHeight / 2, behavior: 'smooth' }); });
  }
  function revSince(k) { var sn = App.tagSince(R.tag); return (S.get(k).rl || []).filter(function (d) { return d >= sn; }).length; }
  function periodTxt(raw) { return R.tag ? 'in ' + (raw ? R.tag.name : App.esc(R.tag.name)) : 'this month'; }
  /* Tally row: the live count with Edit/Delete/Save; sections are picked in the mask Section oval (Mask 1's lines),
     and this page's reads per section (the page counts as read as many times as its least-read section). */
  function tallyPanel() {
    // v109: one line — count (left), Edit / Delete / Save icons centred, Counter switch (right). Read totals are on the Stat page.
    var T = Tally.state();
    return '<div class="rsub tlsub"><div class="trow3 tcore"><span class="t3l"><span class="lbl">Count</span><b class="tlyn">' + T.n + '</b></span>' +
      '<span class="t3m"><button class="icb" data-ract="tlyEdit" aria-label="Edit count">' + IC.pen + '</button><button class="icb danger" data-ract="tlyDel" aria-label="Delete count"' + (T.n ? '' : ' disabled') + '>' + IC.trash + '</button>' +
      '<button class="icb pri" data-ract="tlySave" aria-label="Save count"' + (T.n ? '' : ' disabled') + '>' + IC.check + '</button></span>' +
      '<span class="t3r"><button class="jsw' + (Tally.on() ? ' on' : '') + '" data-ract="tlyHide" role="switch" aria-checked="' + Tally.on() + '"><i></i>Counter</button></span></div></div>';
  }
  function tallyTint() {
    var sc = Tally.scope(); if (R.sub !== 'tally' || !sc.from) return '';
    return ''; // v102: the chosen section is already the only part shown
    var m1 = masksOf(R.p)[0]; if (!m1) return '';
    var ds = shiftItems(viewItems(m1, R.p).filter(function (q) { return q.k === 'div'; }), R.oy).sort(function (a, b) { return (a.y1 + a.y2) - (b.y1 + b.y2); });
    var above = ds[sc.from - 2], below = ds[sc.to - 1], H = r1(R.Hu);
    var top = above ? divPts(above) : '1000,0 0,0', bot = below ? divPts(below).split(' ').reverse().join(' ') : '0,' + H + ' 1000,' + H;
    return '<polygon points="' + top + ' ' + bot + '" style="fill:var(--acc);fill-opacity:.14;pointer-events:none"/>';
  }
  /* v104 Box / Line rows: Show switch (show or hide them on the page), + Box / + Line, Edit, and a trash that
     deletes them all when held. Only that kind's tools are here. */
  function kindPanel(kind) {
    // v109: one line — Add / Edit / Delete-all (hold) icons centred, Show switch on the right.
    var am = activeMask(), isB = kind === 'box', k = isB ? 'box' : 'div', n = R.items.filter(function (q) { return q.k === k; }).length;
    var shown = !(am && (isB ? am.hb : am.hl)), nm = isB ? 'box' : 'line', nms = isB ? 'boxes' : 'lines';
    return '<div class="rsub ksub"><div class="trow3"><span class="t3l"></span><span class="t3m">' +
      '<button class="icb pri" data-ract="' + (isB ? 'addBox' : 'addLine') + '" aria-label="Add ' + nm + '">' + IC.plus + '</button>' +
      '<button class="icb" data-ract="' + (isB ? 'edBoxes' : 'edLines') + '" aria-label="Edit ' + nms + '"' + (n ? '' : ' disabled') + '>' + IC.pen + '</button>' +
      '<button class="icb danger" data-ract="delAll" data-k="' + k + '" aria-label="Hold to delete all ' + nms + '"' + (n ? '' : ' disabled') + '>' + IC.trash + '</button></span>' +
      '<span class="t3r"><button class="jsw' + (shown ? ' on' : '') + '" data-ract="' + (isB ? 'hb' : 'hl') + '" role="switch" aria-checked="' + shown + '"' + (n ? '' : ' disabled') + '><i></i>Show</button></span></div></div>';
  }
  /* v109 Stat page: this page's numbers on a full page; Back sits bottom-right where the reader's Back is. */
  function statPage() {
    if (R.rec) return recStatPage();
    var p = R.p, k = R.k, m = S.isMem(k), h = S.health(k), all = S.tally(k), mo = S.month();
    var sn = R.tag && App.tagSince(R.tag), prd = function (d) { return sn ? d >= sn : d.slice(0, 7) === mo; };
    var per = sn ? 'in ' + App.esc(R.tag.name) : 'this month', ns = S.nSec(p), g = S.d.settings.goalDay, dd = Timer.day(S.today()), la = S.lastActive(k);
    var tile = function (l, v) { return '<div class="stile"><span>' + l + '</span><b>' + v + '</b></div>'; };
    var bar = function (pc, col) { return '<div class="hbar sbar"><i style="width:' + Math.max(0, Math.min(100, pc)) + '%;background:' + col + '"></i></div>'; };
    var x = '<div class="spage"><div class="sbody"><div class="shead"><b>P. ' + p + ' stats</b><span>' + App.esc(App.pageTitle(p)) + '</span></div>';
    x += '<div class="sgrid">' + tile('Reads ' + per, S.tally(k, prd).page + '×') + tile('Reads lifetime', all.page + '×') +
      tile('Time ' + per, Timer.mins(S.pageTime(p, prd))) + tile('Time lifetime', Timer.mins(S.pageTime(p))) +
      tile('Days ' + per, S.activeDays(k, prd).length) + tile('Days lifetime', S.activeDays(k).length) + '</div>';
    if (ns > 1) x += '<div class="slbl">Reads by section (lifetime)</div><div class="ssec">' + all.sec.map(function (c, i) { return '<span>S' + (i + 1) + ' · ' + c + '×</span>'; }).join('') + '</div>';
    if (m) x += '<div class="slbl">Health</div><div class="shl"><button class="icb" data-ract="hminus" aria-label="Lower health">−</button>' + bar(h, h ? App.hcol(h) : 'var(--line)') +
      '<button class="icb" data-ract="hplus" aria-label="Raise health">+</button><b>' + h + '%</b></div>';
    if (g) x += '<div class="slbl">Today\'s goal</div><div class="shl">' + bar(dd.t / (g * 60) * 100, 'var(--acc)') + '<b>' + Math.floor(dd.t / 60) + ' / ' + g + ' min</b></div>';
    x += '<div class="slbl">Last read</div><div>' + (la ? App.esc(new Date(la + 'T00:00:00').toDateString()) : 'Not yet') + '</div>';
    return x + '</div><div class="sfoot"><button class="tb" data-ract="statBack">' + IC.back + 'Back</button></div></div>';
  }
  /* v119 (SL9) Recitation Stat page for the open tag: progress from its bookmark and pages read per day. */
  function recStatPage() {
    var t = S.rtag(R.rtag), b = S.bm(R.rtag), rr = S.rread(R.rtag), D = rr.days, td = S.today(), now = new Date();
    var dk = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    var ws = new Date(now); ws.setDate(now.getDate() - (now.getDay() + 1) % 7); ws = dk(ws); var mo = td.slice(0, 7);
    var sum = function (f) { var o = { pg: 0, jz: 0, d: 0 }; for (var k in D) if (f(k)) { o.pg += D[k].pg; o.jz += D[k].jz; if (D[k].pg) o.d++; } return o; };
    var T = sum(function (k) { return k === td; }), W = sum(function (k) { return k >= ws; }), M = sum(function (k) { return k.slice(0, 7) === mo; }), A = sum(function () { return true; });
    var base = t.start || rr.base || 1, done = b.p ? Math.max(0, b.p - base) : 0, tot = 605 - base, pc = tot > 0 ? Math.round(done / tot * 100) : 0;
    var jf = function (j) { return j >= 10 ? Math.round(j) : Math.round(j * 10) / 10; };
    var tile = function (l, v) { return '<div class="stile"><span>' + l + '</span><b>' + v + '</b></div>'; };
    var fd = function (d) { return new Date(d + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }, nc = S.comps(t.id).length;
    var x = '<div class="spage"><div class="sbody"><div class="shead"><b>' + App.esc(t.name) + '</b><span>' + (t.done ? 'Completed ' + fd(t.done) : b.p ? 'Bookmark P. ' + b.p + ' · ' + App.esc(App.pageTitle(b.p)) : 'No bookmark yet') + '</span></div>';
    x += '<div class="slbl">Progress</div><div class="shl"><div class="hbar sbar"><i style="width:' + pc + '%;background:var(--acc)"></i></div><b>' + pc + '%</b></div>' +
      '<div class="small muted" style="margin-top:2px">' + done + ' of ' + tot + ' pages from P. ' + base + '</div>';
    if (t.target) {
      var dl = Math.round((new Date(t.target + 'T00:00:00') - new Date(td + 'T00:00:00')) / 864e5) + 1;
      x += '<div class="small" style="margin-top:6px">Target ' + new Date(t.target + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' + (dl > 0 ? dl + ' day' + (dl === 1 ? '' : 's') + ' left' : 'passed') + '</div>';
    }
    var pl = S.plan(R.rtag);
    if (pl && !pl.passed) x += '<div class="small" style="margin-top:2px">Today ' + pr(pl.s0, pl.e0) + ' · ' + pl.q + ' pages a day now (planned ' + pl.orig + ')</div>';
    x += '<div class="sgrid" style="margin-top:12px">' + tile('Pages today', T.pg) + tile('Pages this week', W.pg) + tile('Pages this month', M.pg) +
      tile('Juz this month', jf(M.jz)) + tile('Days read this month', M.d) + tile('Average per reading day', A.d ? Math.round(A.pg / A.d) + ' pages' : '–') + (nc ? tile('Completions', nc) : '') + '</div>';
    var rows = '';
    for (var i = 0; i < 7; i++) { var d = new Date(now); d.setDate(now.getDate() - i); var k = dk(d), v = D[k];
      rows += '<div class="rsday"><span>' + (i === 0 ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })) + '</span><b>' + (v && v.pg ? v.pg + ' page' + (v.pg === 1 ? '' : 's') + (v.ed ? ' <span class="muted">· edited</span>' : v.to ? ' <span class="muted">→ P. ' + Math.min(604, v.to) + '</span>' : '') : '–') + '</b></div>'; }
    x += '<div class="slbl">Last 7 days</div><div class="rsdays">' + rows + '</div>';
    return x + '</div><div class="sfoot"><button class="tb" data-ract="statBack">' + IC.back + 'Back</button></div></div>';
  }
  function editPanel() {
    var am = activeMask(), m = R.items[R.sel], x = '';
    x += '<div class="rrow etop">' +
      (R.etool === 'line' ? '<button class="pill soft" data-ract="addLine">+ ' + IC.line + 'Line</button>' : '<button class="pill soft" data-ract="addBox">+ ' + IC.box + 'Box</button>') +
      (m && m.k === 'div' ? '<button class="icb" data-ract="straight" aria-label="Straighten line" title="Straighten">' + IC.line.replace('M3 9h10v6h8', 'M3 12h18') + '</button>' : '') +
      '<button class="icb danger" data-ract="del" data-k="' + (R.etool === 'line' ? 'div' : 'box') + '" aria-label="Delete selected (hold to delete all)">' + IC.trash + '</button>' +
      '<button class="icb" data-ract="cancelEdit" aria-label="Cancel changes">' + IC.x + '</button>' +
      '<button class="icb pri" data-ract="doneEdit" aria-label="Save">' + IC.check + '</button></div>';
    // The style row is always shown so the drawer keeps one height; with no box selected it sets the style for the next box.
    if (R.etool !== 'line') x += boxStyle(m && m.k === 'box' ? m : R.style, false);
    // v112: no instruction line under Box/Line editing; Straighten sits in the top row while a line is selected.
    return x;
  }
  /* v114 Crop panel: the mode is a vertical wheel (Auto / Whole page / Same as P. n-1 / Custom) like the Timer target;
     the crop window can only be dragged in Custom. Cancel and Apply are icons level with the chosen row;
     "Set as default" is a checkbox applied together with Apply. */
  function cropModes() { var m = [['auto', 'Auto'], ['whole', 'Whole page']]; if (R.p > 1) m.push(['prev', 'Same as P. ' + (R.p - 1)]); m.push(['custom', 'Custom']); return m; }
  function cropPanel() {
    var wh = '<div class="twheel cwheel" aria-label="Crop mode"><i class="wsp"></i>' + cropModes().map(function (o) { return '<b class="wv' + (o[0] === R.cmode ? ' on' : '') + '" data-v="' + o[0] + '">' + o[1] + '</b>'; }).join('') + '<i class="wsp"></i></div>';
    return '<div class="rrow"><div class="rtitle" style="text-align:left">Crop <span class="plabel">P. ' + R.p + '</span></div></div>' +
      '<div class="crow">' + wh + '<div class="cside"><div class="cbtns"><button class="icb" data-ract="cropCancel" aria-label="Cancel">' + IC.x + '</button>' +
      '<button class="icb pri" data-ract="cropApply" aria-label="Apply">' + IC.check + '</button></div><i></i>' +
      '<label class="cdef"><input type="checkbox" id="cropDefCb"' + (R.cdef ? ' checked' : '') + '> Set as default</label></div></div>';
  }
  function cropDraftFor(m) {
    if (m === 'auto') return autoCrop(R.p);
    if (m === 'whole') return { l: 0, t: 0, r: 0, b: 0 };
    if (m === 'prev') return cropOf(R.p - 1);
    return R.cust || cropOf(R.p);
  }
  function setCropMode(m) {
    if (m === R.cmode) return;
    if (R.cmode === 'custom') R.cust = R.draft; // remember a hand-made crop while trying other modes
    R.cmode = m; R.draft = JSON.parse(JSON.stringify(cropDraftFor(m)));
    drawCropMode(); bindOv();
  }
  function wireCropWheel() {
    var w = document.querySelector('.rpanel .cwheel'); if (!w) return;
    var on = w.querySelector('.wv.on'), t = null;
    var mid = function () { var c = w.scrollTop + w.clientHeight / 2, best = null, bd = 1e9; [].forEach.call(w.querySelectorAll('.wv'), function (b) { var d = Math.abs(b.offsetTop + b.offsetHeight / 2 - c); if (d < bd) { bd = d; best = b; } }); return best; };
    if (on) w.scrollTop = on.offsetTop + on.offsetHeight / 2 - w.clientHeight / 2;
    w.addEventListener('scroll', function () {
      var m = mid(); [].forEach.call(w.querySelectorAll('.wv'), function (b) { b.classList.toggle('on', b === m); });
      clearTimeout(t); t = setTimeout(function () { var b = mid(); if (b) setCropMode(b.dataset.v); }, 180);
    }, { passive: true });
    w.addEventListener('click', function (e) { var b = e.target.closest('.wv'); if (b) w.scrollTo({ top: b.offsetTop + b.offsetHeight / 2 - w.clientHeight / 2, behavior: 'smooth' }); });
    var cb = $('#cropDefCb'); if (cb) cb.onchange = function () { R.cdef = cb.checked; };
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
    var am = ensureLayer(); if (!am) return false;
    if (!R.edit) { R.snap = { items: JSON.stringify(am.items || []), sec: am.sec || 0 }; R.edit = true; R.sub = R.sub === 'box' || R.sub === 'line' ? R.sub : null; R.etool = R.sub === 'line' ? 'line' : R.sub === 'box' ? 'box' : R.etool; R.sel = sel; renderPanel(); layout(); }
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
  function kindTap(kind) {
    var was = R.edit ? R.etool : R.sub;
    if (R.edit) RACT.doneEdit();
    if (R.sub === 'crop') RACT.cropApply();
    R.edOpen = false; if (R.sub === 'join') R.sub = null;
    R.sub = was === kind ? null : toolSub(kind) || kind;
    if (was === kind) R.sub = null;
    renderPanel(); draw();
  }
  function openOrAdd(k, add) {
    var i = -1; R.items.forEach(function (q, n) { if (q.k === k) i = n; });
    if (i < 0) { add(); return; }
    if (!startEdit(i)) return; R.sel = i; draw(); renderPanel();
  }
  /* The section shown is the section Tally counts; each section's unsaved count waits on its own. */
  function syncSec() {
    var m1 = masksOf(R.p)[0], f = m1 ? m1.sec || 0 : 0;
    if (m1 && f > nDiv(m1.items || []) + 1) f = 0;
    Tally.section(f, R.k);
  }
  function newMask(n) { return { id: 'm' + Date.now().toString(36) + n, name: 'Mask ' + n, items: [], sec: 0, pg: 1 }; }
  function setActive(id) { saveMasks(function (ms, o) { o.am = id || ''; }); loadItems(); }
  /* v104: hold the bin (in the Box or Line row, or while editing) to delete every box, or every line, on the page. */
  (function () {
    var t = null, fired = 0;
    document.addEventListener('pointerdown', function (e) {
      var b = e.target.closest && e.target.closest('.rpanel [data-k][data-ract="del"], .rpanel [data-k][data-ract="delAll"]'); if (!b || b.disabled) return;
      var k = b.dataset.k;
      t = setTimeout(function () {
        t = null; fired = Date.now(); buzz();
        var isB = k === 'box', n = R.items.filter(function (q) { return q.k === k; }).length; if (!n) return;
        if (!confirm('Delete all ' + n + ' ' + (isB ? (n === 1 ? 'box' : 'boxes') : (n === 1 ? 'line' : 'lines')) + ' on this page?')) return;
        R.items = R.items.filter(function (q) { return q.k !== k; }); R.sel = -1;
        commitItems();
        if (R.edit) { var am = activeMask(); if (am && R.snap) R.snap.items = JSON.stringify(am.items || []); }
        loadItems(); draw(); renderPanel(); layout();
      }, 600);
    }, true);
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { document.addEventListener(ev, function () { if (t) { clearTimeout(t); t = null; } }, true); });
    document.addEventListener('click', function (e) { if (Date.now() - fired < 700 && e.target.closest && e.target.closest('[data-k]')) { e.stopPropagation(); e.preventDefault(); } }, true);
    document.addEventListener('contextmenu', function (e) { if (e.target.closest && e.target.closest('.rpanel [data-k]')) e.preventDefault(); }, true);
  })();
  var RACT = {
    // v97: Back pauses the stopwatch (closing the reader does) and keeps an unsaved tally for later — no questions.
    home: function () { if (Tally.dirty()) Tally.park(); history.back(); },
    tally: function () {
      leaveModes();
      if (!Tally.on()) { Tally.show(true); toolSub('tally'); R.sub = 'tally'; } else R.sub = toolSub('tally');
      syncSec();
      renderPanel(); draw();
    },
    statOpen: function () { leaveModes(); R.stat = true; history.pushState({ stat: 1 }, '', location.href); renderPanel(); },
    statBack: function () { if (R.stat) history.back(); },
    tRem: function () { S.d.settings.tRem = !S.d.settings.tRem; S.saveSettings(); renderPanel(); },
    tlySec: function (el) {
      var i = +el.dataset.s, sc = Tally.scope(), T = Tally.state();
      // A running count belongs to the current sections, so it is saved (after asking) before switching.
      if (T.n && !confirm('Save the count of ' + T.n + ' to ' + (sc.from ? 'section ' + sc.from + (sc.to > sc.from ? '–' + sc.to : '') : 'the whole page') + ' before switching?')) return;
      if (!i) Tally.setScope(0, 0);
      else if (sc.from && sc.from === sc.to && i !== sc.from) Tally.setScope(Math.min(i, sc.from), Math.max(i, sc.from));
      else Tally.setScope(i, i);
      renderPanel(); draw();
    },
    tlyEdit: function () { Tally.edit(); renderPanel(); },
    tlySave: function () {
      var T = Tally.state(); if (!T.n) return;
      if (!confirm('Save ' + T.n + ' read' + (T.n === 1 ? '' : 's') + ' to P. ' + R.p + (T.from ? ' (section ' + T.from + (T.to > T.from ? '–' + T.to : '') + ')' : '') + '?')) return;
      Tally.save(); renderPanel();
    },
    tlyDel: function () {
      var T = Tally.state(); if (!T.n) return;
      if (!confirm('Delete this count of ' + T.n + '? It will not be saved.')) return;
      Tally.discard(); App.toast('Count deleted'); renderPanel();
    },
    // v93: the switch in the Tally row hides/shows the counter; the row stays open. The Tally icon only opens/closes the row
    // (and brings a hidden counter back), so the counter is hidden only from this switch.
    tlyHide: function () {
      if (!Tally.on()) { Tally.show(true); syncSec(); renderPanel(); return; }
      // v95: switching the counter off keeps an unsaved count for later on its page (no question asked).
      if (Tally.dirty()) { Tally.park(); App.toast('Tally kept for later'); }
      Tally.show(false); renderPanel(); draw();
    },
    next: function () { step(1); }, prev: function () { step(-1); },
    pgo: function (el) { var q = +el.dataset.p; if (q !== R.p) go(q, q > R.p ? 1 : -1, +el.dataset.n); },
    collapse: function () { togglePanel(false); }, expand: function () { togglePanel(true); },
    dsz: function () { if (R.noTap) return; var z = dzCur(); setDz(z === 'full' ? 'rib' : 'full'); },
    mem: function () { var on = !S.isMem(R.k); S.setMem(R.k, on); App.toast(on ? 'Added to Memorizing (New)' : 'Moved back to To Memorize'); renderPanel(); App.precache(); },
    hminus: function () { S.setHealth(R.k, S.health(R.k) - 5); renderPanel(); },
    hplus: function () { S.setHealth(R.k, S.health(R.k) + 5); renderPanel(); },
    nbS: function (el) { // into the neighbouring surah: its first listed page going forward, its last going back
      var n = +el.dataset.n, d = +el.dataset.d, q;
      if (R.range) { var ps = R.range.filter(function (u) { return S.kn(u) === n; }).map(S.kp).sort(function (a, b) { return a - b; }); q = d > 0 ? ps[0] : ps[ps.length - 1]; }
      else { var s = QURAN.S[n - 1]; q = d > 0 ? s[3] : s[4]; }
      if (q) go(q, d, n);
    },
    surah: function (el) { if (Tally.dirty()) Tally.park(); R.n = +el.dataset.n; R.k = S.uk(R.p, R.n); S.setLast(R.p, R.k); syncSec(); renderPanel(); },
    rev: function () {
      var p = R.k;
      if (S.get(p).lr === S.today()) { S.unreviewToday(p); renderPanel(); App.toast('Review for today removed'); return; }
      S.reviewed(p); renderPanel();
      App.toast('Marked reviewed · ' + (R.tag ? revSince(p) : S.monthCount(p)) + '× ' + periodTxt(1));
    },
    edGrp: function () {
      if (R.edOpen || R.sub === 'crop' || R.sub === 'join' || R.edit) {
        leaveModes(); if (R.sub === 'join' || R.sub === 'health') R.sub = null; R.edOpen = false;
      } else { if (R.sub === 'box' || R.sub === 'line') R.sub = null; R.edOpen = true; R.scrollEnd = true; }
      renderPanel();
    },
    tags: function () { leaveModes(); R.sub = R.sub === 'tags' ? null : 'tags'; renderPanel(); },
    timer: function () {
      leaveModes();
      // Tap opens the oval at 0:00 with play (nothing starts until play is pressed); tap again closes it.
      R.sub = toolSub('timer');
      renderPanel();
    },
    zout: function () { setZoom(-10); },
    zin: function () { setZoom(10); },
    tGo: function () {
      // v97: pausing just keeps the session for later; Save / Delete sit in the Timer row.
      if (Timer.state().run) Timer.pause(); else Timer.start();
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
    health: function () { leaveModes(); R.sub = toolSub('health'); R.edOpen = true; renderPanel(); },
    tag: function (el) { S.toggleTag(R.k, el.dataset.t); renderPanel(); },
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
      if (!confirm('Clear all boxes and lines on this page?')) return;
      saveMasks(function (ms) { ms.forEach(function (m) { if (m.id === am.id) { m.items = []; m.sec = 0; } }); });
      loadItems(); R.edit = false; R.sel = -1; R.sub = null; draw(); renderPanel(); layout();
    },
    addBox: function () {
      if (!startEdit(-1)) return; R.etool = 'box';
      var nb = R.items.filter(function (q) { return q.k === 'box'; }).length, off = (nb % 6) * 40;
      var bw = (+S.d.settings.boxW || 11) * 10; // Settings → New box width, % of the page width
      R.items.push({ k: 'box', x: clamp(500 - bw / 2 + off * 0.5, 0, 1000 - bw), y: clamp(R.Hu * 0.3 + off, 0, R.Hu - 90), w: bw, h: boxH(), c: R.style.c, o: R.style.o, b: R.style.b });
      R.sel = R.items.length - 1; commitItems(); draw(); renderPanel();
    },
    addLine: function () {
      if (!startEdit(-1)) return; R.etool = 'line';
      var ds = dividers(), last = ds.length ? ds[ds.length - 1].m : null, y = last ? Math.max(last.y1, last.y2) + 140 : R.Hu * 0.35;
      if (y > R.Hu - 40) y = R.Hu / 2;
      R.items.push({ k: 'div', x: 500, y1: y, y2: y }); R.sel = R.items.length - 1; commitItems(); draw(); renderPanel();
    },
    del: function () { if (R.sel < 0) return; R.items.splice(R.sel, 1); R.sel = -1; commitItems(); draw(); renderPanel(); },
    straight: function () { var m = R.items[R.sel]; if (!m) return; m.y2 = m.y1; m.x = 500; commitItems(); draw(); },
    sec: function (el) {
      var i = +el.dataset.s; if (!activeMask()) return;
      saveMasks(function (ms) { ms[0].sec = i; ms[0].sec2 = i; });
      Tally.section(i, R.k); // v102: each section keeps its own count; switching shows that section's count
      draw(); renderPanel();
    },
    hb: function () { if (!activeMask()) return; saveMasks(function (ms) { ms[0].hb = !ms[0].hb; }); draw(); renderPanel(); },
    hl: function () { if (!activeMask()) return; saveMasks(function (ms) { ms[0].hl = !ms[0].hl; }); draw(); renderPanel(); },
    bc: function (el) { selBox().c = el.dataset.c; R.palOpen = false; afterStyle(); },
    bo: function (el) { var m = selBox(); m.o = clamp(Math.round(m.o * 20) / 20 + (+el.dataset.d) * 0.05, 0.05, 1); m.o = Math.round(m.o * 100) / 100; afterStyle(); },
    pal: function () { R.palOpen = !R.palOpen; renderPanel(); },
    bb: function () { var m = selBox(); m.b = !m.b; afterStyle(); },
    join: function () {
      if (R.sub !== 'join') ensureLayer();
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
    // Mobile ⇄ Web flip switch (top-right on wide screens). Items are re-read because web view shows uncropped pages.
    viewFlip: function () { if (R.edit) RACT.doneEdit(); if (R.sub === 'crop') RACT.cropApply(); S.d.settings.view = desk() ? 'mobile' : 'web'; S.saveSettings(); R.wasDesk = desk(); R.panel = true; loadItems(); renderPanel(); layout(); },
    // v117 Recitation bookmark: tap = resume here next time (replaces the old one; logged). Undo in the toast.
    bmSet: function () {
      var b = S.bm(R.rtag);
      if (b.p === R.p) { App.toast('Bookmark is on P. ' + R.p); return; }
      var undo = S.setBm(R.p, R.n, R.rtag); buzz(); renderPanel();
      App.toast('Bookmarked P. ' + R.p, function () { undo(); renderPanel(); });
    },
    // v123 (SL8): Mark completion — date editable; the reading is archived (Main restarts at P. 1); Undo in the toast.
    khatm: function () {
      var tg = S.rtag(R.rtag), main = tg.id === 'def';
      App.dialog({ title: 'Mark completion', msg: 'Khatm of “' + App.esc(tg.name) + '”. ' + (main ? 'Main starts again from P. 1.' : 'The reading is archived; start the next one as a new tag.'),
        html: '<div class="dflds"><label>Completed on<input class="dinp" type="date" data-f="d" value="' + S.today() + '"></label></div>', ok: 'Mark' }, function (v, w, f) {
        var tag = R.rtag, undo = S.complete(tag, f.d || S.today()); buzz();
        if (!main) { S.d.ui.rtag = 'def'; S.saveUi(); }
        R.noAsk = true; history.back();
        App.toast('Khatm recorded · ' + tg.name, function () { undo(); if (!main) { S.d.ui.rtag = tag; S.saveUi(); } App.render(); });
      });
    },
    planStat: function () { R.pstat = !R.pstat; renderPanel(); },
    // v128 (SL12): jump to the first page of the next plan section (it re-plans once that set is bookmarked).
    nextSec: function () { var pl = recPlan(), i = S.planSec(pl, R.p), nx = pl && pl.secs[i + 1]; if (nx) go(nx.a, 1); },
    bmGo: function () { var b = S.bm(R.rtag); if (b.p && b.p !== R.p) go(b.p, b.p > R.p ? 1 : -1, b.n); },
    spread: function () { S.d.settings.spread = S.d.settings.spread === false; S.saveSettings(); renderPanel(); layout(); },
    fit: function () { S.d.settings.fit = fitPage() ? 'width' : 'page'; S.saveSettings(); renderPanel(); layout(); },
    fs: function () {
      var d = document;
      if (d.fullscreenElement) d.exitFullscreen(); else if (d.documentElement.requestFullscreen) d.documentElement.requestFullscreen().catch(function () { App.toast('Install the app for full screen'); });
      else App.toast('Install the app for full screen');
    },
    crop: function () {
      var own = S.get(R.p).crop, z = function (a, b) { return ['l', 't', 'r', 'b'].every(function (k) { return Math.abs((a[k] || 0) - (b[k] || 0)) < 0.0005; }); };
      R.draft = cropOf(R.p); R.cust = null; R.cdef = false;
      R.cmode = !own ? 'auto' : z(own, {}) ? 'whole' : R.p > 1 && z(own, cropOf(R.p - 1)) ? 'prev' : 'custom';
      R.sub = 'crop'; R.edit = false; renderPanel(); layout();
    },
    tCrop: function () { if (R.sub === 'crop') { RACT.cropApply(); return; } leaveModes(); RACT.crop(); },
    tBox: function () { kindTap('box'); },
    tLine: function () { kindTap('line'); },
    edBoxes: function () { R.etool = 'box'; openOrAdd('box', RACT.addBox); },
    edLines: function () { R.etool = 'line'; openOrAdd('div', RACT.addLine); },
    delAll: function () { App.toast('Hold the bin to delete all'); },
    cropCancel: function () { R.sub = null; R.draft = null; R.cdef = false; loadItems(); renderPanel(); layout(); },
    cropDef: function () {
      var d = R.draft, a = baseCrop(R.p);
      S.d.settings.cropDef = { l: r4(d.l - a.l), t: r4(d.t - a.t), r: r4(d.r - a.r), b: r4(d.b - a.b), p: R.p }; S.saveSettings();
      S.edit(R.p, function (o) { delete o.crop; }); // this page now follows the default too
      R.sub = null; R.draft = null; loadItems(); renderPanel(); layout(); App.toast('Default crop set from P. ' + R.p);
    },
    cropApply: function () {
      if (R.cdef) { R.cdef = false; RACT.cropDef(); return; }
      var d = R.draft, a = autoCrop(R.p), same = ['l', 't', 'r', 'b'].every(function (k) { return Math.abs(d[k] - a[k]) < 0.0005; });
      S.edit(R.p, function (o) { if (same) delete o.crop; else o.crop = { l: r4(d.l), t: r4(d.t), r: r4(d.r), b: r4(d.b) }; });
      R.sub = null; R.draft = null; loadItems(); renderPanel(); layout();
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
