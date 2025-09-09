"use strict";

/**
 * routes/availability.js
 * Calcula disponibilidad combinando bookings (Sheets) + holds (Redis)
 * Incluye cache TTL + invalidación
 */

const express = require("express");
const router = express.Router();

const { fetchRowsFromSheet, calcOccupiedBeds } = require("../services/sheets");
const { getHoldsMap } = require("../services/holdsStore");
const { cacheGet, cacheSet, cacheInvalidate } = require("../services/cache");

const AVAIL_TTL = 120; // segundos

// GET /api/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/", async (req, res) => {
  const { from, to } = parseQueryDates(req.query);
  if (!from || !to) return sendError(res, 400, "missing_from_to", "Faltan 'from' o 'to'");
  if (!isValidDate(from) || !isValidDate(to)) return sendError(res, 400, "invalid_date", "Formato inválido");
  if (from >= to) return sendError(res, 400, "invalid_range", "'from' debe ser anterior a 'to'");

  const key = `${from}:${to}`;
  try {
    const cached = await cacheGet(key);
    if (cached) {
      return res.json({ ok: true, cached: true, from, to, occupied: cached });
    }

    const rows = await fetchRowsFromSheet(from, to);
    const holds = await getHoldsMap(from, to);
    const occupied = calcOccupiedBeds(rows, holds);

    await cacheSet(key, occupied, AVAIL_TTL);
    return res.json({ ok: true, cached: false, from, to, occupied });
  } catch (err) {
    console.error("[Availability]", err.message);
    return sendError(res, 500, "internal_error", "Error calculando disponibilidad");
  }
});

// === Helpers ===
function parseQueryDates(query) {
  const from = String(query.from || "").trim().slice(0, 10);
  const to = String(query.to || "").trim().slice(0, 10);
  return { from, to };
}
function isValidDate(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(str);
  return d.toISOString().slice(0, 10) === str;
}
function sendError(res, status, code, msg) {
  return res.status(status).json({ ok: false, error: code, message: msg });
}

module.exports = router;
