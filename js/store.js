/* Data layer: local cache (localStorage) + Google Drive appDataFolder sync, per Google account. */
(function () {
  var KEY = 'hifz.v2';
  function pad(n) { return String(n).padStart(2, '0'); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function month() { return today().slice(0, 7); }
  function blank() {
    return {
      v: 2, acct: null, pages: {}, tags: [], time: {}, rtime: {}, su: 0, last: null,
      settings: { theme: 'green', decayOn: true, decayAfter: 14, decayPct: 5, cover: '#ffffff', hideCol: '#f3e9d4', fit: 'page', trim: 'full', trimPad: 0.01, goalDay: 30, autoRev: 10, sessT: 0, tHold: 0.4, tDay: 0, tRuleN: 0, tRulePct: 5, tapShow: false },
      ui: { tab: 'mem', contMin: false, chips: [] }
    };
  }

  /* Memorization units: a page shared by several surahs is a separate unit per surah ("312:19", "312:20");
     any other page is just its page number ("305"). Page-level data (crop, masks) always lives under the page number. */
  var SUR = QURAN.S, MF = ['m', 'tags', 'h', 'hd', 'lr', 'rv', 'rl'];
  function onPage(p) { var o = []; SUR.forEach(function (s, i) { if (s[3] <= p && s[4] >= p) o.push(i + 1); }); return o; }
  var SHARED = []; for (var sp = 1; sp <= 604; sp++) if (onPage(sp).length > 1) SHARED.push(sp);
  function uk(p, n) { p = parseInt(p, 10); var ss = onPage(p); if (ss.length < 2) return String(p); if (ss.indexOf(n) < 0) n = ss[0]; return p + ':' + n; }
  function kp(k) { return parseInt(k, 10); }
  function kn(k) { k = String(k); var i = k.indexOf(':'); return i > 0 ? +k.slice(i + 1) : onPage(kp(k))[0]; }

  var S = {
    d: null, dirty: false,
    uk: uk, kp: kp, kn: kn, onPage: onPage,
    // Old data kept memorization state on the shared page itself; give it to the surah(s) it was really selected for.
    migrateUnits: function () {
      var P = this.d.pages, moved = false;
      SHARED.forEach(function (p) {
        var r = P[p]; if (!r || !MF.some(function (f) { return r[f] != null; })) return;
        var ss = onPage(p), own = ss.filter(function (n) {
          var s = SUR[n - 1];
          for (var q = s[3]; q <= s[4]; q++) if (q !== p) { var o = P[uk(q, n)]; if (o && o.m) return true; }
          return false;
        });
        (own.length ? own : ss).forEach(function (n) {
          var k = uk(p, n); if (P[k]) return;
          var c = {}; MF.forEach(function (f) { if (r[f] != null) c[f] = JSON.parse(JSON.stringify(r[f])); }); c.u = Date.now(); P[k] = c;
        });
        MF.forEach(function (f) { delete r[f]; }); r.u = Date.now(); moved = true;
      });
      if (moved) this.dirty = true;
      return moved;
    },
    today: today, month: month,
    load: function () {
      try { this.d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { this.d = null; }
      if (!this.d || this.d.v !== 2) this.d = blank();
      var b = blank();
      this.d.settings = Object.assign(b.settings, this.d.settings || {});
      this.d.ui = Object.assign(b.ui, this.d.ui || {});
      this.d.tags = this.d.tags || [];
      this.d.pages = this.d.pages || {};
      this.d.time = this.d.time || {};
      this.d.rtime = this.d.rtime || {}; // v116: Recitation mode's stopwatch time (never mixed with memorization)
      this.d.rtags = this.d.rtags || []; // v119: Recitation tags [{ id, name, start, target, c }] — 'def' (Main) is built in
      this.d.radj = this.d.radj || {}; // v124 (SL10): manual pages-read per day { tag: { 'YYYY-MM-DD': pages } }
      this.d.rcomp = this.d.rcomp || []; // v123 (SL8): completions (khatm) [{ id: tag, name, d: 'YYYY-MM-DD', t }]
      this.d.rbm = this.d.rbm || {}; // v117: Recitation bookmarks per tag id ('def' = default tag): { p, n, t, log: [[t, p, n]] }
      if (this.d.last && this.d.last.p && !this.d.last.k) this.d.last.k = uk(this.d.last.p);
      if (this.migrateUnits()) this.persist();
    },
    reset: function (acct) { this.d = blank(); this.d.acct = acct; this.persist(); },
    persist: function () { try { localStorage.setItem(KEY, JSON.stringify(this.d)); } catch (e) { console.warn('save failed', e); } },
    save: function () { this.dirty = true; this.persist(); if (window.Sync) Sync.schedule(); },
    saveUi: function () { this.persist(); },
    saveSettings: function () { this.d.su = Date.now(); this.save(); },
    get: function (p) { return this.d.pages[p] || {}; },
    edit: function (p, fn) { var o = this.d.pages[p] || (this.d.pages[p] = {}); fn(o); o.u = Date.now(); this.save(); },
    isMem: function (p) { var o = this.d.pages[p]; return !!(o && o.m); },
    setMem: function (p, on) {
      if (!!on === this.isMem(p)) return;
      this.edit(p, function (o) {
        // A page added for the first time starts in New; a page removed and added back returns to the tab and tags it had.
        if (on) { var back = o.m === 0; o.m = 1; o.tags = o.tags || []; if (!back && o.tags.indexOf('new') < 0) o.tags.push('new'); if (o.h == null) o.h = 0; }
        else { o.m = 0; }
      });
    },
    // Effective health after the decay rule. Decay counts from the later of last review / last manual health set.
    health: function (p) {
      var o = this.get(p), h = o.h || 0, s = this.d.settings;
      var from = [this.lastActive(p), o.hd].filter(Boolean).sort().pop();
      if (s.decayOn && from && h > 0) {
        var days = Math.floor((Date.now() - new Date(from + 'T00:00:00').getTime()) / 864e5);
        if (days > s.decayAfter) h -= Math.ceil((days - s.decayAfter) / 7) * s.decayPct;
      }
      return Math.max(0, Math.min(100, h));
    },
    setHealth: function (p, v) { this.edit(p, function (o) { o.h = Math.max(0, Math.min(100, v)); o.hd = today(); }); },
    reviewed: function (p) {
      if (this.get(p).lr === today()) return false; // at most one review per page per day
      var eff = this.health(p), m = month();
      this.edit(p, function (o) {
        o.h = eff; o.lr = today(); o.rv = o.rv || {}; o.rv[m] = (o.rv[m] || 0) + 1;
        o.rl = o.rl || []; o.rl.push(today()); if (o.rl.length > 300) o.rl.splice(0, o.rl.length - 300);
      });
      return true;
    },
    // Un-mark today: removes every review logged today (also clears any same-day duplicates from before this rule).
    unreviewToday: function (p) {
      var t = today(), self = this;
      while (this.get(p).lr === t && this.unreviewLast(p)) {}
    },
    // Remove the most recent review (for accidental taps). Uses the dated log; older reviews logged before it existed come off the current month, else the latest month.
    unreviewLast: function (p) {
      var self = this, done = false;
      this.edit(p, function (o) {
        var rv = o.rv || {}, rl = o.rl || [], d = rl.length ? rl.pop() : null, m = d ? d.slice(0, 7) : null;
        if (!m || !rv[m]) m = rv[month()] ? month() : Object.keys(rv).filter(function (k) { return rv[k] > 0; }).sort().pop();
        if (!m) return;
        rv[m]--; if (!rv[m]) delete rv[m]; o.rv = rv; o.rl = rl; done = true;
        if (rl.length) o.lr = rl[rl.length - 1];
        else if (!Object.keys(rv).length) delete o.lr;
      });
      return done;
    },
    unreview: function (p, prev) { this.edit(p, function (o) { o.lr = prev.lr; o.rv = prev.rv; o.h = prev.h; o.rl = prev.rl; }); },
    monthCount: function (p, m) { var o = this.get(p); return (o.rv && o.rv[m || month()]) || 0; },
    totalCount: function (p) { var o = this.get(p), t = 0; for (var k in (o.rv || {})) t += o.rv[k]; return t; },
    hasTag: function (p, t) { var o = this.get(p); return !!(o.tags && o.tags.indexOf(t) >= 0); },
    toggleTag: function (p, t, force) {
      this.edit(p, function (o) {
        o.tags = o.tags || []; var i = o.tags.indexOf(t), on = force == null ? i < 0 : force;
        if (on && i < 0) o.tags.push(t); if (!on && i >= 0) o.tags.splice(i, 1);
      });
    },
    /* v117 Recitation bookmark: one moving bookmark per tag ("resume at p, finished up to p-1"), every move logged. */
    bm: function (tag) { var B = this.d.rbm || (this.d.rbm = {}); return B[tag || 'def'] || (B[tag || 'def'] = { p: 0, n: 0, t: 0, log: [] }); },
    // v119: Recitation tags. 'def' = Main (can't be renamed or deleted). Each tag = one cover-to-cover reading.
    rtags: function () { var m = this.d.rmain || {}; return [{ id: 'def', name: 'Main', start: m.start, from: m.from, target: m.target }].concat(this.d.rtags || []); },
    /* v126: a reading's bookmark log as counted for stats and the Reading log, oldest first. A start date (Main → Start page)
       drops everything logged before it, so pages read elsewhere and old test bookmarks don't count. */
    rlog: function (tag) {
      var t = this.rtag(tag), f = t.from ? new Date(t.from + 'T00:00:00').getTime() : 0;
      return (this.bm(tag).log || []).filter(function (e) { return e[0] >= f; }).sort(function (x, y) { return x[0] - y[0]; });
    },
    rtag: function (id) { return this.rtags().filter(function (t) { return t.id === id; })[0] || this.rtags()[0]; },
    saveRtags: function () { this.d.rtu = Date.now(); this.save(); },
    // Position in juz (0–30) of page p, from the juz start pages, for "juz read".
    juzPos: function (p) { var J = QURAN.J, i = 0; while (i < 29 && p >= J[i + 1]) i++; var e = i < 29 ? J[i + 1] : 605; return i + Math.max(0, Math.min(1, (p - J[i]) / (e - J[i]))); },
    /* v119 (SL9) pages read per day for a tag: the day's last bookmark minus the last bookmark of the previous
       reading day (never negative). Baseline = the tag's start page, else its first bookmark. */
    rread: function (tag) {
      var t = this.rtag(tag), log = this.rlog(tag), byDay = {}, order = [], self = this;
      log.forEach(function (e) { var d = new Date(e[0]), k = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); if (!byDay[k]) { byDay[k] = []; order.push(k); } byDay[k].push(e); });
      // v123 (SL8): a completion is logged as page 605 (end of the mushaf); the entry after it (Main restarting) is a new baseline.
      var prev = t.start || (log[0] ? log[0][1] : 0), out = {}, reset = false;
      order.forEach(function (k) {
        var pg = 0, jz = 0, cur = null, to = 0;
        byDay[k].forEach(function (e) {
          to = e[1];
          if (reset) { prev = e[1]; reset = false; cur = null; return; }
          if (e[1] >= 605) { pg += Math.max(0, 605 - prev); jz += Math.max(0, self.juzPos(605) - self.juzPos(prev)); prev = 605; reset = true; cur = null; return; }
          cur = e[1];
        });
        if (cur != null) { pg += Math.max(0, cur - prev); jz += Math.max(0, self.juzPos(cur) - self.juzPos(prev)); prev = cur; }
        out[k] = { pg: pg, jz: jz, to: to };
      });
      // v124 (SL10): a day's pages read can be corrected by hand (accidental bookmark); juz follow at 604/30 pages a juz.
      var A = (this.d.radj || {})[tag || 'def'] || {};
      Object.keys(A).forEach(function (k) { var o = out[k] || (out[k] = { pg: 0, jz: 0, to: 0 }); o.orig = o.pg; o.jz = o.pg ? o.jz * A[k] / o.pg : A[k] * 30 / 604; o.pg = A[k]; o.ed = true; });
      return { days: out, base: t.start || (log[0] ? log[0][1] : 0) };
    },
    /* v123 (SL8) Mark completion on the last page: logged as a bookmark at 605 (= whole mushaf read), recorded with its
       (editable) date. A tag is one khatm, so it gets the completed colour and is archived; Main restarts at P. 1. */
    complete: function (tag, d) {
      tag = tag || 'def';
      var t = Date.now(), b = this.bm(tag), prev = { p: b.p, n: b.n }, tg = (this.d.rtags || []).filter(function (q) { return q.id === tag; })[0], self = this;
      b.log.push([t, 605, 114]);
      if (tag === 'def') { b.log.push([t + 1, 1, 1]); b.p = 1; b.n = 1; } else { b.p = 605; b.n = 114; }
      b.t = t + 1;
      (this.d.rcomp || (this.d.rcomp = [])).push({ id: tag, name: this.rtag(tag).name, d: d, t: t });
      if (tg) { tg.done = d; tg.a = 1; }
      this.d.rtu = Date.now(); this.save();
      return function undo() {
        var c = self.bm(tag); c.log = c.log.filter(function (e) { return e[0] !== t && e[0] !== t + 1; }); (c.del || (c.del = [])).push(t, t + 1);
        c.p = prev.p; c.n = prev.n; c.t = Date.now();
        self.d.rcomp = self.d.rcomp.filter(function (x) { return x.t !== t; }); if (tg) { delete tg.done; delete tg.a; }
        self.d.rtu = Date.now(); self.save();
      };
    },
    setRadj: function (tag, day, v) {
      var A = this.d.radj || (this.d.radj = {}), T = A[tag || 'def'] || (A[tag || 'def'] = {});
      if (v == null) delete T[day]; else T[day] = v; this.d.rtu = Date.now(); this.save();
    },
    comps: function (tag) { return (this.d.rcomp || []).filter(function (x) { return !tag || x.id === tag; }); },
    setBm: function (p, n, tag) {
      var b = this.bm(tag), prev = { p: b.p, n: b.n, t: b.t }, t = Date.now();
      b.p = p; b.n = n || 0; b.t = t; b.log.push([t, p, n || 0]); this.save();
      var self = this;
      return function undo() { var c = self.bm(tag); c.log = c.log.filter(function (e) { return e[0] !== t; }); (c.del || (c.del = [])).push(t); c.p = prev.p; c.n = prev.n; c.t = Date.now(); self.save(); };
    },
    setLast: function (p, k) { this.d.last = { p: p, k: k || uk(p), t: Date.now() }; this.persist(); },
    merge: function (r) {
      var L = this.d;
      Object.keys(r.pages || {}).forEach(function (k) { var rp = r.pages[k], lp = L.pages[k]; if (!lp || (rp.u || 0) > (lp.u || 0)) L.pages[k] = rp; });
      if ((r.su || 0) > (L.su || 0)) { L.settings = Object.assign(L.settings, r.settings || {}); L.tags = r.tags || L.tags; L.su = r.su; }
      // Stopwatch time: day → device → mode → page seconds. Counts only grow, so keep the larger of each.
      // v116: rtime (Recitation, mode 'c') merges the same way.
      ['time', 'rtime'].forEach(function (key) {
        var T = L[key] || (L[key] = {});
        Object.keys(r[key] || {}).forEach(function (day) {
          var rd = r[key][day], ld = T[day] || (T[day] = {});
          Object.keys(rd).forEach(function (dev) {
            var rv = rd[dev], lv = ld[dev] || (ld[dev] = {});
            ['r', 'n', 'c'].forEach(function (md) { var a = rv[md]; if (!a) return; var b = lv[md] || (lv[md] = {}); for (var p in a) if ((a[p] || 0) > (b[p] || 0)) b[p] = a[p]; });
          });
        });
      });
      if ((r.rtu || 0) > (L.rtu || 0)) { L.rtags = r.rtags || []; L.rcomp = r.rcomp || L.rcomp || []; L.radj = r.radj || L.radj || {}; L.rmain = r.rmain || L.rmain; L.rtu = r.rtu; } // v119: Recitation tags
      // v117: bookmarks — the later move wins; logs are merged by time, minus entries undone on either side (del).
      Object.keys(r.rbm || {}).forEach(function (id) {
        var rb = r.rbm[id], lb = (L.rbm || (L.rbm = {}))[id];
        if (!lb) { L.rbm[id] = rb; return; }
        var del = {}, seen = {}, log = [];
        (lb.del || []).concat(rb.del || []).forEach(function (t) { del[t] = 1; });
        (lb.log || []).concat(rb.log || []).forEach(function (e) { if (!seen[e[0]] && !del[e[0]]) { seen[e[0]] = 1; log.push(e); } });
        log.sort(function (x, y) { return x[0] - y[0]; }); lb.log = log; lb.del = Object.keys(del).map(Number);
        if ((rb.t || 0) > (lb.t || 0)) { lb.p = rb.p; lb.n = rb.n; lb.t = rb.t; }
      });
      if (r.rlast && (!L.rlast || r.rlast.t > L.rlast.t)) L.rlast = r.rlast;
      if (r.last && (!L.last || r.last.t > L.last.t)) L.last = r.last;
      if (L.last && L.last.p && !L.last.k) L.last.k = uk(L.last.p);
      this.migrateUnits();
      this.persist();
    },
    /* Tally: each saved count is logged on the unit as [date, from, to, n]; from/to are sections (1-based) of
       Mask 1's lines, 0/0 = whole page. A section's reads = every entry covering it; the page's reads = its least-read section. */
    nSec: function (p) {
      var o = this.get(p), m = o.mk ? o.mk[0] : (o.masks ? { items: o.masks } : null);
      return m ? (m.items || []).filter(function (q) { return q.k === 'div'; }).length + 1 : 1;
    },
    tally: function (k, pred) {
      var ns = this.nSec(kp(k)), sec = [], raw = 0, i;
      for (i = 0; i < ns; i++) sec.push(0);
      (this.get(k).tl || []).forEach(function (e) {
        if (pred && !pred(e[0])) return;
        raw += e[3];
        var a = e[1] ? Math.min(e[1], ns) : 1, b = e[2] ? Math.min(e[2], ns) : ns;
        for (i = a; i <= b; i++) sec[i - 1] += e[3];
      });
      return { sec: sec, page: Math.min.apply(null, sec), raw: raw };
    },
    addTally: function (k, from, to, n) {
      var before = this.tally(k).page;
      this.edit(k, function (o) { o.tl = o.tl || []; o.tl.push([today(), from || 0, to || 0, n]); });
      return { before: before, after: this.tally(k).page };
    },
    /* Activity is automatic: a page counts as read on a day when it got at least 5 min of stopwatch time
       or at least one saved tally that day (older manual "Reviewed" days still count). */
    ACT_SECS: 300,
    pageSecs: function (d, p) {
      var D = (this.d.time || {})[d] || {}, t = 0;
      for (var dv in D) ['r', 'n'].forEach(function (md) { t += ((D[dv][md] || {})[p]) || 0; });
      return t;
    },
    pageTime: function (p, pred) { var t = 0; for (var d in (this.d.time || {})) if (!pred || pred(d)) t += this.pageSecs(d, p); return t; },
    activeDays: function (k, pred) {
      var o = this.get(k), p = kp(k), set = {}, self = this;
      for (var d in (this.d.time || {})) if ((!pred || pred(d)) && this.pageSecs(d, p) >= this.ACT_SECS) set[d] = 1;
      (o.tl || []).forEach(function (e) { if (e[3] > 0 && (!pred || pred(e[0]))) set[e[0]] = 1; });
      (o.rl || []).forEach(function (d) { if (!pred || pred(d)) set[d] = 1; });
      return Object.keys(set).sort();
    },
    lastActive: function (k) { var a = this.activeDays(k); return a.length ? a[a.length - 1] : this.get(k).lr || null; },
    exportData: function () { var c = JSON.parse(JSON.stringify(this.d)); delete c.ui; return c; }
  };
  window.S = S;

  /* ---------- Google Drive sync (appDataFolder, private to each user) ---------- */
  var API = 'https://www.googleapis.com';
  var Sync = {
    tok: null, exp: 0, fileId: null, state: 'off', timer: null, client: null, lastSync: 0,
    cid: function () { return (window.HIFZ_CONFIG || {}).googleClientId || ''; },
    gisReady: function () { return !!(window.google && google.accounts && google.accounts.oauth2); },
    set: function (st) { this.state = st; if (window.App) App.syncChanged(); },
    init: function () {
      try {
        var t = JSON.parse(sessionStorage.getItem('hifz.tok'));
        if (t && t.exp > Date.now() + 60000 && t.acct === S.d.acct) { this.tok = t.tok; this.exp = t.exp; }
      } catch (e) {}
      if (this.tok) { this.set('syncing'); this.pull(); }
      else if (S.d.acct) {
        this.set('paused');
        // Resume silently on the first tap anywhere (a user gesture lets Google's token popup open and close instantly).
        var self = this;
        document.addEventListener('click', function once() { document.removeEventListener('click', once, true); if (!self.tok) self.signIn(true); }, true);
      }
    },
    signIn: function (silent) {
      var self = this;
      if (!this.cid()) { App.toast('Google sign-in is not set up yet'); return; }
      if (!this.gisReady()) { App.toast('Google sign-in is still loading — try again'); return; }
      if (!this.client) {
        this.client = google.accounts.oauth2.initTokenClient({
          client_id: this.cid(),
          scope: 'https://www.googleapis.com/auth/drive.appdata openid email',
          callback: function (r) { self.onToken(r); },
          error_callback: function () { self.set(S.d.acct ? 'paused' : 'off'); }
        });
      }
      this.client.requestAccessToken({ prompt: silent ? '' : 'select_account', login_hint: S.d.acct || undefined });
    },
    onToken: function (r) {
      var self = this;
      if (!r || r.error) { this.set(S.d.acct ? 'paused' : 'off'); return; }
      this.tok = r.access_token; this.exp = Date.now() + (r.expires_in || 3600) * 1000;
      this.set('syncing');
      fetch(API + '/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + this.tok } })
        .then(function (x) { return x.json(); })
        .then(function (u) {
          var email = u.email;
          if (S.d.acct && S.d.acct !== email) { S.reset(email); self.fileId = null; App.render(); }
          else if (!S.d.acct) { S.d.acct = email; S.dirty = true; S.persist(); }
          sessionStorage.setItem('hifz.tok', JSON.stringify({ tok: self.tok, exp: self.exp, acct: email }));
          self.pull();
        })
        .catch(function () { self.set('error'); });
    },
    signOut: function () {
      if (this.tok && this.gisReady()) try { google.accounts.oauth2.revoke(this.tok, function () {}); } catch (e) {}
      this.tok = null; this.fileId = null; sessionStorage.removeItem('hifz.tok');
      S.reset(null); this.set('off'); App.render();
    },
    api: function (url, opt) {
      var self = this;
      opt = opt || {}; opt.headers = Object.assign({ Authorization: 'Bearer ' + this.tok }, opt.headers || {});
      return fetch(url, opt).then(function (r) {
        if (r.status === 401) { self.tok = null; sessionStorage.removeItem('hifz.tok'); self.set('paused'); throw new Error('auth'); }
        if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) {
          var m = (j.error && j.error.message) || ('HTTP ' + r.status);
          if (window.App) App.toast('Sync error: ' + m.slice(0, 120));
          throw new Error('http ' + r.status);
        });
        return r;
      });
    },
    findFile: function () {
      var self = this;
      if (this.fileId) return Promise.resolve(this.fileId);
      var q = encodeURIComponent("name='hifz.json'");
      return this.api(API + '/drive/v3/files?spaces=appDataFolder&fields=files(id,modifiedTime)&q=' + q)
        .then(function (r) { return r.json(); })
        .then(function (j) { self.fileId = (j.files && j.files[0] && j.files[0].id) || null; return self.fileId; });
    },
    pull: function () {
      var self = this;
      if (!this.tok) return;
      this.set('syncing');
      this.findFile().then(function (id) {
        if (!id) { S.dirty = true; return null; }
        return self.api(API + '/drive/v3/files/' + id + '?alt=media').then(function (r) { return r.json(); });
      }).then(function (remote) {
        if (remote) { S.merge(remote); App.render(); }
        return self.push(true);
      }).catch(function (e) { if (e.message !== 'auth') self.set('error'); });
    },
    schedule: function () {
      var self = this;
      if (!this.tok) return;
      clearTimeout(this.timer);
      this.timer = setTimeout(function () { self.push(); }, 2500);
    },
    push: function (force) {
      var self = this;
      if (!this.tok) return Promise.resolve();
      if (!S.dirty && !force) { this.set('ok'); return Promise.resolve(); }
      if (!S.dirty) { this.lastSync = Date.now(); this.set('ok'); return Promise.resolve(); }
      this.set('syncing');
      var body = JSON.stringify(S.exportData());
      S.dirty = false;
      var p;
      if (this.fileId) {
        p = this.api(API + '/upload/drive/v3/files/' + this.fileId + '?uploadType=media', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: body });
      } else {
        var b = 'hifzboundary' + Date.now();
        var meta = JSON.stringify({ name: 'hifz.json', parents: ['appDataFolder'], mimeType: 'application/json' });
        var multi = '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + meta + '\r\n--' + b + '\r\nContent-Type: application/json\r\n\r\n' + body + '\r\n--' + b + '--';
        p = this.api(API + '/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body: multi })
          .then(function (r) { return r.json(); }).then(function (j) { self.fileId = j.id; });
      }
      return p.then(function () { self.lastSync = Date.now(); self.set('ok'); })
        .catch(function (e) { S.dirty = true; if (e.message !== 'auth') self.set('error'); });
    }
  };
  window.Sync = Sync;
})();
