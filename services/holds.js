"use strict";
/**
 * Holds con TTL por reserva (holdId). Agrega camas por cuarto mientras dure el hold.
 * API pública:
 *  - createHold({holdId, ttlMinutes, payload:{ camas, ... }})
 *  - confirmHold(holdId)
 *  - releaseHold(holdId)
 *  - sweepExpired()
 *  - getHoldsMap() → { "1": Set([...beds]), ... } solo activos
 */

const DEFAULT_TTL_MIN = 10;

const holdsById = new Map(); // holdId -> { expiresAt:number, camas:{roomId:[beds]}, meta:{} }

function now(){ return Date.now(); }
function ensureCamas(obj){
  const out = {};
  const src = Object(obj||{});
  for (const k of Object.keys(src)) {
    const arr = Array.isArray(src[k]) ? src[k] : [];
    out[String(k)] = Array.from(new Set(arr.map(n=>Number(n)).filter(n=>Number.isFinite(n) && n>0)));
  }
  return out;
}

function createHold({ holdId, ttlMinutes = DEFAULT_TTL_MIN, payload = {} } = {}) {
  const id = String(holdId || "").trim() || `HOLD-${Date.now()}`;
  const ttl = Math.max(1, Number(ttlMinutes||DEFAULT_TTL_MIN));
  const exp = now() + ttl*60*1000;
  const camas = ensureCamas(payload.camas || payload.camas_json || {});
  const meta  = { ...payload, camas };

  holdsById.set(id, { expiresAt: exp, camas, meta });
  return { ok:true, holdId:id, expiresAt:new Date(exp).toISOString(), ttlMinutes:ttl };
}

function confirmHold(holdId){
  const id = String(holdId||"");
  const existed = holdsById.delete(id);
  return { ok:true, holdId:id, removed: !!existed, status:"confirmed" };
}

function releaseHold(holdId){
  const id = String(holdId||"");
  const existed = holdsById.delete(id);
  return { ok:true, holdId:id, removed: !!existed, status:"released" };
}

function sweepExpired(){
  const t = now();
  let removed = 0;
  for (const [id, h] of holdsById) {
    if (!h || t >= h.expiresAt) { holdsById.delete(id); removed++; }
  }
  return { removed, remaining: holdsById.size };
}

function getHoldsMap(){
  const out = { "1": new Set(), "3": new Set(), "5": new Set(), "6": new Set() };
  const t = now();
  for (const h of holdsById.values()) {
    if (!h || t >= h.expiresAt) continue;
    for (const roomId of Object.keys(h.camas||{})) {
      const set = out[roomId] || (out[roomId] = new Set());
      for (const b of h.camas[roomId]||[]) set.add(Number(b));
    }
  }
  return out;
}

module.exports = { createHold, confirmHold, releaseHold, sweepExpired, getHoldsMap };
