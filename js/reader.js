/* Page reader: crop, joins with previous/next page, masks (boxes + staircase section lines), RTL swipe. */
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var R = {
    p: 1, mode: 'view', sel: -1, panel: true, sub: null, imgs: {}, Hu: 1000, ms: [], drag: null, tmp: null,
    style: { c: '#ffd400', o: 0.45, b: false }
  };
  var COLORS = ['#ffd400', '#ff5a5a', '#3ccf7a', '#3d8bff', '#b061ff', '#111111', '#ffffff'];
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function r1(v) { return Math.round(v * 10) / 10; }
  function cropOf(p) { var c = S.get(p).crop || {}; return { l: c.l || 0, r: c.r || 0, t: c.t || 0, b: c.b || 0 }; }
  function joinOf(p) { var j = S.get(p).jn || {}; return { prev: j.prev || 0, next: j.next || 0, trimT: j.trimT || 0, trimB: j.trimB || 0 }; }
  function segsFor(p) {
    var j = joinOf(p), s = [];
    if (j.prev > 0 && p > 1) s.push({ p: p - 1, y0: 1 - j.prev, y1: 1 });
    s.push({ p: p, y0: j.trimT, y1: 1 - j.trimB });
    if (j.next > 0 && p < 604) s.push({ p: p + 1, y0: 0, y1: j.next });
    return s;
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
    open: function (p) {
      p = clamp(p | 0, 1, 604);
      var wasOpen = $('#reader').classList.contains('on');
      if (!wasOpen) history.pushState({ reader: 1 }, '', '#p' + p); else history.replaceState({ reader: 1 }, '', '#p' + p);
      $('#reader').classList.add('on'); document.body.style.overflow = 'hidden';
      go(p, 0);
    },
    close: function () {
      $('#reader').classList.remove('on'); document.body.style.overflow = '';
      R.sub = null; R.sel = -1; App.render();
    },
    isOpen: function () { return $('#reader').classList.contains('on'); }
  };
  window.Reader = Reader;
  window.addEventListener('popstate', function () { if (Reader.isOpen()) Reader.close(); });

  function go(p, dir) {
    if (p < 1 || p > 604) return;
    R.p = p; R.sel = -1; R.drag = null;
    if (R.sub === 'crop' || R.sub === 'join') R.sub = null;
    R.ms = JSON.parse(JSON.stringify(S.get(p).masks || []));
    S.setLast(p);
    if (history.state && history.state.reader) history.replaceState({ reader: 1 }, '', '#p' + p);
    var sh = $('#sheet'); if (dir && sh) sh.classList.add('fade');
    layout().then(function () { if (dir) $('#rscroll').scrollTop = 0; var s2 = $('#sheet'); if (s2) s2.classList.remove('fade'); });
    renderPanel();
    [p - 1, p + 1, p + 2, p - 2].forEach(function (q) { if (q >= 1 && q <= 604) img(q).catch(function () {}); });
  }

  /* ---------- layout ---------- */
  var layoutSeq = 0;
  function layout() {
    var seq = ++layoutSeq, p = R.p, segs = segsFor(p);
    return Promise.all(segs.map(function (s) { return img(s.p); })).then(function (ims) {
      if (seq !== layoutSeq) return;
      var sheet = $('#sheet'), W = sheet.clientWidth || window.innerWidth, html = '', H = 0;
      segs.forEach(function (s, i) {
        var im = ims[i], c = cropOf(s.p), nw = im.naturalWidth, nh = im.naturalHeight;
        var cw = (1 - c.l - c.r) * nw, ch = (1 - c.t - c.b) * nh, k = W / cw;
        var sx = c.l * nw, sy = c.t * nh + s.y0 * ch, h = (s.y1 - s.y0) * ch * k;
        html += '<div class="pseg' + (s.p !== p ? ' side' : '') + '" style="height:' + h.toFixed(2) + 'px"><img src="' + im.src + '" alt="" style="width:' + (nw * k).toFixed(2) + 'px;transform:translate(' + (-sx * k).toFixed(2) + 'px,' + (-sy * k).toFixed(2) + 'px)"></div>';
        H += h;
      });
      R.Hu = H / W * 1000;
      sheet.innerHTML = html + '<svg id="ov" viewBox="0 0 1000 ' + R.Hu.toFixed(1) + '" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"></svg>';
      draw(); bindOv();
    }).catch(function () {
      if (seq === layoutSeq) $('#sheet').innerHTML = '<div style="padding:40px;text-align:center;color:#666">Couldn’t load this page. Check your connection.</div>';
    });
  }
  var rq = 0;
  function relayout() { cancelAnimationFrame(rq); rq = requestAnimationFrame(layout); }
  window.addEventListener('resize', function () { if (Reader.isOpen()) relayout(); });

  /* ---------- masks drawing ---------- */
  function dividers() {
    return R.ms.map(function (m, i) { return { m: m, i: i }; }).filter(function (x) { return x.m.k === 'div'; })
      .sort(function (a, b) { return (a.m.y1 + a.m.y2) - (b.m.y1 + b.m.y2); });
  }
  function divPts(m) { return '1000,' + r1(m.y1) + ' ' + r1(m.x) + ',' + r1(m.y1) + ' ' + r1(m.x) + ',' + r1(m.y2) + ' 0,' + r1(m.y2); }
  function draw() {
    var ov = $('#ov'); if (!ov) return;
    var o = S.get(R.p), cov = S.d.settings.cover, sec = o.sec || 0, divs = dividers(), H = R.Hu, s = '';
    if (sec > divs.length + 1) sec = 0;
    if (!o.hb) R.ms.forEach(function (m, i) {
      if (m.k !== 'box') return;
      s += '<rect data-i="' + i + '" class="' + (R.sel === i ? 'sel' : '') + '" x="' + r1(m.x) + '" y="' + r1(m.y) + '" width="' + r1(m.w) + '" height="' + r1(m.h) + '" rx="4" fill="' + m.c + '" fill-opacity="' + m.o + '"' + (m.b ? ' stroke="' + m.c + '" stroke-width="4"' : '') + '/>';
    });
    if (sec && divs.length) {
      var above = divs[sec - 2], below = divs[sec - 1];
      if (above) { var a = above.m; s += '<polygon points="0,0 1000,0 ' + divPts(a) + '" fill="' + cov + '"/>'; }
      if (below) { var b = below.m; s += '<polygon points="' + divPts(b) + ' 0,' + r1(H) + ' 1000,' + r1(H) + '" fill="' + cov + '"/>'; }
    }
    if (R.mode !== 'view') divs.forEach(function (x) {
      s += '<polyline class="hit" data-i="' + x.i + '" points="' + divPts(x.m) + '"/><polyline class="div' + (R.sel === x.i ? ' sel' : '') + '" points="' + divPts(x.m) + '" style="pointer-events:none"/>';
    });
    var m = R.ms[R.sel];
    if (m && R.mode === 'select') {
      if (m.k === 'box') s += '<circle class="hd" data-h="br" cx="' + r1(m.x + m.w) + '" cy="' + r1(m.y + m.h) + '" r="16"/>';
      else s += '<circle class="hd" data-h="r" cx="' + r1((1000 + m.x) / 2) + '" cy="' + r1(m.y1) + '" r="16"/>' +
        '<circle class="hd" data-h="l" cx="' + r1(m.x / 2) + '" cy="' + r1(m.y2) + '" r="16"/>' +
        '<circle class="hd" data-h="s" cx="' + r1(m.x) + '" cy="' + r1((m.y1 + m.y2) / 2) + '" r="14"/>';
    }
    if (R.tmp) s += '<rect x="' + r1(R.tmp.x) + '" y="' + r1(R.tmp.y) + '" width="' + r1(R.tmp.w) + '" height="' + r1(R.tmp.h) + '" fill="' + R.style.c + '" fill-opacity="' + R.style.o + '" stroke="#1d6fe0" stroke-width="3" stroke-dasharray="8 6"/>';
    ov.innerHTML = s;
  }
  function commit() {
    var ms = R.ms.map(function (m) { var c = {}; for (var k in m) c[k] = typeof m[k] === 'number' ? r1(m[k]) : m[k]; return c; });
    S.edit(R.p, function (o) { o.masks = ms; });
  }
  function addMask(m) { R.ms.push(m); R.sel = R.ms.length - 1; commit(); }

  /* ---------- pointer on the mask layer ---------- */
  function P(e) { var r = $('#ov').getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * 1000, y: (e.clientY - r.top) / r.width * 1000 }; }
  function bindOv() {
    var ov = $('#ov'); if (!ov) return;
    var edit = R.mode !== 'view';
    ov.style.pointerEvents = edit ? 'auto' : 'none';
    ov.style.touchAction = edit ? 'none' : 'auto';
    ov.onpointerdown = function (e) {
      if (!edit) return;
      e.preventDefault(); try { ov.setPointerCapture(e.pointerId); } catch (x) {}
      var pt = P(e), t = e.target, ds = t.dataset || {};
      if (R.mode === 'box') { R.drag = { k: 'new', x0: pt.x, y0: pt.y }; return; }
      if (R.mode === 'line') { R.drag = { k: 'line', y0: pt.y, x0: pt.x }; return; }
      if (ds.h != null && R.sel >= 0) { R.drag = { k: 'h', h: ds.h, i: R.sel, pt: pt }; return; }
      if (ds.i != null) { R.sel = +ds.i; R.drag = { k: 'move', i: +ds.i, pt: pt, orig: JSON.parse(JSON.stringify(R.ms[+ds.i])) }; draw(); renderSub(); return; }
      R.sel = -1; draw(); renderSub();
    };
    ov.onpointermove = function (e) {
      var d = R.drag; if (!d) return;
      var pt = P(e), m;
      if (d.k === 'new') { R.tmp = { x: Math.min(d.x0, pt.x), y: Math.min(d.y0, pt.y), w: Math.abs(pt.x - d.x0), h: Math.abs(pt.y - d.y0) }; draw(); return; }
      if (d.k === 'move') {
        m = R.ms[d.i]; var dx = pt.x - d.pt.x, dy = pt.y - d.pt.y;
        if (m.k === 'box') { m.x = d.orig.x + dx; m.y = d.orig.y + dy; } else { m.y1 = d.orig.y1 + dy; m.y2 = d.orig.y2 + dy; }
        d.moved = d.moved || Math.abs(dx) + Math.abs(dy) > 4; draw(); return;
      }
      if (d.k === 'h') {
        m = R.ms[d.i]; if (!m) return;
        if (d.h === 'br') { m.w = Math.max(12, pt.x - m.x); m.h = Math.max(12, pt.y - m.y); }
        else if (d.h === 'r') m.y1 = clamp(pt.y, 0, R.Hu); else if (d.h === 'l') m.y2 = clamp(pt.y, 0, R.Hu); else if (d.h === 's') m.x = clamp(pt.x, 15, 985);
        draw();
      }
    };
    ov.onpointerup = ov.onpointercancel = function (e) {
      var d = R.drag; R.drag = null; if (!d) return;
      var pt = P(e);
      if (d.k === 'new') {
        var t = R.tmp; R.tmp = null;
        if (t && t.w > 10 && t.h > 10) addMask({ k: 'box', x: t.x, y: t.y, w: t.w, h: t.h, c: R.style.c, o: R.style.o, b: R.style.b });
        draw(); renderSub(); return;
      }
      if (d.k === 'line') {
        if (Math.abs(pt.y - d.y0) < 30 && Math.abs(pt.x - d.x0) < 30) {
          addMask({ k: 'div', x: 500, y1: pt.y, y2: pt.y });
          R.mode = 'select'; bindOv(); renderPanel();
          App.toast('Line added — drag a side handle to make a step');
        }
        draw(); return;
      }
      commit(); draw(); renderSub();
    };
  }

  /* ---------- swipe (view mode): RTL book — swipe right = next page ---------- */
  var sw = null;
  function bindSwipe() {
    var sc = $('#rscroll');
    sc.addEventListener('touchstart', function (e) { if (R.mode !== 'view' || e.touches.length !== 1) { sw = null; return; } sw = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }; }, { passive: true });
    sc.addEventListener('touchend', function (e) {
      if (!sw) return; var t = e.changedTouches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y, dt = Date.now() - sw.t; sw = null;
      if (Math.abs(dx) > 70 && Math.abs(dy) < Math.abs(dx) * 0.6 && dt < 800) go(R.p + (dx > 0 ? 1 : -1), dx > 0 ? 1 : -1);
    }, { passive: true });
    document.addEventListener('keydown', function (e) {
      if (!Reader.isOpen() || /INPUT|SELECT|TEXTAREA/.test((e.target || {}).tagName)) return;
      if (e.key === 'ArrowLeft') go(R.p + 1, 1); else if (e.key === 'ArrowRight') go(R.p - 1, -1); else if (e.key === 'Escape') history.back();
    });
  }

  /* ---------- panel ---------- */
  function tb(id, label, icon, on) { return '<button class="tb' + (on ? ' on' : '') + '" data-ract="' + id + '">' + icon + label + '</button>'; }
  var I = function (d) { return '<svg class="i" viewBox="0 0 24 24">' + d + '</svg>'; };
  var IC = {
    hand: I('<path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/>'),
    box: I('<rect x="3" y="6" width="18" height="12" rx="2"/>'), line: I('<path d="M3 9h10v6h8"/>'), sel: I('<path d="M4 3l7 17 2-7 7-2z"/>'),
    crop: I('<path d="M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2"/>'), join: I('<path d="M4 4h16v5H4zM4 15h16v5H4zM12 9v6"/>'),
    tag: I('<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>'),
    full: I('<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>'),
    down: I('<path d="M6 9l6 6 6-6"/>'), up: I('<path d="M18 15l-6-6-6 6"/>'), home: I('<path d="M15 18l-6-6 6-6"/>'),
    left: I('<path d="M15 18l-6-6 6-6"/>'), right: I('<path d="M9 18l6-6-6-6"/>'), check: I('<path d="M20 6L9 17l-5-5"/>')
  };
  function renderPanel() {
    var host = $('#rui'), p = R.p, o = S.get(p), m = S.isMem(p), h = S.health(p), mc = S.monthCount(p), revToday = o.lr === S.today();
    if (!R.panel) {
      host.innerHTML = '<button class="rexpand" data-ract="expand" aria-label="Show controls">' + IC.up + '</button>';
      $('#rpad').className = 'rpad small'; return;
    }
    $('#rpad').className = 'rpad';
    var x = '<button class="rback" data-ract="home" aria-label="Home">' + IC.home + '</button><div class="rpanel">';
    x += '<div class="rrow"><button class="ib" data-ract="next" aria-label="Next page">' + IC.left + '</button>' +
      '<div class="rtitle"><span class="plabel">P. ' + p + '</span>' + App.esc(App.pageTitle(p)) + '</div>' +
      '<button class="ib" data-ract="prev" aria-label="Previous page">' + IC.right + '</button><button class="ib" data-ract="collapse" aria-label="Hide controls">' + IC.down + '</button></div>';
    x += '<div class="rrow scroll"><button class="pill' + (m ? ' on' : '') + '" data-ract="mem">' + (m ? IC.check + 'Memorizing' : '+ Memorize') + '</button>';
    if (m) x += '<span class="hctl"><button data-ract="hminus" aria-label="Lower health">−</button><span style="color:' + (h ? App.hcol(h) : 'var(--muted)') + '">' + h + '%</span><button data-ract="hplus" aria-label="Raise health">+</button></span>' +
      '<button class="pill soft' + (revToday ? ' on' : '') + '" data-ract="rev">' + IC.check + 'Reviewed' + (mc ? ' · ' + mc + '×' : '') + '</button>' +
      '<button class="pill soft' + (R.sub === 'tags' ? ' on' : '') + '" data-ract="tags">' + IC.tag + 'Tags</button>';
    x += '</div>';
    x += '<div class="rrow scroll">' + tb('view', 'Read', IC.hand, R.mode === 'view' && !R.sub) + tb('box', 'Box', IC.box, R.mode === 'box') + tb('line', 'Line', IC.line, R.mode === 'line') +
      tb('select', 'Select', IC.sel, R.mode === 'select') + tb('crop', 'Crop', IC.crop, R.sub === 'crop') + tb('join', 'Join', IC.join, R.sub === 'join') + tb('fs', 'Full', IC.full, false) + '</div>';
    x += '<div class="rsub" id="rsub"></div></div>';
    host.innerHTML = x; renderSub();
  }
  function slider(key, label, val, max, step) {
    return '<div class="sl"><span>' + label + '</span><input type="range" min="0" max="' + max + '" step="' + step + '" value="' + (val * 100) + '" data-rin="' + key + '"><b>' + (Math.round(val * 1000) / 10) + '%</b></div>';
  }
  function renderSub() {
    var el = $('#rsub'); if (!el) return;
    var o = S.get(R.p), m = R.ms[R.sel], x = '';
    if (R.sub === 'crop') {
      var c = cropOf(R.p);
      x = '<div class="hint">Trim the page margins. Masks and joins use the cropped page.</div>' + slider('crop.t', 'Top', c.t, 30, 0.5) + slider('crop.b', 'Bottom', c.b, 30, 0.5) + slider('crop.r', 'Right', c.r, 30, 0.5) + slider('crop.l', 'Left', c.l, 30, 0.5) +
        '<div class="rrow"><button class="btn sm" data-ract="cropCopy"' + (R.p > 1 ? '' : ' disabled') + '>Copy from P. ' + (R.p - 1) + '</button><button class="btn sm" data-ract="cropReset">Reset</button><span style="flex:1"></span><button class="btn sm pri" data-ract="subDone">Done</button></div>';
    } else if (R.sub === 'join') {
      var j = joinOf(R.p);
      x = '<div class="hint">Show part of the neighbouring pages, and trim this page to make room.</div>' + slider('jn.prev', 'From P. ' + (R.p - 1), j.prev, 60, 2.5) + slider('jn.next', 'From P. ' + (R.p + 1), j.next, 60, 2.5) +
        slider('jn.trimT', 'Trim top', j.trimT, 60, 2.5) + slider('jn.trimB', 'Trim bottom', j.trimB, 60, 2.5) +
        '<div class="rrow"><button class="btn sm" data-ract="joinReset">Reset</button><span style="flex:1"></span><button class="btn sm pri" data-ract="subDone">Done</button></div>';
    } else if (R.sub === 'tags') {
      x = '<div class="rrow scroll">' + App.allTags().map(function (t) { return '<button class="chip' + (S.hasTag(R.p, t.id) ? ' on' : '') + '" data-ract="tag" data-t="' + App.esc(t.id) + '">' + App.esc(t.name) + '</button>'; }).join('') + '</div>';
    } else if (m && m.k === 'box' && R.mode === 'select') {
      x = boxStyle(m) + '<button class="btn sm" data-ract="del">Delete</button></div>';
    } else if (m && m.k === 'div' && R.mode === 'select') {
      x = '<div class="rrow"><span class="hint" style="flex:1">Drag the side handles to step the line, the middle handle to move the step.</span><button class="btn sm" data-ract="straight">Straighten</button><button class="btn sm" data-ract="del">Delete</button></div>';
    } else if (R.mode === 'box') {
      x = boxStyle(R.style) + '<span class="hint">Drag on the page to draw</span></div>';
    } else if (R.mode === 'line') {
      x = '<div class="hint">Tap on the page where a section ends.</div>';
    } else if (R.mode === 'select') {
      x = '<div class="hint">Tap a box or line to edit it. Switch to Read to scroll and swipe.</div>';
    }
    if (!R.sub && R.mode !== 'box') {
      var nd = dividers().length, hasBox = R.ms.some(function (q) { return q.k === 'box'; });
      if (nd || hasBox) {
        x += '<div class="rrow scroll">';
        if (nd) { x += '<button class="chip' + (!o.sec ? ' on' : '') + '" data-ract="sec" data-s="0">Whole page</button>'; for (var i = 1; i <= nd + 1; i++) x += '<button class="chip' + (o.sec === i ? ' on' : '') + '" data-ract="sec" data-s="' + i + '">Section ' + i + '</button>'; }
        if (hasBox) x += '<button class="chip' + (!o.hb ? ' on' : '') + '" data-ract="hb">Boxes ' + (o.hb ? 'off' : 'on') + '</button>';
        x += '</div>';
      }
    }
    el.innerHTML = x;
  }
  function boxStyle(m) {
    return '<div class="rrow scroll">' + COLORS.map(function (c) { return '<button class="sw-c' + (m.c === c ? ' on' : '') + '" style="background:' + c + '" data-ract="bc" data-c="' + c + '" aria-label="Colour"></button>'; }).join('') +
      '<span class="hctl" style="margin-left:4px">' + [0.25, 0.45, 0.7, 1].map(function (v) { return '<button style="width:auto;padding:0 8px;font-size:12.5px' + (Math.abs(m.o - v) < 0.01 ? ';color:var(--acc)' : '') + '" data-ract="bo" data-o="' + v + '">' + Math.round(v * 100) + '%</button>'; }).join('') + '</span>' +
      '<button class="pill soft' + (m.b ? ' on' : '') + '" data-ract="bb">Border</button>';
  }

  var RACT = {
    home: function () { history.back(); },
    next: function () { go(R.p + 1, 1); }, prev: function () { go(R.p - 1, -1); },
    collapse: function () { R.panel = false; renderPanel(); }, expand: function () { R.panel = true; renderPanel(); },
    mem: function () { var on = !S.isMem(R.p); S.setMem(R.p, on); App.toast(on ? 'Added to Memorizing (New)' : 'Moved back to To Memorize'); renderPanel(); App.precache(); },
    hminus: function () { S.setHealth(R.p, S.health(R.p) - 5); renderPanel(); },
    hplus: function () { S.setHealth(R.p, S.health(R.p) + 5); renderPanel(); },
    rev: function () {
      var o = S.get(R.p), prev = { lr: o.lr, rv: JSON.parse(JSON.stringify(o.rv || {})), h: o.h }, p = R.p;
      S.reviewed(p); renderPanel();
      App.toast('Marked reviewed · ' + S.monthCount(p) + '× this month', function () { S.unreview(p, prev); if (R.p === p) renderPanel(); });
    },
    tags: function () { R.sub = R.sub === 'tags' ? null : 'tags'; renderPanel(); },
    tag: function (el) { S.toggleTag(R.p, el.dataset.t); renderSub(); },
    view: function () { setMode('view'); }, box: function () { setMode('box'); }, line: function () { setMode('line'); }, select: function () { setMode('select'); },
    crop: function () { R.sub = R.sub === 'crop' ? null : 'crop'; setMode('view', true); },
    join: function () { R.sub = R.sub === 'join' ? null : 'join'; setMode('view', true); },
    subDone: function () { R.sub = null; renderPanel(); },
    fs: function () {
      var d = document;
      if (d.fullscreenElement) d.exitFullscreen(); else if (d.documentElement.requestFullscreen) d.documentElement.requestFullscreen().catch(function () { App.toast('Install the app for full screen'); });
      else App.toast('Install the app for full screen');
    },
    cropCopy: function () { var c = S.get(R.p - 1).crop; S.edit(R.p, function (o) { o.crop = c ? JSON.parse(JSON.stringify(c)) : undefined; }); relayout(); renderSub(); },
    cropReset: function () { S.edit(R.p, function (o) { delete o.crop; }); relayout(); renderSub(); },
    joinReset: function () { S.edit(R.p, function (o) { delete o.jn; }); relayout(); renderSub(); },
    sec: function (el) { var s = +el.dataset.s; S.edit(R.p, function (o) { o.sec = s || 0; }); draw(); renderSub(); },
    hb: function () { S.edit(R.p, function (o) { o.hb = !o.hb; }); draw(); renderSub(); },
    bc: function (el) { var m = selBox(); m.c = el.dataset.c; afterStyle(); },
    bo: function (el) { var m = selBox(); m.o = +el.dataset.o; afterStyle(); },
    bb: function () { var m = selBox(); m.b = !m.b; afterStyle(); },
    del: function () { if (R.sel < 0) return; R.ms.splice(R.sel, 1); R.sel = -1; commit(); var o = S.get(R.p); if (o.sec > dividers().length + 1) S.edit(R.p, function (q) { q.sec = 0; }); draw(); renderSub(); },
    straight: function () { var m = R.ms[R.sel]; if (!m) return; m.y2 = m.y1; m.x = 500; commit(); draw(); }
  };
  function selBox() { var m = R.ms[R.sel]; return (R.mode === 'select' && m && m.k === 'box') ? m : R.style; }
  function afterStyle() { if (selBox() !== R.style) { R.style.c = selBox().c; R.style.o = selBox().o; R.style.b = selBox().b; commit(); } draw(); renderSub(); }
  function setMode(md, keepSub) {
    R.mode = md; if (!keepSub) R.sub = R.sub === 'tags' ? 'tags' : null;
    if (md !== 'select') R.sel = -1;
    if (md === 'box') R.sel = -1;
    bindOv(); draw(); renderPanel();
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-ract]'); if (!el) return;
    var f = RACT[el.dataset.ract]; if (f) { e.preventDefault(); f(el, e); }
  });
  document.addEventListener('input', function (e) {
    var k = e.target.dataset && e.target.dataset.rin; if (!k) return;
    var parts = k.split('.'), v = +e.target.value / 100;
    e.target.nextElementSibling.textContent = (Math.round(v * 1000) / 10) + '%';
    S.edit(R.p, function (o) {
      o[parts[0]] = o[parts[0]] || {}; o[parts[0]][parts[1]] = v;
      if (parts[0] === 'crop') { var c = o.crop; if (c.l + c.r > 0.6) c[parts[1]] = 0.6 - (parts[1] === 'l' ? c.r : c.l); if (c.t + c.b > 0.6) c[parts[1]] = 0.6 - (parts[1] === 't' ? c.b : c.t); }
      if (parts[0] === 'jn') { var j = o.jn; if ((j.trimT || 0) + (j.trimB || 0) > 0.8) j[parts[1]] = 0.8 - (parts[1] === 'trimT' ? (j.trimB || 0) : (j.trimT || 0)); }
    });
    relayout();
  });

  document.addEventListener('DOMContentLoaded', bindSwipe);
  if (document.readyState !== 'loading') bindSwipe();
})();
