"use strict";

const { createClient } = require("redis");
const logger = require("./logger");

class CacheService {
  constructor() {
    this.redis = null;
    this.memoryCache = new Map();
    this.memoryCacheMaxSize = 1000;
    this.isConnected = false;
  }

  async connect() {
    if (this.redis && this.isConnected) return;
    
    try {
      // Configuración específica para Upstash Redis
      const redisConfig = {
        url: process.env.REDIS_URL,
        socket: {
          tls: true,
          rejectUnauthorized: false
        },
        retry_delay: 2000,
        connect_timeout: 10000,
        command_timeout: 5000
      };
      
      this.redis = createClient(redisConfig);
      
      this.redis.on('error', (err) => {
        logger.error('Redis error:', err);
        this.isConnected = false;
      });
      
      this.redis.on('connect', () => {
        logger.info('Redis connected to Upstash');
        this.isConnected = true;
      });
      
      this.redis.on('ready', () => {
        logger.info('Redis ready');
        this.isConnected = true;
      });
      
      this.redis.on('end', () => {
        logger.warn('Redis connection ended');
        this.isConnected = false;
      });
      
      await this.redis.connect();
    } catch (err) {
      logger.error('Redis connection failed:', err);
      this.isConnected = false;
    }
  }

  // Redis cache con fallback a memoria
  async get(key, useMemory = true) {
    try {
      if (this.isConnected) {
        const data = await this.redis.get(key);
        if (data) return JSON.parse(data);
      }
    } catch (err) {
      logger.warn('Redis get failed, using memory cache:', err.message);
    }
    
    if (useMemory && this.memoryCache.has(key)) {
      const item = this.memoryCache.get(key);
      if (Date.now() < item.expires) {
        return item.data;
      }
      this.memoryCache.delete(key);
    }
    
    return null;
  }

  async set(key, data, ttlSeconds = 300) {
    const serialized = JSON.stringify(data);
    
    try {
      if (this.isConnected) {
        await this.redis.setEx(key, ttlSeconds, serialized);
      }
    } catch (err) {
      logger.warn('Redis set failed, using memory cache:', err.message);
    }
    
    // Memory cache fallback
    this.memoryCache.set(key, {
      data,
      expires: Date.now() + (ttlSeconds * 1000)
    });
    
    // Limit memory cache size
    if (this.memoryCache.size > this.memoryCacheMaxSize) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }
  }

  async invalidate(pattern) {
    try {
      if (this.isConnected) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(keys);
        }
      }
    } catch (err) {
      logger.warn('Redis invalidate failed:', err.message);
    }
    
    // Memory cache invalidation
    for (const key of this.memoryCache.keys()) {
      if (key.includes(pattern.replace('*', ''))) {
        this.memoryCache.delete(key);
      }
    }
  }

  // Cache específico para availability
  async getAvailability(from, to) {
    const key = `avail:${from}:${to}`;
    return this.get(key);
  }

  async setAvailability(from, to, data) {
    const key = `avail:${from}:${to}`;
    return this.set(key, data, 120); // 2 minutos
  }

  async invalidateAvailability() {
    return this.invalidate('avail:*');
  }

  // Cache para bookings
  async getBookings(cacheKey) {
    return this.get(`bookings:${cacheKey}`);
  }

  async setBookings(cacheKey, data) {
    return this.set(`bookings:${cacheKey}`, data, 60); // 1 minuto
  }

  getStats() {
    return {
      redis: {
        connected: this.isConnected,
        url: process.env.REDIS_URL ? 'configured' : 'missing'
      },
      memory: {
        entries: this.memoryCache.size,
        maxSize: this.memoryCacheMaxSize
      }
    };
  }

  async destroy() {
    this.memoryCache.clear();
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

module.exports = new CacheService();
