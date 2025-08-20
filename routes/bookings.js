"use strict";

const express = require("express");
const router = express.Router();
const sheets = require("../services/sheets");

// POST /bookings
// cuerpo esperado: { bookingId, nombre, email, telefono, entrada, salida, hombres, mujeres, camas, total, pay_status, consent }
router.post("/", async (req, res) => {
  try {
    const b = Object(req.body || {});
    if (!b.bookingId || !b.entrada || !b.salida || !b.camas) {
      return res.status(400).json({ ok: false, error: "missing_fields" });
    }
    await sheets.appendBookingRow({
      ...b,
      createdAt: new Date().toISOString(),
    });
    return res.json({ ok: true, bookingId: b.bookingId });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

module.exports = router;
