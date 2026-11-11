/* Stopwatch: counts time on the page open in the reader, credits it per day/page, checks targets. */
(function () {
  var LK = 'hifz.timer', DK = 'hifz.dev';
  var dev = localStorage.getItem(DK);
  if (!dev) { dev = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); try { localStorage.setItem(DK, dev); } catch (e) {} }

  // Session state stays on this device only.
  var T = { run: false, secs: 0, last: 0, hitS: false, hitD: '', cr: {} };
  try { Object.assign(T, JSON.parse(localStorage.getItem(LK)) || {}); } catch (e) {}
  T.run = false; // never resume running after a reload; the person taps play again
  function keep() { try { localStorage.setItem(LK, JSON.stringify(T)); } catch (e) {} }

  function fmt(s) {
    s = Math.floor(s || 0); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    var p = function (n) { return String(n).padStart(2, '0'); };
    return h ? h + ':' + p(m) + ':' + p(x) : p(m) + ':' + p(x);
  }
  /* v95: Settings switch "Time left" (Timer row): with a session target, the stopwatch shows the time remaining
     as −3:25 (with "/ 10:00" beside it) instead of the time spent. */
  function rem() { var t = S.d.settings.sessT; return S.d.settings.tRem && t ? t : 0; }
  function ms(s) { s = Math.max(0, Math.ceil(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function shown(s) { var t = rem(); return t ? ((s || 0) > t * 60 ? '+' + ms((s || 0) - t * 60) : '−' + ms(t * 60 - (s || 0))) : fmt(s); } // past the target: +extra
  function mins(s) { var m = Math.round((s || 0) / 60); return m < 60 ? m + ' min' : Math.floor(m / 60) + 'h ' + (m % 60) + 'm'; }
  // Pages tagged New (or not yet in Memorizing) count as memorizing; other Memorizing pages count as review.
  function modeOf(p) { return S.isMem(p) && !S.hasTag(p, 'new') ? 'r' : 'n'; }

  /* Totals for one day across all devices: { r, n, t, pages: { p: { r, n } } } */
  function day(d) {
    var o = { r: 0, n: 0, t: 0, pages: {} }, D = (S.d.time || {})[d] || {};
    Object.keys(D).forEach(function (dv) {
      ['r', 'n'].forEach(function (md) {
        var a = D[dv][md] || {};
        for (var p in a) { var v = a[p] || 0; o[md] += v; o.t += v; var q = o.pages[p] || (o.pages[p] = { r: 0, n: 0 }); q[md] += v; }
      });
    });
    return o;
  }
  function pageToday(p, md) { var q = day(S.today()).pages[p]; return q ? (md ? q[md] : q.r + q.n) : 0; }

  function credit(p, dt) {
    var rec = !!(Reader.rec && Reader.rec()), key = rec ? 'rtime' : 'time';
    var d = S.today(), md = rec ? 'c' : modeOf(Reader.unit ? Reader.unit() : p), TM = S.d[key] || (S.d[key] = {});
    var D = TM[d] || (TM[d] = {}), v = D[dev] || (D[dev] = rec ? {} : { r: {}, n: {} }), m = v[md] || (v[md] = {});
    m[p] = Math.round(((m[p] || 0) + dt) * 10) / 10;
    var k = (rec ? 'R' : '') + d + '|' + md + '|' + p, cr = T.cr || (T.cr = {}); cr[k] = (cr[k] || 0) + dt;
    return md;
  }

  var tickN = 0;
  function tick() {
    if (!T.run) return;
    var now = Date.now();
    if (!window.Reader || !Reader.isOpen() || document.hidden) { Timer.pause(); return; }
    // Cap each step so a frozen tab never books a long gap.
    var dt = Math.min((now - T.last) / 1000, 3); T.last = now;
    if (dt <= 0) return;
    var p = Reader.page(), md = credit(p, dt);
    T.secs += dt; tickN++;
    if (tickN % 5 === 0) { keep(); S.persist(); }
    if (tickN % 60 === 0) S.save();
    var changed = false, s = S.d.settings;
    // v114: reaching the target no longer ends the session — the stopwatch keeps running so extra reading time
    // is recorded too; it buzzes once and the session is saved when it's paused/saved as usual.
    if (s.sessT && !T.hitS && T.secs >= s.sessT * 60) {
      T.hitS = true; keep(); S.save(); buzz();
      App.toast('Target reached · ' + s.sessT + ' min · extra time keeps counting');
      Reader.refresh(); return;
    }
    var dd = S.today();
    if (s.goalDay && T.hitD !== dd && day(dd).t >= s.goalDay * 60) { T.hitD = dd; changed = true; App.toast('Daily goal achieved · ' + s.goalDay + ' min'); buzz(); }
    if (changed) { keep(); Reader.refresh(); } else paint();
  }
  function takeBack(cr) {
    Object.keys(cr).forEach(function (k) {
      var rk = k.charAt(0) === 'R', a = (rk ? k.slice(1) : k).split('|'), D = (S.d[rk ? 'rtime' : 'time'] || {})[a[0]], v = D && D[dev], m = v && v[a[1]];
      if (m && m[a[2]] != null) { m[a[2]] = Math.max(0, Math.round((m[a[2]] - cr[k]) * 10) / 10); if (!m[a[2]]) delete m[a[2]]; }
    });
  }
  function buzz() { try { navigator.vibrate && navigator.vibrate([60, 60, 60]); } catch (e) {} }

  // Update only the live numbers so taps on the panel are never interrupted.
  function paint() {
    var t = shown(T.secs);
    document.querySelectorAll('.tmr-t').forEach(function (el) { el.textContent = t; });
    if (!window.Reader || !Reader.isOpen()) return;
    var p = Reader.page(), dd = day(S.today()), g = S.d.settings.goalDay;
    document.querySelectorAll('.tmr-pg').forEach(function (el) { el.textContent = fmt(pageToday(p)); });
    document.querySelectorAll('.tmr-day').forEach(function (el) { el.textContent = Math.floor(dd.t / 60); });
    document.querySelectorAll('.tmr-bar').forEach(function (el) { el.style.width = (g ? Math.min(100, dd.t / (g * 60) * 100) : 0) + '%'; });
  }

  var Timer = {
    fmt: fmt, shown: shown, rem: rem, mins: mins, day: day, pageToday: pageToday, modeOf: modeOf,
    state: function () { return T; },
    active: function () { return T.run || T.secs > 0; },
    achieved: function () { return !!S.d.settings.sessT && T.secs >= S.d.settings.sessT * 60; },
    start: function () { if (T.run) return; T.run = true; T.last = Date.now(); keep(); },
    pause: function () { if (!T.run) return; T.run = false; keep(); S.save(); if (window.Reader && Reader.isOpen()) Reader.refresh(); },
    toggle: function () { if (T.run) Timer.pause(); else Timer.start(); },
    stop: function () {
      var s = T.secs; T.run = false; T.secs = 0; T.hitS = false; T.cr = {}; keep(); S.save();
      if (s >= 1) App.toast('Session saved · ' + mins(s));
    },
    // Throw the session away: take back every second it credited, then reset.
    discard: function () {
      takeBack(T.cr || {});
      T.run = false; T.secs = 0; T.hitS = false; T.cr = {}; keep(); S.save();
      App.toast('Session deleted');
    },
    setTarget: function (m) { S.d.settings.sessT = m; T.hitS = T.secs >= m * 60 && m > 0; S.saveSettings(); keep(); }
  };
  window.Timer = Timer;
  setInterval(tick, 1000);
  document.addEventListener('visibilitychange', function () { if (document.hidden) Timer.pause(); });
})();
