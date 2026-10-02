// ファイルを1つでも変えたら、この版を上げる（上げないと古い画面のまま配られる）
const VERSION = 'v1';
const CACHE = `kiroku-cho-${VERSION}`;
const FILES = [
  './',
  'index.html',
  'app.css',
  'manifest.webmanifest',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'js/main.js',
  'js/db.js',
  'js/store.js',
  'js/util.js',
  'js/fmt.js',
  'js/records.js',
  'js/search.js',
  'js/calendar.js',
  'js/hash.js',
  'js/lock.js',
  'js/zip.js',
  'js/snapshot.js',
  'js/report.js',
  'js/ui/dom.js',
  'js/ui/lock.js',
  'js/ui/onboarding.js',
  'js/ui/form.js',
  'js/ui/list.js',
  'js/ui/detail.js',
  'js/ui/calendar.js',
  'js/ui/export.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// キャッシュ優先。電波がなくても開ける
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return;
  event.respondWith(caches.match(event.request, { ignoreSearch: true }).then((hit) => hit ?? fetch(event.request)));
});
