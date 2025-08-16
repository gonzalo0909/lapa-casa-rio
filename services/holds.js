// services/holds.js
"use strict";

/**
 * HOLDs in-memory (simple) + helpers to mirror Sheet state.
 * ENV: HOLD_TTL_MINUTES (default 10)
 */
const { postToSheets } = require("./sheets");
const HOLD_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES || 10);

const holdsMem = new Map(); // holdId -> { expiresAt }

function ttlMs(min=HOLD_TTL_MINUTES){ return Math.max(1, min) * 60_000; }

async function createHold({ holdId, payload, ttlMinutes }){
  const id = holdId || `HOLD-${Date.now()}`;
  const expiresAt = Date.now() + ttlMs(ttlMinutes);
  await postToSheets({
    action:"upsert_booking",
    booking_id: id,
    nombre: payload.nombre || "HOLD",
    email: payload.email || "",
    telefono: payload.telefono || "",
    entrada: payload.entrada || "",
    salida: payload.salida || "",
    hombres: Number(payload.hombres || 0),
    mujeres: Number(payload.mujeres || 0),
    camas_json: JSON.stringify(payload.camas || {}),
    total: Number(payload.total || 0),
    pay_status: "hold"
  });
  holdsMem.set(id, { expiresAt });
  return { ok:true, holdId:id, expiresAt };
}

async function releaseHold(holdId){
  if (!holdId) return { ok:false, error:"missing_holdId" };
  await postToSheets({ action:"upsert_booking", booking_id: holdId, pay_status:"released" });
  holdsMem.delete(holdId);
  return { ok:true, holdId };
}

async function confirmHold(holdId, status="paid"){
  if (!holdId) return { ok:false, error:"missing_holdId" };
  await postToSheets({ action:"upsert_booking", booking_id: holdId, pay_status: status });
  holdsMem.delete(holdId);
  return { ok:true, holdId, status };
}

function sweepExpired(){
  const now = Date.now();
  let pruned = 0;
  for (const [id,meta] of holdsMem.entries()){
    if (meta.expiresAt < now) { holdsMem.delete(id); pruned++; }
  }
  return { pruned, holds: holdsMem.size };
}

module.exports = {
  holdsMem,
  createHold,
  releaseHold,
  confirmHold,
  sweepExpired
};
