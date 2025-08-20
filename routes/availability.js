"use strict";

const express = require("express");
const router = express.Router();
const sheets = require("../services/sheets");
const holds = require("../services/holds");

// GET /availability?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/", async (req, res) => {
  try {
    const from = String(req.query.from || "");
    const to = String(req.query.to || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ ok: false, error: "bad_dates" });
    }

    // Ocupación por reservas confirmadas (memoria / Sheets)
    const occByBookings = await sheets.readOccupiedMap(from, to);

    // Ocupación por HOLDs activos (no confirmados)
    const occByHolds = holds.getActiveOccupiedMap(from, to);

    // Merge: unión de camas ocupadas por habitación
    const rooms = [1, 3, 5, 6];
    const occupied = {};
    for (const id of rooms) {
      const a = new Set(occByBookings[id] || []);
      for (const b of (occByHolds[id] || [])) a.add(b);
      occupied[id] = Array.from(a).sort((x, y) => x - y);
    }

    res.json({ ok: true, occupied });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

module.exports = router;
