"use strict";

const express = require("express");
const router = express.Router();
const {
  upsertBooking,
  listBookings,
} = require("../services/bookings");

// Alias para compatibilidad previa
const saveBooking = upsertBooking;

// GET /bookings?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/", async (req, res) => {
  try {
    const { from, to } = req.query || {};
    const rows = await listBookings({ from, to });
    res.json({ ok: true, rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

// POST /bookings → upsert
router.post("/", async (req, res) => {
  try {
    const saved = await saveBooking(req.body || {});
    res.json({ ok: true, booking: saved });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

module.exports = router;
