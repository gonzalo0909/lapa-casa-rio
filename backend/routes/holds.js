"use strict";
const express = require("express");
const router = express.Router();
const {
  listHolds,
  getHold,
  startHold,
  confirmHold,
  releaseHold,
  sweepExpired
} = require("../services/holds");

// Crear HOLD
router.post("/start", (req, res) => {
  try {
    const out = startHold(req.body || {});
    return res.json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

// Confirmar HOLD (tras pago)
router.post("/confirm", (req, res) => {
  try {
    const { holdId, status } = req.body || {};
    if (!holdId) return res.status(400).json({ ok: false, error: "holdId requerido" });
    const out = confirmHold(holdId, status || "paid");
    if (!out.ok) return res.status(404).json(out);
    return res.json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

// Liberar HOLD
router.post("/release", (req, res) => {
  try {
    const { holdId } = req.body || {};
    if (!holdId) return res.status(400).json({ ok: false, error: "holdId requerido" });
    const out = releaseHold(holdId);
    return res.json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

// Listar HOLDs (Admin)
router.get("/list", (_req, res) => {
  sweepExpired();
  return res.json({ ok: true, holds: listHolds() });
});

// Obtener un HOLD por id
router.get("/:id", (req, res) => {
  const id = String(req.params.id || "");
  const item = getHold(id);
  if (!item) return res.status(404).json({ ok: false, error: "hold_not_found" });
  return res.json({ ok: true, hold: item });
});

module.exports = router;
