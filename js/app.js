/* Home, To Memorize / Memorizing tabs, stats, settings. Reader lives in reader.js. */
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var SUR = QURAN.S;
  function sPages(n) { var s = SUR[n - 1], a = []; for (var p = s[3]; p <= s[4]; p++) a.push(p); return a; }
  function onPage(p) { var o = []; SUR.forEach(function (s, i) { if (s[3] <= p && s[4] >= p) o.push(i + 1); }); return o; }
  function juzOf(p) { var j = 1; QURAN.J.forEach(function (st, i) { if (p >= st) j = i + 1; }); return j; }
  function hcol(h) { return h >= 80 ? 'var(--ok)' : h >= 50 ? 'var(--mid)' : h > 0 ? 'var(--bad)' : 'var(--line)'; }
  function pageTitle(p) { return onPage(p).map(function (n) { return SUR[n - 1][0]; }).join(' · '); }
  function ago(d) { if (!d) return 'never'; var n = Math.floor((Date.now() - new Date(d + 'T00:00:00').getTime()) / 864e5); return n <= 0 ? 'today' : n === 1 ? 'yesterday' : n + 'd ago'; }

  var I = function (d) { return '<svg class="i" viewBox="0 0 24 24">' + d + '</svg>'; };
  var ICON = {
    chev: I('<path d="M6 9l6 6 6-6"/>'), back: I('<path d="M15 18l-6-6 6-6"/>'), fwd: I('<path d="M9 18l6-6-6-6"/>'),
    stats: I('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'), gear: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    book: I('<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>'),
    check: I('<path d="M20 6L9 17l-5-5"/>'), play: I('<path d="M6 4l14 8-14 8z"/>')
  };
  var BUILTIN = [{ id: 'new', name: 'New' }, { id: 'review', name: 'Selected for review' }];
  function allTags() { return BUILTIN.concat(S.d.tags); }

  var st = { view: 'home', exp: { mem: {}, tom: {} }, edit: false, q: '', sf: 'all', ssel: {}, month: null };

  var App = {
    esc: esc, ICON: ICON, sPages: sPages, onPage: onPage, pageTitle: pageTitle, hcol: hcol, allTags: allTags,
    render: function () {
      document.documentElement.dataset.theme = S.d.settings.theme;
      var meta = document.querySelector('meta[name=theme-color]');
      if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#1f7a52';
      $('#app').innerHTML = st.view === 'stats' ? stats() : home();
    },
    syncChanged: function () { var el = $('#syncChip'); if (el) el.outerHTML = syncChip(); if ($('#settingsSheet')) openSettings(); },
    toast: function (msg, undo) {
      var t = $('#toast'); t.innerHTML = '<span>' + esc(msg) + '</span>' + (undo ? '<button id="toastUndo">Undo</button>' : '');
      t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('on'); }, undo ? 5000 : 2200);
      if (undo) $('#toastUndo').onclick = function () { undo(); t.classList.remove('on'); };
    },
    precache: function () {
      if (!navigator.serviceWorker || !navigator.serviceWorker.controller) return;
      var set = {};
      Object.keys(S.d.pages).forEach(function (k) { if (S.d.pages[k].m) { var p = +k; set[p] = 1; if (p > 1) set[p - 1] = 1; if (p < 604) set[p + 1] = 1; } });
      if (S.d.last) set[S.d.last.p] = 1;
      var urls = Object.keys(set).map(function (p) { return 'pages/p' + String(p).padStart(3, '0') + '.jpg'; });
      navigator.serviceWorker.controller.postMessage({ type: 'precache', urls: urls });
    }
  };
  window.App = App;

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
      '<button class="ib" data-act="settings" aria-label="Settings">' + ICON.gear + '</button></header>';
    if (d.last && d.last.p) {
      var lp = d.last.p;
      if (d.ui.contMin) h += '<div class="cont min"><button class="go" data-act="open" data-p="' + lp + '">' + ICON.play + ' P. ' + lp + '</button><button class="ib" data-act="contMin" aria-label="Expand">' + ICON.fwd + '</button></div>';
      else h += '<div class="cont"><button class="go" data-act="open" data-p="' + lp + '">' + ICON.play + '<span class="small">Continue</span><b>' + esc(pageTitle(lp)) + '</b><span class="plabel" style="color:inherit;border-color:rgba(255,255,255,.5)">P. ' + lp + '</span></button><button class="ib" data-act="contMin" aria-label="Minimise">' + ICON.back + '</button></div>';
    }
    h += '<nav class="tabs"><button class="' + (d.ui.tab === 'mem' ? 'on' : '') + '" data-act="tab" data-t="mem">Memorizing</button><button class="' + (d.ui.tab === 'tom' ? 'on' : '') + '" data-act="tab" data-t="tom">To Memorize</button></nav>';
    h += d.ui.tab === 'mem' ? memTab() : tomTab();
    return h;
  }

  function memMatch(p) {
    var o = S.get(p); if (!o.m) return false;
    var ch = S.d.ui.chips; if (!ch.length) return true;
    return ch.some(function (t) { return o.tags && o.tags.indexOf(t) >= 0; });
  }
  function memTab() {
    var h = '<div class="chips">' + allTags().map(function (t) {
      return '<button class="chip ' + (S.d.ui.chips.indexOf(t.id) >= 0 ? 'on' : '') + '" data-act="chip" data-t="' + esc(t.id) + '">' + esc(t.name) + '</button>';
    }).join('') + '<button class="chip add" data-act="addTag">+ Tag</button></div>';
    var rows = '';
    SUR.forEach(function (s, i) {
      var n = i + 1, pg = sPages(n).filter(memMatch);
      if (!pg.length) return;
      var open = st.exp.mem[n];
      rows += '<div class="srow"><button class="sname" data-act="openS" data-n="' + n + '" data-k="mem"><span class="num">' + n + '</span><span class="nm">' + esc(s[0]) + '</span><span class="ar">' + esc(s[1]) + '</span></button>' +
        '<button class="exp ' + (open ? 'open' : '') + '" data-act="exp" data-k="mem" data-n="' + n + '" aria-label="Pages">' + ICON.chev + '</button></div>';
      if (open) rows += '<div class="pages">' + pg.map(function (p) {
        var hh = S.health(p);
        return '<button class="pl" data-act="open" data-p="' + p + '"><span class="hd" style="background:' + hcol(hh) + '"></span>P. ' + p + '</button>';
      }).join('') + '<button class="addlink" data-act="addPages" data-n="' + n + '">+ add pages</button></div>';
    });
    if (!rows) {
      var any = Object.keys(S.d.pages).some(function (k) { return S.d.pages[k].m; });
      return h + '<div class="list"><div class="empty">' + (any ? 'No pages with the selected tags.' : 'Nothing here yet.<br>Open <b>To Memorize</b>, tap <b>Edit</b> and tick surahs or pages.') + '</div></div>';
    }
    return h + '<div class="list">' + rows + '</div>';
  }

  function tomTab() {
    var q = st.q.trim().toLowerCase(), rows = '', lastJ = 0;
    var h = '<div class="bar"><input type="search" placeholder="Search surah, number or page" value="' + esc(st.q) + '" data-in="q"><button class="btn ' + (st.edit ? 'pri' : '') + '" data-act="edit">' + (st.edit ? 'Done' : 'Edit') + '</button></div>';
    h += '<div class="legend"><span><i style="background:var(--line)"></i>Not started</span><span><i style="background:var(--mid)"></i>Partly</span><span><i style="background:var(--acc)"></i>All pages</span></div>';
    SUR.forEach(function (s, i) {
      var n = i + 1;
      if (q && !(String(n) === q || s[0].toLowerCase().indexOf(q) >= 0 || s[1].indexOf(st.q.trim()) >= 0 || (+q >= s[3] && +q <= s[4]))) return;
      var j = juzOf(s[3]);
      if (!q && j !== lastJ) { rows += '<div class="divider">Juz ' + j + '</div>'; lastJ = j; }
      var pg = sPages(n), sel = pg.filter(function (p) { return S.isMem(p); }).length, frac = sel / pg.length;
      var mark = sel === 0 ? '' : '<span class="mark" style="background:' + (frac === 1 ? 'var(--acc)' : 'var(--mid)') + '"></span>';
      var open = st.exp.tom[n] || (q && +q >= s[3] && +q <= s[4]);
      rows += '<div class="srow" id="s' + n + '"><span class="prog" style="width:' + (frac * 100).toFixed(1) + '%"></span>' + mark +
        (st.edit ? '<button class="tick ' + (frac === 1 ? 'on' : sel ? 'part' : '') + '" data-act="tickS" data-n="' + n + '" aria-label="Select surah">' + (frac === 1 ? ICON.check : '') + '</button>' : '') +
        '<button class="sname" data-act="' + (st.edit ? 'tickS' : 'openS') + '" data-n="' + n + '" data-k="tom"><span class="num">' + n + '</span><span class="nm">' + esc(s[0]) + '</span><span class="ar">' + esc(s[1]) + '</span></button>' +
        '<button class="exp ' + (open ? 'open' : '') + '" data-act="exp" data-k="tom" data-n="' + n + '" aria-label="Pages">' + ICON.chev + '</button></div>';
      if (open) rows += '<div class="pages">' + pg.map(function (p) {
        var m = S.isMem(p);
        return '<button class="pl ' + (m ? 'mem' : '') + '" data-act="' + (st.edit ? 'tickP' : 'open') + '" data-p="' + p + '">' + (st.edit && m ? '✓ ' : '') + 'P. ' + p + '</button>';
      }).join('') + '</div>';
    });
    return h + '<div class="list">' + (rows || '<div class="empty">No surah matches.</div>') + '</div>';
  }

  /* ---------------- Stats ---------------- */
  function stats() {
    var mem = Object.keys(S.d.pages).filter(function (k) { return S.d.pages[k].m; }).map(Number).sort(function (a, b) { return a - b; });
    var m = S.month(), monthTotal = 0, all = 0, sumH = 0, months = {};
    Object.keys(S.d.pages).forEach(function (k) { var rv = S.d.pages[k].rv || {}; for (var mm in rv) { months[mm] = (months[mm] || 0) + rv[mm]; all += rv[mm]; if (mm === m) monthTotal += rv[mm]; } });
    mem.forEach(function (p) { sumH += S.health(p); });
    var h = '<header class="top"><button class="ib" data-act="home" aria-label="Back">' + ICON.back + '</button><div class="brand">Stats</div></header>';
    h += '<div class="cards"><div class="card"><div class="v">' + mem.length + '</div><div class="k">Pages memorizing</div></div>' +
      '<div class="card"><div class="v">' + (mem.length ? Math.round(sumH / mem.length) : 0) + '%</div><div class="k">Average health</div></div>' +
      '<div class="card"><div class="v">' + monthTotal + '</div><div class="k">Reviews this month</div></div>' +
      '<div class="card"><div class="v">' + all + '</div><div class="k">Reviews in total</div></div></div>';
    if (st.month) {
      var rowsM = Object.keys(S.d.pages).filter(function (k) { return (S.d.pages[k].rv || {})[st.month]; }).map(Number).sort(function (a, b) { return a - b; });
      h += '<div class="bar"><button class="btn sm" data-act="month" data-m="">' + '‹ All months</button><b style="align-self:center">' + st.month + '</b></div><div class="list">' +
        (rowsM.map(function (p) { return '<div class="prow"><button class="pl" data-act="open" data-p="' + p + '">P. ' + p + '</button><div class="grow small">' + esc(pageTitle(p)) + '</div><b>' + S.d.pages[p].rv[st.month] + '×</b></div>'; }).join('') || '<div class="empty">No reviews.</div>') + '</div>';
      return h;
    }
    h += '<div class="seg">' + [['all', 'All'], ['low', 'Below 50%'], ['weak', 'Weakest first'], ['months', 'By month']].map(function (x) {
      return '<button class="' + (st.sf === x[0] ? 'on' : '') + '" data-act="sf" data-f="' + x[0] + '">' + x[1] + '</button>';
    }).join('') + '</div>';
    if (st.sf === 'months') {
      var ks = Object.keys(months).sort().reverse();
      return h + '<div class="list">' + (ks.map(function (k) { return '<button class="prow" style="width:100%;text-align:left" data-act="month" data-m="' + k + '"><div class="grow"><b>' + k + '</b></div><span>' + months[k] + ' reviews</span>' + ICON.fwd + '</button>'; }).join('') || '<div class="empty">No reviews yet.</div>') + '</div>';
    }
    var list = mem.slice();
    if (st.sf === 'low') list = list.filter(function (p) { return S.health(p) < 50; });
    if (st.sf === 'weak') list.sort(function (a, b) { return S.health(a) - S.health(b); });
    h += '<div class="list">' + (list.map(function (p) {
      var hh = S.health(p), o = S.get(p), on = st.ssel[p];
      return '<div class="prow"><button class="tick ' + (on ? 'on' : '') + '" style="margin:0" data-act="ssel" data-p="' + p + '">' + (on ? ICON.check : '') + '</button>' +
        '<div class="grow"><div style="display:flex;gap:8px;align-items:center"><button class="pl" data-act="open" data-p="' + p + '">P. ' + p + '</button><span class="small muted" style="overflow:hidden;white-space:nowrap;text-overflow:ellipsis">' + esc(pageTitle(p)) + (S.hasTag(p, 'review') ? ' · for review' : '') + '</span></div>' +
        '<div class="hbar"><i style="width:' + hh + '%;background:' + hcol(hh) + '"></i></div></div>' +
        '<div style="text-align:right;font-size:12px"><b>' + hh + '%</b><br><span class="muted">' + ago(o.lr) + ' · ' + S.monthCount(p) + '×</span></div></div>';
    }).join('') || '<div class="empty">No pages.</div>') + '</div>';
    var nsel = Object.keys(st.ssel).filter(function (k) { return st.ssel[k]; }).length;
    if (list.length) h += '<div class="actbar"><button class="btn" data-act="sselAll">' + (nsel ? 'Clear (' + nsel + ')' : 'Select all') + '</button><button class="btn pri" data-act="tagReview" ' + (nsel ? '' : 'disabled style="opacity:.5"') + '>Mark for review</button></div>';
    return h;
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
      '<h4>Page display</h4><div class="frow"><label>Show pages</label><select data-in="fit"><option value="page"' + (s.fit !== 'width' ? ' selected' : '') + '>Whole page on screen</option><option value="width"' + (s.fit === 'width' ? ' selected' : '') + '>Fit width (scroll)</option></select></div>' +
      '<div class="frow"><label>Auto-trim margins<br><span class="small muted">Measured separately for every page. Your own crops override it.</span></label><select data-in="trim"><option value="full"' + (s.trim === 'full' ? ' selected' : '') + '>Keep header &amp; page no.</option><option value="frame"' + (s.trim === 'frame' ? ' selected' : '') + '>Frame only</option><option value="off"' + (s.trim === 'off' ? ' selected' : '') + '>Off</option></select></div>' +
      '<div class="frow"><label>Extra margin</label><select data-in="trimPad">' + [0, 0.01, 0.02, 0.03].map(function (v) { return '<option value="' + v + '"' + (Math.abs((s.trimPad == null ? 0.01 : s.trimPad) - v) < 0.001 ? ' selected' : '') + '>' + (v * 100) + '%</option>'; }).join('') + '</select></div>' +
      '<h4>Health decay</h4><div class="frow"><label>Lose health when not reviewed</label><button class="sw ' + (s.decayOn ? 'on' : '') + '" data-act="decayOn"></button></div>' +
      '<div class="frow"><label>Start after</label><select data-in="decayAfter">' + [7, 10, 14, 21, 30].map(function (v) { return '<option value="' + v + '"' + (s.decayAfter === v ? ' selected' : '') + '>' + v + ' days</option>'; }).join('') + '</select></div>' +
      '<div class="frow"><label>Then lose</label><select data-in="decayPct">' + [5, 10, 15].map(function (v) { return '<option value="' + v + '"' + (s.decayPct === v ? ' selected' : '') + '>' + v + '% per week</option>'; }).join('') + '</select></div>' +
      '<h4>Section hiding colour</h4><div class="rrow">' + [['#ffffff', 'White'], ['#fbf6e9', 'Cream'], ['#e9ecea', 'Grey']].map(function (c) { return '<button class="sw-c ' + (s.cover === c[0] ? 'on' : '') + '" style="background:' + c[0] + '" data-act="cover" data-c="' + c[0] + '" aria-label="' + c[1] + '"></button>'; }).join('') + '</div>' +
      '<h4>Custom tags</h4>' + (S.d.tags.length ? S.d.tags.map(function (t) { return '<div class="frow"><label>' + esc(t.name) + '</label><button class="btn sm" data-act="delTag" data-t="' + esc(t.id) + '">Remove</button></div>'; }).join('') : '<p class="small muted">None yet — add one with “+ Tag” on the Memorizing tab.</p>') +
      '<h4>Account &amp; sync</h4>' + acct +
      '<h4>Offline</h4><button class="btn sm" data-act="precache">Save my Memorizing pages for offline</button>' +
      '<p class="small muted" style="margin-top:14px">Install: open the browser menu → “Install app” / “Add to Home screen” for full screen.</p>' +
      '<div style="text-align:right;margin-top:10px"><button class="btn" data-act="closeSheet">Close</button></div></div>';
    var sc = $('#scrim');
    sc.innerHTML = h; sc.style.display = 'flex';
  }
  function closeSheet() { var sc = $('#scrim'); sc.style.display = 'none'; sc.innerHTML = ''; }

  /* ---------------- Actions ---------------- */
  var ACT = {
    tab: function (el) { S.d.ui.tab = el.dataset.t; S.saveUi(); App.render(); window.scrollTo(0, 0); },
    chip: function (el) { var c = S.d.ui.chips, t = el.dataset.t, i = c.indexOf(t); if (i >= 0) c.splice(i, 1); else c.push(t); S.saveUi(); App.render(); },
    addTag: function () {
      var name = (prompt('New tag name') || '').trim(); if (!name) return;
      var id = 't' + Date.now().toString(36); S.d.tags.push({ id: id, name: name }); S.saveSettings(); App.render();
    },
    delTag: function (el) { S.d.tags = S.d.tags.filter(function (t) { return t.id !== el.dataset.t; }); S.d.ui.chips = S.d.ui.chips.filter(function (c) { return c !== el.dataset.t; }); S.saveSettings(); openSettings(); App.render(); },
    exp: function (el) { var k = el.dataset.k, n = el.dataset.n; st.exp[k][n] = !st.exp[k][n]; App.render(); },
    edit: function () { st.edit = !st.edit; App.render(); },
    open: function (el) { closeSheet(); Reader.open(+el.dataset.p); },
    openS: function (el) {
      var n = +el.dataset.n, pg = sPages(n);
      if (el.dataset.k === 'mem') { var f = pg.filter(memMatch); if (f.length) pg = f; }
      Reader.open(pg[0]);
    },
    tickS: function (el) {
      var pg = sPages(+el.dataset.n), all = pg.every(function (p) { return S.isMem(p); });
      pg.forEach(function (p) { S.setMem(p, !all); }); App.render(); App.precache();
    },
    tickP: function (el) { var p = +el.dataset.p; S.setMem(p, !S.isMem(p)); App.render(); App.precache(); },
    addPages: function (el) {
      var n = el.dataset.n; S.d.ui.tab = 'tom'; st.edit = true; st.q = ''; st.exp.tom = {}; st.exp.tom[n] = true; S.saveUi(); App.render();
      var r = document.getElementById('s' + n); if (r) r.scrollIntoView({ block: 'start' });
    },
    contMin: function () { S.d.ui.contMin = !S.d.ui.contMin; S.saveUi(); App.render(); },
    stats: function () { st.view = 'stats'; st.ssel = {}; st.month = null; App.render(); window.scrollTo(0, 0); },
    home: function () { st.view = 'home'; App.render(); },
    sf: function (el) { st.sf = el.dataset.f; App.render(); },
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
      ps.forEach(function (p) { S.toggleTag(+p, 'review', true); });
      st.ssel = {}; App.toast(ps.length + ' page' + (ps.length === 1 ? '' : 's') + ' marked for review'); App.render();
    },
    settings: openSettings, closeSheet: closeSheet,
    theme: function (el) { S.d.settings.theme = el.dataset.t; S.saveSettings(); App.render(); openSettings(); },
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
    } else if (k === 'decayAfter' || k === 'decayPct' || k === 'trimPad') { S.d.settings[k] = +e.target.value; S.saveSettings(); App.render(); }
    else if (k === 'fit' || k === 'trim') { S.d.settings[k] = e.target.value; S.saveSettings(); App.render(); }
  });
  document.addEventListener('click', function (e) { if (e.target.id === 'scrim') closeSheet(); });

  /* ---------------- Boot ---------------- */
  S.load();
  App.render();
  Sync.init();
  if (location.hash.match(/^#p\d+$/)) { var p0 = +location.hash.slice(2); history.replaceState(null, '', location.pathname); Reader.open(p0); }
  if ('serviceWorker' in navigator) {
    var hadSW = !!navigator.serviceWorker.controller, reloaded = false;
    // When a newer build takes over, reload once so the new code is used straight away.
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (hadSW && !reloaded) { reloaded = true; location.reload(); } });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) { reg.update(); setTimeout(App.precache, 3000); }).catch(function () {});
  }
})();
