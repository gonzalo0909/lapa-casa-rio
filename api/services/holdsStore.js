/**
 * services/holdsStore.js
 * Gestiona reservas temporales (HOLDS) en memoria
 * Incluye creación, lectura, confirmación y liberación
 * Maneja expiración automática
 */

"use strict";

const DEFAULT_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES || 10);
const nowMs = () => Date.now();

// Almacena todos los holds activos
const holds = new Map();

/**
 * Limpia los holds expirados
 */
function sweepExpired() {
  const cutoff = nowMs();
  for (const [id, hold] of holds.entries()) {
    if (!hold || !hold.expiresAt || hold.expiresAt <= cutoff) {
      holds.delete(id);
    }
  }
}

/**
 * Devuelve lista de todos los holds activos (ordenados por creación)
 */
function listHolds() {
  sweepExpired();
  return Array.from(holds.values()).sort((a, b) => 
    a.createdAt > b.createdAt ? -1 : 1
  );
}

/**
 * Obtiene un hold por ID
 * @param {string} holdId
 * @returns {Object|null}
 */
function getHold(holdId) {
  sweepExpired();
  return holds.get(String(holdId)) || null;
}

/**
 * Crea un nuevo hold
 * @param {Object} payload
 * @returns {Object} { ok, holdId, expiresAt }
 */
function startHold(payload = {}) {
  sweepExpired();
  const p = payload;
  const holdId = String(p.holdId || `HOLD-${Date.now()}`);
  const ttlMin = DEFAULT_TTL_MINUTES > 0 ? DEFAULT_TTL_MINUTES : 10;
  const ttlMs = ttlMin * 60 * 1000;

  const item = {
    holdId,
    entrada: p.entrada || "",
    salida: p.salida || "",
    hombres: Number(p.hombres || 0),
    mujeres: Number(p.mujeres || 0),
    camas: p.camas || {},
    total: Number(p.total || 0),
    createdAt: new Date(),
    ttlMs,
    expiresAt: nowMs() + ttlMs,
    status: "hold"
  };

  holds.set(holdId, item);

  return {
    ok: true,
    holdId,
    expiresAt: item.expiresAt
  };
}

/**
 * Confirma un hold (cambia estado a "paid", "confirmed", etc.)
 * @param {string} holdId
 * @param {string} status
 * @returns {Object} { ok, error? }
 */
function confirmHold(holdId, status = "paid") {
  sweepExpired();
  const h = holds.get(String(holdId));
  if (!h) {
    return { ok: false, error: "hold_not_found" };
  }
  h.status = status;
  holds.set(String(holdId), h);
  return { ok: true };
}

/**
 * Libera un hold (lo elimina)
 * @param {string} holdId
 * @returns {Object} { ok }
 */
function releaseHold(holdId) {
  sweepExpired();
  holds.delete(String(holdId));
  return { ok: true };
}

/**
 * Devuelve mapa de camas ocupadas por rango de fechas
 * @param {string} fromYMD - Fecha inicio (YYYY-MM-DD)
 * @param {string} toYMD - Fecha fin (YYYY-MM-DD)
 * @returns {Object} { 1: [2,5], 3: [1,3], ... }
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
    const overlaps = !f && !t 
      ? true 
      : Boolean((!t || (hin && hin < t)) && (!f || (hout && hout > f)));

    if (!overlaps) continue;

    const camas = h.camas || {};
    for (const [roomId, beds] of Object.entries(camas)) {
      (beds || []).forEach(bedId => out[Number(roomId)]?.add(Number(bedId)));
    }
  }

  const result = {};
  for (const k of [1, 3, 5, 6]) {
    result[k] = Array.from(out[k] || []).sort((a, b) => a - b);
  }
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
