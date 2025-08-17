"use strict";
const { getRows } = require("./sheets");

const BUFFER = Number(process.env.BOOKING_BUFFER_PER_ROOM || 0);

const ROOMS = { 1: 12, 3: 12, 5: 7, 6: 7 };

function overlaps(aStart, aEnd, bStart, bEnd) {
  // rango [start, end) iso yyyy-mm-dd
  return aStart < bEnd && bStart < aEnd;
}

function clampBeds(arr = [], cap = 0) {
  const s = new Set(arr.filter(Number.isFinite));
  const out = Array.from(s).filter((n) => n >= 1 && n <= cap).sort((a, b) => a - b);
  return out;
}

function occupiedFromRows(rows, fromISO, toISO) {
  const occ = { "1": [], "3": [], "5": [], "6": [] };
  rows.forEach((r) => {
    const status = String(r.pay_status || "").toLowerCase();
    // considerar pagadas/authorized/in_process como no-libres
    if (!["paid", "authorized", "in_process"].includes(status)) return;
    const ent = String(r.entrada || "").slice(0, 10);
    const sal = String(r.salida || "").slice(0, 10);
    if (!ent || !sal) return;
    if (!overlaps(fromISO, toISO, ent, sal)) return;

    let camas = {};
    try { camas = r.camas_json ? JSON.parse(r.camas_json) : {}; } catch (_) {}
    for (const roomId of ["1", "3", "5", "6"]) {
      const cap = ROOMS[Number(roomId)];
      const arr = clampBeds(camas?.[roomId] || [], cap);
      occ[roomId].push(...arr);
    }
  });
  // aplicar buffer: marcar camas extra como ocupadas (al inicio de cada cuarto)
  for (const k of Object.keys(occ)) {
    const cap = ROOMS[Number(k)];
    const set = new Set(occ[k]);
    for (let i = 1; i <= Math.min(BUFFER, cap); i++) set.add(i);
    occ[k] = Array.from(set).sort((a, b) => a - b);
  }
  return occ;
}

function mergeOccupied(a, b) {
  const out = {};
  for (const k of ["1", "3", "5", "6"]) {
    const set = new Set([...(a[k] || []), ...(b[k] || [])]);
    out[k] = Array.from(set).sort((x, y) => x - y);
  }
  return out;
}

let holdsProvider = null; // inyectado para no generar dependencias circulares
function setHoldsProvider(fn) { holdsProvider = fn; }

async function getAvailability(req, res) {
  try {
    const fromISO = String(req.query.from || "").slice(0, 10);
    const toISO = String(req.query.to || "").slice(0, 10);
    if (!fromISO || !toISO) return res.status(400).json({ ok: false, error: "from/to requeridos" });

    const rows = await getRows();
    const occRows = occupiedFromRows(rows, fromISO, toISO);

    const occHolds = holdsProvider ? holdsProvider({ fromISO, toISO }) : { "1": [], "3": [], "5": [], "6": [] };

    const occupied = mergeOccupied(occRows, occHolds);
    return res.json({ ok: true, occupied });
  } catch (e) {
    console.error("availability error:", e);
    return res.status(500).json({ ok: false, error: "availability_failed" });
  }
}

module.exports = { getAvailability, setHoldsProvider, ROOMS, overlaps };
