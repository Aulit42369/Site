/* ================================================================
   Service worker minimal — sert uniquement à rendre admin.html
   installable comme application (Chrome exige un service worker
   avec un gestionnaire "fetch" pour proposer l'installation,
   surtout sur téléphone).

   Ne met RIEN en cache volontairement : toutes les requêtes
   repartent directement sur le réseau. Un jeton GitHub, un statut
   live ou une liste de streamers ne doivent jamais être servis
   depuis une copie périmée.
   ================================================================ */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
