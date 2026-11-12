/* Service worker (v131, SL27 — same design as Habits v5):
   - App shell CACHE-FIRST from a versioned cache that is fully precached at install, so the app opens instantly and
     offline (never the browser's offline page). A new version arrives because the page calls reg.update() on launch →
     the new sw.js installs the new files → takes over → the page reloads once. Bump SHELL with every release.
   - Mushaf pages cache-first (full resolution, offline), kept across versions.
   - Google Fonts (CSS + font files) cache-first, kept across versions, so the Arabic font works offline too. */
var SHELL = 'hifz-shell-v131', PAGES = 'hifz-pages', FONTS = 'hifz-fonts';
var FILES = ['./', 'index.html', 'css/app.css', 'js/config.js', 'js/quran.js', 'js/autocrop.js', 'js/store.js', 'js/timer.js', 'js/tally.js', 'js/reader.js', 'js/app.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(SHELL).then(function (c) {
    return c.addAll(FILES.map(function (f) { return new Request(f, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== SHELL && k !== PAGES && k !== FONTS; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
function cacheFirst(name, req, key) {
  return caches.open(name).then(function (c) {
    return c.match(key || req, { ignoreSearch: !!key }).then(function (hit) {
      return hit || fetch(req).then(function (r) { if (r.ok || r.type === 'opaque') c.put(key || req, r.clone()); return r; });
    });
  });
}
self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') { e.respondWith(cacheFirst(FONTS, req)); return; }
  if (url.origin !== location.origin) return; // Google sign-in and Drive go straight to the network
  if (url.pathname.endsWith('/sw.js')) return;
  if (url.pathname.indexOf('/pages/') >= 0) { e.respondWith(cacheFirst(PAGES, req)); return; }
  e.respondWith(caches.open(SHELL).then(function (c) {
    var key = req.mode === 'navigate' ? 'index.html' : req;
    return c.match(key, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (r) { if (r.ok && req.mode !== 'navigate') c.put(req, r.clone()); return r; })
        .catch(function (err) { return c.match('index.html').then(function (h) { if (h && req.mode === 'navigate') return h; throw err; }); });
    });
  }));
});
self.addEventListener('message', function (e) {
  if (!e.data || e.data.type !== 'precache') return;
  var urls = e.data.urls || [];
  e.waitUntil(caches.open(PAGES).then(function (c) {
    var i = 0;
    function next() {
      if (i >= urls.length) return Promise.resolve();
      var u = new URL(urls[i++], self.registration.scope).href;
      return c.match(u).then(function (hit) { return hit ? null : fetch(u).then(function (r) { if (r.ok) return c.put(u, r); }).catch(function () {}); }).then(next);
    }
    return Promise.all([next(), next(), next()]);
  }));
});
