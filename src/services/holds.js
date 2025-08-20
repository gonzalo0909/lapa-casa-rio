"use strict";

const holds = new Map();

function createHold({ holdId, ttlMinutes, payload }) {
  holds.set(holdId, { expiresAt: Date.now() + ttlMinutes * 60000, payload });
  return true;
}

function confirmHold(holdId) {
  return holds.has(holdId);
}

function releaseHold(holdId) {
  return holds.delete(holdId);
}

function sweepExpired() {
  const now = Date.now();
  for (const [id, h] of holds) if (h.expiresAt < now) holds.delete(id);
}

function getHoldsMap() {
  return Object.fromEntries(holds);
}

module.exports = { createHold, confirmHold, releaseHold, sweepExpired, getHoldsMap };
