// routes/availability.js
"use strict";
const express = require("express");
const router = express.Router();

const BOOKINGS_WEBAPP_URL = process.env.BOOKINGS_WEBAPP_URL || "";
const AVAIL_TTL_MS = 60_000; // 60s
const availabilityCache = new Map(); // key -> { ts, data }

const ROOMS = {
  "1": { name: "Cuarto 1 (12 mixto)", cap: 12 },
  "3": { name: "Cuarto 3 (12 mixto)", cap: 12 },
  "5": { name: "Cuarto 5 (7 mixto)", cap: 7 },
  "6": { name: "Cuarto 6 (7 femenino)", cap: 7 },
};
const DEFAULT_ROOM_BUFFER = Number(process.env.BOOKING_BUFFER_PER_ROOM || 0);
const ROOM_BUFFER_1 = Number(process.env.ROOM_BUFFER_1 || DEFAULT_ROOM_BUFFER);
const ROOM_BUFFER_3 = Number(process.env.ROOM_BUFFER_3 || DEFAULT_ROOM_BUFFER);
const ROOM_BUFFER_5 = Number(process.env.ROOM_BUFFER_5 || DEFAULT_ROOM_BUFFER);
const ROOM_BUFFER_6 = Number(process.env.ROOM_BUFFER_6 || DEFAULT_ROOM_BUFFER);

// GET /availability?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/", async (req, res) => {
  try {
    const from = String(req.query.from || "").slice(0, 10);
    const to = String(req.query.to || "").slice(0, 10);
    if (!from || !to) return res.status(400).json({ ok: false, error: "missing_from_to" });

    const key = `${from}:${to}`;
    const now = Date.now();
    const cached = availabilityCache.get(key);
    if (cached && now - cached.ts < AVAIL_TTL_MS) return res.json(cached.data);

    const rows = await fetchRowsFromSheet_();
    const occupied = calcOccupiedBeds_(rows, from, to);
    const out = { ok: true, from, to, occupied };

    availabilityCache.set(key, { ts: now, data: out });
    return res.json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, error: "availability_failed" });
  }
});

module.exports = router;

// ===== helpers =====
async function fetchRowsFromSheet_() {
  if (!BOOKINGS_WEBAPP_URL) return [];
  const url = `${BOOKINGS_WEBAPP_URL}?mode=rows`;
  const r = await fetch(url);
  const j = await r.json().catch(() => ({ ok: false, rows: [] }));
  return Array.isArray(j.rows) ? j.rows : [];
}

function calcOccupiedBeds_(rows, from, to) {
  const start = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  const occupied = {};
  const ACTIVE = new Set(["paid", "pending", "authorized", "in_process", "approved", "hold"]);

  for (const row of rows) {
    const status = String(row.pay_status || "").toLowerCase();
    if (!ACTIVE.has(status)) continue;

    const entrada = row.entrada ? new Date(String(row.entrada) + "T00:00:00") : null;
    const salida = row.salida ? new Date(String(row.salida) + "T00:00:00") : null;
    if (!entrada || !salida) continue;
    if (!(entrada < end && salida > start)) continue; // overlap

    let cjson = row.camas_json || row.camas || "";
    try { if (typeof cjson === "string") cjson = cjson ? JSON.parse(cjson) : {}; } catch { cjson = {}; }
    if (cjson && typeof cjson === "object") {
      for (const [roomId, beds] of Object.entries(cjson)) {
        if (!occupied[roomId]) occupied[roomId] = new Set();
        (Array.isArray(beds) ? beds : []).forEach(b => occupied[roomId].add(Number(b)));
      }
    }
  }

  // Buffers por cuarto
  const buffers = {
    "1": Math.max(0, Math.min(ROOMS["1"].cap, ROOM_BUFFER_1)),
    "3": Math.max(0, Math.min(ROOMS["3"].cap, ROOM_BUFFER_3)),
    "5": Math.max(0, Math.min(ROOMS["5"].cap, ROOM_BUFFER_5)),
    "6": Math.max(0, Math.min(ROOMS["6"].cap, ROOM_BUFFER_6)),
  };

  for (const roomId of Object.keys(ROOMS)) {
    const cap = ROOMS[roomId].cap;
    if (!occupied[roomId]) occupied[roomId] = new Set();
    const set = occupied[roomId];
    const need = Math.max(0, Math.min(buffers[roomId], cap - set.size));
    if (need > 0) {
      for (let b = 1, added = 0; b <= cap && added < need; b++) {
        if (!set.has(b)) { set.add(b); added++; }
      }
    }
  }

  const out = {};
  for (const [roomId, set] of Object.entries(occupied)) out[roomId] = Array.from(set).sort((a, b) => a - b);
  return out;
}
