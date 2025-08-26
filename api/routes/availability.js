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
  
  if (!from || !to) {
    return sendError(res, 400, "missing_from_to", "Faltan 'from' o 'to' (formato YYYY-MM-DD)");
  }

  const cacheKey = `${from}:${to}`;
  const now = Date.now();

  // Responder desde caché si es válido
  const cached = cache.get(cacheKey);
  if (cached && (now - cached.ts) < AVAIL_TTL_MS) {
    return res.json({
      ok: true,
      cached: true,
      from,
      to,
      occupied: cached.data.occupied
    });
  }

  try {
    const rows = await fetchRowsFromSheet(from, to);
    const holdsMap = getHoldsMap(from, to);
    const occupied = calcOccupiedBeds(rows, holdsMap);
    const data = { from, to, occupied };

    // Guardar en caché
    cache.set(cacheKey, { ts: now, data });

    res.json({
      ok: true,
      cached: false,
      ...data
    });
  } catch (err) {
    console.error("[Availability] Error al obtener disponibilidad:", err.message);
    sendError(res, 500, "internal_error", "No se pudo calcular la disponibilidad");
  }
});

// === Funciones auxiliares ===

function parseQueryDates(query) {
  const from = String(query.from || "").slice(0, 10);
  const to = String(query.to || "").slice(0, 10);
  return { from, to };
}

function sendError(res, status, code, message) {
  return res.status(status).json({
    ok: false,
    error: code,
    message
  });
}

module.exports = router;
