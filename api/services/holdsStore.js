"use strict";

/**
 * services/holdsStore.js
 * Holds en Redis con TTL, renovación y estados.
 */

const { createClient } = require("redis");

const DEFAULT_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES || 10);
const TTL_SECONDS = Math.max(60, DEFAULT_TTL_MINUTES * 60);

let client = null;

async function getClient() {
  if (client) return client;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL not set");
  client = createClient({ url });
  client.on("error", (e) => console.error("Redis error:", e));
  await client.connect();
  return client;
}

function keyHold(id) {
  return `hold:${id}`;
}

async function getHold(holdId) {
  const c = await getClient();
  const raw = await c.get(keyHold(holdId));
  return raw ? JSON.parse(raw) : null;
}

async function startHold(payload = {}) {
  const c = await getClient();
  const holdId = String(payload.holdId || `HOLD-${Date.now()}`);
  const item = {
    holdId,
    entrada: payload.entrada || "",
    salida: payload.salida || "",
    hombres: Number(payload.hombres || 0),
    mujeres: Number(payload.mujeres || 0),
    camas: payload.camas || {},   // { "1":[2,4], "3":[1] }
    total: Number(payload.total || 0),
    createdAt: new Date().toISOString(),
    status: "hold"
  };
  await c.setEx(keyHold(holdId), TTL_SECONDS, JSON.stringify(item));
  return { ok: true, holdId, expiresAt: Date.now() + TTL_SECONDS * 1000 };
}

async function renewHold(holdId, minutes = 5) {
  const c = await getClient();
  const k = keyHold(holdId);
  const raw = await c.get(k);
  if (!raw) return { ok: false, error: "hold_not_found" };
  const extra = Math.max(60, Number(minutes) * 60);
  const ttl = await c.ttl(k);
  const item = JSON.parse(raw);
  if (!["hold", "paid"].includes(item.status)) return { ok: false, error: "invalid_status" };
  const newTtl = Math.max(60, (ttl > 0 ? ttl : 0) + extra);
  await c.setEx(k, newTtl, raw);
  return { ok: true, expiresAt: Date.now() + newTtl * 1000 };
}

async function confirmHold(holdId, status = "paid") {
  const c = await getClient();
  const k = keyHold(holdId);
  const raw = await c.get(k);
  if (!raw) return { ok: false, error: "hold_not_found" };
  const obj = JSON.parse(raw);

  const next = String(status).toLowerCase();
  const allowed = new Set(["hold", "paid", "confirmed"]);
  if (!allowed.has(next)) return { ok: false, error: "invalid_status" };

  const order = { hold: 1, paid: 2, confirmed: 3 };
  if (order[next] < order[obj.status || "hold"]) return { ok: false, error: "status_regression" };

  obj.status = next;

  const minTtl = next === "confirmed" ? 15 * 60 : 3 * 60;
  const newTtl = minTtl;

  await c.setEx(k, newTtl, JSON.stringify(obj));
  return { ok: true };
}

async function releaseHold(holdId) {
  const c = await getClient();
  const k = keyHold(holdId);
  const raw = await c.get(k);
  if (!raw) return { ok: false, error: "hold_not_found" };
  const obj = JSON.parse(raw);
  obj.status = "released";
  await c.setEx(k, 60 * 5, JSON.stringify(obj));
  return { ok: true };
}

async function listHolds() {
  const c = await getClient();
  const keys = await c.keys("hold:*");
  if (!keys.length) return [];
  const vals = await c.mGet(keys);
  return vals
    .filter(Boolean)
    .map((s) => JSON.parse(s))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * getHoldsMap(from,to) → { 1:[beds], 3:[beds], 5:[beds], 6:[beds] }
 * Solo incluye holds con status "hold" o "paid".
 */
async function getHoldsMap(fromYMD, toYMD) {
  const out = { 1: new Set(), 3: new Set(), 5: new Set(), 6: new Set() };
  const c = await getClient();
  const keys = await c.keys("hold:*");
  if (!keys.length) return { 1: [], 3: [], 5: [], 6: [] };
  const vals = await c.mGet(keys);

  const f = fromYMD ? new Date(fromYMD + "T00:00:00Z") : null;
  const t = toYMD ? new Date(toYMD + "T00:00:00Z") : null;

  for (const raw of vals) {
    if (!raw) continue;
    const h = JSON.parse(raw);
    if (!h || !["hold", "paid"].includes(h.status)) continue;

    const hin = h.entrada ? new Date(h.entrada + "T00:00:00Z") : null;
    const hout = h.salida ? new Date(h.salida + "T00:00:00Z") : null;

    const overlaps = !f && !t
      ? true
      : Boolean((!t || (hin && hin < t)) && (!f || (hout && hout > f)));
    if (!overlaps) continue;

    for (const [roomId, beds] of Object.entries(h.camas || {})) {
      (beds || []).forEach((b) => out[Number(roomId)]?.add(Number(b)));
    }
  }

  return {
    1: Array.from(out[1]).sort((a, b) => a - b),
    3: Array.from(out[3]).sort((a, b) => a - b),
    5: Array.from(out[5]).sort((a, b) => a - b),
    6: Array.from(out[6]).sort((a, b) => a - b)
  };
}

module.exports = {
  getHold,
  startHold,
  renewHold,
  confirmHold,
  releaseHold,
  listHolds,
  getHoldsMap
};
