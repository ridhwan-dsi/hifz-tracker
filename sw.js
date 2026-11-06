/* Service worker: app shell network-first (so updates arrive), mushaf pages cache-first (full resolution, offline). */
var SHELL = 'hifz-shell-v13', PAGES = 'hifz-pages';
var FILES = ['./', 'index.html', 'css/app.css', 'js/config.js', 'js/quran.js', 'js/autocrop.js', 'js/store.js', 'js/reader.js', 'js/app.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(SHELL).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== SHELL && k !== PAGES; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.indexOf('/pages/') >= 0) {
    e.respondWith(caches.open(PAGES).then(function (c) {
      return c.match(req).then(function (hit) {
        return hit || fetch(req).then(function (r) { if (r.ok) c.put(req, r.clone()); return r; });
      });
    }));
    return;
  }
  e.respondWith(fetch(req).then(function (r) {
    if (r.ok) { var cp = r.clone(); caches.open(SHELL).then(function (c) { return c.put(req, cp); }).catch(function () {}); }
    return r;
  }, function (err) {
    // Offline: serve the cached copy; if there is none, let the network error through rather than an empty reply.
    return caches.match(req).then(function (h) { return h || caches.match('index.html'); }).then(function (h) { if (h) return h; throw err; });
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
