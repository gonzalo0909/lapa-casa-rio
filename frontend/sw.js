const CACHE_NAME = 'hostel-v1.0.0';
const STATIC_CACHE = [
  '/',
  '/index.html',
  '/css/styles.min.css',
  '/js/main.min.js',
  'https://js.stripe.com/v3/'
];

// Install event
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_CACHE);
      })
      .then(() => {
        console.log('[SW] Installation complete');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[SW] Installation failed:', error);
      })
  );
});

// Activate event
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    }).then(() => {
      console.log('[SW] Activation complete');
      return self.clients.claim();
    })
  );
});

// Fetch event - Network First for API, Cache First for assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // API requests - Network First
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Only cache successful responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(event.request)
            .then(response => {
              if (response) {
                console.log('[SW] Serving API from cache:', event.request.url);
                return response;
              }
              // Return offline message for API failures
              return new Response(
                JSON.stringify({ 
                  error: 'Offline', 
                  message: 'No hay conexión a internet' 
                }), 
                {
                  status: 503,
                  headers: { 'Content-Type': 'application/json' }
                }
              );
            });
        })
    );
    return;
  }
  
  // Static assets - Cache First
  if (event.request.destination === 'style' || 
      event.request.destination === 'script' || 
      event.request.destination === 'document') {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            console.log('[SW] Serving from cache:', event.request.url);
            return response;
          }
          
          return fetch(event.request)
            .then(response => {
              // Cache successful responses
              if (response.status === 200) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(event.request, responseClone);
                });
              }
              return response;
            })
            .catch(error => {
              console.error('[SW] Fetch failed:', error);
              // Return offline page for failed document requests
              if (event.request.destination === 'document') {
                return new Response(
                  `<!DOCTYPE html>
                   <html><head><title>Offline</title></head>
                   <body style="font-family: Arial; text-align: center; padding: 50px;">
                     <h1>Sin conexión</h1>
                     <p>Por favor, verifica tu conexión a internet.</p>
                     <button onclick="location.reload()">Intentar de nuevo</button>
                   </body></html>`,
                  { headers: { 'Content-Type': 'text/html' } }
                );
              }
              throw error;
            });
        })
    );
    return;
  }
  
  // For all other requests, just fetch normally
  event.respondWith(fetch(event.request));
});
