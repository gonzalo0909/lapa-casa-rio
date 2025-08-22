"use strict";

/**
 * Store de HOLDs en memoria (compartido por rutas/servicios).
 * TTL configurable por .env HOLD_TTL_MINUTES (default 10).
 * Estructura de un hold:
 * {
 *   holdId, entrada, salida, hombres, mujeres,
 *   camas: { [roomId:number]: number[] },
 *   total, createdAt: Date, ttlMs, expiresAt: number, status: 'hold'|'paid'|'released'
 * }
 */

const holds = new Map(); // holdId -> hold object
const DEFAULT_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES || 10);

const nowMs = () => Date.now();

function sweepExpired() {
  const cutoff = nowMs();
  for (const [id, h] of holds.entries()) {
    if (!h || !h.expiresAt || h.expiresAt <= cutoff) holds.delete(id);
  }
}

function listHolds() {
  sweepExpired();
  return Array.from(holds.values()).sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
}

function getHold(holdId) {
  sweepExpired();
  return holds.get(String(holdId));
}

function startHold(payload) {
  sweepExpired();
  const p = payload || {};
  const holdId = String(p.holdId || `HOLD-${Date.now()}`);
  const ttlMin = DEFAULT_TTL_MINUTES > 0 ? DEFAULT_TTL_MINUTES : 10;
  const ttlMs = ttlMin * 60 * 1000;

  const item = {
    holdId,
    entrada: p.entrada || "",
    salida: p.salida || "",
    hombres: Number(p.hombres || 0),
    mujeres: Number(p.mujeres || 0),
    camas: p.camas || {}, // {roomId: [beds]}
    total: Number(p.total || 0),
    createdAt: new Date(),
    ttlMs,
    expiresAt: nowMs() + ttlMs,
    status: "hold"
  };

  holds.set(holdId, item);
  return { ok: true, holdId, expiresAt: item.expiresAt };
}

function confirmHold(holdId, status = "paid") {
  sweepExpired();
  const h = holds.get(String(holdId));
  if (!h) return { ok: false, error: "hold_not_found" };
  h.status = status;
  return { ok: true };
}

function releaseHold(holdId) {
  sweepExpired();
  holds.delete(String(holdId));
  return { ok: true };
}

/**
 * Devuelve mapa de camas ocupadas por HOLDs activos que se solapan con [fromYMD, toYMD).
 * Salida: { 1:number[], 3:number[], 5:number[], 6:number[] }
 */
function getHoldsMap(fromYMD, toYMD) {
  sweepExpired();
  const out = { 1: new Set(), 3: new Set(), 5: new Set(), 6: new Set() };

  const f = fromYMD ? new Date(fromYMD + "T00:00:00") : null;
  const t = toYMD ? new Date(toYMD + "T00:00:00") : null;

  for (const h of holds.values()) {
    if (!h || !h.expiresAt || h.expiresAt <= nowMs()) continue;

    const hin = h.entrada ? new Date(h.entrada + "T00:00:00") : null;
    const hout = h.salida ? new Date(h.salida + "T00:00:00") : null;

    // Solapamiento (si no hay from/to, cuenta igual)
    const overlaps =
      !f && !t
        ? true
        : Boolean((!t || (hin && hin < t)) && (!f || (hout && hout > f)));

    if (!overlaps) continue;

    const camas = h.camas || {};
    for (const [rid, beds] of Object.entries(camas)) {
      (beds || []).forEach((b) => out[Number(rid)]?.add(Number(b)));
    }
  }

  const result = {};
  for (const k of [1, 3, 5, 6]) result[k] = Array.from(out[k] || []).sort((a, b) => a - b);
  return result;
}

module.exports = {
  listHolds,
  getHold,
  startHold,
  confirmHold,
  releaseHold,
  sweepExpired,
  getHoldsMap
};
