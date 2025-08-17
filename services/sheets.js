// lapa-casa-backend/services/sheets.js
"use strict";

/**
 * Sheets/GAS bridge para:
 *  - fetchRowsFromSheet(): lee reservas desde GAS
 *  - calcOccupiedBeds(rows, fromISO, toISO): ocupa por reservas + holds + buffer
 *  - notifySheets({ booking_id, status, total }): actualiza estado de pago en GAS
 *
 * Requisitos ENV:
 *  - BOOKINGS_WEBAPP_URL  (URL del Web App de GAS .../exec)
 *  - BOOKING_BUFFER_PER_ROOM (opcional, default 0)
 * Node >= 18 (usa fetch nativo)
 */

const GAS_URL = (process.env.BOOKINGS_WEBAPP_URL || "").trim();
if (!GAS_URL) throw new Error("Falta env BOOKINGS_WEBAPP_URL");

const BUFFER = Number(process.env.BOOKING_BUFFER_PER_ROOM || 0);

// Capacidades (deben reflejar el front)
const ROOMS = { "1": 12, "3": 12, "5": 7, "6": 7 };

// Estados que cuentan como ocupados en disponibilidad
const BUSY_STATUSES = new Set(["paid", "authorized", "in_process"]);

/* ===================== Helpers ===================== */

function iso10(s) { return String(s || "").slice(0, 10); }

// rangos [start, end) en ISO yyyy-mm-dd
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function clampBeds(arr, cap) {
  if (!Array.isArray(arr)) return [];
  const clean = arr
    .map(Number)
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= cap);
  return Array.from(new Set(clean)).sort((a, b) => a - b);
}

function parseCamasJson(s) {
  if (!s) return {};
  try { return typeof s === "string" ? JSON.parse(s) : s || {}; }
  catch { return {}; }
}

function addBuffer(occMap) {
  if (!BUFFER) return occMap;
  const out = {};
  for (const k of Object.keys(occMap)) {
    const cap = ROOMS[k] || 0;
    const set = new Set(occMap[k] || []);
    for (let i = 1; i <= Math.min(BUFFER, cap); i++) set.add(i);
    out[k] = Array.from(set).sort((a, b) => a - b);
  }
  return out;
}

function mergeOccupied(a, b) {
  const out = {};
  for (const k of Object.keys(ROOMS)) {
    const set = new Set([...(a[k] || []), ...(b[k] || [])]);
    out[k] = Array.from(set).sort((x, y) => x - y);
  }
  return out;
}

/* ===================== API: GAS ===================== */

async function fetchRowsFromSheet() {
  const url = `${GAS_URL}?mode=rows`;
  const res = await fetch(url, { method: "GET", headers: { "Accept": "application/json" } });
  if (!res.ok) throw new Error(`GAS rows ${res.status}`);
  const j = await res.json();
  if (!j || !j.ok || !Array.isArray(j.rows)) return [];
  return j.rows;
}

/* ============ Negocio: disponibilidad ============ */

function occupiedFromRows(rows, fromISO, toISO) {
  const occ = { "1": [], "3": [], "5": [], "6": [] };
  for (const r of rows) {
    const status =
