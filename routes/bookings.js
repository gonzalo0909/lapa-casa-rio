"use strict";

const express = require("express");
const router = express.Router();
const { upsertBooking, listBookings } = require("../services/bookings");

// obtener reservas
router.get("/", async (req, res) => {
  try {
    const rows = await listBookings();
    res.json({ ok: true, rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// crear/actualizar reserva
router.post("/", async (req, res) => {
  try {
    const booking = req.body || {};
    const saved = await upsertBooking(booking);
    res.json({ ok: true, booking: saved });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
