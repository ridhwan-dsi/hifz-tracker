/* Data layer: local cache (localStorage) + Google Drive appDataFolder sync, per Google account. */
(function () {
  var KEY = 'hifz.v2';
  function pad(n) { return String(n).padStart(2, '0'); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function month() { return today().slice(0, 7); }
  function blank() {
    return {
      v: 2, acct: null, pages: {}, tags: [], time: {}, su: 0, last: null,
      settings: { theme: 'green', decayOn: true, decayAfter: 14, decayPct: 5, cover: '#ffffff', fit: 'page', trim: 'full', trimPad: 0.01, goalDay: 30, autoRev: 10, sessT: 0, tHold: 0.4, tDay: 0, tRuleN: 0, tRulePct: 5, tapShow: false },
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
        if (on) { o.m = 1; o.tags = o.tags || []; if (o.tags.indexOf('new') < 0) o.tags.push('new'); if (o.h == null) o.h = 0; }
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
    setLast: function (p, k) { this.d.last = { p: p, k: k || uk(p), t: Date.now() }; this.persist(); },
    merge: function (r) {
      var L = this.d;
      Object.keys(r.pages || {}).forEach(function (k) { var rp = r.pages[k], lp = L.pages[k]; if (!lp || (rp.u || 0) > (lp.u || 0)) L.pages[k] = rp; });
      if ((r.su || 0) > (L.su || 0)) { L.settings = Object.assign(L.settings, r.settings || {}); L.tags = r.tags || L.tags; L.su = r.su; }
      // Stopwatch time: day → device → mode → page seconds. Counts only grow, so keep the larger of each.
      var T = L.time || (L.time = {});
      Object.keys(r.time || {}).forEach(function (day) {
        var rd = r.time[day], ld = T[day] || (T[day] = {});
        Object.keys(rd).forEach(function (dev) {
          var rv = rd[dev], lv = ld[dev] || (ld[dev] = { r: {}, n: {} });
          ['r', 'n'].forEach(function (md) { var a = rv[md] || {}, b = lv[md] || (lv[md] = {}); for (var p in a) if ((a[p] || 0) > (b[p] || 0)) b[p] = a[p]; });
        });
      });
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
