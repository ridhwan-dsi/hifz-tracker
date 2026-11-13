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
    inst: I('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'),
    bmk: I('<path d="M6.5 3h11v18l-5.5-4.2L6.5 21z"/>'),
    book: I('<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>'),
    // v123: Memorization mode icon (brain); Recitation mode uses the open-book 'read' icon.
    mem: I('<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3 3 3 0 0 0 3-1.2V5.2A3 3 0 0 0 9 4zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3 3 3 0 0 1-3-1.2V5.2A3 3 0 0 1 15 4z"/>'),
    read: I('<path d="M2 5.5C4.5 4.3 7.5 4.3 12 6c4.5-1.7 7.5-1.7 10-.5v13c-2.5-1.2-5.5-1.2-10 .5-4.5-1.7-7.5-1.7-10-.5zM12 6v13.5"/>'),
    check: I('<path d="M20 6L9 17l-5-5"/>'), pen: I('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'), play: I('<path d="M6 4l14 8-14 8z"/>')
  };
  var BUILTIN = [{ id: 'new', name: 'New' }, { id: 'review', name: 'Review' }];
  /* Each custom tag belongs to one sub-tab (t.s); older tags without one sit under Review. */
  function tagSub(t) { return t.s === 'new' ? 'new' : 'review'; }
  function subOf(k) { return S.hasTag(k, 'new') ? 'new' : 'review'; }
  function subTags(sb) { return S.d.tags.filter(function (t) { return tagSub(t) === sb; }); }
  /* v121 (SL7): archived tags (t.a) are hidden everywhere unless Settings → Show archived tags is on; then they sit greyed at the end. */
  function showArch() { return !!S.d.settings.showArch; }
  function liveTags(sb) { return subTags(sb).filter(function (t) { return !t.a; }); }
  function archTags(sb) { return showArch() ? subTags(sb).filter(function (t) { return t.a; }) : []; }
  /* Tags offered for a page: New, Review, then the custom tags of that page's sub-tab (all of them if no page). */
  function allTags(k) { return BUILTIN.concat(k ? liveTags(subOf(k)) : S.d.tags.filter(function (t) { return !t.a; })); }
  function tagBorn(t) { var n = parseInt(String(t.id).slice(1), 36); return isNaN(n) ? 0 : n; }
  function byOpened(a) { return a.slice().sort(function (x, y) { return (y.o || tagBorn(y)) - (x.o || tagBorn(x)); }); }
  /* The custom tag the Memorizing tab is filtered to (null for New / Review / All). */
  function ctag() { var sb = sub(), c = (S.d.ui.cts || {})[sb]; return c && c !== 'all' ? subTags(sb).filter(function (t) { return t.id === c && (!t.a || showArch()); })[0] || null : null; }
  /* Memorizing sub-tab: 'new' (tagged New) or 'review' (everything else). Old single-chip state carries over once. */
  function sub() {
    var u = S.d.ui;
    if (!u.sub) { var c = (u.chips || [])[0]; u.sub = c === 'new' ? 'new' : 'review'; u.cts = { new: 'all', review: c && c !== 'new' && c !== 'review' ? c : 'all' }; }
    if (!u.cts) u.cts = { new: 'all', review: u.ct || 'all' };
    return u.sub;
  }
  /* Local date the tag was created; counts "in this tag" run from here. */
  function tagSince(t) { if (t.c) return t.c; var d = new Date(tagBorn(t)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  var st = { view: 'home', exp: { mem: {}, tom: {}, rec: {}, juz: {} }, edit: false, tedit: null, sel: {}, q: '', sf: 'all', srt: 'page', sdir: 0, sprd: 'all', ssel: {}, month: null, stab: 'rep', rp: 'day', ra: null, cal: null, cday: null, sper: 'all' };

  /* v133: the look (New/Classic design + new colour mode) belongs to this phone, not the synced data. */
  var NTHEMES = [['mushafw', 'Mushaf White', '#ffffff', '#e1ede0', '#278a3d'], ['mushaf', 'Mushaf', '#edf2e6', '#cfdcbf', '#2f8a3c'], ['midnight', 'Midnight', '#07090d', '#1a2029', '#3ba7ff'], ['emerald', 'Emerald', '#05100c', '#15291f', '#d9b25a'], ['dusk', 'Dusk', '#0d0a14', '#221a33', '#b68cff'], ['sand', 'Sand', '#f5efe3', '#e3d7c0', '#b4612a'], ['cgreen', 'Classic Green', '#111513', '#2a332e', '#4cbf8a']];
  function look() { var L = {}; try { L = JSON.parse(localStorage.getItem('hifz.look')) || {}; } catch (e) {} return { ui: L.ui === 'classic' ? 'classic' : 'new', nt: NTHEMES.some(function (t) { return t[0] === L.nt; }) ? L.nt : 'mushafw', rb: ['white', 'black'].indexOf(L.rb) >= 0 ? L.rb : 'theme' }; }
  function setLook(k, v) { var L = look(); L[k] = v; try { localStorage.setItem('hifz.look', JSON.stringify(L)); } catch (e) {} }

  var App = {
    dialog: function (o, cb) { dialog(o, cb); }, dialogClose: function () { if (dlg) endDlg(false); },
    esc: esc, ICON: ICON, tagSince: tagSince, sPages: sPages, onPage: onPage, pageTitle: pageTitle, hcol: hcol, allTags: allTags,
    render: function () {
      var lk = look(), de = document.documentElement;
      de.dataset.ui = lk.ui; de.dataset.rb = lk.rb; de.dataset.theme = lk.ui === 'new' ? lk.nt : S.d.settings.theme;
      var meta = document.querySelector('meta[name=theme-color]');
      if (meta) meta.content = getComputedStyle(de).getPropertyValue(lk.ui === 'new' ? '--bg' : '--acc').trim() || '#1f7a52';
      document.body.classList.toggle('web', S.d.settings.view === 'web' && innerWidth >= 1000);
      $('#app').innerHTML = st.view === 'stats' ? stats() + (NU() ? bnav() : '') : home() + (NU() && isRec() ? bnav() : '');
      try { offUse(); } catch (e) {}
    },
    syncChanged: function () { var el = $('#syncChip'); if (el) el.outerHTML = syncChip(); if ($('#settingsSheet')) openSettings(); },
    toast: function (msg, undo, label, ms) {
      var t = $('#toast'); t.innerHTML = '<span>' + esc(msg) + '</span>' + (undo ? '<button id="toastUndo">' + esc(label || 'Undo') + '</button>' : '');
      t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('on'); }, ms || (undo ? 5000 : 2200));
      if (undo) $('#toastUndo').onclick = function () { undo(); t.classList.remove('on'); };
    },
    autoPages: function () { // pages always kept offline (Memorizing + neighbours, last page, Recitation bookmarks + 10)
      var set = {};
      Object.keys(S.d.pages).forEach(function (k) { if (S.d.pages[k].m) { var p = S.kp(k); set[p] = 1; if (p > 1) set[p - 1] = 1; if (p < 604) set[p + 1] = 1; } });
      if (S.d.last) set[S.d.last.p] = 1;
      // v131 (SL16): Recitation — every live tag's bookmark page and the next 10, plus the last page read, stay cached for offline reading.
      var add = function (p) { p = p | 0; if (!p) return; for (var i = 0; i <= 10 && p + i <= 604; i++) set[p + i] = 1; };
      ['def'].concat((S.d.rtags || []).filter(function (t) { return !t.a; }).map(function (t) { return t.id; })).forEach(function (id) { var b = S.d.rbm && S.d.rbm[id]; if (b && b.p) add(Math.min(b.p, 604)); });
      if (S.d.rlast && S.d.rlast.p) add(S.d.rlast.p);
      return set;
    },
    precache: function () {
      if (!navigator.serviceWorker || !navigator.serviceWorker.controller) return;
      var set = App.autoPages();
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
    // v131 (SL27/SL17): green "Synced" when nothing is waiting; "Not synced" while changes wait (offline or token expired) — they go up on the next tap online.
    var wait = S.d.acct && S.dirty && s !== 'syncing' && s !== 'error';
    var label = !cid ? 'Local only' : !S.d.acct ? 'Sign in' : s === 'syncing' ? 'Syncing…' : s === 'error' ? 'Sync error' : wait ? 'Not synced' : 'Synced';
    var cls = s === 'error' ? 'err' : wait ? 'paused' : s === 'syncing' ? '' : S.d.acct ? 'ok' : '';
    return '<button id="syncChip" class="sync ' + cls + '" data-act="syncChip">' + label + '</button>';
  }

  /* ---------------- Home ---------------- */
  /* v116: two separate modes. Memorization (tabs Memorizing / To Memorize) and Recitation (Surah / Juz):
     Recitation has its own time and last page; nothing crosses over. The book button flips between them. */
  function isRec() { return S.d.ui.mode === 'rec'; }
  function header() {
    var rec = isRec();
    return '<header class="top"><div class="brand"><span class="dot">' + ICON.book + '</span>' + (rec ? 'Recitation' : 'Hifz Tracker') + '</div>' + syncChip() +
      '<button class="ib" data-act="stats" aria-label="Stats">' + ICON.stats + '</button>' +
      '<button class="ib modesw" data-act="mode" aria-label="' + (rec ? 'Recitation mode · tap for Memorization' : 'Memorization mode · tap for Recitation') + '" title="' + (rec ? 'Recitation mode' : 'Memorization mode') + '">' + (rec ? ICON.read : ICON.mem) + '</button>' +
      '<button class="ib" data-act="settings" aria-label="Settings">' + ICON.gear + '</button>' + viewSw() + '</header>';
  }
  /* ---------- v136 New design: header, Continue card, surah badges, page tiles, bottom navigation ---------- */
  function NU() { return document.documentElement.dataset.ui === 'new'; }
  function badge(n, big) { var hu = (n * 47) % 360; return '<span class="sbadge' + (big ? ' big' : '') + (SUR[n - 1][1].length > 6 ? ' lng' : '') + '" style="--h1:hsl(' + hu + ' 42% 34%);--h2:hsl(' + ((hu + 40) % 360) + ' 48% 20%)"><span class="ar">' + esc(SUR[n - 1][1]) + '</span>' + (big ? '<span class="en">' + esc(SUR[n - 1][0]) + '</span>' : '') + '</span>'; }
  function avgH(ks) { if (!ks.length) return 0; var t = 0; ks.forEach(function (k) { t += S.health(k); }); return Math.round(t / ks.length); }
  function lastOf(ks) { var l = null; ks.forEach(function (k) { var d = S.lastActive(k); if (d && (!l || d > l)) l = d; }); return l; }
  function ring(f) { var r = 9, c = 2 * Math.PI * r; return '<svg class="sring" viewBox="0 0 24 24"><circle cx="12" cy="12" r="' + r + '"/>' + (f >= 1 ? '<circle class="full" cx="12" cy="12" r="' + r + '"/><path class="tk" d="M8 12.3l2.6 2.6L16 9.5"/>' : f > 0 ? '<circle class="arc" cx="12" cy="12" r="' + r + '" stroke-dasharray="' + (c * f).toFixed(1) + ' ' + c.toFixed(1) + '"/>' : '') + '</svg>'; }
  function nuHeader() {
    var rec = isRec(), d = S.d, t = st.view === 'stats' ? (rec ? 'Recitation stats' : 'Stats') : rec ? 'Recitation' : d.ui.tab === 'tom' ? 'To Memorize' : 'Memorizing';
    return '<header class="nhd"><div class="t"><small>As-salāmu ʿalaykum · ' + syncChip() + '</small><h1>' + t + '</h1></div>' +
      '<button class="ib modesw" data-act="mode" aria-label="' + (rec ? 'Recitation mode · tap for Memorization' : 'Memorization mode · tap for Recitation') + '" title="' + (rec ? 'Recitation mode' : 'Memorization mode') + '">' + (rec ? ICON.read : ICON.mem) + '</button>' + viewSw() + '</header>';
  }
  function bnav() {
    var d = S.d, sv = st.view === 'stats', it;
    if (isRec()) { var rt = d.ui.rtab === 'juz' ? 'juz' : d.ui.rtab === 'bm' ? 'bm' : 'sur'; it = [['sur', 'Surah', ICON.book], ['juz', 'Juz', ICON.read], ['bm', 'Reading log', ICON.bmk], ['stats', 'Stats', ICON.stats], ['set', 'Settings', ICON.gear]].map(function (x) { return x.concat([!sv && x[0] === rt || sv && x[0] === 'stats']); }); }
    else it = [['mem', 'Memorizing', ICON.mem], ['tom', 'To Memorize', ICON.book], ['stats', 'Stats', ICON.stats], ['set', 'Settings', ICON.gear]].map(function (x) { return x.concat([sv ? x[0] === 'stats' : x[0] === (d.ui.tab === 'tom' ? 'tom' : 'mem')]); });
    return '<nav class="bnav">' + it.map(function (x) { return '<button class="' + (x[3] ? 'on' : '') + '" data-act="nav" data-t="' + x[0] + '">' + x[2] + '<span>' + x[1] + '</span></button>'; }).join('') + '</nav>';
  }
  function nuCont() {
    var d = S.d; if (!d.last || !d.last.p) return '';
    var lp = d.last.p, lk = d.last.k || S.uk(lp), n = S.kn(lk);
    if (d.ui.contMin) return '<div class="ncont min"><button class="go" data-act="open" data-p="' + lk + '">' + ICON.play + '<b>' + esc(SUR[n - 1][0]) + '</b> · P. ' + lp + '</button><button class="ib" data-act="contMin" aria-label="Expand">' + ICON.chev + '</button></div>';
    var mem = units(n).filter(function (k) { return S.isMem(k); }), i = mem.indexOf(lk), hh = S.health(lk), la = S.lastActive(lk);
    var line = (S.isMem(lk) ? (subOf(lk) === 'new' ? 'New' : 'Review') + ' · health ' + hh + '%' : 'Not in Memorizing') + ' · ' + (la ? 'read ' + ago(la) : 'not read yet');
    var h = '<div class="ncont"><div class="lab"><span>CONTINUE WHERE YOU LEFT OFF</span><button class="ib" data-act="contMin" aria-label="Minimise">' + ICON.chev + '</button></div>' +
      '<div class="hrow">' + badge(n, true) + '<div class="tx"><h2>' + esc(SUR[n - 1][0]) + ' · P. ' + lp + '</h2><p>' + line + '</p></div></div>';
    if (i >= 0 && mem.length > 1) {
      h += '<div class="segb">' + mem.slice(0, 24).map(function (k, j) { return '<i class="' + (j < i ? 'f' : j === i ? 'c' : '') + '" style="--hc:' + hcol(S.health(k)) + '"></i>'; }).join('') + '</div>' +
        '<div class="meta2"><span>Page ' + (i + 1) + ' of ' + mem.length + ' in ' + esc(SUR[n - 1][0]) + '</span><span>avg health ' + avgH(mem) + '%</span></div>';
    }
    return h + '<button class="pbtn" data-act="open" data-p="' + lk + '" aria-label="Continue">' + ICON.play + '</button></div>';
  }
  function tiles(n, ks, act, sel, extra) {
    var lk = S.d.last && (S.d.last.k || S.uk(S.d.last.p)), all = st.more && st.more[n], sh = all || ks.length <= 18 ? ks : ks.slice(0, 18);
    return '<div class="tiles">' + sh.map(function (k) {
      var hh = S.health(k), m = S.isMem(k), on = sel ? sel(k) : m;
      return '<button class="tl' + (k === lk ? ' cur' : '') + (sel && on ? ' on' : '') + (!sel && act !== 'open' ? '' : '') + (!m ? ' off' : '') + '" data-act="' + act + '" data-k="' + (act === 'open' && !S.isMem(k) ? 'tom' : 'mem') + '" data-p="' + k + '">' +
        (sel && on ? '<em>' + ICON.check + '</em>' : '') + '<small>P.</small><b>' + S.kp(k) + '</b><i style="background:' + (m ? hcol(hh) : 'transparent') + ';width:' + (m ? Math.max(hh, 8) : 0) + '%"></i></button>';
    }).join('') + (sh.length < ks.length ? '<button class="tl more" data-act="more" data-n="' + n + '">Show all<b>' + ks.length + '</b></button>' : '') + (extra || '') + '</div>';
  }
  function nuSrow(n, act, ks, right, sub2, open, k2, pre) {
    var s = SUR[n - 1];
    return '<div class="nrow"' + (k2 === 'tom' ? ' id="s' + n + '"' : '') + '>' + (pre || '') + '<button class="sname" data-act="' + act + '" data-n="' + n + '" data-k="' + k2 + '">' + badge(n) + '<span class="tx"><span class="nm">' + esc(s[0]) + ' <span class="num">' + n + '</span></span><span class="sub">' + sub2 + '</span></span></button>' +
      (right || '') + '<button class="exp ' + (open ? 'open' : '') + '" data-act="exp" data-k="' + k2 + '" data-n="' + n + '" aria-label="Pages">' + ICON.chev + '</button></div>';
  }
  function rtag() { var t = S.rtag(S.d.ui.rtag || 'def'); return t.a && !showArch() ? 'def' : t.id; }
  function recHome() {
    var d = S.d, h = NU() ? nuHeader() : header(), rl = d.rlast;
    var rt = rtag(), bm = S.bm(rt);
    // v119 (SL6): tags — Main plus his own readings (e.g. a Ramadan khatm), each with its own bookmark, log and stats.
    var rts = S.rtags(), rlist = rts.filter(function (t) { return !t.a; }).concat(showArch() ? rts.filter(function (t) { return t.a; }) : []);
    h += '<div class="chips">' + rlist.map(function (t) {
      return '<button class="chip ' + (t.id === rt ? 'on' : '') + (t.a ? ' arch' : '') + (t.done ? ' done' : '') + '" data-act="rchip" data-t="' + esc(t.id) + '"' + (t.id === 'def' ? ' data-long="rmain"' : ' data-long="rtag"') + '>' + esc(t.name) + '</button>';
    }).join('') + '<button class="chip add" data-act="raddTag">+ Tag</button></div>';
    // v117: Continue (last page read) and the bookmark (where the reading really stands) side by side.
    if ((rl && rl.p) || bm.p) h += '<div class="rconts">' + (rl && rl.p ? '<div class="cont min"><button class="go" data-act="ropen" data-p="' + rl.p + '" data-n="' + (rl.n || 0) + '">' + ICON.play + ' Continue · ' + esc(SUR[(rl.n || onPage(rl.p)[0]) - 1][0]) + ' · P. ' + rl.p + '</button></div>' : '') +
      (bm.p && !(rl && rl.p === bm.p) ? '<div class="cont min bmc"><button class="go" data-act="ropen" data-p="' + Math.min(604, bm.p) + '" data-n="' + (bm.p > 604 ? 114 : bm.n || 0) + '">' + ICON.bmk + (bm.p > 604 ? ' Completed' : ' P. ' + bm.p) + '</button></div>' : '') + '</div>';
    // v128 (SL11): with a target date, today's set shows on the home too.
    var pl = S.plan(rt);
    if (pl) h += '<div class="rhplan">' + (pl.passed ? '<b>Target date passed</b> · ' + pl.left + ' pages left' :
      pl.done ? '<b class="ok">' + ICON.check + ' Today\'s P. ' + pl.s0 + '–' + pl.e0 + ' done</b>' + (pl.next ? ' · next P. ' + pl.next.a + '–' + pl.next.b : '') :
      '<b>Today:</b> P. ' + pl.s0 + '–' + pl.e0 + ' · ' + pl.q + ' page' + (pl.q === 1 ? '' : 's') + ' · ' + pl.dl + ' day' + (pl.dl === 1 ? '' : 's') + ' left') + '</div>';
    var t = d.ui.rtab === 'juz' ? 'juz' : d.ui.rtab === 'bm' ? 'bm' : 'sur';
    h += '<nav class="tabs"><button class="' + (t === 'sur' ? 'on' : '') + '" data-act="rtab" data-t="sur">Surah</button><button class="' + (t === 'juz' ? 'on' : '') + '" data-act="rtab" data-t="juz">Juz</button><button class="' + (t === 'bm' ? 'on' : '') + '" data-act="rtab" data-t="bm">Reading log</button></nav>';
    return h + (t === 'juz' ? juzTab() : t === 'bm' ? bmTab() : recSurTab());
  }
  /* v125 Reading log (was Bookmarks): one row per reading day, newest first — Start = the bookmark the day began from
     (the previous day's last bookmark, or the tag's start page), End = the page before the day's last bookmark,
     Total = pages read that day (same figure as Stats, including a hand-corrected day). A completion (605) ends at 604. */
  function bmTab() {
    var tg = rtag(), t = S.rtag(tg), rr = S.rread(tg).days, log = S.rlog(tg);
    if (!log.length) return '<div class="list"><div class="empty">No readings yet. In the reader, tap ' + ICON.bmk + ' Bookmark to mark where you stopped.</div></div>';
    var byDay = {}, order = [];
    log.forEach(function (e) { var d = new Date(e[0]), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); if (!byDay[k]) { byDay[k] = []; order.push(k); } byDay[k].push(e); });
    var prev = t.start || log[0][1], reset = false, days = [];
    order.forEach(function (k) {
      var from = reset ? 0 : prev, last = null, fin = false;
      byDay[k].forEach(function (e) {
        if (reset) { prev = e[1]; reset = false; if (!fin) from = e[1]; return; }
        if (e[1] >= 605) { fin = true; last = 605; prev = 605; reset = true; return; }
        last = e[1]; prev = e[1];
      });
      days.push({ k: k, from: from, last: last, fin: fin, r: rr[k] || { pg: 0 } });
    });
    var cell = function (p) { return p ? '<button class="rlc pg" data-act="ropen" data-p="' + p + '" data-n="' + onPage(p)[0] + '">P. ' + p + '</button>' : '<span class="rlc">—</span>'; };
    var rows = '<div class="rlrow rlhd"><span class="rlc">Start page</span><span class="rlc">End page</span><span class="rlc">Total read</span></div>';
    days.reverse().forEach(function (x) {
      var dt = new Date(x.k + 'T12:00:00'), day = dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: dt.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
      var end = x.last == null ? 0 : Math.min(604, x.last - 1), pg = x.r.pg || 0, ok = end >= x.from && pg > 0;
      rows += '<div class="divider">' + esc(day) + (x.fin ? ' · Completed' : '') + '</div>';
      rows += '<div class="rlrow">' + cell(x.from && x.from <= 604 ? x.from : 0) + (ok ? cell(end) : '<span class="rlc">—</span>') +
        '<span class="rlc tot">' + pg + (pg === 1 ? ' page' : ' pages') + (x.r.ed ? ' <i>edited</i>' : '') + '</span></div>';
    });
    return '<div class="list">' + rows + '</div>';
  }
  /* v128 (SL13) Recitation TOC inside a reading: read pages are hidden (only what's left of this reading shows), one
     Expand all control, and with a target date a "Daily sections" switch that groups what's left by the day it is
     planned for — a dated divider per day, then the surahs (or juz) that day covers with that day's pages only.
     "Show read" brings the whole mushaf back. */
  function rview() {
    var tg = rtag(), t = S.rtag(tg), b = S.bm(tg), pl = S.plan(tg), q = !!st.q.trim();
    var cur = b.p > 0 ? Math.min(b.p, 605) : (t.start || 1), hide = !S.d.ui.rshowRead && !q && cur > 1;
    return { cur: hide ? cur : 1, hide: hide, pl: pl, daily: !!(S.d.ui.rdaily && pl && !pl.passed && !q) };
  }
  function rtocBar(v, k, keys) {
    var E = st.exp[k], isAll = keys.length && keys.every(function (x) { return E[x]; });
    return '<div class="rtoc"><button class="chip' + (isAll ? ' on' : '') + '" data-act="rexpAll" data-k="' + k + '" data-keys="' + keys.join(',') + '">' + (isAll ? 'Collapse all' : 'Expand all') + '</button>' +
      '<button class="chip' + (S.d.ui.rshowRead ? ' on' : '') + '" data-act="rshowRead">Show read</button>' +
      (v.pl && !v.pl.passed ? '<button class="chip' + (S.d.ui.rdaily ? ' on' : '') + '" data-act="rdaily">Daily sections</button>' : '') + '</div>';
  }
  function rchips(ps, n) { return ps.map(function (p) { return '<button class="pl" data-act="ropen" data-p="' + p + '"' + (n ? ' data-n="' + n + '"' : '') + '>P. ' + p + '</button>'; }).join(''); }
  function rrow(k, key, n, num, nm, sub, ar, ps, force) {
    var open = st.exp[k][key] || force;
    return '<div class="srow"><button class="sname" data-act="ropen" data-p="' + ps[0] + '" data-n="' + n + '"><span class="num">' + num + '</span><span class="nm">' + esc(nm) + '</span>' + (sub ? '<span class="jsub">' + sub + '</span>' : '') + (ar ? '<span class="ar">' + esc(ar) + '</span>' : '') + '</button>' +
      '<button class="exp ' + (open ? 'open' : '') + '" data-act="exp" data-k="' + k + '" data-n="' + key + '" aria-label="Pages">' + ICON.chev + '</button></div>' +
      (open ? '<div class="pages">' + rchips(ps, k === 'rec' ? n : 0) + '</div>' : '');
  }
  function pgRange(ps) { return ps.length === 1 ? 'P. ' + ps[0] : 'P. ' + ps[0] + '–' + ps[ps.length - 1]; }
  // Daily sections: one divider per planned day, then the surahs / juz that fall in it, each with that day's pages.
  function rdailyList(v, k) {
    var rows = '', keys = [];
    v.pl.secs.forEach(function (x, i) {
      var a = Math.max(x.a, v.cur); if (a > x.b) return;
      var dt = new Date(x.d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
      rows += '<div class="divider dsec">' + (i === 0 ? 'Today · ' : '') + esc(dt) + ' · ' + pgRange([x.a, x.b].filter(function (p, j) { return !j || p !== x.a; })) + ' · ' + (x.b - x.a + 1) + ' pages</div>';
      if (k === 'rec') SUR.forEach(function (s, si) {
        var n = si + 1, ps = sPages(n).filter(function (p) { return p >= a && p <= x.b; }); if (!ps.length) return;
        var key = i + '_' + n; keys.push(key); rows += rrow('rec', key, n, n, s[0], pgRange(ps), '', ps);
      });
      else QURAN.J.forEach(function (p0, ji) {
        var j = ji + 1, p1 = j < 30 ? QURAN.J[ji + 1] - 1 : 604, ps = []; for (var p = Math.max(p0, a); p <= Math.min(p1, x.b); p++) ps.push(p); if (!ps.length) return;
        var key = i + '_' + j; keys.push(key); rows += rrow('juz', key, onPage(ps[0])[0], j, 'Juz ' + j, pgRange(ps), '', ps);
      });
    });
    return rtocBar(v, k, keys) + '<div class="list">' + (rows || '<div class="empty">Every page of this reading is read.</div>') + '</div>';
  }
  function recSurTab() {
    var q = st.q.trim().toLowerCase(), rows = '', lastJ = 0, v = rview(), keys = [];
    var h = '<div class="bar"><input type="search" placeholder="Search surah, number or page" value="' + esc(st.q) + '" data-in="q"></div>';
    if (v.daily) return h + rdailyList(v, 'rec');
    SUR.forEach(function (s, i) {
      var n = i + 1;
      if (q && !(String(n) === q || s[0].toLowerCase().indexOf(q) >= 0 || s[1].indexOf(st.q.trim()) >= 0 || (+q >= s[3] && +q <= s[4]))) return;
      var ps = sPages(n).filter(function (p) { return p >= v.cur; }); if (!ps.length) return; keys.push(String(n));
      var j = juzOf(ps[0]);
      if (!q && j !== lastJ) { rows += '<div class="divider">Juz ' + j + '</div>'; lastJ = j; }
      rows += rrow('rec', n, n, n, s[0], ps[0] > s[3] ? 'from P. ' + ps[0] : '', s[1], ps, q && +q >= s[3] && +q <= s[4]);
    });
    return h + rtocBar(v, 'rec', keys) + '<div class="list">' + (rows || '<div class="empty">' + (v.hide && !q ? 'Every page of this reading is read.' : 'No surah matches.') + '</div>') + '</div>';
  }
  function juzTab() {
    var rows = '', v = rview(), keys = [];
    if (v.daily) return rdailyList(v, 'juz');
    QURAN.J.forEach(function (p0, i) {
      var j = i + 1, p1 = j < 30 ? QURAN.J[i + 1] - 1 : 604, a = QURAN.JA[i];
      var s0 = Math.max(p0, v.cur); if (s0 > p1) return; keys.push(String(j));
      var ps = []; for (var p = s0; p <= p1; p++) ps.push(p);
      // In this mushaf every juz begins at the top of a page, so a juz runs up to the page before the next one.
      rows += rrow('juz', j, s0 === p0 ? a[0] : onPage(s0)[0], j, 'Juz ' + j, s0 === p0 ? esc(SUR[a[0] - 1][0]) + ' ' + a[0] + ':' + a[1] + ' · P. ' + p0 : 'from P. ' + s0 + ' · ' + (p1 - s0 + 1) + ' left', '', ps);
    });
    return rtocBar(v, 'juz', keys) + '<div class="list">' + (rows || '<div class="empty">Every page of this reading is read.</div>') + '</div>';
  }
  function tagFields(start, target, noStart, daily, from) {
    return '<div class="dflds">' + (noStart ? '' : '<label>Start page<input class="dinp" data-f="start" inputmode="numeric" value="' + start + '"></label>') +
      dailyField(daily, from) + '<label>Target date <span class="muted">(optional)</span><input class="dinp" type="date" data-f="target" value="' + esc(target) + '"></label></div>';
  }
  /* v139: his own daily pages for a reading (used by the reader's "Daily pages" strip mode). "Work out date" fills the
     target date from the pages left at that pace — only a suggestion; the target date stays his to change. */
  function dailyField(daily, from) {
    return '<label>Daily pages <span class="muted">(optional)</span><span class="drow"><input class="dinp" data-f="daily" inputmode="numeric" value="' + (daily > 0 ? daily : '') + '" placeholder="e.g. 7">' +
      '<button class="btn sm" type="button" data-calc="1"' + (from ? ' data-from="' + from + '"' : '') + '>Work out date</button></span><span class="dnote" id="dnote"></span></label>';
  }
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-calc]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    var box = b.closest('.dflds'), q = function (k) { var i = box.querySelector('[data-f="' + k + '"]'); return i; };
    var n = parseInt(q('daily').value, 10), st = q('start'), from = b.dataset.from ? +b.dataset.from : parseInt(st && st.value, 10) || 1;
    var note = box.querySelector('#dnote');
    if (!(n > 0)) { if (note) note.textContent = 'Enter how many pages a day first'; return; }
    var days = Math.max(1, Math.ceil((605 - Math.min(604, Math.max(1, from))) / n)), d = new Date(); d.setDate(d.getDate() + days - 1);
    q('target').value = ymd(d);
    if (note) note.textContent = (605 - from) + ' pages left from P. ' + from + ' ÷ ' + n + ' a day = ' + days + ' day' + (days === 1 ? '' : 's') + '. Change the date if you like.';
  }, true);
  /* v119 (SL9) Recitation stats: pages and juz read per day / week / month / year, for one tag or all tags.
     Pages read on a day = that day's last bookmark minus the previous reading day's (S.rread). */
  function recStats() {
    var pd = st.rp, td = S.today(), a = st.ra || td, r = repRange(pd, a), s0 = r[0], s1 = r[1], all = st.rall, rt = rtag();
    var tags = all ? S.rtags() : [S.rtag(rt)], D = {};
    tags.forEach(function (t) { var dd = S.rread(t.id).days; for (var k in dd) { var q = D[k] || (D[k] = { pg: 0, jz: 0 }); q.pg += dd[k].pg; q.jz += dd[k].jz; if (dd[k].ed) q.ed = true; } });
    // v123 (SL8): completions (khatm) dated within the period.
    var NC = S.comps(all ? null : rt).filter(function (c) { return c.d >= s0 && c.d <= s1; }).length;
    var PG = 0, JZ = 0, ND = 0; for (var k in D) if (k >= s0 && k <= s1) { PG += D[k].pg; JZ += D[k].jz; if (D[k].pg) ND++; }
    var jf = function (j) { return j >= 10 ? Math.round(j) : Math.round(j * 10) / 10; };
    var h = NU() ? nuHeader() : '<header class="top"><button class="ib" data-act="home" aria-label="Back">' + ICON.back + '</button><div class="brand">Recitation stats</div>' + viewSw() + '</header>';
    h += '<div class="seg"><button class="' + (all ? '' : 'on') + '" data-act="rall" data-v="0">' + esc(S.rtag(rt).name) + '</button><button class="' + (all ? 'on' : '') + '" data-act="rall" data-v="1">All readings</button></div>';
    h += '<div class="seg mini" style="margin-top:4px">' + [['day', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly'], ['year', 'Yearly']].map(function (x) { return '<button class="' + (pd === x[0] ? 'on' : '') + '" data-act="rp" data-p="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
    if (pd === 'year' && hij(td)) h += '<div class="seg mini" style="margin-top:4px">' + [['cal', 'Calendar year'], ['ram', 'Ramadan to Ramadan']].map(function (x) { return '<button class="' + ((S.d.settings.ryear === 'ram') === (x[0] === 'ram') ? 'on' : '') + '" data-act="ryear" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
    var nxt = addD(s1, 1);
    h += '<div class="calhd"><button class="ib" data-act="ra" data-d="' + addD(s0, -1) + '" aria-label="Previous">' + ICON.back + '</button><b' + (r[2] ? ' class="small"' : '') + '>' + repLabel(pd, r) + '</b><button class="ib" data-act="ra" data-d="' + nxt + '" aria-label="Next"' + (nxt > td ? ' disabled style="opacity:.3"' : '') + '>' + ICON.fwd + '</button></div>';
    // v124 (SL10): in Daily view for one reading, the day's pages read can be corrected (marked "edited").
    var dE = pd === 'day' && !all && D[s0] && D[s0].ed, canEd = pd === 'day' && !all && s0 <= td;
    h += '<div class="cards"><div class="card' + (canEd ? '" data-act="redit" data-d="' + s0 + '" role="button' : '') + '"><div class="v">' + PG + (canEd ? ' <span class="edp">' + ICON.pen + '</span>' : '') + '</div><div class="k">Pages read' + (dE ? ' · edited' : '') + '</div></div><div class="card"><div class="v">' + jf(JZ) + '</div><div class="k">Juz read</div></div>' +
      (pd === 'day' ? '' : '<div class="card"><div class="v">' + ND + '</div><div class="k">Days read</div></div><div class="card"><div class="v">' + (ND ? Math.round(PG / ND) : 0) + '</div><div class="k">Pages per reading day</div></div>') +
      (NC || pd === 'year' ? '<div class="card"><div class="v">' + NC + '</div><div class="k">Completions</div></div>' : '') + '</div>';
    if (pd !== 'day') {
      var B = [];
      if (pd === 'year' && r[2]) { // v124: Ramadan cycle — one bar per Hijri month, Ramadan first
        var HM = ['Ram', 'Shw', 'DhQ', 'DhH', 'Muh', 'Saf', 'Rb1', 'Rb2', 'Jm1', 'Jm2', 'Raj', 'Sha'];
        for (var hd = s0, hb = null; hd <= s1; hd = addD(hd, 1)) { var hh = hij(addD(hd, -(+S.d.settings.ramAdj || 0))), hi = (hh.m + 3) % 12; if (!hb || hb.i !== hi) { hb = { i: hi, k: hd, e: hd, l: HM[hi], v: 0, rng: 1 }; B.push(hb); } hb.e = hd; }
      } else if (pd === 'year') for (var mi = 0; mi < 12; mi++) B.push({ k: s0.slice(0, 4) + '-' + String(mi + 1).padStart(2, '0'), l: 'JFMAMJJASOND'[mi], v: 0 });
      else for (var d = s0; d <= s1; d = addD(d, 1)) B.push({ k: d, l: pd === 'week' ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'narrow' }) : String(+d.slice(8)), v: 0 });
      for (var k2 in D) if (k2 >= s0 && k2 <= s1) { var bb = B.filter(function (x) { return x.rng ? k2 >= x.k && k2 <= x.e : k2.indexOf(x.k) === 0; })[0]; if (bb) bb.v += D[k2].pg; }
      var mx = Math.max.apply(null, B.map(function (x) { return x.v; }).concat([5]));
      h += '<div class="rbars' + (B.length > 12 ? ' dense' : '') + '">' + B.map(function (x) {
        var fut = (pd === 'year' && !x.rng ? x.k + '-01' : x.k) > td;
        return '<button class="rb' + (x.v ? ' on' : '') + '"' + (fut ? ' disabled' : x.rng ? ' data-act="rdrill" data-k="' + x.k.slice(0, 7) + '" data-r="' + x.k + '"' : ' data-act="rdrill" data-k="' + x.k + '"') + '><span class="rbv">' + (x.v || '') + '</span><i style="height:' + (x.v ? Math.max(4, x.v / mx * 100) : 0) + '%"></i><span class="rbl">' + x.l + '</span></button>';
      }).join('') + '</div><div class="small muted callg">Pages read per ' + (pd === 'year' ? 'month' : 'day') + '</div>';
    }
    // Every reading's progress from its bookmark.
    h += '<div class="bar" style="margin-top:14px"><b style="align-self:center">Readings</b></div><div class="list">' + S.rtags().map(function (t) {
      var b = S.bm(t.id), base = t.start || S.rread(t.id).base || 1, tot = 605 - base, pc = b.p && tot > 0 ? Math.round(Math.max(0, b.p - base) / tot * 100) : 0;
      return '<div class="prow"><button class="pl" data-act="rchipGo" data-t="' + esc(t.id) + '">' + esc(t.name) + '</button><div class="grow small">' + (t.done ? '<span class="donec">Completed ' + esc(t.done) + '</span>' : b.p ? 'Bookmark P. ' + b.p : 'No bookmark yet') + (t.id === 'def' && S.comps('def').length ? '<br><span class="donec">' + S.comps('def').length + '× completed</span>' : '') +
        (t.target ? '<br><span class="muted">Target ' + esc(t.target) + '</span>' : '') + '</div><div style="text-align:right"><b>' + pc + '%</b></div></div>';
    }).join('') + '</div>';
    return h;
  }
  function home() {
    if (isRec()) return recHome();
    var d = S.d, h = header();
    if (NU()) { h = nuHeader() + nuCont(); h += d.ui.tab === 'mem' ? memTab() : tomTab(); return h + bnav(); }
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
    h += '<div class="chips"><button class="chip ' + (!ct ? 'on' : '') + '" data-act="chip" data-t="all">All</button>' + byOpened(liveTags(sb)).concat(byOpened(archTags(sb))).map(function (t) {
      return '<button class="chip ' + (ct && ct.id === t.id ? 'on' : '') + (t.a ? ' arch' : '') + '" data-act="chip" data-long="tag" data-t="' + esc(t.id) + '">' + esc(t.name) + '</button>';
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
      if (NU()) {
        var ah = avgH(pg), la = lastOf(pg);
        rows += nuSrow(n, 'openS', pg, '<span class="pct" style="color:' + hcol(ah) + '">' + ah + '%</span>', pg.length + ' page' + (pg.length === 1 ? '' : 's') + (la ? ' · read ' + ago(la) : ''), open, 'mem');
        if (open) rows += tiles(n, pg, 'open', null, '<button class="tl add" data-act="addPages" data-n="' + n + '">+ add<br>pages</button>');
        return;
      }
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
    if (NU()) h += '<div class="legend"><span><i style="background:var(--line)"></i>Not started</span><span><i style="background:var(--acc);opacity:.55"></i>Partly</span><span><i style="background:var(--acc)"></i>All pages</span></div>'; else
    h += '<div class="legend"><span><i style="background:var(--line)"></i>Not started</span><span><i style="background:var(--mid)"></i>Partly</span><span><i style="background:var(--acc)"></i>All pages</span></div>';
    SUR.forEach(function (s, i) {
      var n = i + 1;
      if (q && !(String(n) === q || s[0].toLowerCase().indexOf(q) >= 0 || s[1].indexOf(st.q.trim()) >= 0 || (+q >= s[3] && +q <= s[4]))) return;
      var j = juzOf(s[3]);
      if (!q && j !== lastJ) { rows += '<div class="divider">Juz ' + j + '</div>'; lastJ = j; }
      var pg = units(n), sel = pg.filter(function (p) { return S.isMem(p); }).length, frac = sel / pg.length;
      var mark = sel === 0 ? '' : '<span class="mark" style="background:' + (frac === 1 ? 'var(--acc)' : 'var(--mid)') + '"></span>';
      var open = st.exp.tom[n] || (q && +q >= s[3] && +q <= s[4]);
      if (NU()) {
        var tk = st.edit ? '<button class="tick ' + (frac === 1 ? 'on' : sel ? 'part' : '') + '" data-act="tickS" data-n="' + n + '" aria-label="Select surah">' + (frac === 1 ? ICON.check : '') + '</button>' : '';
        rows += nuSrow(n, st.edit ? 'tickS' : 'openS', pg, ring(frac), s[2] + ' ayahs · P. ' + s[3] + (s[4] > s[3] ? '–' + s[4] : '') + (sel ? ' · ' + (frac === 1 ? 'all pages' : sel + ' of ' + pg.length + ' pages') : ''), open, 'tom', tk);
        if (open) rows += tiles(n, pg, st.edit ? 'tickP' : 'open', st.edit ? function (k) { return S.isMem(k); } : null);
        return;
      }
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
  var dlg = null, dlgO = null;
  function dialog(o, cb) {
    var sc = document.getElementById('scrim'); dlg = cb; dlgO = o;
    var drg = o.input != null || /data-f=/.test(o.html || '');
    sc.innerHTML = '<div class="sheetm pbox' + (drg ? ' drg' : '') + '">' + (drg ? '<div class="dgrip" title="Drag to move"></div>' : '') + '<div class="pbt">' + esc(o.title) + '</div>' + (o.msg ? '<p class="small">' + o.msg + '</p>' : '') +
      (o.input != null ? '<input class="dinp" id="dinp" maxlength="40" enterkeyhint="done"' + (o.num ? ' inputmode="numeric"' : '') + ' value="' + esc(o.input) + '" autocomplete="off">' : '') +
      (o.html || '') + '<div class="pbtns' + (o.col ? ' col' : '') + '">' + (o.btns ? o.btns.map(function (b) { return '<button class="btn ' + (b[2] || '') + '" data-dg="' + b[0] + '">' + esc(b[1]) + '</button>'; }).join('') :
        '<button class="btn" data-dg="x">Cancel</button><button class="btn ' + (o.danger ? 'danger' : 'pri') + '" data-dg="ok">' + esc(o.ok) + '</button>') + '</div></div>';
    sc.classList.toggle('top', drg); sc.style.display = 'flex'; fitScrim(); if (drg) placeDlg();
    var inp = document.getElementById('dinp');
    if (inp) { setTimeout(function () { inp.focus(); inp.select(); }, 30); inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); endDlg(true); } }); }
  }
  /* v89: the on-screen keyboard overlays the page without resizing it, hiding the dialog buttons.
     Size the scrim to the visible area (visualViewport) so the sheet sits just above the keyboard. */
  function fitScrim() {
    var sc = document.getElementById('scrim'), vv = window.visualViewport;
    if (!vv || sc.style.display !== 'flex') return;
    sc.style.top = vv.offsetTop + 'px'; sc.style.bottom = 'auto'; sc.style.height = vv.height + 'px';
    placeDlg();
  }
  /* v129 (SL14): text-input dialogs have a grip; drag it to move the dialog up or down (e.g. just above the keyboard).
     The spot is remembered (px from the top of the visible area) and reused until moved again; kept fully on screen. */
  var DPK = 'hifz.dlgY', dlgY = null;
  try { var dy0 = localStorage.getItem(DPK); dlgY = dy0 == null ? null : +dy0; } catch (e) {}
  function placeDlg(y) {
    var sc = document.getElementById('scrim'), b = sc && sc.querySelector('.sheetm.drg'); if (!b) return;
    if (y == null) y = dlgY; if (y == null) { b.style.marginTop = ''; sc.classList.remove('moved'); return; }
    var max = Math.max(0, sc.clientHeight - b.offsetHeight - 6);
    sc.classList.add('moved'); b.style.marginTop = Math.max(6, Math.min(max, y)) + 'px';
  }
  document.addEventListener('pointerdown', function (e) {
    var g = e.target.closest && e.target.closest('.dgrip'); if (!g) return;
    e.preventDefault();
    var sc = document.getElementById('scrim'), b = g.parentNode, y0 = e.clientY, top0 = b.getBoundingClientRect().top - sc.getBoundingClientRect().top, y = top0;
    try { g.setPointerCapture(e.pointerId); } catch (er) {}
    function mv(ev) { y = top0 + ev.clientY - y0; placeDlg(y); }
    function up() {
      g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up);
      dlgY = parseFloat(b.style.marginTop) || 0; try { localStorage.setItem(DPK, dlgY); } catch (er) {}
    }
    g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
  }, true);
  if (window.visualViewport) { visualViewport.addEventListener('resize', fitScrim); visualViewport.addEventListener('scroll', fitScrim); }
  function endDlg(ok, id) {
    var sc = document.getElementById('scrim'), inp = document.getElementById('dinp'), v = inp ? inp.value : null, cb = dlg, o = dlgO || {}, f = {};
    Array.prototype.forEach.call(sc.querySelectorAll('[data-f]'), function (q) { f[q.dataset.f] = q.value; });
    if (!ok && o.always) { ok = true; id = id || 'x'; } // a question that must be answered: dismissing counts as the first button
    dlg = null; dlgO = null; sc.style.display = 'none'; sc.innerHTML = ''; sc.style.top = sc.style.height = sc.style.bottom = '';
    if (ok && cb) cb(v, id, f);
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
    var c = e.target.closest && e.target.closest('[data-long]'); if (!c) return;
    var x = e.clientX, y = e.clientY;
    lp = { c: c, x: x, y: y, t: setTimeout(function () {
      lp = null; lpFired = Date.now(); try { navigator.vibrate && navigator.vibrate(25); } catch (er) {}
      if (c.dataset.long === 'rtag') { ACT.rtagMenu(c); return; }
      if (c.dataset.long === 'rmain') { ACT.rmainStart(); return; }
      var id = c.dataset.t, t = S.d.tags.filter(function (q) { return q.id === id; })[0]; if (!t) return;
      dialog({ title: t.name, col: true, btns: t.a ? [['un', 'Unarchive', 'pri'], ['del', 'Delete', 'danger'], ['x', 'Cancel']] :
        [['ren', 'Rename', 'pri'], ['arc', 'Archive'], ['del', 'Delete', 'danger'], ['x', 'Cancel']] }, function (v, w) {
        if (w === 'ren') ACT.renTag(c); else if (w === 'del') ACT.delTag(c);
        else if (w === 'arc' || w === 'un') ACT.archTag(t, w === 'arc');
      });
    }, 550) };
  }, true);
  ['pointerup', 'pointercancel'].forEach(function (ev) { document.addEventListener(ev, function () { if (lp) { clearTimeout(lp.t); lp = null; } }, true); });
  document.addEventListener('pointermove', function (e) { if (lp && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 10) { clearTimeout(lp.t); lp = null; } }, true);
  document.addEventListener('click', function (e) { if (Date.now() - lpFired < 700 && e.target.closest && e.target.closest('[data-long]')) { e.stopPropagation(); e.preventDefault(); } }, true);
  document.addEventListener('contextmenu', function (e) { if (e.target.closest && e.target.closest('[data-long]')) e.preventDefault(); }, true);

  /* ---------------- Stats ---------------- */
  function stats() {
    if (isRec()) return recStats();
    var mem = Object.keys(S.d.pages).filter(function (k) { return S.d.pages[k].m; }).sort(byUnit);
    var m = S.month(), monthTotal = 0, all = 0, sumH = 0, months = {};
    Object.keys(S.d.pages).forEach(function (k) { var rv = S.d.pages[k].rv || {}; for (var mm in rv) { months[mm] = (months[mm] || 0) + rv[mm]; all += rv[mm]; if (mm === m) monthTotal += rv[mm]; } });
    mem.forEach(function (p) { sumH += S.health(p); });
    var h = NU() ? nuHeader() : '<header class="top"><button class="ib" data-act="home" aria-label="Back">' + ICON.back + '</button><div class="brand">Stats</div>' + viewSw() + '</header>';
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
  /* v124 (SL10) Ramadan cycle: from 1 Ramadan (Umm al-Qura calendar) to the day before the next 1 Ramadan,
     shifted by Settings → Ramadan start (−1 / 0 / +1 day) for local moon sighting. */
  var HF = null, RC = {};
  function hij(k) {
    try { HF = HF || new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { year: 'numeric', month: 'numeric', day: 'numeric' }); } catch (e) { return null; }
    var o = {}; HF.formatToParts(new Date(k + 'T12:00:00')).forEach(function (x) { o[x.type] = +x.value || x.value; }); return { y: parseInt(o.year, 10), m: o.month, d: o.day };
  }
  function ram1(hy) { // Gregorian date of 1 Ramadan of Hijri year hy (Umm al-Qura), cached
    if (RC[hy]) return RC[hy];
    var k = addD('1900-01-01', Math.round((hy + 8 / 12 - 1318.0) * 354.367)), h = hij(k), g = 0;
    if (!h) return null;
    while (!(h.y === hy && h.m === 9 && h.d === 1) && g++ < 120) { var dd = ((hy - h.y) * 12 + (9 - h.m)) * 29.5 + (1 - h.d); k = addD(k, Math.abs(dd) < 1 ? (dd < 0 ? -1 : 1) : Math.round(dd)); h = hij(k); }
    return (RC[hy] = k);
  }
  function ramRange(a) {
    var adj = +S.d.settings.ramAdj || 0, h = hij(addD(a, -adj)); if (!h) return null;
    var hy = h.m >= 9 ? h.y : h.y - 1, s = ram1(hy), e = ram1(hy + 1); if (!s || !e) return null;
    return [addD(s, adj), addD(e, adj - 1), hy];
  }
  function ramYear() { return st.rp === 'year' && S.d.settings.ryear === 'ram' && !!hij(S.today()); }
  function repRange(pd, a) {
    if (pd === 'year' && ramYear()) { var rr = ramRange(a); if (rr) return rr; }
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
    if (r[2]) return 'Ramadan ' + r[2] + ' AH · ' + f(r[0], { day: 'numeric', month: 'short', year: 'numeric' }) + ' – ' + f(r[1], { day: 'numeric', month: 'short', year: 'numeric' });
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
  /* v126 (SL20): names only — tapping a setting's name opens its help in a small drawer at the bottom of the sheet.
     Mode-specific: each mode shows only the settings that do something there (shared ones in both). */
  var SHELP = {
    acct: 'Your progress, boxes and lines are kept in your own Google Drive and synced across devices. Sign out to use the app on this device only.',
    theme: 'Colour of the app. Kept on this phone only, so each device can have its own.',
    readerBg: 'Colour of the space around the page in the reader (e.g. between the page and the drawer): Theme follows your colour mode, or pick plain White or Black. Saved on this phone.',
    design: 'New is the redesigned look; Classic is the earlier design, kept for now as a fallback. Your data and features are the same in both.',
    web: 'For laptops and big screens: a thin control bar across the bottom, page arrows at the sides, two facing pages. Off: the phone reader. Also on the switch beside Settings.',
    webTrim: 'Off: web view shows whole pages, like a printed mushaf.',
    fit: 'Whole page on screen, or fit the page width and scroll.',
    trim: 'Trims the white margins, measured separately for every page. Your own crops override it.',
    crop: 'Your default crop applies to every page you haven’t cropped yourself; Auto in a page’s Crop uses it. To make one, open Crop on a page, adjust it and tap “Set as default”. Restore goes back to the auto-trim.',
    pad: 'Extra space kept around the trimmed page.',
    tap: 'On: double-tap the page to hide or bring back the drawer. Off: a single tap hides it and the page number brings it back.',
    boxW: 'How wide a new box starts, as a share of the page width.',
    boxH: 'On: a box’s handles change only its width, so the height can’t shift by accident. Off: the corner handles change width and height.',
    cover: 'What covers the part of a page hidden by a section line. Paper is the default; White is how it used to look.',
    swipe: 'Swiping stays inside one surah. On: when the next surah in your list starts on the same or the next page (e.g. Faatir → Yaseen), swiping carries on into it.',
    decay: 'A page loses health when it isn’t reviewed: after the days you pick, then by the percentage each week.',
    goal: 'Minutes of stopwatch time a day across all pages. You get a note when you reach it.',
    tHold: 'How long to hold the counter until the ring closes and one read is counted.',
    tDay: 'Page reads a day (a page counts once all its sections are read).',
    tRule: 'Every so many reads of a page raises its health by the percentage you pick.',
    arch: 'Archived tags show greyed at the end of the tag row, in both modes. Long-press one to unarchive it. Tags are created with + Tag; long-press a tag to rename, archive or delete it.',
    ram: 'For the Ramadan-to-Ramadan year in Stats. Day 1 comes from the Umm al-Qura calendar; move it a day for local moon sighting.',
    main: 'Long-press Main on the Recitation home to set its start page and the day counting begins, so pages read elsewhere don’t count.',
    offline: 'Choose which tags (or the whole mushaf) are kept on this device for reading without internet, with their size before downloading. Pages you are memorizing and the next 10 pages of each reading are always kept. You can be reminded to free the pages of tags you stop opening.',
    share: 'Copies the app link. Each person signs in with their own Google account, so your data stays yours.',
    update: 'Clears the cached app files and reloads. Your data and offline pages are kept. The version beside the button shows which one you have.',
    install: 'Open the browser menu → “Install app” / “Add to Home screen” for full screen.'
  };
  function openSettings() {
    var s = S.d.settings, cid = Sync.cid(), rec = isRec();
    var nm = function (k, t) { return '<button class="slbl" data-act="shelp" data-h="' + k + '">' + t + '</button>'; };
    var row = function (k, t, ctl) { return '<div class="frow">' + nm(k, t) + (ctl || '') + '</div>'; };
    var sw = function (on, act) { return '<button class="sw ' + (on ? 'on' : '') + '" data-act="' + act + '"></button>'; };
    var sel = function (inp, vals, cur, lbl) { return '<select data-in="' + inp + '">' + vals.map(function (v) { var x = Array.isArray(v) ? v : [v, lbl(v)]; return '<option value="' + x[0] + '"' + (String(cur) === String(x[0]) ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>'; };
    var acct = !cid ? row('acct', 'Data on this device only')
      : S.d.acct ? '<div class="frow">' + nm('acct', esc(S.d.acct)) + '<span class="sst">' + (Sync.state === 'syncing' ? 'Syncing…' : Sync.state === 'error' ? 'Sync failed' : S.dirty ? 'Not synced — goes up on your next tap online' : 'Synced') + '</span><button class="btn sm" data-act="syncNow">Sync</button></div>' +
        '<div class="frow">' + nm('acct', 'Sign out') + '<button class="btn sm" data-act="signOut">Sign out</button></div>'
        : '<div class="frow">' + nm('acct', 'Google account') + '<button class="btn sm pri" data-act="signIn">Sign in</button></div>';
    var themes = [['green', '#1f7a52', 'Green'], ['blue', '#1d5ca6', 'Blue'], ['dark', '#111513', 'Dark']], lk = look();
    var ver = esc(((window.HIFZ_CONFIG || {}).appVersion || '—').split(' · ')[0]);
    var h = '<div class="sheetm sett" id="settingsSheet"><h3>Settings <span class="smode">' + (rec ? 'Recitation' : 'Memorization') + '</span></h3>' +
      '<h4>Account</h4>' + acct +
      '<h4>Appearance</h4>' + row('design', 'Design', '<div class="dsw">' + [['new', 'New'], ['classic', 'Classic']].map(function (d) { return '<button class="' + (lk.ui === d[0] ? 'on' : '') + '" data-act="design" data-d="' + d[0] + '">' + d[1] + '</button>'; }).join('') + '</div>') +
      (lk.ui === 'new'
        ? '<div class="frow lookblk">' + nm('theme', 'Colour mode') + '<div class="themes six">' + NTHEMES.map(function (t) { return '<button class="' + (lk.nt === t[0] ? 'on' : '') + '" data-act="ntheme" data-t="' + t[0] + '"><span class="sw3"><i style="background:' + t[2] + '"></i><i style="background:' + t[3] + '"></i><i style="background:' + t[4] + '"></i></span>' + t[1] + '</button>'; }).join('') + '</div></div>' +
          row('readerBg', 'Reader background', '<div class="dsw">' + [['theme', 'Theme'], ['white', 'White'], ['black', 'Black']].map(function (d) { return '<button class="' + (lk.rb === d[0] ? 'on' : '') + '" data-act="readerBg" data-d="' + d[0] + '">' + d[1] + '</button>'; }).join('') + '</div>')
        : '<div class="frow">' + nm('theme', 'Theme') + '<div class="themes">' + themes.map(function (t) { return '<button class="' + (s.theme === t[0] ? 'on' : '') + '" data-act="theme" data-t="' + t[0] + '"><span class="sq" style="background:' + t[1] + '"></span>' + t[2] + '</button>'; }).join('') + '</div></div>') +
      '<h4>Page display</h4>' +
      (innerWidth >= 1000 ? row('web', 'Web view', sw(s.view === 'web', 'webView')) + row('webTrim', 'Trim margins in web view', sw(s.webTrim, 'webTrim')) : '') +
      row('fit', 'Show pages', sel('fit', [['page', 'Whole page'], ['width', 'Fit width']], s.fit === 'width' ? 'width' : 'page')) +
      row('trim', 'Auto-trim', sel('trim', [['full', 'Keep header'], ['frame', 'Frame only'], ['off', 'Off']], s.trim || 'full')) +
      row('crop', 'Default crop', s.cropDef ? '<span class="sst">P. ' + s.cropDef.p + '</span><button class="btn sm" data-act="cropRestore">Restore</button>' : '<span class="sst">Auto-trim</span>') +
      row('pad', 'Extra margin', sel('trimPad', [0, 0.01, 0.02, 0.03], [0, 0.01, 0.02, 0.03].filter(function (v) { return Math.abs((s.trimPad == null ? 0.01 : s.trimPad) - v) < 0.001; })[0], function (v) { return (v * 100) + '%'; })) +
      row('tap', 'Double-tap for drawer', sw(s.tapShow, 'tapShow'));
    if (!rec) h += '<h4>Boxes &amp; lines</h4>' +
      row('boxW', 'New box width', sel('boxW', [8, 11, 15, 20, 25, 34, 50], +s.boxW || 11, function (v) { return v + '%'; })) +
      row('boxH', 'Lock box height', sw(s.boxHLock !== false, 'boxHLock')) +
      '<div class="frow">' + nm('cover', 'Hidden area') + '<div class="rrow">' + [['#f3e9d4', 'Paper'], ['#ffffff', 'White'], ['#fbf6e9', 'Cream'], ['#e9ecea', 'Grey']].map(function (c) { return '<button class="sw-c ' + ((s.hideCol || '#f3e9d4') === c[0] ? 'on' : '') + '" style="background:' + c[0] + '" data-act="cover" data-c="' + c[0] + '" aria-label="' + c[1] + '" title="' + c[1] + '"></button>'; }).join('') + '</div></div>' +
      '<h4>Reading</h4>' + row('swipe', 'Swipe into next surah', sw(s.swipeSur !== false, 'swipeSur')) +
      row('goal', 'Daily goal', sel('goalDay', [0, 10, 15, 20, 30, 45, 60, 90], s.goalDay || 0, function (v) { return v ? v + ' min' : 'Off'; })) +
      '<h4>Tally</h4>' + row('tHold', 'Hold to count', sel('tHold', [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1, 1.2, 1.5], +s.tHold || 0.4, function (v) { return v + ' s'; })) +
      row('tDay', 'Daily target', sel('tDay', [0, 1, 2, 3, 5, 10, 20, 30], +s.tDay || 0, function (v) { return v ? v + ' reads' : 'Off'; })) +
      row('tRule', 'Raise health every', sel('tRuleN', [0, 5, 10, 20, 30, 50, 100], +s.tRuleN || 0, function (v) { return v ? v + ' reads' : 'Off'; })) +
      (s.tRuleN ? row('tRule', 'By', sel('tRulePct', [5, 10, 15, 20], +s.tRulePct || 5, function (v) { return '+' + v + '%'; })) : '') +
      '<h4>Health</h4>' + row('decay', 'Lose health', sw(s.decayOn, 'decayOn')) +
      (s.decayOn ? row('decay', 'Start after', sel('decayAfter', [7, 10, 14, 21, 30], s.decayAfter, function (v) { return v + ' days'; })) +
        row('decay', 'Then lose', sel('decayPct', [5, 10, 15], s.decayPct, function (v) { return v + '% / week'; })) : '');
    else h += '<h4>Reading</h4>' + row('main', 'Main start page', '<span class="sst">' + (S.d.rmain ? 'P. ' + S.d.rmain.start : 'Not set') + '</span><button class="btn sm" data-act="rmainSet">Set</button>') +
      '<div class="frow">' + nm('ram', 'Ramadan start') + '</div><div class="seg mini">' + [[-1, '1 day earlier'], [0, 'Umm al-Qura'], [1, '1 day later']].map(function (x) { return '<button class="' + ((+s.ramAdj || 0) === x[0] ? 'on' : '') + '" data-act="ramAdj" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
    h += '<h4>Tags</h4>' + row('arch', 'Show archived tags', sw(s.showArch, 'showArch')) +
      '<h4>App</h4>' + row('update', 'Update app', '<span class="sst">' + ver + '</span><button class="btn sm" data-act="updateApp">Update</button>') +
      row('share', 'Share the app', '<button class="btn sm" data-act="shareApp">Copy link</button>') +
      row('offline', 'Offline pages', '<button class="btn sm" data-act="offOpen">Manage</button>') +
      (instEv ? row('install', 'Install app', '<button class="btn sm pri" data-act="install">' + ICON.down + ' Install</button>') : installedApp() ? '' : row('install', 'Install app', '<span class="sst">Browser menu</span>')) +
      '<div style="text-align:right;margin-top:10px"><button class="btn" data-act="closeSheet">Close</button></div>' +
      '<div class="shelp" id="shelp" data-act="shelpX"></div></div>';
    var sc = $('#scrim');
    sc.innerHTML = h; sc.style.display = 'flex';
  }
  function closeSheet() { var sc = $('#scrim'); sc.style.display = 'none'; sc.innerHTML = ''; }

  /* ---------------- Actions ---------------- */
  var ACT = {
    nav: function (el) {
      var t = el.dataset.t;
      if (t === 'stats') return ACT.stats();
      if (t === 'set') return openSettings();
      st.view = 'home'; st.tedit = null;
      if (isRec()) S.d.ui.rtab = t; else S.d.ui.tab = t;
      S.saveUi(); App.render(); window.scrollTo(0, 0);
    },
    more: function (el) { st.more = st.more || {}; st.more[el.dataset.n] = 1; App.render(); },
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
      var btns = [['all', toName + ' · All', 'pri']].concat(byOpened(liveTags(to)).map(function (t) { return [t.id, t.name]; }), [['x', 'Cancel']]);
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
    // v121 (SL7): archive keeps the tag, its pages and stats; it just leaves the chip row (and Move lists) until unarchived.
    archTag: function (t, on) {
      if (on) { t.a = 1; var cts = S.d.ui.cts || {}; Object.keys(cts).forEach(function (b) { if (cts[b] === t.id) cts[b] = 'all'; }); if (st.tedit === t.id) st.tedit = null; }
      else delete t.a;
      S.saveSettings(); App.render(); App.toast(on ? 'Tag archived' + (showArch() ? '' : ' · Settings → Show archived tags') : 'Tag unarchived');
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
    // v128 (SL13): one control expands (or collapses) every row in the Recitation Surah / Juz tab.
    rexpAll: function (el) {
      var k = el.dataset.k, E = st.exp[k], ks = (el.dataset.keys || '').split(',').filter(Boolean), on = !ks.every(function (x) { return E[x]; });
      ks.forEach(function (x) { if (on) E[x] = true; else delete E[x]; }); App.render();
    },
    rshowRead: function () { S.d.ui.rshowRead = !S.d.ui.rshowRead; S.saveUi(); App.render(); },
    rdaily: function () { S.d.ui.rdaily = !S.d.ui.rdaily; S.saveUi(); App.render(); },
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
    // v123: the icon shows the current mode (brain = Memorization, open book = Recitation); tapping swaps it with a note.
    mode: function () { S.d.ui.mode = isRec() ? 'mem' : 'rec'; st.q = ''; st.view = 'home'; S.saveUi(); App.render(); window.scrollTo(0, 0); App.toast(isRec() ? 'Recitation mode' : 'Memorization mode'); },
    rall: function (el) { st.rall = el.dataset.v === '1'; App.render(); },
    rchipGo: function (el) { S.d.ui.rtag = el.dataset.t; S.saveUi(); st.view = 'home'; App.render(); },
    rchip: function (el) { S.d.ui.rtag = el.dataset.t; S.saveUi(); App.render(); },
    // v119 (SL6): new recitation tag — name, start page (default 1) and an optional target date.
    raddTag: function () {
      dialog({ title: 'New reading', input: '', ok: 'Create', html: tagFields(1, '', false, 0) }, function (name, w, f) {
        name = (name || '').trim(); if (!name) { App.toast('Give it a name'); return; }
        var sp = parseInt(f.start, 10); if (!(sp >= 1 && sp <= 604)) sp = 1;
        var id = 'r' + Date.now().toString(36);
        S.d.rtags.push({ id: id, name: name, start: sp, target: f.target || '', daily: parseInt(f.daily, 10) || 0, c: S.today() });
        var b = S.bm(id); b.p = sp; b.n = onPage(sp)[0]; b.t = Date.now();
        S.d.ui.rtag = id; S.saveRtags(); App.render(); App.toast(name + ' · starts at P. ' + sp);
      });
    },
    rtagMenu: function (c) {
      var t = S.d.rtags.filter(function (q) { return q.id === c.dataset.t; })[0]; if (!t) return;
      dialog({ title: t.name, col: true, btns: t.a ? [['un', 'Unarchive', 'pri'], ['del', 'Delete', 'danger'], ['x', 'Cancel']] :
        [['ed', 'Edit', 'pri'], ['arc', 'Archive'], ['del', 'Delete', 'danger'], ['x', 'Cancel']] }, function (v, w) {
        if (w === 'arc' || w === 'un') { // v121 (SL7): bookmark, log and stats are kept; All readings stats still count it.
          if (w === 'arc') { t.a = 1; if (S.d.ui.rtag === t.id) S.d.ui.rtag = 'def'; } else delete t.a;
          S.saveRtags(); App.render(); App.toast(w === 'arc' ? 'Reading archived' + (showArch() ? '' : ' · Settings → Show archived tags') : 'Reading unarchived'); return;
        }
        if (w === 'ed') dialog({ title: 'Edit reading', input: t.name, ok: 'Save', html: tagFields(t.start || 1, t.target || '', true, t.daily, S.bm(t.id).p || t.start || 1) }, function (name, w2, f) {
          name = (name || '').trim(); if (name) t.name = name; t.target = f.target || ''; t.daily = parseInt(f.daily, 10) || 0; S.saveRtags(); App.render();
        });
        else if (w === 'del') dialog({ title: 'Delete reading', msg: 'Delete “' + esc(t.name) + '” with its bookmark and log?', ok: 'Delete', danger: true }, function () {
          S.d.rtags = S.d.rtags.filter(function (q) { return q.id !== t.id; }); delete S.d.rbm[t.id];
          if (S.d.ui.rtag === t.id) S.d.ui.rtag = 'def'; S.saveRtags(); App.render(); App.toast('Reading deleted');
        });
      });
    },
    /* v126: Main can't be renamed or deleted, but long-press sets where it starts: the start page and the day counting
       begins. Bookmarks from before that day are left out of stats and the Reading log (kept, not deleted). */
    rmainStart: function () {
      var m = S.d.rmain || {}, b = S.bm('def');
      dialog({ title: 'Main · start', ok: 'Save', html: '<div class="dflds"><label>Start page<input class="dinp" data-f="start" inputmode="numeric" value="' + (m.start || b.p || 1) + '"></label>' +
        '<label>Count from<input class="dinp" type="date" data-f="from" value="' + esc(m.from || S.today()) + '"></label>' +
        dailyField(m.daily, b.p || 0) + '<label>Target date <span class="muted">(optional)</span><input class="dinp" type="date" data-f="target" value="' + esc(m.target || '') + '"></label></div>',
        btns: m.start ? [['ok', 'Save', 'pri'], ['clr', 'Clear'], ['x', 'Cancel']] : null }, function (v, w, f) {
        if (w === 'clr') { delete S.d.rmain; S.saveRtags(); App.render(); App.toast('Main start cleared'); return; }
        var sp = parseInt(f.start, 10); if (!(sp >= 1 && sp <= 604)) { App.toast('Start page 1–604'); return; }
        S.d.rmain = { start: sp, from: f.from || S.today(), target: f.target || '', daily: parseInt(f.daily, 10) || 0 };
        if (!b.p || b.p < sp) S.setBm(sp, onPage(sp)[0], 'def');
        S.saveRtags(); App.render(); App.toast('Main counts from P. ' + sp);
      });
    },
    rtab: function (el) { S.d.ui.rtab = el.dataset.t; S.saveUi(); App.render(); },
    ropen: function (el) { closeSheet(); var p = +el.dataset.p, n = +el.dataset.n || 0; Reader.open(p, n, null, null, true); },
    contMin: function () { S.d.ui.contMin = !S.d.ui.contMin; S.saveUi(); App.render(); },
    stats: function () { st.view = 'stats'; st.ssel = {}; st.month = null; App.render(); window.scrollTo(0, 0); },
    home: function () { st.view = 'home'; App.render(); },
    sf: function (el) { st.sf = el.dataset.f; App.render(); },
    sdir: function () { st.sdir = st.sdir ? 0 : 1; App.render(); },
    stab: function (el) { st.stab = el.dataset.t; st.cday = null; App.render(); },
    cal: function (el) { st.cal = el.dataset.m; App.render(); },
    cday: function (el) { st.cday = el.dataset.d || null; App.render(); window.scrollTo(0, 0); },
    sper: function (el) { st.sper = el.dataset.p; App.render(); },
    ryear: function (el) { S.d.settings.ryear = el.dataset.v; S.saveSettings(); st.ra = null; App.render(); },
    ramAdj: function (el) { S.d.settings.ramAdj = +el.dataset.v; S.saveSettings(); openSettings(); App.render(); },
    redit: function (el) {
      var day = el.dataset.d, rt = rtag(), cur = (S.rread(rt).days[day] || {}), ed = cur.ed;
      dialog({ title: 'Pages read · ' + new Date(day + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), input: String(cur.pg || 0), num: true,
        msg: 'Fix a day thrown off by an accidental bookmark.' + (ed ? ' From bookmarks: ' + (cur.orig || 0) + '.' : ''),
        btns: (ed ? [['rs', 'Reset']] : []).concat([['x', 'Cancel'], ['ok', 'Save', 'pri']]) }, function (v, w) {
        if (w === 'rs') S.setRadj(rt, day, null);
        else { var n = parseInt(v, 10); if (!(n >= 0 && n <= 604)) { App.toast('Enter 0–604 pages'); return; } S.setRadj(rt, day, n); }
        App.render();
      });
    },
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
    shelp: function (el) {
      var d = $('#shelp'), k = el.dataset.h; if (!d) return;
      if (d.classList.contains('on') && d.dataset.k === k) { d.classList.remove('on'); return; }
      d.dataset.k = k; d.innerHTML = '<b>' + esc(el.textContent) + '</b><span>' + esc(SHELP[k] || '') + '</span>'; d.classList.add('on');
    },
    shelpX: function () { var d = $('#shelp'); if (d) d.classList.remove('on'); },
    rmainSet: function () { closeSheet(); ACT.rmainStart(); },
    shareApp: function () {
      var u = location.origin + location.pathname, done = function () { App.toast('App link copied'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(done, function () { prompt('Copy this link', u); });
      else prompt('Copy this link', u);
    },
    updateApp: function (el) {
      el.disabled = true; el.textContent = 'Updating…';
      var sw = navigator.serviceWorker, files = ['./', 'index.html', 'css/app.css', 'js/config.js', 'js/quran.js', 'js/autocrop.js', 'js/store.js', 'js/timer.js', 'js/tally.js', 'js/reader.js', 'js/app.js', 'sw.js'];
      var p1 = sw ? sw.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.unregister(); })); }) : Promise.resolve();
      var p2 = window.caches ? caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== 'hifz-pages' && k !== 'hifz-fonts'; }).map(function (k) { return caches.delete(k); })); }) : Promise.resolve();
      // Refetch the app files past the browser's HTTP cache so the reload gets fresh copies.
      var p3 = Promise.all(files.map(function (f) { return fetch(f, { cache: 'reload' }).catch(function () {}); }));
      // v110: come back to Settings at the same scroll spot, so the result of the update is visible.
      var sh = document.getElementById('settingsSheet');
      try { sessionStorage.setItem('hifzUpd', JSON.stringify({ y: sh ? sh.scrollTop : 0, v: (window.HIFZ_CONFIG || {}).appVersion || '' })); } catch (e) {}
      Promise.all([p1, p2, p3]).catch(function () {}).then(function () { location.replace(location.pathname + '?v=' + Date.now() + location.hash); });
    },
    theme: function (el) { S.d.settings.theme = el.dataset.t; S.saveSettings(); App.render(); openSettings(); },
    ntheme: function (el) { setLook('nt', el.dataset.t); App.render(); openSettings(); },
    readerBg: function (el) { setLook('rb', el.dataset.d); App.render(); openSettings(); },
    design: function (el) { setLook('ui', el.dataset.d); App.render(); openSettings(); },
    swipeSur: function () { S.d.settings.swipeSur = S.d.settings.swipeSur === false; S.saveSettings(); openSettings(); },
    viewFlip: function () { S.d.settings.view = S.d.settings.view === 'web' ? 'mobile' : 'web'; S.saveSettings(); App.render(); },
    webTrim: function () { S.d.settings.webTrim = !S.d.settings.webTrim; S.saveSettings(); openSettings(); },
    webView: function () { S.d.settings.view = S.d.settings.view === 'web' ? 'mobile' : 'web'; S.saveSettings(); App.render(); openSettings(); },
    tapShow: function () { S.d.settings.tapShow = !S.d.settings.tapShow; S.saveSettings(); openSettings(); },
    boxHLock: function () { S.d.settings.boxHLock = S.d.settings.boxHLock === false; S.saveSettings(); openSettings(); },
    cropRestore: function () { if (!confirm('Restore the default crop to the auto-trim?')) return; S.d.settings.cropDef = null; S.saveSettings(); /* null, not delete, so the restore syncs to other devices */ openSettings(); App.render(); App.toast('Default crop restored'); },
    showArch: function () { S.d.settings.showArch = !S.d.settings.showArch; S.saveSettings(); openSettings(); App.render(); },
    decayOn: function () { S.d.settings.decayOn = !S.d.settings.decayOn; S.saveSettings(); openSettings(); App.render(); },
    cover: function (el) { S.d.settings.hideCol = el.dataset.c; S.saveSettings(); openSettings(); },
    signIn: function () { Sync.signIn(false); },
    signOut: function () { if (confirm('Sign out? Your data stays safe in your Google Drive.')) { Sync.signOut(); closeSheet(); } },
    syncNow: function () { if (navigator.onLine === false) { App.toast('You’re offline — changes are kept and sync later'); return; } Sync.now(); },
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
    } else if (k === 'offRem') { S.d.settings.offRem = +e.target.value; S.saveSettings();
    } else if (k === 'decayAfter' || k === 'decayPct' || k === 'trimPad' || k === 'goalDay' || k === 'autoRev' || k === 'tHold' || k === 'boxW' || k === 'tDay' || k === 'tRuleN' || k === 'tRulePct') { S.d.settings[k] = +e.target.value; S.saveSettings(); App.render(); if (k === 'tRuleN') openSettings(); }
    else if (k === 'srt') { st.srt = e.target.value; st.sdir = 0; App.render(); }
    else if (k === 'sprd') { st.sprd = e.target.value; App.render(); }
    else if (k === 'fit' || k === 'trim') { S.d.settings[k] = e.target.value; S.saveSettings(); App.render(); }
  });
  document.addEventListener('click', function (e) { if (e.target.id === 'scrim') closeSheet(); });

  /* ---------------- Offline manager (v132, SL18) + reminder for unused offline tags (SL19) ----------------
     Device-only record in localStorage 'hifz.off': sel = chosen keys { key: { at } }, used = { key: last opened },
     asked = { key: when the reminder was answered }. Keys: 'all' (whole mushaf), 'mem' (all Memorizing pages),
     'm:<tag id>' (Memorization tag), 'r:<tag id>' (Recitation reading: bookmark → end of the mushaf). */
  var OFK = 'hifz.off', PCN = 'hifz-pages';
  function offD() { var o = null; try { o = JSON.parse(localStorage.getItem(OFK)); } catch (e) {} o = o || {}; o.sel = o.sel || {}; o.used = o.used || {}; o.asked = o.asked || {}; return o; }
  function offW(o) { try { localStorage.setItem(OFK, JSON.stringify(o)); } catch (e) {} }
  function pgUrl(p) { return new URL('pages/p' + String(p).padStart(3, '0') + '.jpg', location.href).href; }
  function kbOf(ps) { var K = (window.AUTOCROP && AUTOCROP.kb) || []; return ps.reduce(function (a, p) { return a + (K[p - 1] || 250); }, 0); }
  function mb(kb) { var m = kb / 1024; return (m >= 10 ? Math.round(m) : m.toFixed(1)) + ' MB'; }
  function offList() { // [{ k, name, grp, pages: [p…] }]
    var L = [{ k: 'all', name: 'Whole mushaf', grp: '', pages: Array.from({ length: 604 }, function (_, i) { return i + 1; }) }];
    var memK = Object.keys(S.d.pages).filter(function (k) { return S.d.pages[k].m; });
    var uniq = function (ks) { var o = {}; ks.forEach(function (k) { o[S.kp(k)] = 1; }); return Object.keys(o).map(Number).sort(function (a, b) { return a - b; }); };
    L.push({ k: 'mem', name: 'All Memorizing pages', grp: 'Memorization', pages: uniq(memK) });
    S.d.tags.forEach(function (t) { L.push({ k: 'm:' + t.id, name: t.name, grp: 'Memorization', arch: !!t.a, pages: uniq(memK.filter(function (k) { return S.hasTag(k, t.id); })) }); });
    S.rtags().forEach(function (t) {
      var b = S.bm(t.id), p0 = b.p || t.start || 1, ps = [];
      for (var p = Math.max(1, p0); p <= 604; p++) ps.push(p);
      L.push({ k: 'r:' + t.id, name: t.name, grp: 'Recitation', arch: !!t.a, pages: ps });
    });
    return L;
  }
  function offCached() { // Promise → { page: 1 } for every page saved on this device
    if (!window.caches) return Promise.resolve({});
    return caches.open(PCN).then(function (c) { return c.keys(); }).then(function (ks) {
      var o = {}; ks.forEach(function (r) { var m = /\/p(\d{3})\.jpg/.exec(r.url); if (m) o[+m[1]] = 1; }); return o;
    }).catch(function () { return {}; });
  }
  var ofs = null; // open manager: { tick: { key: 1 }, cached, busy, prog }
  function offRender() {
    if (!ofs) return;
    var L = offList(), C = ofs.cached || {}, s = S.d.settings, nC = Object.keys(C).length;
    var need = {}; L.forEach(function (x) { if (ofs.tick[x.k]) x.pages.forEach(function (p) { need[p] = 1; }); });
    var dl = Object.keys(need).filter(function (p) { return !C[p]; }).map(Number);
    var row = function (x) {
      if (x.k !== 'all' && x.k !== 'mem' && x.arch && !ofs.tick[x.k]) return '';
      var have = x.pages.filter(function (p) { return C[p]; }).length, on = !!ofs.tick[x.k];
      var st2 = !x.pages.length ? 'No pages' : x.pages.length + ' pages · ' + mb(kbOf(x.pages)) + ' · ' + (have === x.pages.length ? 'all saved' : have ? have + ' saved' : 'not saved');
      return '<div class="prow offr"><button class="tick ' + (on ? 'on' : '') + '" style="margin:0" data-act="offTick" data-k="' + esc(x.k) + '"' + (x.pages.length ? '' : ' disabled') + '>' + (on ? ICON.check : '') + '</button>' +
        '<div class="offn"><b>' + esc(x.name) + '</b><span class="small muted">' + st2 + '</span></div></div>';
    };
    var grp = function (g) { var r = L.filter(function (x) { return x.grp === g; }).map(row).join(''); return r ? '<h4>' + g + '</h4>' + r : ''; };
    var h = '<div class="sheetm sett offm" id="offSheet"><h3>Offline pages</h3>' +
      '<p class="small">On this device: <b>' + nC + ' pages · ' + mb(kbOf(Object.keys(C).map(Number))) + '</b>. Pages you are memorizing and the next 10 pages of each reading are always kept.</p>' +
      L.filter(function (x) { return !x.grp; }).map(row).join('') + grp('Memorization') + grp('Recitation') +
      '<h4>Reminder</h4><div class="frow"><span class="slbl">Ask to free a tag not opened for</span><select data-in="offRem">' + [0, 14, 30, 60, 90].map(function (v) { return '<option value="' + v + '"' + ((s.offRem == null ? 30 : +s.offRem) === v ? ' selected' : '') + '>' + (v ? v + ' days' : 'Never') + '</option>'; }).join('') + '</select></div>' +
      '<p class="small" id="offProg" style="min-height:1.2em">' + (ofs.prog || (dl.length ? 'To download: ' + dl.length + ' pages · ' + mb(kbOf(dl)) : '')) + '</p>' +
      '<div class="pbtns" style="justify-content:space-between"><button class="btn danger" data-act="offClear"' + (ofs.busy ? ' disabled' : '') + '>Remove all</button>' +
      '<span><button class="btn" data-act="offBack">Back</button> <button class="btn pri" data-act="offSave"' + (ofs.busy ? ' disabled' : '') + '>' + (dl.length ? 'Download' : 'Save') + '</button></span></div></div>';
    var sc = $('#scrim'); sc.innerHTML = h; sc.style.display = 'flex';
  }
  /* Bring the device in line with the ticks: download what's missing, remove pages that no ticked choice
     and no always-kept page needs (only pages of choices that were unticked, so other cached pages stay). */
  function offApply(tick, done) {
    var o = offD(), L = offList(), prev = o.sel, now = Date.now(), need = {}, gone = {}, auto = App.autoPages();
    var sel = {}; Object.keys(tick).forEach(function (k) { if (tick[k]) sel[k] = prev[k] || { at: now }; }); o.sel = sel; offW(o);
    L.forEach(function (x) { if (sel[x.k]) x.pages.forEach(function (p) { need[p] = 1; }); });
    L.forEach(function (x) { if (prev[x.k] && !sel[x.k]) x.pages.forEach(function (p) { if (!need[p] && !auto[p]) gone[p] = 1; }); });
    if (!window.caches) { done && done(0, 0, 0); return; }
    caches.open(PCN).then(function (c) {
      return Promise.all(Object.keys(gone).map(function (p) { return c.delete(pgUrl(p)); })).then(function () { return offCached(); }).then(function (C) {
        var q = Object.keys(need).filter(function (p) { return !C[p]; }).map(Number), n = q.length, ok = 0, bad = 0, i = 0;
        if (!n) { done && done(0, 0, Object.keys(gone).length); return; }
        var tick1 = function () { if (ofs) { ofs.prog = 'Downloading… ' + (ok + bad) + ' of ' + n; var el = $('#offProg'); if (el) el.textContent = ofs.prog; } };
        var next = function () {
          if (i >= n) return Promise.resolve(); var u = pgUrl(q[i++]);
          return fetch(u).then(function (r) { if (!r.ok) throw 0; return c.put(u, r); }).then(function () { ok++; }, function () { bad++; }).then(function () { tick1(); return next(); });
        };
        tick1();
        return Promise.all([next(), next(), next(), next()]).then(function () { done && done(ok, bad, Object.keys(gone).length); });
      });
    }).catch(function () { done && done(0, 1, 0); });
  }
  function offOpenM() { var o = offD(), t = {}; Object.keys(o.sel).forEach(function (k) { t[k] = 1; }); ofs = { tick: t, cached: null }; offRender(); offCached().then(function (C) { if (ofs) { ofs.cached = C; offRender(); } }); }
  function offUse() { // note which tag is open, for the reminder
    var k = isRec() ? 'r:' + rtag() : (ctag() ? 'm:' + ctag().id : null); if (!k) return;
    var o = offD(); if (!o.sel[k]) return; var t = Date.now(); if (t - (o.used[k] || 0) < 3600000) return; o.used[k] = t; offW(o);
  }
  function offRemind() { // SL19: one question per unused offline tag; answered again only after it is used and left unused again
    var days = S.d.settings.offRem == null ? 30 : +S.d.settings.offRem; if (!days) return;
    if ((window.Reader && Reader.isOpen()) || $('#scrim').style.display === 'flex') return;
    var o = offD(), L = offList(), now = Date.now();
    var x = L.filter(function (x) {
      if (!o.sel[x.k] || x.k === 'all' || x.k === 'mem') return false;
      var last = Math.max(o.sel[x.k].at || 0, o.used[x.k] || 0);
      return now - last > days * 86400000 && !((o.asked[x.k] || 0) > last);
    })[0];
    if (!x) return;
    dialog({ title: 'Offline pages', msg: '“' + esc(x.name) + '” (' + (x.grp === 'Recitation' ? 'reading' : 'tag') + ') hasn’t been opened for ' + days + ' days. Keep its ' + mb(kbOf(x.pages)) + ' of offline pages on this device?', always: true, btns: [['keep', 'Keep', 'pri'], ['rm', 'Remove offline pages']] }, function (v, w) {
      var o2 = offD(); o2.asked[x.k] = Date.now(); offW(o2);
      if (w === 'rm') { var t = {}; Object.keys(o2.sel).forEach(function (k) { if (k !== x.k) t[k] = 1; }); offApply(t, function (a, b, g) { App.toast('Removed ' + g + ' offline pages'); }); }
    });
  }
  Object.assign(ACT, {
    offOpen: function () { offOpenM(); },
    offBack: function () { if (ofs && ofs.busy) return; ofs = null; openSettings(); },
    offTick: function (el) { if (!ofs || ofs.busy) return; var k = el.dataset.k; if (ofs.tick[k]) delete ofs.tick[k]; else ofs.tick[k] = 1; ofs.prog = ''; offRender(); },
    offSave: function () {
      if (!ofs || ofs.busy) return;
      if (navigator.onLine === false && Object.keys(ofs.tick).length) App.toast('You’re offline — pages download when you’re back online');
      ofs.busy = true; offRender();
      offApply(ofs.tick, function (ok, bad, gone) {
        if (!ofs) { App.toast(bad ? 'Some pages couldn’t download' : 'Offline pages updated'); return; }
        ofs.busy = false; ofs.prog = (ok ? ok + ' pages downloaded. ' : '') + (gone ? gone + ' removed. ' : '') + (bad ? bad + ' couldn’t download — check your connection and tap Download again.' : ok || gone ? '' : 'Up to date.');
        offCached().then(function (C) { if (ofs) { ofs.cached = C; offRender(); } });
      });
    },
    offClear: function () {
      if (!ofs || ofs.busy) return;
      dialog({ title: 'Remove all offline pages?', msg: 'Every tag is unticked and its pages are removed from this device. Pages you are memorizing and the next 10 pages of each reading stay.', always: true, btns: [['x', 'Cancel'], ['go', 'Remove all', 'danger']] }, function (v, w) {
        if (w !== 'go') { offRender(); return; }
        var auto = App.autoPages(); var o = offD(); o.sel = {}; offW(o); ofs.tick = {}; ofs.busy = true; offRender();
        caches.open(PCN).then(function (c) { return c.keys().then(function (ks) { return Promise.all(ks.filter(function (r) { var m = /\/p(\d{3})\.jpg/.exec(r.url); return !m || !auto[+m[1]]; }).map(function (r) { return c.delete(r); })); }); })
          .catch(function () {}).then(function () { return offCached(); }).then(function (C) { if (ofs) { ofs.busy = false; ofs.cached = C; ofs.prog = 'Removed.'; offRender(); } });
      });
    }
  });

  /* ---------------- Boot ---------------- */
  S.load();
  App.render();
  Sync.init();
  setTimeout(function () { try { offRemind(); } catch (e) {} }, 4000);
  // Reopen the page after a reload (e.g. Update app) with the same swipe scope as before, not the free mushaf.
  function reopen(p0) {
    if (isRec()) Reader.open(p0, S.d.rlast && S.d.rlast.p === p0 ? S.d.rlast.n : 0, null, null, true);
    else { var lk = S.d.last && S.kp(S.d.last.k) === p0 ? S.d.last.k : S.uk(p0), sc0 = scope(lk); Reader.open(p0, S.kn(lk), sc0 && sc0.rg, sc0 && sc0.tag); }
  }
  /* v129 (SL30): on leaving the app, note where he was. Reopened within 1 hour = same screen (reader page, Stats or home)
     and scroll position; later = the home page. A reload with #pNNN (Update app) still reopens that page as before. */
  var RSK = 'hifz.resume', rs = null, upd = false;
  try { rs = JSON.parse(localStorage.getItem(RSK)); upd = !!sessionStorage.getItem('hifzUpd'); } catch (e) {}
  function saveResume() {
    var h = location.hash.match(/^#p(\d+)$/), ro = Reader.isOpen();
    try { localStorage.setItem(RSK, JSON.stringify({ t: Date.now(), v: ro ? 'reader' : st.view, p: ro && h ? +h[1] : 0, rec: isRec(), y: window.scrollY })); } catch (e) {}
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) saveResume(); });
  window.addEventListener('pagehide', saveResume);
  if (location.hash.match(/^#p\d+$/)) {
    var p0 = +location.hash.slice(2);
    history.replaceState(null, '', location.pathname);
    reopen(p0);
  } else if (!upd && rs && Date.now() - rs.t < 3600e3 && !!rs.rec === isRec()) {
    if (rs.v === 'stats') { st.view = 'stats'; App.render(); }
    if (rs.v === 'reader' && rs.p) reopen(rs.p);
    var ry = rs.y || 0; if (ry) { window.scrollTo(0, ry); requestAnimationFrame(function () { window.scrollTo(0, ry); }); setTimeout(function () { if (window.scrollY < ry - 4) window.scrollTo(0, ry); }, 600); }
  }
  (function () {
    var u = null; try { u = JSON.parse(sessionStorage.getItem('hifzUpd')); sessionStorage.removeItem('hifzUpd'); } catch (e) {}
    if (!u) return;
    openSettings();
    var sh = document.getElementById('settingsSheet'); if (sh) { sh.scrollTop = u.y; requestAnimationFrame(function () { sh.scrollTop = u.y; }); }
    var v = (window.HIFZ_CONFIG || {}).appVersion || '';
    App.toast(v && v !== u.v ? 'Updated to ' + v.split(' ·')[0] : 'Already on the latest version (' + v.split(' ·')[0] + ')');
  })();
  /* v117 (SL32): install offer. Chrome fires beforeinstallprompt when the app can be installed; we hold it and show
     our own card at the top on a first visit (or 30 days after "Not now"), plus an Install app button in Settings. */
  var instEv = null, IKEY = 'hifz.instNo';
  function installedApp() { return !!(window.matchMedia && (matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches)) || navigator.standalone === true; }
  function instBanner() {
    if (!instEv || installedApp() || document.getElementById('instBar')) return;
    var no = 0; try { no = +localStorage.getItem(IKEY) || 0; } catch (e) {}
    if (Date.now() - no < 30 * 864e5) return;
    var b = document.createElement('div'); b.id = 'instBar';
    b.innerHTML = '<img src="icons/icon-192.png" alt=""><div class="it"><b>Install Hifz Tracker</b><span>Adds a home-screen shortcut and opens full screen, like an app.</span></div>' +
      '<div class="ib2"><button class="btn" data-ins="no">Not now</button><button class="btn pri" data-ins="yes">Install</button></div>';
    document.body.appendChild(b); requestAnimationFrame(function () { b.classList.add('on'); });
    b.addEventListener('click', function (e) {
      var w = e.target.closest('[data-ins]'); if (!w) return;
      if (w.dataset.ins === 'yes') ACT.install(); else { try { localStorage.setItem(IKEY, Date.now()); } catch (er) {} }
      hideInst();
    });
  }
  function hideInst() { var b = document.getElementById('instBar'); if (b) { b.classList.remove('on'); setTimeout(function () { b.remove(); }, 250); } }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); instEv = e; setTimeout(instBanner, 1200); if ($('#settingsSheet')) openSettings(); });
  window.addEventListener('appinstalled', function () { instEv = null; hideInst(); App.toast('Installed — open it from your home screen'); if ($('#settingsSheet')) openSettings(); });
  ACT.install = function () {
    if (!instEv) { App.toast('Open the browser menu → Install app'); return; }
    var ev = instEv; instEv = null; hideInst(); ev.prompt();
    if (ev.userChoice) ev.userChoice.then(function (r) { if (r && r.outcome !== 'accepted') { try { localStorage.setItem(IKEY, Date.now()); } catch (er) {} } if ($('#settingsSheet')) openSettings(); });
  };

  if ('serviceWorker' in navigator) {
    var hadSW = !!navigator.serviceWorker.controller, reloaded = false;
    // When a newer build takes over, reload once so the new code is used straight away.
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (hadSW && !reloaded) { reloaded = true; location.reload(); } });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) { reg.update(); setTimeout(App.precache, 3000); }).catch(function () {});
  }
})();
