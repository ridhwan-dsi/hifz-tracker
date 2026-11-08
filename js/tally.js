/* Tally counter: a floating round button over the reader. Hold it until the ring closes to count one read
   (hold time in Settings), vibrating at that moment; slide it to move it. Counts are saved to the open page's log
   for the chosen sections (Mask 1's lines); a new tally then starts at 0. */
(function () {
  var LK = 'hifz.tally', C = 232.5; // ring circumference (r = 37)
  var T = { on: false, n: 0, k: null, from: 0, to: 0, x: 0.84, y: 0.32 };
  try { Object.assign(T, JSON.parse(localStorage.getItem(LK)) || {}); } catch (e) {}
  function keep() { try { localStorage.setItem(LK, JSON.stringify(T)); } catch (e) {} }
  /* v92 kept tallies: unsaved counts parked per page (unit key) on this device, not in the stats.
     A count still running when the app was closed is parked on its page at the next launch, so the page
     comes back as it was left once the Tally icon is tapped there. Minimising leaves it running as is. */
  var KK = 'hifz.tallyKept', K = {};
  try { K = JSON.parse(localStorage.getItem(KK)) || {}; } catch (e) {}
  function keepK() { try { localStorage.setItem(KK, JSON.stringify(K)); } catch (e) {} }
  function park() { if (!T.n || !T.k) return; K[T.k] = { n: T.n, from: T.from, to: T.to, at: Date.now() }; T.n = 0; T.k = null; keepK(); keep(); }
  if (T.n > 0) { park(); T.on = false; keep(); }
  function holdMs() { var h = +S.d.settings.tHold || 0.4; return Math.round(Math.max(0.2, Math.min(1.5, h)) * 1000); }
  function buzz() { try { navigator.vibrate && navigator.vibrate(35); } catch (e) {} }

  var el = null, ring = null, num = null;
  function build() {
    el = document.createElement('div'); el.id = 'tally'; el.setAttribute('role', 'button'); el.setAttribute('aria-label', 'Hold to count');
    el.innerHTML = '<svg viewBox="0 0 84 84"><circle class="tk" cx="42" cy="42" r="37"/><circle class="tr" cx="42" cy="42" r="37"/></svg><div class="tn">0</div>';
    document.body.appendChild(el);
    ring = el.querySelector('.tr'); num = el.querySelector('.tn');
    var g = null;
    // The ring is drawn frame by frame and the count + vibration fire on the very frame it closes,
    // so even at 0.2 s the buzz lands with the ring, not after it.
    function reset() { if (g) cancelAnimationFrame(g.raf); ring.style.transition = 'stroke-dashoffset .12s'; ring.style.strokeDashoffset = C; }
    function run(gg) {
      var ms = holdMs(), t0 = performance.now();
      ring.style.transition = 'none';
      (function f(now) {
        if (g !== gg || gg.drag) return;
        var k = Math.min(1, (now - t0) / ms);
        ring.style.strokeDashoffset = C * (1 - k);
        if (k < 1) { gg.raf = requestAnimationFrame(f); return; }
        buzz(); Tally.add(1); el.classList.add('pop'); setTimeout(function () { el.classList.remove('pop'); }, 130); reset();
      })(t0);
    }
    el.addEventListener('pointerdown', function (e) {
      e.preventDefault(); e.stopPropagation();
      try { el.setPointerCapture(e.pointerId); } catch (x) {}
      var r = el.getBoundingClientRect();
      g = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top, drag: false };
      run(g);
    });
    el.addEventListener('pointermove', function (e) {
      if (!g || e.pointerId !== g.id) return;
      if (!g.drag && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 8) { g.drag = true; reset(); }
      if (g.drag) {
        var w = el.offsetWidth, nx = Math.max(0, Math.min(innerWidth - w, e.clientX - g.ox)), ny = Math.max(0, Math.min(innerHeight - w, e.clientY - g.oy));
        el.style.left = nx + 'px'; el.style.top = ny + 'px';
        T.x = (nx + w / 2) / innerWidth; T.y = (ny + w / 2) / innerHeight;
      }
    });
    function up(e) { if (!g || e.pointerId !== g.id) return; var d = g.drag; reset(); g = null; if (d) keep(); }
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('click', function (e) { e.stopPropagation(); });
  }
  function place() {
    if (!el) return; var w = el.offsetWidth || 84;
    el.style.left = Math.max(0, Math.min(innerWidth - w, T.x * innerWidth - w / 2)) + 'px';
    el.style.top = Math.max(0, Math.min(innerHeight - w, T.y * innerHeight - w / 2)) + 'px';
  }
  addEventListener('resize', place);

  // Reads saved on a given day across every page: each page counts its least-read section that day.
  function dayReads(pred) {
    var t = 0, P = S.d.pages;
    for (var k in P) if (P[k].tl && P[k].tl.length) t += S.tally(k, pred).page;
    return t;
  }

  var ask = null;
  var Tally = {
    state: function () { return T; },
    on: function () { return T.on; },
    dirty: function () { return T.n > 0; },
    unit: function () { return T.k; },
    dayReads: dayReads,
    render: function () {
      if (!el) build();
      var vis = T.on && window.Reader && Reader.isOpen();
      el.style.display = vis ? 'block' : 'none';
      num.textContent = T.n;
      if (vis) place();
    },
    show: function (on) { T.on = !!on; keep(); Tally.render(); },
    add: function (d) {
      if (!T.n) T.k = Reader.unit();
      T.n = Math.max(0, T.n + d); keep(); Tally.render(); Reader.refresh();
    },
    set: function (n) { if (!T.n) T.k = Reader.unit(); T.n = Math.max(0, n | 0); keep(); Tally.render(); Reader.refresh(); },
    scope: function () { return { from: T.from, to: T.to }; },
    // Switching sections saves any count first, so it is never credited to the wrong part.
    setScope: function (from, to) { if (T.n) Tally.save(); T.from = from; T.to = to; keep(); },
    newPage: function () { T.from = T.to = 0; keep(); },
    save: function () {
      if (!T.n) return;
      var k = T.k || Reader.unit(), n = T.n, s = S.d.settings, r = S.addTally(k, T.from, T.to, n);
      T.n = 0; T.k = null; keep(); Tally.render();
      var msg = 'Saved ' + n + ' · page read ' + r.after + '×';
      // Health rule: every N page reads raises health by the set step (Memorizing pages only).
      if (s.tRuleN > 0 && S.isMem(k)) {
        var st = Math.floor(r.after / s.tRuleN) - Math.floor(r.before / s.tRuleN);
        if (st > 0) { var h0 = S.health(k); S.setHealth(k, h0 + st * (s.tRulePct || 5)); msg += ' · health ' + S.health(k) + '%'; }
      }
      App.toast(msg);
    },
    discard: function () { T.n = 0; T.k = null; keep(); Tally.render(); },
    // Keep for later: park the count on its page; it is not saved to the stats.
    park: function () { if (!T.k) T.k = Reader.unit(); park(); Tally.render(); },
    kept: function (k) { return K[k] || null; },
    // Resume a kept count on this page (only when nothing is counting now).
    resume: function (k) {
      var q = K[k]; if (!q || T.n) return false;
      T.n = q.n; T.k = k; T.from = q.from || 0; T.to = q.to || 0; delete K[k]; keepK(); keep(); Tally.render();
      App.toast('Resumed kept tally · ' + q.n); return true;
    },
    edit: function () {
      var v = prompt('Count', T.n); if (v == null) return false;
      v = parseInt(v, 10); if (!(v >= 0)) return false;
      Tally.set(v); return true;
    },
    // Unsaved count when leaving the page: Save, Keep for later, Delete, or Continue counting (stay). Tapping outside stays too.
    ask: function (then, stay) {
      var sc = document.getElementById('scrim'); if (!sc) { then(); return; }
      ask = { then: then, stay: stay };
      var k = T.k || Reader.unit();
      sc.innerHTML = '<div class="sheetm pbox"><div class="pbt">Unsaved tally on P. ' + S.kp(k) + '</div>' +
        '<div class="small muted">Count ' + T.n + (T.from ? ' · section ' + T.from + (T.to > T.from ? '–' + T.to : '') : ' · whole page') + '</div>' +
        '<div class="pbtns"><button class="btn danger" data-tg="leave">Delete</button><button class="btn" data-tg="keep">Keep for later</button><button class="btn pri" data-tg="save">Save</button></div>' +
        '<div class="pbtns"><button class="btn" data-tg="stay">Continue counting</button></div></div>';
      sc.style.display = 'flex';
    }
  };
  function closeAsk() { var sc = document.getElementById('scrim'); sc.style.display = 'none'; sc.innerHTML = ''; }
  document.addEventListener('click', function (e) {
    if (!ask) return;
    var b = e.target.closest && e.target.closest('[data-tg]'), a = ask;
    if (b) {
      e.stopPropagation();
      var w = b.dataset.tg;
      if (w === 'stay') { ask = null; closeAsk(); if (a.stay) a.stay(); return; }
      if (w === 'edit' && !Tally.edit()) return;
      if (w === 'leave') Tally.discard(); else if (w === 'keep') Tally.park(); else Tally.save();
      ask = null; closeAsk(); a.then(); return;
    }
    if (e.target.id === 'scrim') { ask = null; closeAsk(); if (a.stay) a.stay(); }
  }, true);
  // v92: in web view, Space counts one read while the counter is out (held key repeats are ignored).
  document.addEventListener('keydown', function (e) {
    if (e.code !== 'Space' && e.key !== ' ') return;
    if (!el || el.style.display === 'none' || ask || !Reader.isOpen() || !Reader.desk()) return;
    var t = e.target, tg = t && t.tagName;
    if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT' || (t && t.isContentEditable)) return;
    e.preventDefault(); if (e.repeat) return;
    buzz(); Tally.add(1); el.classList.add('pop'); setTimeout(function () { el.classList.remove('pop'); }, 130);
  });
  window.Tally = Tally;
})();
