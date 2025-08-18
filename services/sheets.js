"use strict";
/**
 * /services/sheets.js
 * Minimal y robusto:
 *  - fetchRowsFromSheet(): lee reservas (Apps Script ?mode=rows)
 *  - notifySheets(payload): POST genérico (upsert_booking / payment_update)
 *  - calcOccupiedBeds(rows, fromISO, toISO, holdsMap?, bufferPerRoom?)
 *
 * Env:
 *  - BOOKINGS_WEBAPP_URL: URL del Web App GAS (termina en /exec)
 *  - BOOKING_BUFFER_PER_ROOM: sobre-reserva virtual (n camas bloqueadas por cuarto)
 */

const ROWS_URL = String(process.env.BOOKINGS_WEBAPP_URL || "").trim();
const BUFFER_PER_ROOM = Number(process.env.BOOKING_BUFFER_PER_ROOM || 0);

/* ---------- helpers de fechas ---------- */
const parseISO = (s) => new Date(String(s).slice(0, 10) + "T00:00:00Z");
const overlap = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;

/* ---------- lecturas y escrituras a GAS ---------- */
async function fetchRowsFromSheet() {
  if (!ROWS_URL) throw new Error("BOOKINGS_WEBAPP_URL_missing");
  const url = ROWS_URL + (ROWS_URL.includes("?") ? "&" : "?") + "mode=rows";

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j?.ok !== true || !Array.isArray(j.rows)) {
    throw new Error("rows_fetch_error");
  }

  // Normaliza y reduce a lo necesario para disponibilidad
  return j.rows.map((r) => ({
    booking_id: String(r.booking_id || ""),
    entrada: String(r.entrada || ""),
    salida: String(r.salida || ""),
    camas_json: String(r.camas_json || ""),
    pay_status: String(r.pay_status || ""),
    total: Number(r.total || 0),
  }));
}

async function notifySheets(payload) {
  if (!ROWS_URL) throw new Error("BOOKINGS_WEBAPP_URL_missing");
  const res = await fetch(ROWS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload || {}),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j) throw new Error("sheets_notify_error");
  return j;
}

/* ---------- cálculo de camas ocupadas ---------- */
function calcOccupiedBeds(rows, fromISO, toISO, holdsMap = {}, bufferPerRoom = BUFFER_PER_ROOM) {
  const from = parseISO(fromISO);
  const to = parseISO(toISO);

  // Rooms conocidas (ajustable): 1,3,5,6
  const occ = { "1": new Set(), "3": new Set(), "5": new Set(), "6": new Set() };

  for (const r of rows) {
    const a = r.entrada ? parseISO(r.entrada) : null;
    const b = r.salida ? parseISO(r.salida) : null;
    if (!a || !b || !(a < b)) continue;
    if (!overlap(a, b, from, to)) continue;

    // Suma camas reservadas
    try {
      const c = r.camas_json ? JSON.parse(r.camas_json) : {};
      for (const roomId of Object.keys(c || {})) {
        (c[roomId] || []).forEach((bed) => occ[roomId]?.add(Number(bed)));
      }
    } catch {
      /* ignora parseos inválidos */
    }
  }

  // Buffer por cuarto (si se define): bloquea X camas libres ficticias
  if (bufferPerRoom > 0) {
    for (const roomId of Object.keys(occ)) {
      let added = 0,
        bed = 1;
      while (added < bufferPerRoom && bed <= 60) {
        if (!occ[roomId].has(bed)) {
          occ[roomId].add(bed);
          added++;
        }
        bed

      
