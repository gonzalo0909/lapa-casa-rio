/**
 * services/holdsStore.js
 * Gestiona reservas temporales (HOLDS) en Redis
 * Persistencia, TTL automático y acceso seguro
 */

"use strict";

const { createClient } = require("redis");

// TTL por defecto: 10 minutos
const DEFAULT_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES || 10);
const TTL_MS = DEFAULT_TTL_MINUTES * 60;

// Cliente Redis
let client = null;

async function connectRedis() {
  if (client) return client;
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL no definida en .env");
  }
  client = createClient({ url });
  client.on("error", (err) => console.error("Redis error:", err));
  await client.connect();
  return client;
}

/**
 * Asegura que Redis esté conectado
 */
async function getRedis() {
  if (!client) await connectRedis();
  return client;
}

/**
 * Obtiene un hold por ID
 * @param {string} holdId
 * @returns {Object|null}
 */
async function getHold(holdId) {
  const redis = await getRedis();
  const data = await redis.get(`hold:${holdId}`);
  return data ? JSON.parse(data) : null;
}

/**
 * Crea un nuevo hold con TTL
 * @param {Object} payload
 * @returns {Object} { ok, holdId, expiresAt }
 */
async function startHold(payload = {}) {
  const redis = await getRedis();
  const p = payload;
  const holdId = String(p.holdId || `HOLD-${Date.now()}`);
  const ttlMs = DEFAULT_TTL_MINUTES > 0 ? TTL_MS : 60; // en segundos

  const item = {
    holdId,
    entrada: p.entrada || "",
    salida: p.salida || "",
    hombres: Number(p.hombres || 0),
    mujeres: Number(p.mujeres || 0),
    camas: p.camas || {},
    total: Number(p.total || 0),
    createdAt: new Date().toISOString(),
    ttlSeconds: ttlMs,
    status: "hold"
  };

  await redis.setEx(`hold:${holdId}`, ttlMs, JSON.stringify(item));

  return {
    ok: true,
    holdId,
    expiresAt: Date.now() + ttlMs * 1000
  };
}

/**
 * Confirma un hold (cambia estado)
 * @param {string} holdId
 * @param {string} status
 * @returns {Object} { ok, error? }
 */
async function confirmHold(holdId, status = "paid") {
  const redis = await getRedis();
  const key = `hold:${holdId}`;
  const data = await redis.get(key);
  if (!data) {
    return { ok: false, error: "hold_not_found" };
  }
  const item = JSON.parse(data);
  item.status = status;
  await redis.setEx(key, item.ttlSeconds, JSON.stringify(item));
  return { ok: true };
}

/**
 * Libera un hold (lo elimina)
 * @param {string} holdId
 * @returns {Object} { ok }
 */
async function releaseHold(holdId) {
  const redis = await getRedis();
  await redis.del(`hold:${holdId}`);
  return { ok: true };
}

/**
 * Devuelve todos los holds activos
 * @returns {Array}
 */
async function listHolds() {
  const redis = await getRedis();
  const keys = await redis.keys("hold:*");
  const items = await Promise.all(keys.map(k => redis.get(k)));
  return items
    .map(data => JSON.parse(data))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Devuelve mapa de camas ocupadas por rango de fechas
 * @param {string} fromYMD - Fecha inicio (YYYY-MM-DD)
 * @param {string} toYMD - Fecha fin (YYYY-MM-DD)
 * @returns {Object} { 1: [2,5], 3: [1,3], ... }
 */
async function getHoldsMap(fromYMD, toYMD) {
  const out = { 1: new Set(), 3: new Set(), 5: new Set(), 6: new Set() };
  const f = fromYMD ? new Date(fromYMD + "T00:00:00") : null;
  const t = toYMD ? new Date(toYMD + "T00:00:00") : null;

  const redis = await getRedis();
  const keys = await redis.keys("hold:*");
  const items = await Promise.all(keys.map(k => redis.get(k)));

  for (const data of items) {
    const h = JSON.parse(data);
    if (!h || h.status !== "hold") continue;

    const hin = h.entrada ? new Date(h.entrada + "T00:00:00") : null;
    const hout = h.salida ? new Date(h.salida + "T00:00:00") : null;
    const overlaps = !f && !t 
      ? true 
      : Boolean((!t || (hin && hin < t)) && (!f || (hout && hout > f)));

    if (!overlaps) continue;

    const camas = h.camas || {};
    for (const [roomId, beds] of Object.entries(camas)) {
      (beds || []).forEach(bedId => out[Number(roomId)]?.add(Number(bedId)));
    }
  }

  const result = {};
  for (const k of [1, 3, 5, 6]) {
    result[k] = Array.from(out[k] || []).sort((a, b) => a - b);
  }
  return result;
}

module.exports = {
  getHold,
  startHold,
  confirmHold,
  releaseHold,
  listHolds,
  getHoldsMap,
  connectRedis // útil para inicializar en server.js
};
