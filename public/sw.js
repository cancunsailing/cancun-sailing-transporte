// Service worker básico: guarda la app para abrirla con señal débil y muestra la última versión de cada página visitada.
const CACHE = 'cs-transporte-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/manifest.webmanifest', '/icon.svg']))); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(
    fetch(r).then((res) => { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(r, copia)); return res; })
      .catch(() => caches.match(r).then((m) => m || new Response('Sin conexión', { status: 503 }))),
  );
});
