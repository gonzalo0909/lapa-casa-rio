"use strict";
const express = require("express");
const router = express.Router();

const { fetchRowsFromSheet, calcOccupiedBeds } = require("../services/sheets");
const { getHoldsMap } = require("../services/holdsStore");

const AVAIL_TTL_MS = 60_000;
const cache = new Map();

// GET /api/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/", async (req, res) => {
  try {
    const from = String(req.query.from || "").slice(0, 10);
    const to = String(req.query.to || "").slice(0, 10);
    if (!from || !to) return res.status(400).json({ ok:false, error:"missing_from_to" });

    const key = `${from}:${to}`, now = Date.now();
    if (cache.has(key) && now - cache.get(key).ts < AVAIL_TTL_MS) {
      return res.json({ ok:true, cached:true, ...cache.get(key).data });
    }

    const rows = await fetchRowsFromSheet(from, to);
    const holdsMap = getHoldsMap(from, to);
    const occupied = calcOccupiedBeds(rows, holdsMap);

    const data = { from, to, occupied };
    cache.set(key, { ts: now, data });
    res.json({ ok:true, cached:false, ...data });
  } catch (err) {
    console.error("Error /api/availability:", err);
    res.status(500).json({ ok:false, error:err.message });
  }
});

module.exports = router;
