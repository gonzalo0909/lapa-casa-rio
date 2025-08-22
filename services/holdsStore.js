"use strict";

const holds = new Map(); // holdId -> hold
const TTL_MIN = Number(process.env.HOLD_TTL_MINUTES || 10);
const now = () => Date.now();

function sweep() {
  const t = now();
  for (const [id, h] of holds.entries()) {
    if (!h || !h.expiresAt || h.expiresAt <= t || h.status === "released") holds.delete(id);
  }
}
setInterval(sweep, 60_000).unref?.();

function startHold({ holdId, entrada, salida, hombres=0, mujeres=0, camas={}, total=0 }) {
  sweep();
  const id = String(holdId || `HOLD-${Date.now()}`);
  const ttlMs = (TTL_MIN>0?TTL_MIN:10)*60*1000;
  holds.set(id, {
    holdId: id, entrada, salida, hombres:Number(hombres), mujeres:Number(mujeres),
    camas: camas||{}, total:Number(total||0),
    createdAt: new Date(), ttlMs, expiresAt: now()+ttlMs, status:"hold"
  });
  return { holdId:id, expiresAt: now()+ttlMs };
}

function confirmHold(holdId, status="paid") { const h=holds.get(String(holdId)); if(!h) return false; h.status=status; return true; }
function releaseHold(holdId){ const id=String(holdId); if(!holds.has(id)) return false; holds.get(id).status="released"; holds.delete(id); return true; }

function overlaps(aStart, aEnd, bStart, bEnd){ return (aStart<bEnd && bStart<aEnd); }

function getHoldsMap(from, to) {
  sweep();
  const out = {};
  const f = new Date(from+"T00:00:00"), t = new Date(to+"T00:00:00");
  for (const h of holds.values()) {
    if (!(h.status==="hold" || h.status==="paid_pending")) continue;
    if (!overlaps(f,t,new Date(h.entrada+"T00:00:00"), new Date(h.salida+"T00:00:00"))) continue;
    for (const [roomId,beds] of Object.entries(h.camas||{})) {
      const k=String(roomId); if(!out[k]) out[k]=new Set(); (beds||[]).forEach(b=>out[k].add(Number(b)));
    }
  }
  const final={}; for (const [k,set] of Object.entries(out)) final[k]=Array.from(set).sort((a,b)=>a-b);
  return final;
}

function listHolds(){
  sweep();
  return Array.from(holds.values()).map(h => ({ ...h }));
}
function getStats(){
  sweep();
  let total=0, active=0, paid_pending=0;
  for (const h of holds.values()){ total++; if(h.status==="hold") active++; if(h.status==="paid_pending") paid_pending++; }
  return { total, active, paid_pending };
}

module.exports = { startHold, confirmHold, releaseHold, getHoldsMap, listHolds, getStats };
