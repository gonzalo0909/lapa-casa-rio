// FILE: src/routes/availability.js
"use strict";

const express = require("express");
const router = express.Router();

const { fetchRowsFromSheet, calcOccupiedBeds } = require("../services/sheets");
const { getHoldsMap } = require("../services/holds");

// === Config
const ROOM_CAPS = { "1": 12, "3": 12, "5": 7, "6": 7 }; // 38 pax (mixto + 6 femenino)
const AVAIL_TTL_MS = Number(process.env.AVAIL_TTL_MS || 60_000); // 60s
const MAX_RANGE_DAYS = Number(process.env.AVAIL_MAX_RANGE_DAYS || 60);

// Cache simple en memoria: key "from:to" → { ts, data }
const cache = new Map();

// === Utils
function asISO(d) {
  const s = String(d || "").slice(0, 10);
  // YYYY-MM-DD simple check
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function daysBetween(a, b) {
  const ad = new Date(a + "T00:00:00Z");
  const bd = new Date(b + "T00:00:00Z");
  return Math.round((bd - ad) / 86_400_000);
}

function mkRangeOk(from, to) {
  if (!from || !to) return { ok: false, error: "missing_from_or_to" };
  if (from >= to) return { ok: false, error: "invalid_range" };
  if (daysBetween(from, to) > MAX_RANGE_DAYS) return { ok: false, error: "range_too_large" };
  return { ok: true };
}

function bedsArray(cap) {
  return Array.from({ length: cap }, (_, i) => i + 1);
}

// Une ocupación histórica (Sheets) + holds vivos (memoria) → set de ocupadas por cuarto
function mergeOccupied(occupiedFromSheets, holdsMap) {
  // occupiedFromSheets: { "1": Set([...]), ... }
  // holdsMap: { "1": Set([...]), ... }
  const out = {};
  for (const roomId of Object.keys(ROOM_CAPS)) {
    const s1 = occupiedFromSheets[roomId] || new Set();
    const s2 = (holdsMap && holdsMap[roomId]) ? holdsMap[roomId] : new Set();
    const s = new Set(s1);
    for (const v of s2) s.add(v);
    out[roomId] = s;
  }
  return out;
}

function computeFreeBeds(mergedOccupied) {
  const rooms = {};
  for (const [roomId, cap] of Object.entries(ROOM_CAPS)) {
    const all = bedsArray(cap);
    const occ = mergedOccupied[roomId] || new Set();
    rooms[roomId] = all.filter(n => !occ.has(n));
  }
  return rooms;
}

// === Handler
// GET /api/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/", async (req, res) => {
  try {
    const from = asISO(req.query.from);
    const to = asISO(req.query.to);

    const rangeOk = mkRangeOk(from, to);
    if (!rangeOk.ok) {
      return res.status(400).json({ ok: false, error: rangeOk.error });
    }

    const key = `${from}:${to}`;
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && (now - cached.ts) < AVAIL_TTL_MS) {
      return res.json(cached.data);
    }

    // 1) Ocupadas por reservas confirmadas (en Sheets/DB) para el rango
    // calcOccupiedBeds debe devolver: { "1": Set([1,2,...]), "3": Set([...]), ... }
    let occupiedBySheet;
    if (typeof calcOccupiedBeds === "function") {
      occupiedBySheet = await calcOccupiedBeds(from, to);
    } else {
      // Fallback: calcular a partir de las rows si solo tenemos fetchRowsFromSheet
      const rows = await fetchRowsFromSheet({ mode: "rows", from, to });
      // Esperamos rows con { entrada, salida, camas_json } o similar
      const occ = { "1": new Set(), "3": new Set(), "5": new Set(), "6": new Set() };
      for (const r of Array.isArray(rows) ? rows : []) {
        // Si la reserva cruza el rango solicitado
        const rin = String(r.entrada || r.checkin || "").slice(0, 10);
        const rout = String(r.salida || r.checkout || "").slice(0, 10);
        if (!rin || !rout) continue;
        // Intersección de [rin, rout) con [from, to)
        if (rin < to && rout > from) {
          // camas_json esperado como {"1":[1,2],"3":[4],...}
          let cj = r.camas_json;
          if (typeof cj === "string") {
            try { cj = JSON.parse(cj); } catch { cj = null; }
          }
          if (cj && typeof cj === "object") {
            for (const k of Object.keys(ROOM_CAPS)) {
              const arr = Array.isArray(cj[k]) ? cj[k] : [];
              for (const n of arr) if (Number.isFinite(+n)) occ[k].add(+n);
            }
          }
        }
      }
      occupiedBySheet = occ;
    }

    // 2) Holds vivos (anti-overbooking)
    // getHoldsMap → { "1": Set([...]), "3": Set([...]), ... }
    let holdsMap = {};
    try {
      const m = await getHoldsMap();
      // Normalizamos a Set
      for (const k of Object.keys(ROOM_CAPS)) {
        const arr = m && m[k] ? Array.from(m[k]) : [];
        holdsMap[k] = new Set(arr.map(Number).filter(n => Number.isFinite(n)));
      }
    } catch {
      // sin holds
      for (const k of Object.keys(ROOM_CAPS)) holdsMap[k] = new Set();
    }

    // 3) Merge y cálculo de libres
    const merged = mergeOccupied(occupiedBySheet, holdsMap);
    const rooms = computeFreeBeds(merged);

    // 4) Resumen opcional
    const totals = Object.fromEntries(
      Object.entries(ROOM_CAPS).map(([k, cap]) => [k, { cap, free: rooms[k].length }])
    );
    const totalFree = Object.values(totals).reduce((a, v) => a + v.free, 0);

    const payload = {
      ok: true,
      range: { from, to },
      ts: new Date().toISOString(),
      rooms,        // { "1":[...], "3":[...], "5":[...], "6":[...] }
      totals,       // { "1":{cap,free}, ... }
      total_free: totalFree
    };

    cache.set(key, { ts: now, data: payload });
    return res.json(payload);
  } catch (err) {
    console.error("[availability] error:", err);
    return res.status(500).json({ ok: false, error: "availability_failed" });
  }
});

module.exports = router;
