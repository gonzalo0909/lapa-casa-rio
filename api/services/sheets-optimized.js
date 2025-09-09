"use strict";

const cache = require('./cache');
const logger = require('./logger');

class SheetsService {
  constructor() {
    this.baseUrl = process.env.BOOKINGS_WEBAPP_URL;
    this.requestCache = new Map();
    this.batchQueue = [];
    this.batchTimeout = null;
  }

  // Optimized fetch with intelligent caching
  async fetchRowsFromSheet(from, to, useCache = true) {
    const cacheKey = `rows:${from || 'all'}:${to || 'all'}`;
    
    if (useCache) {
      const cached = await cache.get(cacheKey);
      if (cached) {
        logger.debug(`Cache hit for ${cacheKey}`);
        return cached;
      }
    }

    try {
      const url = `${this.baseUrl}?mode=rows`;
      const response = await this.fetchWithRetry(url, 3);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const rows = Array.isArray(data.rows) ? data.rows : [];
      
      const filtered = this.filterByDateRange(rows, from, to);
      
      // Cache for 60 seconds
      await cache.set(cacheKey, filtered, 60);
      
      logger.debug(`Fetched ${filtered.length} rows from sheets`);
      return filtered;
      
    } catch (err) {
      logger.error('Sheets fetch failed:', err.message);
      
      // Return cached data if available, even if expired
      const staleCache = await cache.get(cacheKey, false);
      if (staleCache) {
        logger.warn('Using stale cache due to fetch error');
        return staleCache;
      }
      
      return [];
    }
  }

  async fetchWithRetry(url, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, {
          headers: { "Accept": "application/json" },
          timeout: 10000
        });
        return response;
      } catch (err) {
        if (i === maxRetries - 1) throw err;
        logger.warn(`Retry ${i + 1} for ${url}: ${err.message}`);
        await this.sleep(delay * Math.pow(2, i)); // Exponential backoff
      }
    }
  }

  filterByDateRange(rows, from, to) {
    if (!from && !to) return rows;

    const fromDate = from ? new Date(`${from}T00:00:00`) : null;
    const toDate = to ? new Date(`${to}T00:00:00`) : null;

    return rows.filter(row => {
      if (!row.entrada || !row.salida) return false;
      
      const checkIn = new Date(`${row.entrada}T00:00:00`);
      const checkOut = new Date(`${row.salida}T00:00:00`);

      // No overlap if checkout <= range start OR checkin >= range end
      if (fromDate && checkOut <= fromDate) return false;
      if (toDate && checkIn >= toDate) return false;

      return true;
    });
  }

  // Batch processing for multiple date range queries
  async batchFetchRanges(ranges) {
    const results = new Map();
    const uniqueRanges = this.deduplicateRanges(ranges);
    
    const promises = uniqueRanges.map(async range => {
      const data = await this.fetchRowsFromSheet(range.from, range.to);
      results.set(`${range.from}:${range.to}`, data);
    });
    
    await Promise.all(promises);
    return results;
  }

  deduplicateRanges(ranges) {
    const seen = new Set();
    return ranges.filter(range => {
      const key = `${range.from}:${range.to}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Optimized occupied beds calculation
  calcOccupiedBeds(rows, holdsMap = {}) {
    const occupied = { 1: new Set(), 3: new Set(), 5: new Set(), 6: new Set() };
    const validStatuses = new Set(['approved', 'paid', 'confirmed', 'succeeded']);

    // Process bookings
    for (const row of rows) {
      if (!validStatuses.has(String(row.pay_status || '').toLowerCase())) {
        continue;
      }

      let camas = {};
      try {
        camas = row.camas_json ? JSON.parse(row.camas_json) : (row.camas || {});
      } catch (e) {
        camas = row.camas || {};
      }

      for (const [roomId, beds] of Object.entries(camas)) {
        const room = Number(roomId);
        if (occupied[room] && Array.isArray(beds)) {
          beds.forEach(bedId => occupied[room].add(Number(bedId)));
        }
      }
    }

    // Add holds
    for (const [roomId, beds] of Object.entries(holdsMap)) {
      const room = Number(roomId);
      if (occupied[room] && Array.isArray(beds)) {
        beds.forEach(bedId => occupied[room].add(Number(bedId)));
      }
    }

    // Convert to sorted arrays
    const result = {};
    for (const roomId of [1, 3, 5, 6]) {
      result[roomId] = Array.from(occupied[roomId] || []).sort((a, b) => a - b);
    }
    
    return result;
  }

  async invalidateCache(pattern = 'rows:*') {
    await cache.invalidate(pattern);
    logger.debug(`Invalidated cache: ${pattern}`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats() {
    return {
      baseUrl: this.baseUrl ? 'configured' : 'missing',
      requestCacheSize: this.requestCache.size,
      batchQueueSize: this.batchQueue.length
    };
  }
}

module.exports = new SheetsService();
