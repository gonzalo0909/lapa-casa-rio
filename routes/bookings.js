"use strict";

const express = require("express");
const router = express.Router();
const { listBookings, upsertBooking } = require("../services/sheets"); 
// ajustá el path al servicio real

// GET /api/bookings → lista reservas
router.get("/", async (req, res) => {
  try {
    const rows = await listBookings();
    res.json({ ok: true, rows });
  } catch (err) {
    console.error("Error listBookings", err);
    res.status(500).json({ ok: false, error: "list_failed" });
  }
});

// POST /api/bookings → crea/actualiza reserva
router.post("/", async (req, res) => {
  try {
    const booking = req.body;
    if (!booking || !booking.entrada || !booking.salida) {
      return res.status(400).json({ ok: false, error: "missing_fields" });
    }
    const saved = await upsertBooking(booking);
    res.json({ ok: true, booking: saved });
  } catch (err) {
    console.error("Error upsertBooking", err);
    res.status(500).json({ ok: false, error: "upsert_failed" });
  }
});

module.exports = router;
