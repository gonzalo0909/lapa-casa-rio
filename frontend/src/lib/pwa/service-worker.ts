// src/lib/pwa/service-worker.ts

const CACHE_NAME = 'lapa-casa-hostel-v1';
const STATIC_CACHE_NAME = 'lapa-casa-static-v1';
const DYNAMIC_CACHE_NAME = 'lapa-casa-dynamic-v1';

// Recursos estáticos para cachear
const STATIC_ASSETS = [
  '/',
  '/pt',
  '/en',
  '/es',
  '/manifest.json',
  '/offline.html',
  '/images/logo.png',
  '/images/rooms/',
  '/fonts/inter.woff2'
];

// Rutas API críticas para cachear
const API_ROUTES = [
  '/api/rooms',
  '/api/availability',
  '/api/pricing'
];

// Instalar service worker
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    Promise.all([
      // Cache estático
      caches.open(STATIC_CACHE_NAME).then(cache => {
        return cache.addAll(STATIC_ASSETS);
      }),
      // Cache dinámico
      caches.open(DYNAMIC_CACHE_NAME).then(cache => {
        return cache.addAll([]);
      })
    ]).then(() => {
      console.log('✅ Service Worker instalado y cache inicializado');
      return self.skipWaiting();
    })
  );
});

// Activar service worker
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    Promise.all([
      // Limpiar caches antiguos
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME) {
              console.log('🗑️ Eliminando cache antiguo:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Tomar control de todas las páginas
      self.clients.claim()
    ]).then(() => {
      console.log('✅ Service Worker activado');
    })
  );
});

// Interceptar peticiones de red
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo manejar peticiones del mismo origen
  if (url.origin !== location.origin) {
    return;
  }

  // Estrategia para diferentes tipos de recursos
  if (request.method === 'GET') {
    // Recursos estáticos: Cache First
    if (isStaticAsset(request.url)) {
      event.respondWith(cacheFirst(request));
    }
    // API calls: Network First con fallback
    else if (isApiCall(request.url)) {
      event.respondWith(networkFirstWithFallback(request));
    }
    // Páginas HTML: Stale While Revalidate
    else if (request.headers.get('accept')?.includes('text/html')) {
      event.respondWith(staleWhileRevalidate(request));
    }
    // Otros recursos: Network First
    else {
      event.respondWith(networkFirst(request));
    }
  }
});

// Manejar mensajes del cliente
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_BOOKING_DATA') {
    cacheBookingData(event.data.payload);
  }
});

// Estrategias de cache

// Cache First: Para recursos estáticos
async function cacheFirst(request: Request): Promise<Response> {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('❌ Error en cache first:', error);
    return getOfflineFallback(request);
  }
}

// Network First: Para datos dinámicos
async function networkFirst(request: Request): Promise<Response> {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('🔄 Red no disponible, buscando en cache');
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return getOfflineFallback(request);
  }
}

// Network First con fallback específico para API
async function networkFirstWithFallback(request: Request): Promise<Response> {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('🔄 API no disponible, usando cache');
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback específico para APIs críticas
    return new Response(JSON.stringify({
      error: 'Sin conexión',
      offline: true,
      cached: false
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Stale While Revalidate: Para páginas HTML
async function staleWhileRevalidate(request: Request): Promise<Response> {
  const cache = await caches.open(DYNAMIC_CACHE_NAME);
  const cachedResponse = await cache.match(request);

  // Actualizar cache en background
  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => null);

  // Devolver cache inmediatamente si existe
  if (cachedResponse) {
    return cachedResponse;
  }

  // Si no hay cache, esperar por la red
  try {
    return await fetchPromise || getOfflineFallback(request);
  } catch (error) {
    return getOfflineFallback(request);
  }
}

// Utilidades

function isStaticAsset(url: string): boolean {
  return url.includes('/images/') || 
         url.includes('/fonts/') || 
         url.includes('/icons/') ||
         url.endsWith('.css') ||
         url.endsWith('.js') ||
         url.endsWith('.woff2');
}

function isApiCall(url: string): boolean {
  return url.includes('/api/') || API_ROUTES.some(route => url.includes(route));
}

async function getOfflineFallback(request: Request): Promise<Response> {
  if (request.headers.get('accept')?.includes('text/html')) {
    const offlinePage = await caches.match('/offline.html');
    return offlinePage || new Response('Página no disponible sin conexión', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  if (request.headers.get('accept')?.includes('application/json')) {
    return new Response(JSON.stringify({
      error: 'Datos no disponibles sin conexión',
      offline: true
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response('Recurso no disponible sin conexión', {
    status: 503,
    headers: { 'Content-Type': 'text/plain' }
  });
}

// Cache datos específicos de reserva para uso offline
async function cacheBookingData(data: any): Promise<void> {
  try {
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const response = new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
    await cache.put('/api/booking/offline-data', response);
    console.log('💾 Datos de reserva cacheados para uso offline');
  } catch (error) {
    console.error('❌ Error cacheando datos de reserva:', error);
  }
}

// Notificar updates disponibles
self.addEventListener('message', (event) => {
  if (event.data?.type === 'CHECK_FOR_UPDATES') {
    // Verificar si hay nueva versión disponible
    event.ports[0].postMessage({
      type: 'UPDATE_AVAILABLE',
      available: false // Implementar lógica de detección
    });
  }
});

export {};
