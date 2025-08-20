"use strict";
const express = require("express");
const router = express.Router();

/**
 * GET /availability?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Respuesta que espera el front:
 * { ok:true, occupied: { 1:[nums], 3:[nums], 5:[nums], 6:[nums] } }
 * - 1,3,5 = mixtos; 6 = femenino
 * - "occupied" lista SOLO camas ocupadas (las libres el front las infiere)
 */
router.get("/", (req, res) => {
  const { from, to } = req.query || {};
  if (!from || !to) {
    return res.status(400).json({ ok: false, error: "missing_dates" });
  }

  // TODO: aquí deberías consultar tu DB/planilla y construir "occupied".
  // Por ahora: todas libres (arrays vacíos).
  const occupied = {
    1: [], // p.ej. [2,5,7] si quisieras marcarlas ocupadas
    3: [],
    5: [],
    6: []
  };

  return res.json({ ok: true, occupied });
});

module.exports = router;
