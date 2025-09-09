"use strict";

const { createClient } = require("redis");
const { logger } = require('./logger');

const DEFAULT_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES || 3);
const TTL_SECONDS = DEFAULT_TTL_MINUTES * 60;

let client = null;

async function connectRedis() {
  if (client) return client;
  
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL no definida en .env");
  }

  // Configuración para Upstash (Redis en la nube)
  const isUpstash = url.includes('upstash.io');
  const config = {
    url,
    socket: isUpstash ? {
      tls: true,
      rejectUnauthorized: false
    } : undefined,
    retry_delay: 2000,
    connect_timeout: 10000
  };

  client = createClient(config);
  
  client.on("error", (err) => {
    logger.error("Redis error:", err);
  });
  
  client.on("connect", () => {
    logger.info("Redis connected successfully");
  });
  
  client.on("ready", () => {
    logger.info("Redis ready for commands");
  });
  
  await client.connect();
  return client;
}

async function getRedis() {
  if (!client) await connectRedis();
  return client;
}

async function getHold(holdId) {
  try {
    const redis = await getRedis();
    const data = await redis.get(`hold:${holdId}`);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    logger.error(`Error getting hold ${holdId}:`, err);
    return null;
  }
}

async function startHold(payload = {}) {
  try {
    const redis = await getRedis();
    const p = payload;
    const holdId = String(p.holdId || `HOLD-${Date.now()}`);
    const ttlSec = TTL_SECONDS;

    const item = {
      holdId,
      entrada: p.entrada || "",
      salida: p.salida || "",
      hombres: Number(p.hombres || 0),
      mujeres: Number(p.mujeres || 0),
      camas: p.camas || {},
      total: Number(p.total || 0),
      createdAt: new Date().toISOString(),
      ttlSeconds: ttlSec,
      status: "hold"
    };

    await redis.setEx(`hold:${holdId}`, ttlSec, JSON.stringify(item));
    
    logger.info(`Hold created: ${holdId} (expires in ${ttlSec}s)`);

    return {
      ok: true,
      holdId,
      expiresAt: Date.now() + ttlSec * 1000
    };
  } catch (err) {
    logger.error('Error creating hold:', err);
    return { ok: false, error: 'hold_creation_failed' };
  }
}

async function confirmHold(holdId, status = "paid") {
  try {
    const redis = await getRedis();
    const key = `hold:${holdId}`;
    const data = await redis.get(key);
    
    if (!data) {
      return { ok: false, error: "hold_not_found" };
    }
    
    const item = JSON.parse(data);
    item.status = status;
    item.confirmedAt = new Date().toISOString();
    
    // Mantener por más tiempo cuando se confirma
    await redis.setEx(key, 3600, JSON.stringify(item)); // 1 hora
    
    logger.info(`Hold confirmed: ${holdId} with status ${status}`);
    return { ok: true };
  } catch (err) {
    logger.error(`Error confirming hold ${holdId}:`, err);
    return { ok: false, error: 'confirm_failed' };
  }
}

async function releaseHold(holdId) {
  try {
    const redis = await getRedis();
    const deleted = await redis.del(`hold:${holdId}`);
    
    logger.info(`Hold released: ${holdId} (existed: ${deleted > 0})`);
    return { ok: true, existed: deleted > 0 };
  } catch (err) {
    logger.error(`Error releasing hold ${holdId}:`, err);
    return { ok: false, error: 'release_failed' };
  }
}

async function listHolds() {
  try {
    const redis = await getRedis();
    const keys = await redis.keys("hold:*");
    
    if (keys.length === 0) return [];
    
    const items = await Promise.all(
      keys.map(async (k) => {
        try {
          const data = await redis.get(k);
          return data ? JSON.parse(data) : null;
        } catch (err) {
          logger.warn(`Error parsing hold ${k}:`, err);
          return null;
        }
      })
    );
    
    return items
      .filter(Boolean)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (err) {
    logger.error('Error listing holds:', err);
    return [];
  }
}

async function getHoldsMap(fromYMD, toYMD) {
  try {
    const out = { 1: new Set(), 3: new Set(), 5: new Set(), 6: new Set() };
    const f = fromYMD ? new Date(fromYMD + "T00:00:00") : null;
    const t = toYMD ? new Date(toYMD + "T00:00:00") : null;

    const redis = await getRedis();
    const keys = await redis.keys("hold:*");
    
    if (keys.length === 0) {
      return { 1: [], 3: [], 5: [], 6: [] };
    }

    const items = await Promise.all(
      keys.map(async (k) => {
        try {
          const data = await redis.get(k);
          return data ? JSON.parse(data) : null;
        } catch (err) {
          return null;
        }
      })
    );

    for (const h of items.filter(Boolean)) {
      if (!h || h.status !== "hold") continue;

      const hin = h.entrada ? new Date(h.entrada + "T00:00:00") : null;
      const hout = h.salida ? new Date(h.salida + "T00:00:00") : null;
      
      const overlaps = !f && !t
        ? true
        : Boolean((!t || (hin && hin < t)) && (!f || (hout && hout > f)));

      if (!overlaps) continue;

      const camas = h.camas || {};
      for (const [roomId, beds] of Object.entries(camas)) {
        const room = Number(roomId);
        if (out[room] && Array.isArray(beds)) {
          beds.forEach(bedId => out[room].add(Number(bedId)));
        }
      }
    }

    const result = {};
    for (const k of [1, 3, 5, 6]) {
      result[k] = Array.from(out[k] || []).sort((a, b) => a - b);
    }
    
    return result;
  } catch (err) {
    logger.error('Error getting holds map:', err);
    return { 1: [], 3: [], 5: [], 6: [] };
  }
}

// Cleanup de holds expirados (opcional)
async function cleanupExpiredHolds() {
  try {
    const redis = await getRedis();
    const keys = await redis.keys("hold:*");
    let cleaned = 0;
    
    for (const key of keys) {
      const ttl = await redis.ttl(key);
      if (ttl === -2) { // Key doesn't exist
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} expired holds`);
    }
    
    return cleaned;
  } catch (err) {
    logger.error('Error cleaning expired holds:', err);
    return 0;
  }
}

module.exports = {
  getHold,
  startHold,
  confirmHold,
  releaseHold,
  listHolds,
  getHoldsMap,
  connectRedis,
  cleanupExpiredHolds
};
