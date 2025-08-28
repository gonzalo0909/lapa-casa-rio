/**
 * availability.js
 * Calcula la disponibilidad de camas combinando bookings (Google Sheets) y holds (memoria)
 * Usa caché simple para mejorar rendimiento (60 segundos)
 */

"use strict";

const express = require("express");
const router = express.Router();

const { fetchRowsFromSheet, calcOccupiedBeds } = require("../services/sheets");
const { getHoldsMap } = require("../services/holdsStore");

const AVAIL_TTL_MS = 60_000;
const cache = new Map();

/**
 * GET /api/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Devuelve las camas ocupadas por habitación en el rango de fechas
 */
router.get("/", async (req, res) => {
  const { from, to } = parseQueryDates(req.query);

  // Validación de formato de fecha
  if (!isValidDate(from)) {
    return sendError(res, 400, "invalid_from", "Formato de 'from' inválido. Usa YYYY-MM-DD");
  }
  if (!isValidDate(to)) {
    return sendError(res, 400, "invalid_to", "Formato de 'to' inválido. Usa YYYY-MM-DD");
  }
  if (new Date(from) >= new Date(to)) {
    return sendError(res, 400, "invalid_range", "'from' debe ser anterior a 'to'");
  }

  const cacheKey = `${from}:${to}`;
  const now = Date.now();

  const cached = cache.get(cacheKey);
  if (cached && now - cached.ts < AVAIL_TTL_MS) {
    return res.json({
      ok: true,
      cached: true,
      from,
      to,
      occupied: cached.data.occupied,
    });
  }

  try {
    const rows = await fetchRowsFromSheet(from, to);
    const holdsMap = getHoldsMap(from, to);
    const occupied = calcOccupiedBeds(rows, holdsMap);
    const data = { from, to, occupied };

    cache.set(cacheKey, { ts: now, data });

    res.json({
      ok: true,
      cached: false,
      ...data,
    });
  } catch (err) {
    console.error("[Availability] Error al obtener disponibilidad:", err.message);
    sendError(res, 500, "internal_error", "No se pudo calcular la disponibilidad");
  }
});

function parseQueryDates(query) {
  const from = String(query.from || "").slice(0, 10);
  const to = String(query.to || "").slice(0, 10);
  return { from, to };
}

function isValidDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(new Date(date));
}

function sendError(res, status, code, message) {
  return res.status(status).json({
    ok: false,
    error: code,
    message,
  });
}

module.exports = router;
