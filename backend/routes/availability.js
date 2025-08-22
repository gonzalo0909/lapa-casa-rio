"use strict";
const express = require("express");
const router = express.Router();

const { fetchRowsFromSheet, calcOccupiedBeds } = require("../services/sheets");
const { getHoldsMap } = require("../services/holdsStore");

const AVAIL_TTL_MS = 60_000; // cache 60s
const cache = new Map(); // key "from:to" -> { ts, data }

router.get("/", async (req, res) => {
  try {
    const from = String(req.query.from || "").slice(0, 10);
    const to   = String(req.query.to   || "").slice(0, 10);
    if (!from || !to) return res.status(400).json({ ok:false, error:"missing_from_to" });

    const key = `${from}:${to}`, now = Date.now();
    if (cache.has(key) && now - cache.get(key).ts < AVAIL_TTL_MS) {
      return res.json({ ok:true, cached:true, ...cache.get(key).data });
    }

    const rows = await fetchRowsFromSheet(from, to); // pagos aprobados (GAS)
    const holds = getHoldsMap(from, to);            // holds en RAM
    const occupied = calcOccupiedBeds(rows, holds); // merge

    const data = { from, to, occupied };
    cache.set(key, { ts: now, data });
    res.json({ ok:true, cached:false, ...data });
  } catch (e) {
    console.error("availability error", e);
    res.status(500).json({ ok:false, error:String(e.message||e) });
  }
});

module.exports = router;
