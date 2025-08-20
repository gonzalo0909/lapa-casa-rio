"use strict";

const DEFAULT_TTL_MIN = Number(process.env.HOLD_TTL_MINUTES || 10);
const holds = new Map();

function nowMs(){ return Date.now(); }
function ttlMs(min){ return Math.max(1, Number(min || DEFAULT_TTL_MIN)) * 60 * 1000; }

function overlaps(aStart, aEnd, bStart, bEnd){
  // rangos de noches [start, end) sin incluir checkout
  return aStart < bEnd && bStart < aEnd;
}

function startHold(holdId, payload = {}, ttlMin = DEFAULT_TTL_MIN){
  const exp = nowMs() + ttlMs(ttlMin);
  const hold = { id: holdId, payload, expiresAt: exp, confirmed: false, createdAt: nowMs() };
  holds.set(holdId, hold);
  return hold;
}

function confirmHold(holdId){
  const h = holds.get(holdId);
  if (!h) return null;
  h.confirmed = true;
  return h;
}

function releaseHold(holdId){
  return holds.delete(holdId);
}

function getHold(holdId){
  return holds.get(holdId) || null;
}

function listActive(){
  const t = nowMs();
  const out = [];
  for (const h of holds.values()){
    if (!h.confirmed && h.expiresAt > t) out.push(h);
  }
  return out;
}

function sweep(){
  const t = nowMs();
  let removed = 0;
  for (const [id, h] of holds) {
    if (!h.confirmed && h.expiresAt <= t) {
      holds.delete(id);
      removed++;
    }
  }
  return removed;
}

// Mapa de ocupación por holds activos para un rango
function getActiveOccupiedMap(from, to){
  const occ = { 1: [], 3: [], 5: [], 6: [] };
  const seen = { 1: new Set(), 3: new Set(), 5: new Set(), 6: new Set() };

  const aStart = new Date(from + "T00:00:00");
  const aEnd   = new Date(to   + "T00:00:00");

  for (const h of listActive()){
    const p = h.payload || {};
    if (!p.entrada || !p.salida || !p.camas) continue;

    const bStart = new Date(p.entrada + "T00:00:00");
    const bEnd   = new Date(p.salida  + "T00:00:00");
    if (!overlaps(aStart, aEnd, bStart, bEnd)) continue;

    for (const [roomId, beds] of Object.entries(p.camas || {})){
      const id = Number(roomId);
      (beds || []).forEach(b => seen[id]?.add(Number(b)));
    }
  }

  for (const k of [1,3,5,6]) occ[k] = Array.from(seen[k]).sort((a,b)=>a-b);
  return occ;
}

module.exports = {
  startHold,
  confirmHold,
  releaseHold,
  getHold,
  listActive,
  sweep,
  getActiveOccupiedMap,
};
