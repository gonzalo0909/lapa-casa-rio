"use strict";

const express = require("express");
const router = express.Router();
const { fetchRowsFromSheet, calcOccupiedBeds } = require("../services/sheets");
const { getHoldsMap } = require("../services/holds");

// TTL de caché (ms). Puedes ajustar con AVAIL_TTL_MS en .env
const AVAIL_TTL_MS = Number(process.env.AVAIL_TTL_MS || 60_000);
const cache = new Map(); // key: `${from}:${to}` → { ts, data }

// GET /api/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/", async (req, res) => {
  try {
    const from = String(req.query.from || "").slice(0, 10);
    const to   = String(req.query.to   || "").slice(0, 10);
    if (!from || !to) return res.status(400).json({ ok:false, error:"missing_from_to" });

    const key = `${from}:${to}`;
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && now - cached.ts < AVAIL_TTL_MS) return res.json(cached.data);

    const rows  = await fetchRowsFromSheet();
    const holds = getHoldsMap(); // camas bloqueadas temporalmente
    const occupied = calcOccupiedBeds(rows, from, to, holds);

    const out = { ok:true, from, to, occupied };
    cache.set(key, { ts: now, data: out });
    res.json(out);
  } catch (e) {
    res.status(500).json({ ok:false, error:"availability_failed" });
  }
});

module.exports = router;
