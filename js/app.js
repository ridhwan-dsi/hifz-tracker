/* Home, To Memorize / Memorizing tabs, stats, settings. Reader lives in reader.js. */
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var SUR = QURAN.S;
  function sPages(n) { var s = SUR[n - 1], a = []; for (var p = s[3]; p <= s[4]; p++) a.push(p); return a; }
  function onPage(p) { var o = []; SUR.forEach(function (s, i) { if (s[3] <= p && s[4] >= p) o.push(i + 1); }); return o; }
  function juzOf(p) { var j = 1; QURAN.J.forEach(function (st, i) { if (p >= st) j = i + 1; }); return j; }
  function hcol(h) { return h >= 80 ? 'var(--ok)' : h >= 50 ? 'var(--mid)' : h > 0 ? 'var(--bad)' : 'var(--line)'; }
  function units(n) { return sPages(n).map(function (p) { return S.uk(p, n); }); }
  function byUnit(a, b) { return S.kp(a) - S.kp(b) || S.kn(a) - S.kn(b); }
  function unitTitle(k) { return SUR[S.kn(k) - 1][0]; }
  function pageTitle(p) { return onPage(p).map(function (n) { return SUR[n - 1][0]; }).join(' · '); }
  function ago(d) { if (!d) return 'never'; var n = Math.floor((Date.now() - new Date(d + 'T00:00:00').getTime()) / 864e5); return n <= 0 ? 'today' : n === 1 ? 'yesterday' : n + 'd ago'; }

  var I = function (d) { return '<svg class="i" viewBox="0 0 24 24">' + d + '</svg>'; };
  var ICON = {
    chev: I('<path d="M6 9l6 6 6-6"/>'), back: I('<path d="M15 18l-6-6 6-6"/>'), fwd: I('<path d="M9 18l6-6-6-6"/>'),
    stats: I('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'), gear: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    book: I('<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>'),
    check: I('<path d="M20 6L9 17l-5-5"/>'), pen: I('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'), play: I('<path d="M6 4l14 8-14 8z"/>')
  };
  var BUILTIN = [{ id: 'new', name: 'New' }, { id: 'review', name: 'Review' }];
  /* Each custom tag belongs to one sub-tab (t.s); older tags without one sit under Review. */
  function tagSub(t) { return t.s === 'new' ? 'new' : 'review'; }
  function subOf(k) { return S.hasTag(k, 'new') ? 'new' : 'review'; }
  function subTags(sb) { return S.d.tags.filter(function (t) { return tagSub(t) === sb; }); }
  /* Tags offered for a page: New, Review, then the custom tags of that page's sub-tab (all of them if no page). */
  function allTags(k) { return BUILTIN.concat(k ? subTags(subOf(k)) : S.d.tags); }
  function tagBorn(t) { var n = parseInt(String(t.id).slice(1), 36); return isNaN(n) ? 0 : n; }
  function byOpened(a) { return a.slice().sort(function (x, y) { return (y.o || tagBorn(y)) - (x.o || tagBorn(x)); }); }
  /* The custom tag the Memorizing tab is filtered to (null for New / Review / All). */
  function ctag() { var sb = sub(), c = (S.d.ui.cts || {})[sb]; return c && c !== 'all' ? subTags(sb).filter(function (t) { return t.id === c; })[0] || null : null; }
  /* Memorizing sub-tab: 'new' (tagged New) or 'review' (everything else). Old single-chip state carries over once. */
  function sub() {
    var u = S.d.ui;
    if (!u.sub) { var c = (u.chips || [])[0]; u.sub = c === 'new' ? 'new' : 'review'; u.cts = { new: 'all', review: c && c !== 'new' && c !== 'review' ? c : 'all' }; }
    if (!u.cts) u.cts = { new: 'all', review: u.ct || 'all' };
    return u.sub;
  }
  /* Local date the tag was created; counts "in this tag" run from here. */
  function tagSince(t) { if (t.c) return t.c; var d = new Date(tagBorn(t)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  var st = { view: 'home', exp: { mem: {}, tom: {} }, edit: false, tedit: null, sel: {}, q: '', sf: 'all', srt: 'page', sdir: 0, sprd: 'all', ssel: {}, month: null, stab: 'rep', rp: 'day', ra: null, cal: null, cday: null, sper: 'all' };

  var App = {
    esc: esc, ICON: ICON, tagSince: tagSince, sPages: sPages, onPage: onPage, pageTitle: pageTitle, hcol: hcol, allTags: allTags,
    render: function () {
      document.documentElement.dataset.theme = S.d.settings.theme;
      var meta = document.querySelector('meta[name=theme-color]');
      if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#1f7a52';
      document.body.classList.toggle('web', S.d.settings.view === 'web' && innerWidth >= 1000);
      $('#app').innerHTML = st.view === 'stats' ? stats() : home();
    },
    syncChanged: function () { var el = $('#syncChip'); if (el) el.outerHTML = syncChip(); if ($('#settingsSheet')) openSettings(); },
    toast: function (msg, undo, label, ms) {
      var t = $('#toast'); t.innerHTML = '<span>' + esc(msg) + '</span>' + (undo ? '<button id="toastUndo">' + esc(label || 'Undo') + '</button>' : '');
      t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('on'); }, ms || (undo ? 5000 : 2200));
      if (undo) $('#toastUndo').onclick = function () { undo(); t.classList.remove('on'); };
    },
    precache: function () {
      if (!navigator.serviceWorker || !navigator.serviceWorker.controller) return;
      var set = {};
      Object.keys(S.d.pages).forEach(function (k) { if (S.d.pages[k].m) { var p = S.kp(k); set[p] = 1; if (p > 1) set[p - 1] = 1; if (p < 604) set[p + 1] = 1; } });
      if (S.d.last) set[S.d.last.p] = 1;
      var urls = Object.keys(set).map(function (p) { return 'pages/p' + String(p).padStart(3, '0') + '.jpg'; });
      navigator.serviceWorker.controller.postMessage({ type: 'precache', urls: urls });
    }
  };
  window.App = App;
  // Mobile ⇄ Web switch beside Settings, offered on screens 1000 px wide or more (small laptops are about 1280–1366).
  function viewSw() { return innerWidth >= 1000 ? '<button class="vsw' + (S.d.settings.view === 'web' ? ' on' : '') + '" data-act="viewFlip" title="Mobile view / Web view" aria-label="Switch between mobile view and web view"><span class="vm"><svg class="i" viewBox="0 0 24 24"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg></span><span class="vd"><svg class="i" viewBox="0 0 24 24"><rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8.5 21h7M12 17v4"/></svg></span></button>' : ''; }
  var wasWide = innerWidth >= 1000;
  window.addEventListener('resize', function () { var w = innerWidth >= 1000; if (w !== wasWide) { wasWide = w; if (!(window.Reader && Reader.isOpen())) App.render(); } });

  function syncChip() {
    var s = Sync.state, cid = Sync.cid();
    var label = !cid ? 'Local only' : s === 'ok' ? 'Synced' : s === 'syncing' ? 'Syncing…' : s === 'paused' ? 'Tap to sync' : s === 'error' ? 'Sync error' : 'Sign in';
    var cls = s === 'ok' ? 'ok' : s === 'error' ? 'err' : s === 'paused' ? 'paused' : '';
    return '<button id="syncChip" class="sync ' + cls + '" data-act="syncChip">' + label + '</button>';
  }

  /* ---------------- Home ---------------- */
  function home() {
    var d = S.d, h = '';
    h += '<header class="top"><div class="brand"><span class="dot">' + ICON.book + '</span>Hifz Tracker</div>' + syncChip() +
      '<button class="ib" data-act="stats" aria-label="Stats">' + ICON.stats + '</button>' +
      '<button class="ib" data-act="settings" aria-label="Settings">' + ICON.gear + '</button>' + viewSw() + '</header>';
    if (d.last && d.last.p) {
      var lp = d.last.p, lk = d.last.k || S.uk(lp);
      if (d.ui.contMin) h += '<div class="cont min"><button class="go" data-act="open" data-p="' + lk + '">' + ICON.play + ' P. ' + lp + '</button><button class="ib" data-act="contMin" aria-label="Expand">' + ICON.fwd + '</button></div>';
      else h += '<div class="cont"><button class="go" data-act="open" data-p="' + lk + '">' + ICON.play + '<span class="small">Continue</span><b>' + esc(unitTitle(lk)) + '</b><span class="plabel" style="color:inherit;border-color:rgba(255,255,255,.5)">P. ' + lp + '</span></button><button class="ib" data-act="contMin" aria-label="Minimise">' + ICON.back + '</button></div>';
    }
    h += '<nav class="tabs"><button class="' + (d.ui.tab === 'mem' ? 'on' : '') + '" data-act="tab" data-t="mem">Memorizing</button><button class="' + (d.ui.tab === 'tom' ? 'on' : '') + '" data-act="tab" data-t="tom">To Memorize</button></nav>';
    h += d.ui.tab === 'mem' ? memTab() : tomTab();
    return h;
  }

  function memMatch(p) {
    var o = S.get(p); if (!o.m) return false;
    if ((sub() === 'new') !== S.hasTag(p, 'new')) return false;
    var ct = ctag(); return !ct || S.hasTag(p, ct.id);
  }
  /* Swipe scope for a Memorizing page, wherever the reader is opened from (tab, Continue, Stats, reload):
     the active tag's pages if the page is in it, else every Memorizing page of its sub-tab (New / Review).
     Pages not in Memorizing (To Memorize) swipe freely. */
  function scope(k) {
    if (!k || !S.isMem(k)) return null;
    var keys = Object.keys(S.d.pages), ct = ctag(), sb = subOf(k);
    if (sb === sub() && ct && S.hasTag(k, ct.id)) return { rg: keys.filter(memMatch), tag: ct };
    return { rg: keys.filter(function (u) { return S.isMem(u) && subOf(u) === sb; }), tag: null };
  }
  function memTab() {
    var sb = sub(), ct = ctag();
    // Sub-tabs New / Review; under them "All" (always first) then custom tags, most recently opened first.
    var h = '<nav class="subtabs">' + BUILTIN.map(function (t) {
      var nc = Object.keys(S.d.pages).filter(function (k) { return S.isMem(k) && subOf(k) === t.id; }).length;
      return '<button class="' + (sb === t.id ? 'on' : '') + '" data-act="sub" data-t="' + t.id + '">' + esc(t.name) + ' <span class="cnt">' + nc + '</span></button>';
    }).join('') + '</nav>';
    h += '<div class="chips"><button class="chip ' + (!ct ? 'on' : '') + '" data-act="chip" data-t="all">All</button>' + byOpened(subTags(sb)).map(function (t) {
      return '<button class="chip ' + (ct && ct.id === t.id ? 'on' : '') + '" data-act="chip" data-long="tag" data-t="' + esc(t.id) + '">' + esc(t.name) + '</button>';
    }).join('') + '<button class="chip add" data-act="addTag">+ Tag</button></div>';
    var cnt = Object.keys(S.d.pages).filter(memMatch).length, pgs = ' <span class="muted">· ' + cnt + ' page' + (cnt === 1 ? '' : 's') + '</span>';
    if (st.tedit && (ct ? st.tedit !== ct.id : st.tedit !== 'all')) st.tedit = null;
    if (st.tedit) {
      var pool = subPool(), ns = pool.filter(function (k) { return st.sel[k]; }).length, every = pool.length && ns === pool.length;
      h += '<div class="tagbar selbar"><button class="tick ' + (every ? 'on' : ns ? 'part' : '') + '" data-act="selAll" aria-label="Select all">' + (every ? ICON.check : '') + '</button>' +
        '<span class="grow"><b>' + ns + '</b> <span class="muted">selected</span></span><span class="tbtns"><button class="btn sm" data-act="selMove"' + (ns ? '' : ' disabled') + '>Move</button><button class="btn sm pri" data-act="selDone">Done</button></span></div>';
      return h + selList();
    }
    if (ct || cnt) h += '<div class="tagbar"><span><b>' + esc(ct ? ct.name : (sb === 'new' ? 'New' : 'Review')) + '</b>' + pgs + '</span><button class="ib pen" data-act="selStart" aria-label="Select">' + ICON.pen + '</button></div>';
    var rows = '';
    SUR.forEach(function (s, i) {
      var n = i + 1, pg = units(n).filter(memMatch);
      if (!pg.length) return;
      var open = st.exp.mem[n];
      rows += '<div class="srow"><button class="sname" data-act="openS" data-n="' + n + '" data-k="mem"><span class="num">' + n + '</span><span class="nm">' + esc(s[0]) + '</span><span class="ar">' + esc(s[1]) + '</span></button>' +
        '<button class="exp ' + (open ? 'open' : '') + '" data-act="exp" data-k="mem" data-n="' + n + '" aria-label="Pages">' + ICON.chev + '</button></div>';
      if (open) rows += '<div class="pages">' + pg.map(function (p) {
        var hh = S.health(p);
        return '<button class="pl" data-act="open" data-k="mem" data-p="' + p + '"><span class="hd" style="background:' + hcol(hh) + '"></span>P. ' + S.kp(p) + '</button>';
      }).join('') + '<button class="addlink" data-act="addPages" data-n="' + n + '">+ add pages</button></div>';
    });
    if (!rows) {
      var any = Object.keys(S.d.pages).some(function (k) { return S.d.pages[k].m; });
      return h + '<div class="list"><div class="empty">' + (any ? 'No pages here.' : 'Nothing here yet.<br>Open <b>To Memorize</b>, tap <b>Edit</b> and tick surahs or pages.') + '</div></div>';
    }
    return h + '<div class="list">' + rows + '</div>';
  }

  /* Select mode (pen): every page of the sub-tab with a tick. In a custom tag the ticks start as the tag's pages and Done
     saves them as its members; under All nothing starts ticked. Move sends the ticked pages to the other sub-tab. */
  function subPool() { var sb = sub(); return Object.keys(S.d.pages).filter(function (k) { return S.isMem(k) && subOf(k) === sb; }); }
  function selList() {
    var rows = '', sb = sub();
    SUR.forEach(function (s, i) {
      var n = i + 1, pg = units(n).filter(function (p) { return S.isMem(p) && subOf(p) === sb; });
      if (!pg.length) return;
      var sel = pg.filter(function (p) { return st.sel[p]; }).length, all = sel === pg.length, open = st.exp.mem[n];
      rows += '<div class="srow"><button class="tick ' + (all ? 'on' : sel ? 'part' : '') + '" data-act="selS" data-n="' + n + '" aria-label="Select surah">' + (all ? ICON.check : '') + '</button>' +
        '<button class="sname" data-act="selS" data-n="' + n + '"><span class="num">' + n + '</span><span class="nm">' + esc(s[0]) + '</span><span class="ar">' + esc(s[1]) + '</span></button>' +
        '<button class="exp ' + (open ? 'open' : '') + '" data-act="exp" data-k="mem" data-n="' + n + '" aria-label="Pages">' + ICON.chev + '</button></div>';
      if (open) rows += '<div class="pages">' + pg.map(function (p) {
        var on = st.sel[p];
        return '<button class="pl ' + (on ? 'mem' : '') + '" data-act="selP" data-p="' + p + '">' + (on ? '✓ ' : '') + 'P. ' + S.kp(p) + '</button>';
      }).join('') + '</div>';
    });
    return '<div class="list">' + (rows || '<div class="empty">Nothing here yet.</div>') + '</div>';
  }
  /* Move pages to the other sub-tab, optionally into one of its tags; tags of the old sub-tab come off. */
  function movePages(ks, to, tagId) {
    var from = to === 'new' ? 'review' : 'new', old = subTags(from).map(function (t) { return t.id; });
    ks.forEach(function (k) {
      old.forEach(function (id) { if (S.hasTag(k, id)) S.toggleTag(k, id, false); });
      S.toggleTag(k, from, false); S.toggleTag(k, to, true);
      if (tagId) S.toggleTag(k, tagId, true);
    });
  }

  function tomTab() {
    var q = st.q.trim().toLowerCase(), rows = '', lastJ = 0;
    var h = '<div class="bar"><input type="search" placeholder="Search surah, number or page" value="' + esc(st.q) + '" data-in="q">' + (st.edit ? '<button class="btn pri" data-act="edit">Done</button>' : '<button class="ib pen" data-act="edit" aria-label="Edit">' + ICON.pen + '</button>') + '</div>';
    h += '<div class="legend"><span><i style="background:var(--line)"></i>Not started</span><span><i style="background:var(--mid)"></i>Partly</span><span><i style="background:var(--acc)"></i>All pages</span></div>';
    SUR.forEach(function (s, i) {
      var n = i + 1;
      if (q && !(String(n) === q || s[0].toLowerCase().indexOf(q) >= 0 || s[1].indexOf(st.q.trim()) >= 0 || (+q >= s[3] && +q <= s[4]))) return;
      var j = juzOf(s[3]);
      if (!q && j !== lastJ) { rows += '<div class="divider">Juz ' + j + '</div>'; lastJ = j; }
      var pg = units(n), sel = pg.filter(function (p) { return S.isMem(p); }).length, frac = sel / pg.length;
      var mark = sel === 0 ? '' : '<span class="mark" style="background:' + (frac === 1 ? 'var(--acc)' : 'var(--mid)') + '"></span>';
      var open = st.exp.tom[n] || (q && +q >= s[3] && +q <= s[4]);
      rows += '<div class="srow" id="s' + n + '"><span class="prog" style="width:' + (frac * 100).toFixed(1) + '%"></span>' + mark +
        (st.edit ? '<button class="tick ' + (frac === 1 ? 'on' : sel ? 'part' : '') + '" data-act="tickS" data-n="' + n + '" aria-label="Select surah">' + (frac === 1 ? ICON.check : '') + '</button>' : '') +
        '<button class="sname" data-act="' + (st.edit ? 'tickS' : 'openS') + '" data-n="' + n + '" data-k="tom"><span class="num">' + n + '</span><span class="nm">' + esc(s[0]) + '</span><span class="ar">' + esc(s[1]) + '</span></button>' +
        '<button class="exp ' + (open ? 'open' : '') + '" data-act="exp" data-k="tom" data-n="' + n + '" aria-label="Pages">' + ICON.chev + '</button></div>';
      if (open) rows += '<div class="pages">' + pg.map(function (p) {
        var m = S.isMem(p);
        return '<button class="pl ' + (m ? 'mem' : '') + '" data-act="' + (st.edit ? 'tickP' : 'open') + '" data-k="tom" data-p="' + p + '">' + (st.edit && m ? '✓ ' : '') + 'P. ' + S.kp(p) + '</button>';
      }).join('') + '</div>';
    });
    return h + '<div class="list">' + (rows || '<div class="empty">No surah matches.</div>') + '</div>';
  }

  /* Small in-app dialog on the scrim: optional text input, Cancel + one action. cb(value) runs on the action. */
  var dlg = null;
  function dialog(o, cb) {
    var sc = document.getElementById('scrim'); dlg = cb;
    sc.innerHTML = '<div class="sheetm pbox"><div class="pbt">' + esc(o.title) + '</div>' + (o.msg ? '<p class="small">' + o.msg + '</p>' : '') +
      (o.input != null ? '<input class="dinp" id="dinp" maxlength="40" value="' + esc(o.input) + '" autocomplete="off">' : '') +
      '<div class="pbtns' + (o.col ? ' col' : '') + '">' + (o.btns ? o.btns.map(function (b) { return '<button class="btn ' + (b[2] || '') + '" data-dg="' + b[0] + '">' + esc(b[1]) + '</button>'; }).join('') :
        '<button class="btn" data-dg="x">Cancel</button><button class="btn ' + (o.danger ? 'danger' : 'pri') + '" data-dg="ok">' + esc(o.ok) + '</button>') + '</div></div>';
    sc.style.display = 'flex';
    var inp = document.getElementById('dinp');
    if (inp) { setTimeout(function () { inp.focus(); inp.select(); }, 30); inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); endDlg(true); } }); }
  }
  function endDlg(ok, id) {
    var sc = document.getElementById('scrim'), inp = document.getElementById('dinp'), v = inp ? inp.value : null, cb = dlg;
    dlg = null; sc.style.display = 'none'; sc.innerHTML = '';
    if (ok && cb) cb(v, id);
  }
  document.addEventListener('click', function (e) {
    if (!dlg) return;
    var b = e.target.closest && e.target.closest('[data-dg]');
    if (b) { e.stopPropagation(); endDlg(b.dataset.dg !== 'x', b.dataset.dg); }
    else if (e.target.id === 'scrim') { e.stopPropagation(); endDlg(false); }
  }, true);

  /* Long-press a custom tag chip: Rename / Delete menu. The click that ends the press is swallowed. */
  var lp = null, lpFired = 0;
  document.addEventListener('pointerdown', function (e) {
    var c = e.target.closest && e.target.closest('[data-long=tag]'); if (!c) return;
    var x = e.clientX, y = e.clientY;
    lp = { c: c, x: x, y: y, t: setTimeout(function () {
      lp = null; lpFired = Date.now(); try { navigator.vibrate && navigator.vibrate(25); } catch (er) {}
      var id = c.dataset.t, t = S.d.tags.filter(function (q) { return q.id === id; })[0]; if (!t) return;
      dialog({ title: t.name, btns: [['x', 'Cancel'], ['del', 'Delete', 'danger'], ['ren', 'Rename', 'pri']] }, function (v, w) {
        if (w === 'ren') ACT.renTag(c); else if (w === 'del') ACT.delTag(c);
      });
    }, 550) };
  }, true);
  ['pointerup', 'pointercancel'].forEach(function (ev) { document.addEventListener(ev, function () { if (lp) { clearTimeout(lp.t); lp = null; } }, true); });
  document.addEventListener('pointermove', function (e) { if (lp && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 10) { clearTimeout(lp.t); lp = null; } }, true);
  document.addEventListener('click', function (e) { if (Date.now() - lpFired < 700 && e.target.closest && e.target.closest('[data-long]')) { e.stopPropagation(); e.preventDefault(); } }, true);
  document.addEventListener('contextmenu', function (e) { if (e.target.closest && e.target.closest('[data-long]')) e.preventDefault(); }, true);

  /* ---------------- Stats ---------------- */
  function stats() {
    var mem = Object.keys(S.d.pages).filter(function (k) { return S.d.pages[k].m; }).sort(byUnit);
    var m = S.month(), monthTotal = 0, all = 0, sumH = 0, months = {};
    Object.keys(S.d.pages).forEach(function (k) { var rv = S.d.pages[k].rv || {}; for (var mm in rv) { months[mm] = (months[mm] || 0) + rv[mm]; all += rv[mm]; if (mm === m) monthTotal += rv[mm]; } });
    mem.forEach(function (p) { sumH += S.health(p); });
    var h = '<header class="top"><button class="ib" data-act="home" aria-label="Back">' + ICON.back + '</button><div class="brand">Stats</div>' + viewSw() + '</header>';
    h += '<div class="seg">' + [['rep', 'Report'], ['prog', 'Progress'], ['time', 'Calendar']].map(function (x) { return '<button class="' + (st.stab === x[0] ? 'on' : '') + '" data-act="stab" data-t="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
    if (st.stab === 'time') return h + timeStats();
    if (st.stab === 'rep') return h + report();
    h += '<div class="cards"><div class="card"><div class="v">' + mem.length + '</div><div class="k">Pages memorizing</div></div>' +
      '<div class="card"><div class="v">' + (mem.length ? Math.round(sumH / mem.length) : 0) + '%</div><div class="k">Average health</div></div>' +
      '</div>';
    if (st.month) {
      var rowsM = Object.keys(S.d.pages).filter(function (k) { return (S.d.pages[k].rv || {})[st.month]; }).sort(byUnit);
      h += '<div class="bar"><button class="btn sm" data-act="month" data-m="">' + '‹ All months</button><b style="align-self:center">' + st.month + '</b></div><div class="list">' +
        (rowsM.map(function (p) { return '<div class="prow"><button class="pl" data-act="open" data-p="' + p + '">P. ' + S.kp(p) + '</button><div class="grow small">' + esc(unitTitle(p)) + '</div><b>' + S.d.pages[p].rv[st.month] + '×</b></div>'; }).join('') || '<div class="empty">No reviews.</div>') + '</div>';
      return h;
    }
    h += '<div class="seg">' + [['all', 'All'], ['low', 'Below 50%']].map(function (x) {
      return '<button class="' + (st.sf === x[0] ? 'on' : '') + '" data-act="sf" data-f="' + x[0] + '">' + x[1] + '</button>';
    }).join('') + '</div>';
    if (st.sf === 'months') {
      var ks = Object.keys(months).sort().reverse();
      return h + '<div class="list">' + (ks.map(function (k) { return '<button class="prow" style="width:100%;text-align:left" data-act="month" data-m="' + k + '"><div class="grow"><b>' + k + '</b></div><span>' + months[k] + ' reviews</span>' + ICON.fwd + '</button>'; }).join('') || '<div class="empty">No reviews yet.</div>') + '</div>';
    }
    var list = mem.slice();
    if (st.sf === 'low') list = list.filter(function (p) { return S.health(p) < 50; });
    // Sort: page / health / time / reviews / last reviewed; time and review counts for all time or one month.
    var prd = st.sprd, tmap = {}, pms = {};
    Object.keys(S.d.time || {}).forEach(function (d) {
      var mm = d.slice(0, 7); pms[mm] = 1; if (prd !== 'all' && mm !== prd) return;
      var pg = Timer.day(d).pages; for (var q in pg) tmap[q] = (tmap[q] || 0) + pg[q].r + pg[q].n;
    });
    for (var mm2 in months) pms[mm2] = 1; pms[m] = 1;
    var tOf = function (p) { return tmap[S.kp(p)] || 0; };
    var rdOf = function (p) { return S.tally(p, prd === 'all' ? null : function (d) { return d.slice(0, 7) === prd; }).page; };
    var rOf = function (p) { return S.activeDays(p, prd === 'all' ? null : function (d) { return d.slice(0, 7) === prd; }).length; };
    var SRT = { page: ['Page', 'Mushaf order', 'Reversed', null], health: ['Health', 'Best first', 'Worst first', function (p) { return S.health(p); }],
      time: ['Time spent', 'Most first', 'Least first', tOf], reads: ['Times read (tally)', 'Most first', 'Least first', rdOf], revs: ['Days read', 'Most first', 'Least first', rOf],
      last: ['Last read', 'Most recent first', 'Longest ago first', function (p) { var d = S.lastActive(p); return d ? new Date(d + 'T00:00:00').getTime() : 0; }] };
    var sk = SRT[st.srt] || SRT.page, kf = sk[3], dn = st.sdir ? -1 : 1;
    list.sort(function (a, b) { var c = kf ? kf(b) - kf(a) : 0; return (c || byUnit(a, b)) * (kf ? (c ? dn : 1) : dn); });
    h += '<div class="sortbar"><select data-in="srt" aria-label="Sort by">' + Object.keys(SRT).map(function (k) { return '<option value="' + k + '"' + (st.srt === k ? ' selected' : '') + '>' + SRT[k][0] + '</option>'; }).join('') + '</select>' +
      '<button class="btn sm" data-act="sdir">⇅ ' + sk[st.sdir ? 2 : 1] + '</button>' +
      '<select data-in="sprd" aria-label="Period"><option value="all">All time</option>' + Object.keys(pms).sort().reverse().map(function (k) { return '<option value="' + k + '"' + (prd === k ? ' selected' : '') + '>' + (k === m ? 'This month' : k) + '</option>'; }).join('') + '</select></div>';
    h += '<div class="list">' + (list.map(function (p) {
      var hh = S.health(p), o = S.get(p), on = st.ssel[p];
      return '<div class="prow"><button class="tick ' + (on ? 'on' : '') + '" style="margin:0" data-act="ssel" data-p="' + p + '">' + (on ? ICON.check : '') + '</button>' +
        '<div class="grow"><div style="display:flex;gap:8px;align-items:center"><button class="pl" data-act="open" data-p="' + p + '">P. ' + S.kp(p) + '</button><span class="small muted" style="overflow:hidden;white-space:nowrap;text-overflow:ellipsis">' + esc(unitTitle(p)) + (S.hasTag(p, 'review') ? ' · for review' : '') + '</span></div>' +
        '<div class="hbar"><i style="width:' + hh + '%;background:' + hcol(hh) + '"></i></div></div>' +
        '<div style="text-align:right;font-size:12px"><b>' + hh + '%</b><br><span class="muted">' + ago(S.lastActive(p)) + ' · ' + rOf(p) + 'd' + (tOf(p) >= 30 ? ' · ' + Timer.mins(tOf(p)) : '') + (rdOf(p) ? ' · ' + rdOf(p) + ' reads' : '') + '</span></div></div>';
    }).join('') || '<div class="empty">No pages.</div>') + '</div>';
    var nsel = Object.keys(st.ssel).filter(function (k) { return st.ssel[k]; }).length;
    if (list.length) h += '<div class="actbar"><button class="btn" data-act="sselAll">' + (nsel ? 'Clear (' + nsel + ')' : 'Select all') + '</button><button class="btn pri" data-act="tagReview" ' + (nsel ? '' : 'disabled style="opacity:.5"') + '>Mark for review</button></div>';
    return h;
  }

  /* ---------------- Report: day / week / month / year ----------------
     A page counts as read on a day with 5+ min of stopwatch time or a saved tally (S.activeDays); a day is
     practised when any page counts. Weeks start on Saturday. */
  function addD(k, n) { var d = new Date(k + 'T00:00:00'); d.setDate(d.getDate() + n); return dkey(d); }
  function repRange(pd, a) {
    var d = new Date(a + 'T00:00:00'), s, e;
    if (pd === 'day') s = e = a;
    else if (pd === 'week') { s = addD(a, -((d.getDay() + 1) % 7)); e = addD(s, 6); }
    else if (pd === 'month') { s = a.slice(0, 7) + '-01'; e = dkey(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }
    else { s = a.slice(0, 4) + '-01-01'; e = a.slice(0, 4) + '-12-31'; }
    return [s, e];
  }
  function repLabel(pd, r) {
    var f = function (k, o) { return new Date(k + 'T00:00:00').toLocaleDateString(undefined, o); };
    if (pd === 'day') return r[0] === S.today() ? 'Today' : f(r[0], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    if (pd === 'week') return f(r[0], { day: 'numeric', month: 'short' }) + ' – ' + f(r[1], { day: 'numeric', month: 'short' });
    if (pd === 'month') return f(r[0], { month: 'long', year: 'numeric' });
    return r[0].slice(0, 4);
  }
  function report() {
    var pd = st.rp, td = S.today(), a = st.ra || td, r = repRange(pd, a), s0 = r[0], s1 = r[1];
    var inR = function (d) { return d >= s0 && d <= s1; };
    // Per page number: time, reads (tally; shared pages add their surah parts), active days.
    var P = {}, get = function (p) { return P[p] || (P[p] = { t: 0, rd: 0, days: {} }); };
    Object.keys(S.d.time || {}).forEach(function (d) {
      if (!inR(d)) return; var pg = Timer.day(d).pages;
      for (var p in pg) { var v = pg[p].r + pg[p].n; if (v >= 1) { var q = get(p); q.t += v; if (v >= S.ACT_SECS) q.days[d] = 1; } }
    });
    Object.keys(S.d.pages).forEach(function (k) {
      var o = S.d.pages[k], hit = (o.tl || []).some(function (e) { return inR(e[0]); }) || (o.rl || []).some(inR);
      if (!hit) return;
      var q = get(S.kp(k)); q.rd += S.tally(k, inR).page;
      S.activeDays(k, inR).forEach(function (d) { q.days[d] = 1; });
    });
    var ps = Object.keys(P).map(Number), T = 0, RD = 0, DAYS = {}, act = 0;
    ps.forEach(function (p) { var q = P[p]; T += q.t; RD += q.rd; var n = Object.keys(q.days).length; if (n) act++; for (var d in q.days) DAYS[d] = 1; });
    var nDays = Object.keys(DAYS).length;
    var h = '<div class="seg mini" style="margin-top:4px">' + [['day', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly'], ['year', 'Yearly']].map(function (x) { return '<button class="' + (pd === x[0] ? 'on' : '') + '" data-act="rp" data-p="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
    var nxt = addD(s1, 1);
    h += '<div class="calhd"><button class="ib" data-act="ra" data-d="' + addD(s0, -1) + '" aria-label="Previous">' + ICON.back + '</button><b>' + repLabel(pd, r) + '</b><button class="ib" data-act="ra" data-d="' + nxt + '" aria-label="Next"' + (nxt > td ? ' disabled style="opacity:.3"' : '') + '>' + ICON.fwd + '</button></div>';
    h += '<div class="cards">' +
      '<div class="card"><div class="v">' + Timer.mins(T) + '</div><div class="k">Total time</div></div>' +
      '<div class="card"><div class="v">' + RD + '</div><div class="k">Page reads (tally)</div></div>' +
      '<div class="card"><div class="v">' + act + '</div><div class="k">Pages read</div></div>' +
      (pd === 'day' ? '<div class="card"><div class="v">' + (nDays ? '✓' : '–') + '</div><div class="k">' + (nDays ? 'Day counted' : 'Not counted yet') + '</div></div>'
        : '<div class="card"><div class="v">' + nDays + '</div><div class="k">Days practised</div></div>') + '</div>';
    // Bars: days of the week/month, months of the year (minutes). Tap to drill in.
    if (pd !== 'day') {
      var B = [];
      if (pd === 'year') for (var mi = 0; mi < 12; mi++) B.push({ k: s0.slice(0, 4) + '-' + String(mi + 1).padStart(2, '0'), l: 'JFMAMJJASOND'[mi], t: 0, on: 0 });
      else for (var d = s0; d <= s1; d = addD(d, 1)) B.push({ k: d, l: pd === 'week' ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'narrow' }) : String(+d.slice(8)), t: 0, on: 0 });
      Object.keys(S.d.time || {}).forEach(function (d) { if (!inR(d)) return; var b = B.filter(function (x) { return d.indexOf(x.k) === 0; })[0]; if (b) b.t += Timer.day(d).t; });
      Object.keys(DAYS).forEach(function (d) { var b = B.filter(function (x) { return d.indexOf(x.k) === 0; })[0]; if (b) b.on++; });
      var mx = Math.max.apply(null, B.map(function (b) { return b.t; }).concat([60]));
      h += '<div class="rbars' + (B.length > 12 ? ' dense' : '') + '">' + B.map(function (b) {
        var fut = (pd === 'year' ? b.k + '-01' : b.k) > td;
        return '<button class="rb' + (b.on ? ' on' : '') + '"' + (fut ? ' disabled' : ' data-act="rdrill" data-k="' + b.k + '"') + '><span class="rbv">' + (b.t >= 60 ? Math.round(b.t / 60) : '') + '</span><i style="height:' + (b.t || b.on ? Math.max(4, b.t / mx * 100) : 0) + '%"></i><span class="rbl">' + b.l + '</span></button>';
      }).join('') + '</div><div class="small muted callg">Minutes · green = day counted (5 min or a tally on a page)</div>';
    }
    // Pages and their stats for the period
    var srt = st.rsrt || 't';
    ps.sort(function (x, y) { var A = P[x], Bq = P[y]; return srt === 'p' ? x - y : srt === 'r' ? (Bq.rd - A.rd) || (Bq.t - A.t) : (Bq.t - A.t) || (Bq.rd - A.rd); });
    h += '<div class="bar" style="margin-top:14px"><b style="align-self:center">Pages</b><span style="flex:1"></span><div class="seg mini">' + [['t', 'Time'], ['r', 'Reads'], ['p', 'Page']].map(function (x) { return '<button class="' + (srt === x[0] ? 'on' : '') + '" data-act="rsrt" data-s="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div></div>';
    h += '<div class="list">' + (ps.map(function (p) {
      var q = P[p], nd = Object.keys(q.days).length;
      return '<div class="prow"><button class="pl" data-act="open" data-p="' + S.uk(p) + '">P. ' + p + '</button><div class="grow small">' + esc(pageTitle(p)) +
        (pd !== 'day' ? '<br><span class="muted">' + nd + ' day' + (nd === 1 ? '' : 's') + '</span>' : (nd ? '<br><span class="muted">counted</span>' : '')) + '</div>' +
        '<div style="text-align:right;font-size:12px"><b>' + Timer.mins(q.t) + '</b><br><span class="muted">' + q.rd + '× read</span></div></div>';
    }).join('') || '<div class="empty">Nothing read in this period.</div>') + '</div>';
    return h;
  }

  /* ---------------- Time dashboard ---------------- */
  function dkey(dt) { return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0'); }
  function timeStats() {
    var TM = S.d.time || {}, days = Object.keys(TM).sort(), g = S.d.settings.goalDay, td = S.today(), D = {};
    days.forEach(function (k) { D[k] = Timer.day(k); });
    var sum = function (pred) { var t = 0; days.forEach(function (k) { if (pred(k)) t += D[k].t; }); return t; };
    var now = new Date(), wk = new Date(now); wk.setDate(now.getDate() - 6); var wks = dkey(wk), mth = S.month();
    // Streak: consecutive days meeting the daily goal (any time at all when no goal is set), ending today or yesterday.
    var streak = 0, c = new Date(now), met = function (k) { return D[k] && D[k].t >= (g ? g * 60 : 1); };
    if (!met(dkey(c))) c.setDate(c.getDate() - 1);
    while (met(dkey(c))) { streak++; c.setDate(c.getDate() - 1); }
    var h = '<div class="cards">' +
      '<div class="card"><div class="v">' + Math.floor(((D[td] || {}).t || 0) / 60) + (g ? '<span class="small muted"> / ' + g + '</span>' : '') + '</div><div class="k">Minutes today' + (g && met(td) ? ' · ✓ goal' : '') + '</div></div>' +
      '<div class="card"><div class="v">' + streak + '</div><div class="k">Day streak</div></div>' +
      '<div class="card"><div class="v">' + Timer.mins(sum(function (k) { return k >= wks; })) + '</div><div class="k">Last 7 days</div></div>' +
      '<div class="card"><div class="v">' + Timer.mins(sum(function () { return true; })) + '</div><div class="k">Total time</div></div>' +
      '<div class="card"><div class="v">' + Tally.dayReads(function (d) { return d === td; }) + (S.d.settings.tDay ? '<span class="small muted"> / ' + S.d.settings.tDay + '</span>' : '') + '</div><div class="k">Page reads today</div></div>' +
      '<div class="card"><div class="v">' + Tally.dayReads(function (d) { return d.slice(0, 7) === mth; }) + '</div><div class="k">Page reads this month</div></div></div>';
    if (st.cday) return h + dayDetail(st.cday, D[st.cday]);
    // Month calendar
    var cm = st.cal || mth, y = +cm.slice(0, 4), mo = +cm.slice(5, 7) - 1, first = new Date(y, mo, 1), nd = new Date(y, mo + 1, 0).getDate();
    var prev = dkey(new Date(y, mo - 1, 1)).slice(0, 7), next = dkey(new Date(y, mo + 1, 1)).slice(0, 7), mt = 0;
    h += '<div class="calhd"><button class="ib" data-act="cal" data-m="' + prev + '" aria-label="Previous month">' + ICON.back + '</button><b>' + first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) + '</b><button class="ib" data-act="cal" data-m="' + next + '" aria-label="Next month"' + (cm >= mth ? ' disabled style="opacity:.3"' : '') + '>' + ICON.fwd + '</button></div>';
    h += '<div class="cal">' + ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(function (x) { return '<span class="dow">' + x + '</span>'; }).join('');
    for (var i = 0; i < first.getDay(); i++) h += '<span></span>';
    for (var d = 1; d <= nd; d++) {
      var k = cm + '-' + String(d).padStart(2, '0'), o = D[k], m = o ? Math.round(o.t / 60) : 0; if (o) mt += o.t;
      var lvl = !o || o.t < 30 ? 0 : g ? Math.min(4, Math.ceil(o.t / (g * 60) * 4)) : Math.min(4, Math.ceil(m / 15));
      h += '<button class="cd l' + lvl + (k === td ? ' today' : '') + '"' + (o && o.t >= 30 ? ' data-act="cday" data-d="' + k + '"' : ' disabled') + '><b>' + d + '</b>' +
        (m ? '<span>' + m + 'm</span>' : '') + '<i>' + (o && o.n >= 30 ? '<em class="dn"></em>' : '') + (o && o.r >= 30 ? '<em class="dr"></em>' : '') + '</i>' + (g && o && o.t >= g * 60 ? '<u>✓</u>' : '') + '</button>';
    }
    h += '</div><div class="small muted callg"><em class="dn"></em> memorizing <em class="dr"></em> review · ✓ daily goal · ' + Timer.mins(mt) + ' this month</div>';
    // By surah
    var per = st.sper, bys = {};
    days.forEach(function (k) {
      if (per === 'month' && k.slice(0, 7) !== mth) return;
      var P = D[k].pages;
      for (var p in P) { var ss = onPage(+p); ss.forEach(function (n) { var b = bys[n] || (bys[n] = { r: 0, n: 0 }); b.r += P[p].r / ss.length; b.n += P[p].n / ss.length; }); }
    });
    var list = Object.keys(bys).map(Number).sort(function (a, b) { return (bys[b].r + bys[b].n) - (bys[a].r + bys[a].n); });
    var mx = list.length ? bys[list[0]].r + bys[list[0]].n : 1;
    h += '<div class="bar" style="margin-top:14px"><b style="align-self:center">By surah</b><span style="flex:1"></span><div class="seg mini">' + [['all', 'All time'], ['month', 'This month']].map(function (x) { return '<button class="' + (per === x[0] ? 'on' : '') + '" data-act="sper" data-p="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div></div>';
    h += '<div class="list">' + (list.map(function (n) {
      var b = bys[n], t = b.r + b.n;
      return '<div class="prow"><div class="grow"><div style="display:flex;justify-content:space-between;gap:8px"><span><span class="muted small">' + n + '</span> <b>' + esc(SUR[n - 1][0]) + '</b></span><b>' + Timer.mins(t) + '</b></div>' +
        '<div class="tsplit" style="width:' + Math.max(4, t / mx * 100) + '%"><i class="dn" style="flex:' + b.n + '"></i><i class="dr" style="flex:' + b.r + '"></i></div>' +
        '<div class="small muted">' + (b.n >= 30 ? 'Memorizing ' + Timer.mins(b.n) : '') + (b.n >= 30 && b.r >= 30 ? ' · ' : '') + (b.r >= 30 ? 'Review ' + Timer.mins(b.r) : '') + '</div></div></div>';
    }).join('') || '<div class="empty">No time yet. Start the stopwatch from the Timer button in the reader.</div>') + '</div>';
    return h;
  }
  function dayDetail(k, o) {
    var dt = new Date(k + 'T00:00:00'), ps = Object.keys(o.pages).map(Number).sort(function (a, b) { return a - b; });
    var h = '<div class="bar"><button class="btn sm" data-act="cday" data-d="">‹ Calendar</button><b style="align-self:center">' + dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + Timer.mins(o.t) + '</b></div>';
    return h + '<div class="list">' + ps.map(function (p) {
      var q = o.pages[p];
      return '<div class="prow"><button class="pl" data-act="open" data-p="' + p + '">P. ' + p + '</button><div class="grow small">' + esc(pageTitle(p)) + '<br><span class="muted">' + (q.n >= 30 ? 'memorizing ' + Timer.mins(q.n) : '') + (q.n >= 30 && q.r >= 30 ? ' · ' : '') + (q.r >= 30 ? 'review ' + Timer.mins(q.r) : '') + '</span></div><b>' + Timer.mins(q.r + q.n) + '</b></div>';
    }).join('') + '</div>';
  }

  /* ---------------- Settings ---------------- */
  function openSettings() {
    var s = S.d.settings, cid = Sync.cid();
    var acct = !cid ? '<p class="small muted">Google sign-in has not been configured for this app yet, so your data is kept on this device only.</p>'
      : S.d.acct ? '<div class="frow"><label><b>' + esc(S.d.acct) + '</b><br><span class="small muted">' + ({ ok: 'Synced to your Google Drive', syncing: 'Syncing…', paused: 'Sync paused — tap Sync now', error: 'Last sync failed' }[Sync.state] || '') + '</span></label><button class="btn sm" data-act="syncNow">Sync now</button></div><button class="btn sm" data-act="signOut">Sign out</button>'
        : '<p class="small muted">Sign in with Google to keep your progress and masks in your own Google Drive, on every device.</p><button class="btn pri" data-act="signIn">Sign in with Google</button>';
    var themes = [['green', '#1f7a52', 'Green'], ['blue', '#1d5ca6', 'Blue'], ['dark', '#111513', 'Dark']];
    var h = '<div class="sheetm" id="settingsSheet"><h3>Settings</h3>' +
      '<h4>Theme</h4><div class="themes">' + themes.map(function (t) { return '<button class="' + (s.theme === t[0] ? 'on' : '') + '" data-act="theme" data-t="' + t[0] + '"><span class="sq" style="background:' + t[1] + '"></span>' + t[2] + '</button>'; }).join('') + '</div>' +
      '<h4>Page display</h4>' + (innerWidth >= 1000 ? '<div class="frow"><label>Web view<br><span class="small muted">For laptops and big screens: a thin control bar across the bottom, page arrows at the sides, two facing pages. Off: the phone reader. Also on the switch beside Settings.</span></label><button class="sw ' + (s.view === 'web' ? 'on' : '') + '" data-act="webView"></button></div>' +
        '<div class="frow"><label>Trim margins in web view<br><span class="small muted">Off: web view shows whole pages, like a printed mushaf.</span></label><button class="sw ' + (s.webTrim ? 'on' : '') + '" data-act="webTrim"></button></div>' : '') + '<div class="frow"><label>Show pages</label><select data-in="fit"><option value="page"' + (s.fit !== 'width' ? ' selected' : '') + '>Whole page on screen</option><option value="width"' + (s.fit === 'width' ? ' selected' : '') + '>Fit width (scroll)</option></select></div>' +
      '<div class="frow"><label>Auto-trim margins<br><span class="small muted">Measured separately for every page. Your own crops override it.</span></label><select data-in="trim"><option value="full"' + (s.trim === 'full' ? ' selected' : '') + '>Keep header &amp; page no.</option><option value="frame"' + (s.trim === 'frame' ? ' selected' : '') + '>Frame only</option><option value="off"' + (s.trim === 'off' ? ' selected' : '') + '>Off</option></select></div>' +
      (s.cropDef ? '<div class="frow"><label>Default crop<br><span class="small muted">Custom, set from P. ' + s.cropDef.p + '. Applies to every page you haven’t cropped yourself; Auto in a page’s Crop uses it. Restore default goes back to the auto-trim above.</span></label><button class="btn sm" data-act="cropRestore">Restore default</button></div>'
        : '<div class="frow"><label>Default crop<br><span class="small muted">Using the auto-trim above. To make your own, open Crop on a page, adjust it and tap “Set as default”.</span></label></div>') +
      '<div class="frow"><label>Extra margin</label><select data-in="trimPad">' + [0, 0.01, 0.02, 0.03].map(function (v) { return '<option value="' + v + '"' + (Math.abs((s.trimPad == null ? 0.01 : s.trimPad) - v) < 0.001 ? ' selected' : '') + '>' + (v * 100) + '%</option>'; }).join('') + '</select></div>' +
      '<div class="frow"><label>New box width<br><span class="small muted">How wide a new box starts, as a share of the page width.</span></label><select data-in="boxW">' + [8, 11, 15, 20, 25, 34, 50].map(function (v) { return '<option value="' + v + '"' + ((+s.boxW || 11) === v ? ' selected' : '') + '>' + v + '%</option>'; }).join('') + '</select></div>' +
      '<div class="frow"><label>Lock box height<br><span class="small muted">On: a box’s handles change only its width, so the height can’t shift by accident. Off: the corner handles change width and height.</span></label><button class="sw ' + (s.boxHLock !== false ? 'on' : '') + '" data-act="boxHLock"></button></div>' +
      '<div class="frow"><label>Double-tap page for the drawer<br><span class="small muted">On: double-tap the page to hide or bring back the drawer. Off: a single tap hides it and the page number brings it back.</span></label><button class="sw ' + (s.tapShow ? 'on' : '') + '" data-act="tapShow"></button></div>' +
      '<div class="frow"><label>Swipe on into the next surah<br><span class="small muted">In Memorizing, swiping stays inside one surah. On: when the next surah in your list starts on the same or the next page (e.g. Faatir → Yaseen), swiping carries on into it. Off: swiping always stops at the end of a surah.</span></label><button class="sw ' + (s.swipeSur !== false ? 'on' : '') + '" data-act="swipeSur"></button></div>' +
      '<h4>Health decay</h4><div class="frow"><label>Lose health when not reviewed</label><button class="sw ' + (s.decayOn ? 'on' : '') + '" data-act="decayOn"></button></div>' +
      '<div class="frow"><label>Start after</label><select data-in="decayAfter">' + [7, 10, 14, 21, 30].map(function (v) { return '<option value="' + v + '"' + (s.decayAfter === v ? ' selected' : '') + '>' + v + ' days</option>'; }).join('') + '</select></div>' +
      '<div class="frow"><label>Then lose</label><select data-in="decayPct">' + [5, 10, 15].map(function (v) { return '<option value="' + v + '"' + (s.decayPct === v ? ' selected' : '') + '>' + v + '% per week</option>'; }).join('') + '</select></div>' +
      '<h4>Stopwatch</h4><div class="frow"><label>Daily goal</label><select data-in="goalDay">' + [0, 10, 15, 20, 30, 45, 60, 90].map(function (v) { return '<option value="' + v + '"' + (s.goalDay === v ? ' selected' : '') + '>' + (v ? v + ' min' : 'Off') + '</option>'; }).join('') + '</select></div>' +
      '<h4>Tally</h4><div class="frow"><label>Hold to count<br><span class="small muted">How long to hold the counter until the ring closes.</span></label>' + '<select data-in="tHold">' + [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1, 1.2, 1.5].map(function (v) { return '<option value="' + v + '"' + (+s.tHold === v ? ' selected' : '') + '>' + v + ' s' + '</option>'; }).join('') + '</select>' + '</div>' +
      '<div class="frow"><label>Daily target<br><span class="small muted">Page reads a day (a page counts once all its sections are read).</span></label>' + '<select data-in="tDay">' + [0, 1, 2, 3, 5, 10, 20, 30].map(function (v) { return '<option value="' + v + '"' + (+s.tDay === v ? ' selected' : '') + '>' + (v ? v + ' reads' : 'Off') + '</option>'; }).join('') + '</select>' + '</div>' +
      '<div class="frow"><label>Raise health every</label>' + '<select data-in="tRuleN">' + [0, 5, 10, 20, 30, 50, 100].map(function (v) { return '<option value="' + v + '"' + (+s.tRuleN === v ? ' selected' : '') + '>' + (v ? v + ' reads' : 'Off') + '</option>'; }).join('') + '</select>' + '</div>' +
      (s.tRuleN ? '<div class="frow"><label>By</label>' + '<select data-in="tRulePct">' + [5, 10, 15, 20].map(function (v) { return '<option value="' + v + '"' + (+s.tRulePct === v ? ' selected' : '') + '>' + '+' + v + '%' + '</option>'; }).join('') + '</select>' + '</div>' : '') +
      '<h4>Section hiding colour</h4><div class="rrow">' + [['#ffffff', 'White'], ['#fbf6e9', 'Cream'], ['#e9ecea', 'Grey']].map(function (c) { return '<button class="sw-c ' + (s.cover === c[0] ? 'on' : '') + '" style="background:' + c[0] + '" data-act="cover" data-c="' + c[0] + '" aria-label="' + c[1] + '"></button>'; }).join('') + '</div>' +
      '<h4>Custom tags</h4><p class="small muted">' + (S.d.tags.length ? S.d.tags.length + ' tag' + (S.d.tags.length === 1 ? '' : 's') + '. ' : '') + 'Create tags with + Tag on the Memorizing tab; long-press a tag to rename or delete it.</p>' +
      '<h4>Account &amp; sync</h4>' + acct +
      '<h4>Offline</h4><button class="btn sm" data-act="precache">Save my Memorizing pages for offline</button>' +
      '<h4>Share</h4><div class="frow"><label>Share the app<br><span class="small muted">Copies the app link. Each person signs in with their own Google account, so your data stays yours.</span></label><button class="btn sm" data-act="shareApp">Copy link</button></div>' +
      '<h4>Update app</h4><div class="frow"><label>Load the latest version<br><span class="small muted">Clears the cached app files and reloads. Your data and offline pages are kept. Version: ' + esc((window.HIFZ_CONFIG || {}).appVersion || '—') + '</span></label><button class="btn sm" data-act="updateApp">Update app</button></div>' +
      '<p class="small muted" style="margin-top:14px">Install: open the browser menu → “Install app” / “Add to Home screen” for full screen.</p>' +
      '<div style="text-align:right;margin-top:10px"><button class="btn" data-act="closeSheet">Close</button></div></div>';
    var sc = $('#scrim');
    sc.innerHTML = h; sc.style.display = 'flex';
  }
  function closeSheet() { var sc = $('#scrim'); sc.style.display = 'none'; sc.innerHTML = ''; }

  /* ---------------- Actions ---------------- */
  var ACT = {
    tab: function (el) { st.tedit = null; S.d.ui.tab = el.dataset.t; S.saveUi(); App.render(); window.scrollTo(0, 0); },
    chip: function (el) { // one tag at a time; opening a custom tag moves it to the front
      st.tedit = null; var b = sub(); S.d.ui.cts[b] = el.dataset.t;
      var ct = ctag(); if (ct) { ct.o = Date.now(); S.saveSettings(); } else S.saveUi(); App.render();
    },
    sub: function (el) { st.tedit = null; sub(); S.d.ui.sub = el.dataset.t; S.saveUi(); App.render(); },
    selStart: function () {
      var ct = ctag(); st.sel = {}; st.tedit = ct ? ct.id : 'all';
      if (ct) subPool().forEach(function (k) { if (S.hasTag(k, ct.id)) st.sel[k] = true; });
      App.render();
    },
    selAll: function () {
      var pool = subPool(), every = pool.every(function (k) { return st.sel[k]; });
      st.sel = {}; if (!every) pool.forEach(function (k) { st.sel[k] = true; }); App.render();
    },
    selS: function (el) {
      var sb = sub(), pg = units(+el.dataset.n).filter(function (p) { return S.isMem(p) && subOf(p) === sb; }), all = pg.every(function (p) { return st.sel[p]; });
      pg.forEach(function (p) { if (all) delete st.sel[p]; else st.sel[p] = true; }); App.render();
    },
    selP: function (el) { var p = el.dataset.p; if (st.sel[p]) delete st.sel[p]; else st.sel[p] = true; App.render(); },
    selDone: function () { // in a custom tag the ticks become its pages; under All, Done just closes
      var ct = ctag();
      if (ct && st.tedit === ct.id) subPool().forEach(function (k) { S.toggleTag(k, ct.id, !!st.sel[k]); });
      st.tedit = null; st.sel = {}; App.render();
    },
    selMove: function () {
      var ks = subPool().filter(function (k) { return st.sel[k]; }); if (!ks.length) return;
      var to = sub() === 'new' ? 'review' : 'new', toName = to === 'new' ? 'New' : 'Review';
      var btns = [['all', toName + ' · All', 'pri']].concat(byOpened(subTags(to)).map(function (t) { return [t.id, t.name]; }), [['x', 'Cancel']]);
      dialog({ title: 'Move ' + ks.length + ' page' + (ks.length === 1 ? '' : 's') + ' to ' + toName, msg: 'Pick All or a tag in ' + toName + '.', btns: btns, col: true }, function (v, w) {
        var tg = w === 'all' ? null : subTags(to).filter(function (t) { return t.id === w; })[0];
        if (w !== 'all' && !tg) return;
        movePages(ks, to, tg && tg.id);
        st.tedit = null; st.sel = {}; App.render(); App.toast('Moved ' + ks.length + ' page' + (ks.length === 1 ? '' : 's') + ' to ' + toName + (tg ? ' · ' + tg.name : ''));
      });
    },
    // Tag name entry uses an in-app dialog (the browser's prompt() can be blocked in an installed app).
    addTag: function () {
      dialog({ title: 'New tag', input: '', ok: 'Create' }, function (name) {
        name = (name || '').trim(); if (!name) return;
        var id = 't' + Date.now().toString(36), sb = sub(); S.d.tags.push({ id: id, name: name, s: sb, c: S.today(), o: Date.now() });
        S.d.ui.cts = S.d.ui.cts || {}; S.d.ui.cts[sb] = id; st.tedit = id; st.sel = {}; // open the new tag in select mode, ready to pick its pages
        S.saveSettings(); App.render(); App.toast('Tag created · tick the pages for it');
      });
    },
    renTag: function (el) {
      var t = S.d.tags.filter(function (x) { return x.id === el.dataset.t; })[0]; if (!t) return;
      dialog({ title: 'Rename tag', input: t.name, ok: 'Save' }, function (name) {
        name = (name || '').trim(); if (!name || name === t.name) return;
        t.name = name; S.saveSettings(); App.render();
      });
    },
    delTag: function (el) {
      var id = el.dataset.t, t = S.d.tags.filter(function (x) { return x.id === id; })[0]; if (!t) return;
      dialog({ title: 'Delete tag', msg: 'Delete “' + esc(t.name) + '”? Its pages stay in Memorizing.', ok: 'Delete', danger: true }, function () {
        S.d.tags = S.d.tags.filter(function (x) { return x.id !== id; });
        Object.keys(S.d.pages).forEach(function (k) { if (S.hasTag(k, id)) S.toggleTag(k, id, false); });
        var cts = S.d.ui.cts || {}; Object.keys(cts).forEach(function (b) { if (cts[b] === id) cts[b] = 'all'; });
        st.tedit = null; S.saveSettings(); App.render(); App.toast('Tag deleted');
      });
    },
    exp: function (el) { var k = el.dataset.k, n = el.dataset.n; st.exp[k][n] = !st.exp[k][n]; App.render(); },
    edit: function () { st.edit = !st.edit; App.render(); },
    open: function (el) {
      closeSheet(); var k = el.dataset.p, sc = el.dataset.k === 'tom' ? null : scope(k);
      Reader.open(S.kp(k), S.kn(k), sc && sc.rg, sc && sc.tag);
    },
    openS: function (el) {
      var n = +el.dataset.n, pg = units(n), sc = null;
      if (el.dataset.k === 'mem') { var f = pg.filter(memMatch); if (f.length) { pg = f; sc = scope(f[0]); } }
      Reader.open(S.kp(pg[0]), n, sc && sc.rg, sc && sc.tag);
    },
    tickS: function (el) {
      var pg = units(+el.dataset.n), all = pg.every(function (p) { return S.isMem(p); });
      pg.forEach(function (p) { S.setMem(p, !all); }); App.render(); App.precache();
    },
    tickP: function (el) { var p = el.dataset.p; S.setMem(p, !S.isMem(p)); App.render(); App.precache(); },
    addPages: function (el) {
      var n = el.dataset.n; S.d.ui.tab = 'tom'; st.edit = true; st.q = ''; st.exp.tom = {}; st.exp.tom[n] = true; S.saveUi(); App.render();
      var r = document.getElementById('s' + n); if (r) r.scrollIntoView({ block: 'start' });
    },
    contMin: function () { S.d.ui.contMin = !S.d.ui.contMin; S.saveUi(); App.render(); },
    stats: function () { st.view = 'stats'; st.ssel = {}; st.month = null; App.render(); window.scrollTo(0, 0); },
    home: function () { st.view = 'home'; App.render(); },
    sf: function (el) { st.sf = el.dataset.f; App.render(); },
    sdir: function () { st.sdir = st.sdir ? 0 : 1; App.render(); },
    stab: function (el) { st.stab = el.dataset.t; st.cday = null; App.render(); },
    cal: function (el) { st.cal = el.dataset.m; App.render(); },
    cday: function (el) { st.cday = el.dataset.d || null; App.render(); window.scrollTo(0, 0); },
    sper: function (el) { st.sper = el.dataset.p; App.render(); },
    rp: function (el) { st.rp = el.dataset.p; App.render(); },
    ra: function (el) { st.ra = el.dataset.d; App.render(); },
    rsrt: function (el) { st.rsrt = el.dataset.s; App.render(); },
    rdrill: function (el) { var k = el.dataset.k; st.rp = k.length === 7 ? 'month' : 'day'; st.ra = k.length === 7 ? k + '-01' : k; App.render(); window.scrollTo(0, 0); },
    month: function (el) { st.month = el.dataset.m || null; App.render(); },
    ssel: function (el) { st.ssel[el.dataset.p] = !st.ssel[el.dataset.p]; App.render(); },
    sselAll: function () {
      var any = Object.keys(st.ssel).some(function (k) { return st.ssel[k]; });
      st.ssel = {};
      if (!any) document.querySelectorAll('[data-act=ssel]').forEach(function (b) { st.ssel[b.dataset.p] = true; });
      App.render();
    },
    tagReview: function () {
      var ps = Object.keys(st.ssel).filter(function (k) { return st.ssel[k]; });
      ps.forEach(function (p) { S.toggleTag(p, 'review', true); });
      st.ssel = {}; App.toast(ps.length + ' page' + (ps.length === 1 ? '' : 's') + ' marked for review'); App.render();
    },
    settings: openSettings, closeSheet: closeSheet,
    shareApp: function () {
      var u = location.origin + location.pathname, done = function () { App.toast('App link copied'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(done, function () { prompt('Copy this link', u); });
      else prompt('Copy this link', u);
    },
    updateApp: function (el) {
      el.disabled = true; el.textContent = 'Updating…';
      var sw = navigator.serviceWorker, files = ['./', 'index.html', 'css/app.css', 'js/config.js', 'js/quran.js', 'js/autocrop.js', 'js/store.js', 'js/timer.js', 'js/tally.js', 'js/reader.js', 'js/app.js', 'sw.js'];
      var p1 = sw ? sw.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.unregister(); })); }) : Promise.resolve();
      var p2 = window.caches ? caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== 'hifz-pages'; }).map(function (k) { return caches.delete(k); })); }) : Promise.resolve();
      // Refetch the app files past the browser's HTTP cache so the reload gets fresh copies.
      var p3 = Promise.all(files.map(function (f) { return fetch(f, { cache: 'reload' }).catch(function () {}); }));
      Promise.all([p1, p2, p3]).catch(function () {}).then(function () { location.replace(location.pathname + '?v=' + Date.now() + location.hash); });
    },
    theme: function (el) { S.d.settings.theme = el.dataset.t; S.saveSettings(); App.render(); openSettings(); },
    swipeSur: function () { S.d.settings.swipeSur = S.d.settings.swipeSur === false; S.saveSettings(); openSettings(); },
    viewFlip: function () { S.d.settings.view = S.d.settings.view === 'web' ? 'mobile' : 'web'; S.saveSettings(); App.render(); },
    webTrim: function () { S.d.settings.webTrim = !S.d.settings.webTrim; S.saveSettings(); openSettings(); },
    webView: function () { S.d.settings.view = S.d.settings.view === 'web' ? 'mobile' : 'web'; S.saveSettings(); App.render(); openSettings(); },
    tapShow: function () { S.d.settings.tapShow = !S.d.settings.tapShow; S.saveSettings(); openSettings(); },
    boxHLock: function () { S.d.settings.boxHLock = S.d.settings.boxHLock === false; S.saveSettings(); openSettings(); },
    cropRestore: function () { if (!confirm('Restore the default crop to the auto-trim?')) return; S.d.settings.cropDef = null; S.saveSettings(); /* null, not delete, so the restore syncs to other devices */ openSettings(); App.render(); App.toast('Default crop restored'); },
    decayOn: function () { S.d.settings.decayOn = !S.d.settings.decayOn; S.saveSettings(); openSettings(); App.render(); },
    cover: function (el) { S.d.settings.cover = el.dataset.c; S.saveSettings(); openSettings(); },
    signIn: function () { Sync.signIn(false); },
    signOut: function () { if (confirm('Sign out? Your data stays safe in your Google Drive.')) { Sync.signOut(); closeSheet(); } },
    syncNow: function () { if (Sync.tok) Sync.pull(); else Sync.signIn(true); },
    syncChip: function () { if (!Sync.cid() || !S.d.acct) openSettings(); else ACT.syncNow(); },
    precache: function () { App.precache(); App.toast('Saving pages for offline…'); }
  };
  App.ACT = ACT;

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var f = ACT[el.dataset.act]; if (f) { e.preventDefault(); f(el, e); }
  });
  document.addEventListener('input', function (e) {
    var k = e.target.dataset && e.target.dataset.in; if (!k) return;
    if (k === 'q') {
      st.q = e.target.value; var pos = e.target.selectionStart; App.render();
      var inp = document.querySelector('[data-in=q]'); if (inp) { inp.focus(); try { inp.setSelectionRange(pos, pos); } catch (x) {} }
    } else if (k === 'decayAfter' || k === 'decayPct' || k === 'trimPad' || k === 'goalDay' || k === 'autoRev' || k === 'tHold' || k === 'boxW' || k === 'tDay' || k === 'tRuleN' || k === 'tRulePct') { S.d.settings[k] = +e.target.value; S.saveSettings(); App.render(); if (k === 'tRuleN') openSettings(); }
    else if (k === 'srt') { st.srt = e.target.value; st.sdir = 0; App.render(); }
    else if (k === 'sprd') { st.sprd = e.target.value; App.render(); }
    else if (k === 'fit' || k === 'trim') { S.d.settings[k] = e.target.value; S.saveSettings(); App.render(); }
  });
  document.addEventListener('click', function (e) { if (e.target.id === 'scrim') closeSheet(); });

  /* ---------------- Boot ---------------- */
  S.load();
  App.render();
  Sync.init();
  // Reopen the page after a reload (e.g. Update app) with the same swipe scope as before, not the free mushaf.
  if (location.hash.match(/^#p\d+$/)) {
    var p0 = +location.hash.slice(2), lk = S.d.last && S.kp(S.d.last.k) === p0 ? S.d.last.k : S.uk(p0), sc0 = scope(lk);
    history.replaceState(null, '', location.pathname); Reader.open(p0, S.kn(lk), sc0 && sc0.rg, sc0 && sc0.tag);
  }
  if ('serviceWorker' in navigator) {
    var hadSW = !!navigator.serviceWorker.controller, reloaded = false;
    // When a newer build takes over, reload once so the new code is used straight away.
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (hadSW && !reloaded) { reloaded = true; location.reload(); } });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) { reg.update(); setTimeout(App.precache, 3000); }).catch(function () {});
  }
})();
