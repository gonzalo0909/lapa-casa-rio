// src/lib/pwa/cache-strategy.ts

interface CacheConfig {
  name: string;
  maxEntries?: number;
  maxAgeSeconds?: number;
  purgeOnQuotaError?: boolean;
}

interface CacheStrategy {
  cacheName: string;
  strategy: 'cacheFirst' | 'networkFirst' | 'staleWhileRevalidate' | 'networkOnly' | 'cacheOnly';
  options?: {
    cacheableResponse?: {
      statuses?: number[];
      headers?: Record<string, string>;
    };
    expiration?: {
      maxEntries?: number;
      maxAgeSeconds?: number;
    };
  };
}

export class CacheStrategyManager {
  private readonly CACHE_PREFIX = 'lapa-casa-';
  private readonly CACHE_VERSION = 'v1';
  
  // Configuraciones de cache específicas
  private readonly cacheConfigs: Record<string, CacheConfig> = {
    static: {
      name: `${this.CACHE_PREFIX}static-${this.CACHE_VERSION}`,
      maxEntries: 100,
      maxAgeSeconds: 7 * 24 * 60 * 60, // 7 días
      purgeOnQuotaError: true
    },
    api: {
      name: `${this.CACHE_PREFIX}api-${this.CACHE_VERSION}`,
      maxEntries: 50,
      maxAgeSeconds: 5 * 60, // 5 minutos
      purgeOnQuotaError: true
    },
    images: {
      name: `${this.CACHE_PREFIX}images-${this.CACHE_VERSION}`,
      maxEntries: 60,
      maxAgeSeconds: 30 * 24 * 60 * 60, // 30 días
      purgeOnQuotaError: true
    },
    booking: {
      name: `${this.CACHE_PREFIX}booking-${this.CACHE_VERSION}`,
      maxEntries: 20,
      maxAgeSeconds: 60 * 60, // 1 hora
      purgeOnQuotaError: false
    },
    user: {
      name: `${this.CACHE_PREFIX}user-${this.CACHE_VERSION}`,
      maxEntries: 10,
      maxAgeSeconds: 24 * 60 * 60, // 24 horas
      purgeOnQuotaError: false
    }
  };

  // Estrategias por tipo de recurso
  private readonly strategies: Record<string, CacheStrategy> = {
    // Recursos estáticos (CSS, JS, fuentes)
    static: {
      cacheName: this.cacheConfigs.static.name,
      strategy: 'cacheFirst',
      options: {
        cacheableResponse: {
          statuses: [0, 200]
        },
        expiration: {
          maxEntries: this.cacheConfigs.static.maxEntries,
          maxAgeSeconds: this.cacheConfigs.static.maxAgeSeconds
        }
      }
    },
    
    // Imágenes del hostel
    images: {
      cacheName: this.cacheConfigs.images.name,
      strategy: 'cacheFirst',
      options: {
        cacheableResponse: {
          statuses: [0, 200]
        },
        expiration: {
          maxEntries: this.cacheConfigs.images.maxEntries,
          maxAgeSeconds: this.cacheConfigs.images.maxAgeSeconds
        }
      }
    },
    
    // API de disponibilidad y precios
    availability: {
      cacheName: this.cacheConfigs.api.name,
      strategy: 'networkFirst',
      options: {
        cacheableResponse: {
          statuses: [200]
        },
        expiration: {
          maxEntries: this.cacheConfigs.api.maxEntries,
          maxAgeSeconds: this.cacheConfigs.api.maxAgeSeconds
        }
      }
    },
    
    // Datos de habitaciones
    rooms: {
      cacheName: this.cacheConfigs.api.name,
      strategy: 'staleWhileRevalidate',
      options: {
        cacheableResponse: {
          statuses: [200]
        },
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 60 * 60 // 1 hora
        }
      }
    },
    
    // Datos de reserva en proceso
    booking: {
      cacheName: this.cacheConfigs.booking.name,
      strategy: 'networkFirst',
      options: {
        cacheableResponse: {
          statuses: [200]
        },
        expiration: {
          maxEntries: this.cacheConfigs.booking.maxEntries,
          maxAgeSeconds: this.cacheConfigs.booking.maxAgeSeconds
        }
      }
    },
    
    // Datos de usuario
    user: {
      cacheName: this.cacheConfigs.user.name,
      strategy: 'networkFirst',
      options: {
        cacheableResponse: {
          statuses: [200]
        },
        expiration: {
          maxEntries: this.cacheConfigs.user.maxEntries,
          maxAgeSeconds: this.cacheConfigs.user.maxAgeSeconds
        }
      }
    },
    
    // Páginas HTML
    pages: {
      cacheName: this.cacheConfigs.static.name,
      strategy: 'staleWhileRevalidate',
      options: {
        cacheableResponse: {
          statuses: [200]
        },
        expiration: {
          maxEntries: 30,
          maxAgeSeconds: 24 * 60 * 60 // 24 horas
        }
      }
    }
  };

  // Determinar estrategia basada en la URL
  getStrategyForRequest(request: Request): CacheStrategy | null {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // Recursos estáticos
    if (this.isStaticAsset(pathname)) {
      return this.strategies.static;
    }
    
    // Imágenes
    if (this.isImage(pathname)) {
      return this.strategies.images;
    }
    
    // APIs específicas
    if (pathname.includes('/api/availability')) {
      return this.strategies.availability;
    }
    
    if (pathname.includes('/api/rooms')) {
      return this.strategies.rooms;
    }
    
    if (pathname.includes('/api/booking') || pathname.includes('/api/payment')) {
      return this.strategies.booking;
    }
    
    if (pathname.includes('/api/user') || pathname.includes('/api/auth')) {
      return this.strategies.user;
    }
    
    // Páginas HTML
    if (request.headers.get('accept')?.includes('text/html')) {
      return this.strategies.pages;
    }
    
    return null;
  }

  // Implementar estrategias de cache

  async cacheFirst(request: Request, cacheName: string): Promise<Response> {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      // Verificar si la respuesta no ha expirado
      if (this.isResponseFresh(cachedResponse, request)) {
        return cachedResponse;
      }
    }
    
    try {
      const networkResponse = await fetch(request);
      
      if (networkResponse.ok) {
        // Agregar metadatos de expiración
        const responseToCache = this.addExpirationHeaders(networkResponse.clone());
        await cache.put(request, responseToCache);
      }
      
      return networkResponse;
    } catch (error) {
      // Si falla la red, devolver cache aunque esté expirado
      if (cachedResponse) {
        return cachedResponse;
      }
      throw error;
    }
  }

  async networkFirst(request: Request, cacheName: string): Promise<Response> {
    const cache = await caches.open(cacheName);
    
    try {
      const networkResponse = await fetch(request);
      
      if (networkResponse.ok) {
        const responseToCache = this.addExpirationHeaders(networkResponse.clone());
        await cache.put(request, responseToCache);
      }
      
      return networkResponse;
    } catch (error) {
      console.log('Red no disponible, buscando en cache para:', request.url);
      
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
      
      throw error;
    }
  }

  async staleWhileRevalidate(request: Request, cacheName: string): Promise<Response> {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    // Actualizar cache en background
    const fetchPromise = fetch(request)
      .then(networkResponse => {
        if (networkResponse.ok) {
          const responseToCache = this.addExpirationHeaders(networkResponse.clone());
          cache.put(request, responseToCache);
        }
        return networkResponse;
      })
      .catch(error => {
        console.log('Error actualizando cache:', error);
        return null;
      });
    
    // Devolver cache inmediatamente si existe
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Si no hay cache, esperar por la red
    return fetchPromise || this.getOfflineFallback(request);
  }

  // Utilidades de cache

  private isStaticAsset(pathname: string): boolean {
    return /\.(css|js|woff2?|ttf|eot|ico|png|jpg|jpeg|gif|svg|webp)$/i.test(pathname) ||
           pathname.includes('/_next/static/') ||
           pathname.includes('/static/');
  }

  private isImage(pathname: string): boolean {
    return /\.(png|jpg|jpeg|gif|svg|webp|avif)$/i.test(pathname) ||
           pathname.includes('/images/') ||
           pathname.includes('/photos/');
  }

  private isResponseFresh(response: Response, request: Request): boolean {
    const cacheControl = response.headers.get('cache-control');
    const expires = response.headers.get('expires');
    const lastModified = response.headers.get('last-modified');
    const etag = response.headers.get('etag');
    
    // Verificar Cache-Control
    if (cacheControl) {
      const maxAge = this.extractMaxAge(cacheControl);
      if (maxAge) {
        const responseTime = new Date(response.headers.get('date') || Date.now());
        const expirationTime = new Date(responseTime.getTime() + maxAge * 1000);
        return new Date() < expirationTime;
      }
    }
    
    // Verificar Expires header
    if (expires) {
      return new Date() < new Date(expires);
    }
    
    // Si no hay información de expiración, considerar fresco por 5 minutos
    const responseTime = new Date(response.headers.get('date') || Date.now());
    const defaultExpiration = new Date(responseTime.getTime() + 5 * 60 * 1000);
    return new Date() < defaultExpiration;
  }

  private extractMaxAge(cacheControl: string): number | null {
    const match = cacheControl.match(/max-age=(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  private addExpirationHeaders(response: Response): Response {
    const headers = new Headers(response.headers);
    
    if (!headers.has('date')) {
      headers.set('date', new Date().toUTCString());
    }
    
    if (!headers.has('cache-control')) {
      headers.set('cache-control', 'max-age=300'); // 5 minutos por defecto
    }
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  private async getOfflineFallback(request: Request): Promise<Response> {
    if (request.headers.get('accept')?.includes('text/html')) {
      const offlinePage = await caches.match('/offline.html');
      return offlinePage || new Response('Página no disponible sin conexión', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    if (request.headers.get('accept')?.includes('application/json')) {
      return new Response(JSON.stringify({
        error: 'Sin conexión',
        message: 'Los datos no están disponibles offline',
        offline: true
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Recurso no disponible sin conexión', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  // Gestión de espacio de almacenamiento

  async checkStorageQuota(): Promise<{ used: number; available: number; percentage: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const available = estimate.quota || 0;
      const percentage = available > 0 ? (used / available) * 100 : 0;
      
      return { used, available, percentage };
    }
    
    return { used: 0, available: 0, percentage: 0 };
  }

  async cleanupExpiredCache(): Promise<void> {
    const cacheNames = await caches.keys();
    
    for (const cacheName of cacheNames) {
      if (cacheName.startsWith(this.CACHE_PREFIX)) {
        await this.cleanupCacheEntries(cacheName);
      }
    }
  }

  private async cleanupCacheEntries(cacheName: string): Promise<void> {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    
    for (const request of requests) {
      const response = await cache.match(request);
      if (response && !this.isResponseFresh(response, request)) {
        await cache.delete(request);
        console.log('Entrada de cache expirada eliminada:', request.url);
      }
    }
  }

  async clearAllCaches(): Promise<void> {
    const cacheNames = await caches.keys();
    
    const deletionPromises = cacheNames
      .filter(name => name.startsWith(this.CACHE_PREFIX))
      .map(name => caches.delete(name));
    
    await Promise.all(deletionPromises);
    console.log('Todos los caches limpiados');
  }

  async getCacheStats(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};
    
    for (const [configName, config] of Object.entries(this.cacheConfigs)) {
      try {
        const cache = await caches.open(config.name);
        const requests = await cache.keys();
        
        stats[configName] = {
          name: config.name,
          entries: requests.length,
          maxEntries: config.maxEntries,
          maxAge: config.maxAgeSeconds
        };
      } catch (error) {
        stats[configName] = {
          name: config.name,
          entries: 0,
          error: error.message
        };
      }
    }
    
    return stats;
  }

  // Precargar recursos críticos
  async precacheResources(urls: string[]): Promise<void> {
    const cache = await caches.open(this.cacheConfigs.static.name);
    
    const precachePromises = urls.map(async url => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
          console.log('Recurso precargado:', url);
        }
      } catch (error) {
        console.error('Error precargando recurso:', url, error);
      }
    });
    
    await Promise.all(precachePromises);
  }
}

// Singleton instance
export const cacheStrategy = new CacheStrategyManager();
