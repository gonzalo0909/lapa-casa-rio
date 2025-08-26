/**
 * routes/holds.js
 * Gestiona reservas temporales (HOLD) por 10 minutos
 * Permite: crear, listar, confirmar y liberar holds
 */

"use strict";

const express = require("express");
const router = express.Router();

const {
  listHolds,
  getHold,
  startHold,
  confirmHold,
  releaseHold,
  getHoldsMap
} = require("../services/holdsStore");

/* ===== PUBLIC: Crear un nuevo HOLD ===== */
router.post("/start", (req, res) => {
  try {
    const body = req.body || {};
    const result = startHold({
      holdId: body.holdId,
      entrada: body.entrada,
      salida: body.salida,
      hombres: body.hombres,
      mujeres: body.mujeres,
      camas: body.camas,
      total: body.total
    });

    if (!result.ok) {
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

/* ===== ADMIN: Listar todos los holds activos ===== */
router.get("/list", (req, res) => {
  try {
    const holds = listHolds();
    return res.json({ ok: true, holds });
  } catch (err) {
    console.error("[HOLDS] Error al listar holds:", err.message);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/* ===== ADMIN: Confirmar un hold (convertir a reserva pagada) ===== */
router.post("/confirm", (req, res) => {
  try {
    const { holdId, status = "paid" } = req.body || {};
    if (!holdId) {
      return res.status(400).json({ ok: false, error: "hold_id_required" });
    }

    const result = confirmHold(holdId, status);
    if (!result.ok) {
      return res.status(404).json({ ok: false, error: "hold_not_found" });
    }

    return res.json({ ok: true, holdId, status });
  } catch (err) {
    console.error("[HOLDS] Error al confirmar hold:", err.message);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/* ===== ADMIN: Liberar un hold (cancelar reserva temporal) ===== */
router.post("/release", (req, res) => {
  try {
    const { holdId } = req.body || {};
    if (!holdId) {
      return res.status(400).json({ ok: false, error: "hold_id_required" });
    }

    const result = releaseHold(holdId);
    if (!result.ok) {
      return res.status(404).json({ ok: false, error: "hold_not_found" });
    }

    return res.json({ ok: true, holdId, released: true });
  } catch (err) {
    console.error("[HOLDS] Error al liberar hold:", err.message);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/* ===== UTILS: Exponer getHoldsMap para otros módulos ===== */
module.exports = { router, listHolds, confirmHold, releaseHold, getHoldsMap };
