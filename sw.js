/* Élan Académie — service worker minimal : réseau d'abord, cache seulement hors connexion.
   Il ne garde jamais une vieille version de l'application quand le réseau répond. */
var CACHE = "elan-site-v1";
self.addEventListener("install", function (e) { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(caches.keys().then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET" || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(fetch(e.request).then(function (res) {
    var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); return res;
  }).catch(function () { return caches.match(e.request).then(function (r) { return r || (e.request.mode === "navigate" ? caches.match("./") : undefined); }); }));
});
