/**
 * SERVICE WORKER - LAPA CASA HOSTEL
 * Cache offline y optimización de recursos
 */

const CACHE_NAME = 'lapa-casa-hostel-v1.0.0';
const CACHE_VERSION = 1;

// Archivos críticos para cache
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/assets/css/styles.min.css',
  '/assets/js/main.min.js',
  '/favicon.ico'
];

// Archivos adicionales para cache (opcional)
const ADDITIONAL_ASSETS = [
  // Se pueden agregar imágenes, fonts, etc.
];

// URLs que NO deben ser cacheadas
const EXCLUDE_CACHE = [
  '/api/',
  'chrome-extension://',
  'https://js.stripe.com/',
  'https://sdk.mercadopago.com/',
  'https://api.stripe.com/',
  'https://api.mercadopago.com/'
];

/**
 * Instalación del Service Worker
 */
self.addEventListener('install', event => {
  console.log('[SW] Instalando Service Worker v' + CACHE_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cacheando archivos críticos');
        return cache.addAll(CORE_ASSETS);
      })
      .then(() => {
        console.log('[SW] Archivos críticos cacheados exitosamente');
        // Forzar activación inmediata
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[SW] Error cacheando archivos críticos:', error);
      })
  );
});

/**
 * Activación del Service Worker
 */
self.addEventListener('activate', event => {
  console.log('[SW] Activando Service Worker v' + CACHE_VERSION);
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        // Limpiar caches viejos
        const deletePromises = cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Eliminando cache viejo:', name);
            return caches.delete(name);
          });
        
        return Promise.all(deletePromises);
      })
      .then(() => {
        console.log('[SW] Cache cleanup completado');
        // Tomar control inmediatamente
        return self.clients.claim();
      })
      .catch(error => {
        console.error('[SW] Error en activación:', error);
      })
  );
});

/**
 * Intercepción de requests (fetch)
 */
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // No cachear URLs excluidas
  if (shouldExcludeFromCache(request.url)) {
    return; // Dejar que el navegador maneje la request
  }
  
  // Solo manejar GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    handleFetchRequest(request)
  );
});

/**
 * Manejar requests con estrategia cache-first para assets, network-first para API
 */
async function handleFetchRequest(request) {
  const url = new URL(request.url);
  
  try {
    // Estrategia para archivos estáticos (CSS, JS, imágenes)
    if (isStaticAsset(request.url)) {
      return await cacheFirstStrategy(request);
    }
    
    // Estrategia para HTML y API calls
    return await networkFirstStrategy(request);
    
  } catch (error) {
    console.warn('[SW] Error manejando request:', error);
    
    // Fallback para páginas HTML
    if (request.destination === 'document') {
      const cachedIndex = await caches.match('/index.html');
      if (cachedIndex) {
        return cachedIndex;
      }
    }
    
    // Fallback genérico
    return new Response('Recurso no disponible offline', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

/**
 * Estrategia Cache First (para assets estáticos)
 */
async function cacheFirstStrategy(request) {
  // Buscar primero en cache
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Si no está en cache, buscar en red y cachear
  try {
    const networkResponse = await fetch(request);
    
    // Solo cachear respuestas exitosas
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.warn('[SW] Network failed para:', request.url);
    throw error;
  }
}

/**
 * Estrategia Network First (para HTML y API)
 */
async function networkFirstStrategy(request) {
  try {
    // Intentar red primero
    const networkResponse = await fetch(request);
    
    // Si es exitoso y es HTML, cachear para offline
    if (networkResponse.ok && request.destination === 'document') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Si falla la red, buscar en cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

/**
 * Verificar si una URL debe excluirse del cache
 */
function shouldExcludeFromCache(url) {
  return EXCLUDE_CACHE.some(pattern => url.includes(pattern));
}

/**
 * Verificar si es un asset estático
 */
function isStaticAsset(url) {
  return /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)(\?.*)?$/i.test(url);
}

/**
 * Manejo de mensajes desde la aplicación principal
 */
self.addEventListener('message', event => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_CACHE_INFO':
      getCacheInfo().then(info => {
        event.ports[0].postMessage(info);
      });
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;
      
    case 'UPDATE_CACHE':
      updateCache().then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;
      
    default:
      console.warn('[SW] Mensaje desconocido:', type);
  }
});

/**
 * Obtener información del cache
 */
async function getCacheInfo() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    
    return {
      cacheName: CACHE_NAME,
      cacheVersion: CACHE_VERSION,
      cachedCount: keys.length,
      cachedUrls: keys.map(req => req.url)
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Limpiar todos los caches
 */
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  const deletePromises = cacheNames.map(name => caches.delete(name));
  return Promise.all(deletePromises);
}

/**
 * Actualizar cache con nuevos recursos
 */
async function updateCache() {
  const cache = await caches.open(CACHE_NAME);
  return cache.addAll(CORE_ASSETS);
}

/**
 * Manejo de errores globales
 */
self.addEventListener('error', event => {
  console.error('[SW] Error global:', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('[SW] Promise rejection no manejada:', event.reason);
});

/**
 * Logging para debugging
 */
console.log('[SW] Service Worker cargado - Lapa Casa Hostel v' + CACHE_VERSION);
