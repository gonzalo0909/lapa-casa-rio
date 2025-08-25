"use strict";
const express = require("express");
const router = express.Router();

// Placeholder: devolvería bookings de una DB real
router.get("/", (req, res) => {
  const { from, to, q } = req.query;
  const rows = [
    { booking_id: "BKG-001", entrada: "2025-09-10", salida: "2025-09-12", hombres: 2, mujeres: 1, pay_status: "paid" },
    { booking_id: "BKG-002", entrada: "2025-10-01", salida: "2025-10-05", hombres: 1, mujeres: 0, pay_status: "pending" },
  ];
  // (Opcional) aplicar filtros simples
  return res.json({ ok: true, rows });
});

module.exports = router;
