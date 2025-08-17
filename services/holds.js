"use strict";

/**
 * /services/holds.js
 * Manejo de "holds" (bloqueos temporales de camas)
 */

const HOLD_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES || 10);
let holds = {}; // { hold_id: { expires:number, data:{} } }

/* Crear hold */
function startHold(hold_id, data={}) {
  const expires = Date.now() + HOLD_TTL_MINUTES * 60 * 1000;
  holds[hold_id] = { expires, data };
  return { ok:true, hold_id, expires };
}

/* Confirmar hold → se mantiene */
function confirmHold(hold_id) {
  const h = holds[hold_id];
  if (!h) return { ok:false, error:"hold_not_found" };
  return { ok:true, hold_id, data:h.data };
}

/* Liberar hold */
function releaseHold(hold_id) {
  if (holds[hold_id]) {
    delete holds[hold_id];
    return { ok:true };
  }
  return { ok:false, error:"hold_not_found" };
}

/* Limpiar holds expirados */
function sweepHolds() {
  const now = Date.now();
  for (const [id,h] of Object.entries(holds)) {
    if (h.expires < now) delete holds[id];
  }
  return { ok:true, active:Object.keys(holds).length };
}

module.exports = { startHold, confirmHold, releaseHold, sweepHolds };
