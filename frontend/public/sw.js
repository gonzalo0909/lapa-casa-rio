// lapa-casa-hostel/frontend/public/sw.js
// Service Worker — Lapa Casa Rio
// Estrategia: Cache-first para assets estáticos, Network-first para páginas y API.

const CACHE_VERSION = 'v1';
const STATIC_CACHE  = `lapa-static-${CACHE_VERSION}`;
const PAGES_CACHE   = `lapa-pages-${CACHE_VERSION}`;

// Assets estáticos que se pre-cachean al instalar
const PRECACHE_ASSETS = [
  '/manifest.json',
  '/favicon.ico',
];

// Rutas que nunca se cachean (API, admin, pagos)
const NEVER_CACHE = [
  '/api/',
  '/admin/',
  '/payment',
  '/_next/webpack-hmr',
];

// ─── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate ───────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== PAGES_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch ──────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo interceptamos peticiones GET al mismo origen
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Rutas que nunca se cachean
  if (NEVER_CACHE.some((path) => url.pathname.startsWith(path))) return;

  // Assets estáticos (_next/static, imágenes, fuentes) → Cache-first
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/img/') ||
    url.pathname.match(/\.(png|jpg|jpeg|webp|svg|ico|woff2?|ttf)$/)
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Páginas HTML → Network-first con fallback a caché
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request, PAGES_CACHE));
    return;
  }

  // Todo lo demás → Network-first
  event.respondWith(networkFirst(request, PAGES_CACHE));
});

// ─── Estrategias ────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Offline — verifique sua conexão.', { status: 503 });
  }
}
