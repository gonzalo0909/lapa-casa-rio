"use strict";

/**
 * Gestor de HOLDs en memoria (TTL). Si desplegás múltiples réplicas, conviene
 * mover esto a Redis/DB. Para el MVP en un solo proceso, vale perfecto.
 */

const TTL_MIN = Number(process.env.HOLD_TTL_MINUTES || 10);
const holds = new Map(); // key: holdId  -> value: { ...datos, expiresAt, status }

function now() { return Date.now(); }
function minutes(ms) { return ms * 60 * 1000; }

function overlaps(aStart, aEnd, bStart, bEnd) {
  // [aStart, aEnd) vs [bStart, bEnd)
  const A = new Date(aStart + "T00:00:00").getTime();
  const B = new Date(aEnd   + "T00:00:00").getTime();
  const C = new Date(bStart + "T00:00:00").getTime();
  const D = new Date(bEnd   + "T00:00:00").getTime();
  return (A < D) && (C < B);
}

function conflictsWithActiveHolds(payload) {
  const { entrada, salida, camas = {} } = payload;
  const conflicts = [];
  for (const [id, h] of holds) {
    if (h.status !== "hold") continue;
    if (h.expiresAt <= now()) continue;
    if (!overlaps(entrada, salida, h.entrada, h.salida)) continue;
    // revisa camas/rooms intersectadas
    for (const roomId of Object.keys(camas)) {
      const reqBeds = new Set(camas[roomId]);
      const otherBeds = new Set((h.camas?.[roomId]) || []);
      for (const b of reqBeds) {
        if (otherBeds.has(Number(b))) {
          conflicts.push({ holdId: id, roomId, bed: Number(b) });
        }
      }
    }
  }
  return conflicts;
}

function startHold(payload) {
  const { holdId } = payload;
  if (!holdId) throw new Error("holdId required");
  const conflicts = conflictsWithActiveHolds(payload);
  if (conflicts.length) {
    const first = conflicts[0];
    const msg = `conflict: room ${first.roomId} bed ${first.bed} (hold ${first.holdId})`;
    return { ok: false, error: msg };
  }
  const record = {
    ...payload,
    status: "hold",
    createdAt: new Date().toISOString(),
    expiresAt: now() + minutes(TTL_MIN),
  };
  holds.set(holdId, record);
  return { ok: true, holdId };
}

function confirmHold(holdId, status = "paid") {
  if (!holds.has(holdId)) return { ok: false, error: "hold_not_found" };
  const h = holds.get(holdId);
  h.status = status; // "paid" o "confirmed"
  h.confirmedAt = new Date().toISOString();
  holds.set(holdId, h);
  return { ok: true, hold: h };
}

function releaseHold(holdId) {
  if (!holds.has(holdId)) return { ok: false, error: "hold_not_found" };
  const h = holds.get(holdId);
  h.status = "released";
  h.releasedAt = new Date().toISOString();
  holds.set(holdId, h);
  return { ok: true, hold: h };
}

function getHold(holdId) {
  return holds.get(holdId) || null;
}

function getActiveHoldsSnapshot() {
  const out = [];
  for (const [id, h] of holds) {
    if (h.status === "hold" && h.expiresAt > now()) out.push({ id, ...h });
  }
  return out;
}

function sweepExpired() {
  const removed = [];
  for (const [id, h] of holds) {
    if (h.status === "hold" && h.expiresAt <= now()) {
      holds.delete(id);
      removed.push(id);
    }
  }
  return { ok: true, removed, count: removed.length };
}

module.exports = {
  startHold,
  confirmHold,
  releaseHold,
  getHold,
  getActiveHoldsSnapshot,
  sweepExpired,
  _holds: holds, // para debug/tests
};
