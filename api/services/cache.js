"use strict";

/**
 * services/cache.js
 * Cache simple (Redis) para disponibilidad
 */

const { createClient } = require("redis");
let client;

async function getClient() {
  if (!client) {
    client = createClient({ url: process.env.REDIS_URL });
    client.on("error", (err) => console.error("Redis error:", err));
    await client.connect();
  }
  return client;
}

async function cacheGet(key) {
  try {
    const c = await getClient();
    const val = await c.get(`cache:${key}`);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

async function cacheSet(key, value, ttlSec) {
  try {
    const c = await getClient();
    await c.setEx(`cache:${key}`, ttlSec, JSON.stringify(value));
  } catch {}
}

async function cacheInvalidate() {
  try {
    const c = await getClient();
    const keys = await c.keys("cache:*");
    if (keys.length) await c.del(keys);
  } catch {}
}

module.exports = { cacheGet, cacheSet, cacheInvalidate };
