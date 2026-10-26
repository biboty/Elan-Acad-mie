/* Ancien service worker de l'espace famille : il se désinscrit, le site entier est servi par ../sw.js. */
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.registration.unregister().then(function () { return self.clients.matchAll(); }).then(function (cs) { cs.forEach(function (c) { c.navigate(c.url); }); })); });
