// Keeps CORE working offline. Online: always asks GitHub for the newest version first.
const CACHE = 'core-v8';
const FILES = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'core.m4a', 'core-reverse.m4a'];

self.addEventListener('install', e => {
  // cache: 'reload' skips any old saved copy and downloads fresh files
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Sounds: use the saved copy (big files that rarely change)
  if (url.pathname.endsWith('.m4a')) {
    e.respondWith(caches.match(url.href).then(r => r || fetch(e.request)));
    return;
  }

  // Pages and files from this site: always check GitHub for a newer version
  const sameSite = url.origin === self.location.origin;
  const req = sameSite ? new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }) : e.request;

  e.respondWith(
    fetch(req)
      .then(res => {
        // A page that moved (e.g. /CORE to /CORE/): let the app follow it normally
        if (res.redirected && e.request.mode === 'navigate') return Response.redirect(res.url, 302);
        if (res.ok && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request.url, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request.url).then(r => r || (e.request.mode === 'navigate' ? caches.match('./') : undefined)))
  );
});
