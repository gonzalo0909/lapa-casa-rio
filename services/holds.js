"use strict";
/**
 * /services/holds.js
 * - createHold({holdId, ttlMinutes, payload{entrada,salida,camas,...}})
 * - confirmHold(holdId), releaseHold(holdId), sweepExpired()
 * - getOccupiedBedsBetween(fromISO, toISO): { "1":Set, "3":Set, "5":Set, "6":Set }
 */
const MS = m => m*60*1000;
const store = new Map(); // holdId -> { exp:number, confirmed:boolean, payload:{} }

function now(){ return Date.now(); }
function parseISO(s){ return new Date(String(s).slice(0,10)+"T00:00:00Z"); }
function overlap(aStart,aEnd,bStart,bEnd){ return aStart < bEnd && bStart < aEnd; }

function createHold({ holdId, ttlMinutes=10, payload={} }) {
  const id = String(holdId || ("HOLD-"+Date.now()));
  const exp = now() + MS(Math.max(1, Number(ttlMinutes||10)));
  store.set(id, { exp, confirmed:false, payload });
  return { ok:true, holdId:id, expiresAt: new Date(exp).toISOString() };
}

function confirmHold(holdId) {
  const k = String(holdId||"");
  const item = store.get(k);
  if (!item) return { ok:false, error:"not_found" };
  item.confirmed = true;
  store.set(k, item);
  return { ok:true, holdId:k };
}

function releaseHold(holdId) {
  const k = String(holdId||"");
  if (!store.has(k)) return { ok:false, error:"not_found" };
  store.delete(k);
  return { ok:true, holdId:k };
}

function sweepExpired(){
  const t = now();
  let removed = 0;
  for (const [k,v] of store){
    if (t > v.exp || v.confirmed) { store.delete(k); removed++; }
  }
  return { removed };
}

function getOccupiedBedsBetween(fromISO, toISO) {
  const from = parseISO(fromISO), to = parseISO(toISO);
  const out = { "1": new Set(), "3": new Set(), "5": new Set(), "6": new Set() };
  for (const [, v] of store) {
    if (!v || v.confirmed || now() > v.exp) continue;
    const p = v.payload || {};
    if (!p.entrada || !p.salida) continue;
    const a = parseISO(p.entrada), b = parseISO(p.salida);
    if (!overlap(a,b,from,to)) continue;
    const camas = p.camas || {};
    for (const roomId of Object.keys(camas)) {
      (camas[roomId]||[]).forEach(bed => out[roomId]?.add(Number(bed)));
    }
  }
  return out;
}

module.exports = {
  createHold, confirmHold, releaseHold, sweepExpired, getOccupiedBedsBetween
};
