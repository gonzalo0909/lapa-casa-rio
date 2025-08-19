"use strict";

const express = require("express");
const router = express.Router();
const {
  upsertBooking,   // ✅ usar el nombre correcto
  listBookings,
} = require("../services/bookings");

// GET /bookings?from=YYYY-MM-DD&to=YYYY-MM-DD  → lista (últimas / rango)
router.get("/", async (req, res) => {
  try {
    const { from, to } = req.query || {};
    const rows = await listBookings({ from, to });
    res.json({ ok: true, rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

// POST /bookings  → crea/actualiza una reserva completa (upsert)
router.post("/", async (req, res) => {
  try {
    const saved = await upsertBooking(req.body || {}); // ✅ corrige nombre
    res.json({ ok: true, booking: saved });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

module.exports = router;
