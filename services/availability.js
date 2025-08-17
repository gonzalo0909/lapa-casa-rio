"use strict";
/**
 * /services/availability.js
 * - getAvailability(fromISO, toISO): calcula disponibilidad de camas
 */
const { fetchRowsFromSheet, calcOccupiedBeds } = require("./sheets");
const { getHoldsMap } = require("./holds");

async function getAvailability(fromISO, toISO) {
  const rows = await fetchRowsFromSheet();
  const holdsMap = await getHoldsMap();
  const occupied = calcOccupiedBeds(rows, fromISO, toISO, holdsMap);

  // Capacidad por habitación (ajusta según hostel)
  const CAPACITY = { "1": 12, "3": 12, "5": 7, "6": 7 };

  const availability = {};
  for (const roomId of Object.keys(CAPACITY)) {
    const totalBeds = CAPACITY[roomId];
    const occBeds   = occupied[roomId] || [];
    availability[roomId] = {
      total: totalBeds,
      occupied: occBeds.length,
      free: Math.max(totalBeds - occBeds.length, 0),
      occupiedBeds: occBeds
    };
  }
  return availability;
}

module.exports = { getAvailability };
