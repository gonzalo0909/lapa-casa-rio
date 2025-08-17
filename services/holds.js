"use strict";
/**
 * /services/holds.js
 * - Maneja holds (bloqueos temporales de camas)
 */

const holds = {}; // { "roomId": Set(bedNumbers) }

function addHold(roomId, bedNumber) {
  if (!holds[roomId]) holds[roomId] = new Set();
  holds[roomId].add(Number(bedNumber));
}

function releaseHold(roomId, bedNumber) {
  if (holds[roomId]) {
    holds[roomId].delete(Number(bedNumber));
    if (holds[roomId].size === 0) delete holds[roomId];
  }
}

function getHoldsMap() {
  return holds;
}

function clearAllHolds() {
  for (const r of Object.keys(holds)) delete holds[r];
}

module.exports = {
  addHold,
  releaseHold,
  getHoldsMap,
  clearAllHolds
};
