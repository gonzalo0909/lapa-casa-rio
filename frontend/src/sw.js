const CACHE_VERSION = '2.0.0';
const CACHE_NAMES = {
  static: `hostel-static-v${CACHE_VERSION}`,
  dynamic: `hostel-dynamic-v${CACHE_VERSION}`,
  api: `hostel-api-v${CACHE_VERSION}`
};

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/css/styles.css',
  '/assets/js/config.js',
  '/assets/js/main.js',
  '/assets/js/core/api-client.js',
  '/assets/js/business/room-manager.js',
  '/assets/js/ui/toast-manager.js',
  '/favicon.ico'
];

// Install event
self.addEventListener('install', event => {
  console.log('[SW] Installing version', CACHE_VERSION);
  
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAMES.static).then(cache => {
        return cache.addAll(STATIC_ASSETS);
      }),
      caches.open(CACHE_NAMES.dynamic),
      caches.open(CACHE_NAMES.api)
    ]).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate event
self.addEventListener('activate', event => {
  console.log('[SW] Activating version', CACHE_VERSION);
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      const deletePromises = cacheNames
        .filter(cacheName => !Object.values(CACHE_NAMES).includes(cacheName))
        .map(cacheName => {
          console.log('[SW] Deleting old cache:', cacheName);
          return caches.delete(cacheName);
        });
      
      return Promise.all(deletePromises);
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch event
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Handle API requests
  if (url.pathname.includes('/api/')) {
    event.respondWith(handleAPIRequest(request));
    return;
  }
  
  // Handle static assets
  if (STATIC_ASSETS.some(asset => url.pathname.endsWith(asset)) || 
      url.pathname.includes('/assets/')) {
    event.respondWith(handleStaticRequest(request));
    return;
  }
  
  // Handle other requests
  event.respondWith(handleDynamicRequest(request));
});

// API request handler - Network first with fallback
async function handleAPIRequest(request) {
  const cache = await caches.open(CACHE_NAMES.api);
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    console.log('[SW] API network failed, trying cache');
    
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline response for API
    return new Response(
      JSON.stringify({
        error: true,
        message: 'Offline mode active',
        offline: true,
        data: getOfflineData(request)
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Static request handler - Cache first
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAMES.static);
  
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    // Return offline page for documents
    if (request.destination === 'document') {
      return generateOfflinePage();
    }
    
    throw error;
  }
}

// Dynamic request handler - Stale while revalidate
async function handleDynamicRequest(request) {
  const cache = await caches.open(CACHE_NAMES.dynamic);
  
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);
  
  return cachedResponse || fetchPromise || generateOfflinePage();
}

// Generate offline data for API requests
function getOfflineData(request) {
  const url = new URL(request.url);
  
  if (url.pathname.includes('/availability')) {
    return {
      room1: 12,
      room3: 12, 
      room5: 7,
      room6: 7,
      totalAvailable: 38,
      occupiedBeds: {},
      message: 'Datos simulados - modo offline'
    };
  }
  
  if (url.pathname.includes('/health')) {
    return {
      status: 'offline',
      timestamp: new Date().toISOString(),
      message: 'Service Worker activo'
    };
  }
  
  return null;
}

// Generate offline page
function generateOfflinePage() {
  const offlineHTML = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <title>Offline - Lapa Casa Hostel</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          background: #f9fafb;
          margin: 0;
          padding: 2rem;
          text-align: center;
          color: #374151;
        }
        .container {
          max-width: 400px;
          margin: 2rem auto;
          background: white;
          padding: 2rem;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        h1 { color: #f59e0b; margin-bottom: 1rem; }
        .btn {
          background: #f59e0b;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          cursor: pointer;
          margin-top: 1rem;
        }
        .status {
          background: #fee2e2;
          color: #dc2626;
          padding: 0.5rem;
          border-radius: 6px;
          margin: 1rem 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🏠 Lapa Casa Hostel</h1>
        <div class="status">📡 Sin conexión</div>
        <p>No hay conexión a internet. Algunas funciones están limitadas.</p>
        <p>Conecta a internet para acceder a todas las funcionalidades.</p>
        <button class="btn" onclick="location.reload()">
          🔄 Intentar de nuevo
        </button>
        <p style="font-size: 0.875rem; color: #6b7280; margin-top: 2rem;">
          Powered by Service Worker v${CACHE_VERSION}
        </p>
      </div>
    </body>
    </html>
  `;
  
  return new Response(offlineHTML, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}
