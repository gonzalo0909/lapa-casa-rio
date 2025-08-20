"use strict";
const express = require("express");
const router = express.Router();

/**
 * Demo: devuelve todas las camas libres (nadie ocupado).
 * Respuesta real esperada por el front:
 * { ok:true, occupied: { 1:[2,5], 3:[1], 5:[], 6:[3] } }
 */
router.get("/", (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ ok: false, error: "missing_dates" });
  // TODO: conectar a tu planilla/DB para calcular ocupación real.
  res.json({ ok: true, occupied: { 1: [], 3: [], 5: [], 6: [] } });
});

module.exports = router;
