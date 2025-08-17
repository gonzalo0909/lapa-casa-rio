"use strict";
/**
 * services/holds.js – holds de camas
 * Exporta: createHold, releaseHold, confirmHold, sweepExpired
 */
const HOLD_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES || 10);
const holds = Object.create(null);
const now = () => Date.now();
const ttlMs = (min)=> (min>0?min:10)*60*1000;

function createHold({ holdId, ttlMinutes = HOLD_TTL_MINUTES, payload = {} } = {}) {
  if (!holdId) return { ok:false, error:"hold_id_required" };
  const rec = holds[holdId] || { payload:{}, status:"hold" };
  rec.payload = { ...(rec.payload||{}), ...(payload||{}) };
  rec.status  = "hold";
  rec.expires = now() + ttlMs(ttlMinutes);
  holds[holdId] = rec;
  return { ok:true, holdId, expires: rec.expires };
}
function releaseHold(holdId="") {
  const rec = holds[holdId]; if (!rec) return { ok:false, error:"hold_not_found" };
  delete holds[holdId]; return { ok:true, holdId };
}
function confirmHold(holdId="", status="paid") {
  const rec = holds[holdId]; if (!rec) return { ok:false, error:"hold_not_found" };
  delete holds[holdId]; return { ok:true, holdId, status };
}
function sweepExpired() {
  const t = now(); let purged = 0;
  for (const [id, rec] of Object.entries(holds)) if (!rec.expires || rec.expires < t) { delete holds[id]; purged++; }
  return { ok:true, purged, active:Object.keys(holds).length };
}
module.exports = { createHold, releaseHold, confirmHold, sweepExpired };
