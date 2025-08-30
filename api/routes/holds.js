// File: /routes/holds.js
"use strict";

/**
 * Maneja reservas temporales (HOLD): crear, listar, confirmar y liberar
 */

const express = require("express");
const router = express.Router();

const {
  listHolds,
  startHold,
  confirmHold,
  releaseHold,
  getHoldsMap
} = require("../services/holdsStore");

/* ===== POST /api/holds/start ===== */
router.post("/start", async (req, res) => {
  try {
    const body = req.body || {};
    const result = await startHold({
      holdId: body.holdId,
      entrada: body.entrada,
      salida: body.salida,
      hombres: body.hombres,
      mujeres: body.mujeres,
      camas: body.camas,
      total: body.total
    });

    if (!result?.ok) {
      return res.status(400).json({ ok: false, error: "invalid_hold_data" });
    }

    return res.json({
      ok: true,
      holdId: result.holdId,
      expiresAt: result.expiresAt
    });
  } catch (err) {
    console.error("[HOLDS] Error al crear hold:", err.message);
    return res.status(400).json({ ok: false, error: "bad_request" });
  }
});

/* ===== GET /api/holds/list ===== */
async function list(req, res) {
  try {
    const holds = await listHolds();
    return res.json({ ok: true, holds });
  } catch (err) {
    console.error("[HOLDS] Error al listar holds:", err.message);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
}
router.get("/list", list);

/* ===== POST /api/holds/confirm ===== */
async function confirm(req, res) {
  try {
    const { holdId, status = "paid" } = req.body || {};
    if (!holdId) {
      return res.status(400).json({ ok: false, error: "hold_id_required" });
    }

    const result = await confirmHold(holdId, status);
    if (!result?.ok) {
      return res.status(404).json({ ok: false, error: "hold_not_found" });
    }

    return res.json({ ok: true, holdId, status });
  } catch (err) {
    console.error("[HOLDS] Error al confirmar hold:", err.message);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
}
router.post("/confirm", confirm);

/* ===== POST /api/holds/release ===== */
async function release(req, res) {
  try {
    const { holdId } = req.body || {};
    if (!holdId) {
      return res.status(400).json({ ok: false, error: "hold_id_required" });
    }

    const result = await releaseHold(holdId);
    if (!result?.ok) {
      return res.status(404).json({ ok: false, error: "hold_not_found" });
    }

    return res.json({ ok: true, holdId, released: true });
  } catch (err) {
    console.error("[HOLDS] Error al liberar hold:", err.message);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
}
router.post("/release", release);

module.exports = { router, list, confirm, release, getHoldsMap };
