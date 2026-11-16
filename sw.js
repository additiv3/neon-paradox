// Service Worker: Das Spiel funktioniert nach dem ersten Laden auch ohne Internet.
// Strategie "Netz zuerst": online gibt es immer die neueste Version, offline die zuletzt geladene.
const CACHE = 'neon-paradox-v3';
const CORE = [
  './', 'index.html', 'manifest.json', 'icon.svg', 'icons/icon-192.png', 'css/style.css',
  'js/util.js', 'js/renderer.js', 'js/grid.js', 'js/particles.js', 'js/audio.js',
  'js/world.js', 'js/maps.js', 'js/upgrades.js', 'js/meta.js', 'js/game.js', 'js/extras.js', 'js/settings.js', 'js/menus.js',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  ev.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html')))
  );
});
