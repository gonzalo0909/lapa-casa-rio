"use strict";

/**
 * routes/holds.js
 * Holds temporales (crear, listar, confirmar, renovar, liberar)
 * Valida stock antes de confirmar.
 */

const express = require("express");
const router = express.Router();

const {
  listHolds,
  startHold,
  confirmHold,
  renewHold,
  releaseHold,
  getHold
} = require("../services/holdsStore");

const {
  fetchRowsFromSheet,
  calcOccupiedBeds
} = require("../services/sheets");

const { getHoldsMap } = require("../services/holdsStore");
const { cacheInvalidate } = require("../services/cache");

// POST /api/holds/start
router.post("/start", async (req, res) => {
  try {
    const b = req.body || {};
    const payload = {
      holdId: b.holdId,
      entrada: String(b.entrada || ""),
      salida: String(b.salida || ""),
      hombres: Number(b.hombres || 0),
      mujeres: Number(b.mujeres || 0),
      camas: b.camas || {}, // { "1":[2,4], "3":[1] }
      total: Number(b.total || 0)
    };

    if (!isYMD(payload.entrada) || !isYMD(payload.salida)) {
      return res.status(400).json({ ok: false, error: "invalid_dates" });
    }
    if (new Date(payload.entrada) >= new Date(payload.salida)) {
      return res.status(400).json({ ok: false, error: "invalid_range" });
    }

    const result = await startHold(payload);
    return res.json({ ok: true, holdId: result.holdId, expiresAt: result.expiresAt });
  } catch (err) {
    console.error("[HOLDS:start]", err.message);
    return res.status(400).json({ ok: false, error: "bad_request" });
  }
});

// GET /api/holds/list
router.get("/list", async (_req, res) => {
  try {
    const holds = await listHolds();
    return res.json({ ok: true, holds });
  } catch (err) {
    console.error("[HOLDS:list]", err.message);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// POST /api/holds/renew  { holdId, minutes? }
router.post("/renew", async (req, res) => {
  try {
    const { holdId, minutes } = req.body || {};
    if (!holdId) return res.status(400).json({ ok: false, error: "hold_id_required" });
    const r = await renewHold(holdId, Number(minutes) || 5);
    if (!r.ok) return res.status(404).json({ ok: false, error: r.error || "renew_failed" });
    return res.json({ ok: true, holdId, expiresAt: r.expiresAt });
  } catch (err) {
    console.error("[HOLDS:renew]", err.message);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// POST /api/holds/confirm  { holdId, status? }
router.post("/confirm", async (req, res) => {
  try {
    const { holdId, status = "paid" } = req.body || {};
    if (!holdId) return res.status(400).json({ ok: false, error: "hold_id_required" });

    // Validación de stock en tiempo real
    const hold = await getHold(holdId);
    if (!hold || hold.status === "released") {
      return res.status(404).json({ ok: false, error: "hold_not_found" });
    }

    const from = hold.entrada;
    const to = hold.salida;
    const rows = await fetchRowsFromSheet(from, to);
    const currentHolds = await getHoldsMap(from, to);
    const occupied = calcOccupiedBeds(rows, currentHolds);

    const conflicts = findConflicts(occupied, hold.camas);
    if (conflicts.length) {
      return res.status(409).json({ ok: false, error: "conflict", conflicts });
    }

    const r = await confirmHold(holdId, status); // cambia estado, extiende TTL igual que la clave original
    if (!r.ok) return res.status(404).json({ ok: false, error: r.error || "confirm_failed" });

    await cacheInvalidate(); // refresca disponibilidad
    return res.json({ ok: true, holdId, status: status.toLowerCase() });
  } catch (err) {
    console.error("[HOLDS:confirm]", err.message);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// POST /api/holds/release  { holdId }
router.post("/release", async (req, res) => {
  try {
    const { holdId } = req.body || {};
    if (!holdId) return res.status(400).json({ ok: false, error: "hold_id_required" });

    const r = await releaseHold(holdId);
    if (!r.ok) return res.status(404).json({ ok: false, error: r.error || "release_failed" });

    await cacheInvalidate();
    return res.json({ ok: true, holdId, released: true });
  } catch (err) {
    console.error("[HOLDS:release]", err.message);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// Helpers
function isYMD(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function findConflicts(occupiedMap, requested) {
  const issues = [];
  for (const [roomId, beds] of Object.entries(requested || {})) {
    const occ = new Set(occupiedMap[Number(roomId)] || []);
    for (const b of beds || []) {
      if (occ.has(Number(b))) issues.push({ roomId: Number(roomId), bed: Number(b) });
    }
  }
  return issues;
}

module.exports = { router };
