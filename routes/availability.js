"use strict";

const express = require("express");
const router = express.Router();
const sheets = require("../services/sheets");
const holds = require("../services/holds");

const BUFFER = Math.max(0, Number(process.env.BOOKING_BUFFER_PER_ROOM || 0));

// GET /availability?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/", async (req, res) => {
  try {
    const from = String(req.query.from || "");
    const to = String(req.query.to || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ ok: false, error: "bad_dates" });
    }

    const occByBookings = await sheets.readOccupiedMap(from, to);
    const occByHolds = holds.getActiveOccupiedMap(from, to);

    const rooms = [1, 3, 5, 6];
    const occupied = {};
    for (const id of rooms) {
      const a = new Set(occByBookings[id] || []);
      for (const b of (occByHolds[id] || [])) a.add(b);

      // aplicar buffer suave por room (marca como ocupadas N camas libres más altas)
      if (BUFFER > 0) {
        const cap = ({1:12,3:12,5:7,6:7})[id] || 12;
        const occArr = Array.from(a);
        for (let x=0; x<BUFFER; x++){
          // busca la cama libre más alta
          for (let bed=cap; bed>=1; bed--){
            if (!a.has(bed)) { a.add(bed); break; }
          }
        }
      }

      occupied[id] = Array.from(a).sort((x, y) => x - y);
    }

    res.json({ ok: true, occupied });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

module.exports = router;
