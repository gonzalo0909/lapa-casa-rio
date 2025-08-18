// services/holds.js
"use strict";
/**
 * /services/holds.js — HOLD por reserva con TTL
 * API:
 *  createHold({ holdId, ttlMinutes, payload:{ camas, ... } })
 *  confirmHold(holdId)
 *  releaseHold(holdId)
 *  sweepExpired()
 *  getHoldsMap()  → { "1": Set([...]), "3": Set([...]), "5": Set([...]), "6": Set([...]) }
 */
const DEFAULT_TTL_MIN = 10;
const holdsById = new Map(); // holdId → { expiresAt:number, camas:{roomId:number[]}, meta:{} }
const ROOMS = ["1","3","5","6"];
const now = () => Date.now();

function normCamas(c) {
  const out = {};
  const src = c && typeof c === "object" ? c : {};
  for (const k of Object.keys(src)) {
    const rid = String(k);
    const arr = Array.isArray(src[k]) ? src[k] : [];
    out[rid] = Array.from(new Set(arr.map(n => Number(n)).filter(n => Number.isFinite(n) && n > 0)));
  }
  return out;
}

function createHold({ holdId, ttlMinutes = DEFAULT_TTL_MIN, payload = {} } = {}) {
  const id  = String(holdId || "").trim() || `HOLD-${Date.now()}`;
  const ttl = Math.max(1, Number(ttlMinutes || DEFAULT_TTL_MIN));
  const exp = now() + ttl * 60 * 1000;

  const camas = normCamas(payload.camas || payload.camas_json || {});
  const meta  = { ...payload, camas };

  holdsById.set(id, { expiresAt: exp, camas, meta });
  return { ok: true, holdId: id, expiresAt: new Date(exp).toISOString(), ttlMinutes: ttl };
}

function confirmHold(holdId) {
  const id = String(holdId || "");
  const removed = holdsById.delete(id);
  return { ok: true, holdId: id, removed: !!removed, status: "confirmed" };
}

function releaseHold(holdId) {
  const id = String(holdId || "");
  const removed = holdsById.delete(id);
  return { ok: true, holdId: id, removed: !!removed, status: "released" };
}

function sweepExpired() {
  const t = now();
  let removed = 0;
  for (const [id, h] of holdsById) {
    if (!h || t >= h.expiresAt) { holdsById.delete(id); removed++; }
  }
  return { removed, remaining: holdsById.size };
}

function getHoldsMap() {
  const out = {};
  for (const r of ROOMS) out[r] = new Set();
  const t = now();
  for (const h of holdsById.values()) {
    if (!h || t >= h.expiresAt) continue;
    for (const rid of Object.keys(h.camas || {})) {
      const set = out[rid] || (out[rid] = new Set());
      for (const b of h.camas[rid]) set.add(Number(b));
    }
  }
  return out;
}

module.exports = { createHold, confirmHold, releaseHold, sweepExpired, getHoldsMap };
