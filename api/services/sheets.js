"use strict";

/**
 * services/sheets.js
 * Conecta con Google Apps Script (code.gs) vía REST
 * Opera reservas: fetch, disponibilidad, upsert, estado de pago
 */

const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const BASE = process.env.BOOKINGS_WEBAPP_URL;
const TOKEN = process.env.CRON_TOKEN || "";

/**
 * GET filas (reservas) filtradas por rango.
 */
async function fetchRowsFromSheet(from, to) {
  if (!BASE) return [];
  try {
    const url = `${BASE}?mode=rows`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    const rows = Array.isArray(data.rows) ? data.rows : [];

    if (!from && !to) return rows;
    const f = from ? new Date(from + "T00:00:00") : null;
    const t = to ? new Date(to + "T00:00:00") : null;

    return rows.filter((r) => {
      const inDate = r.entrada ? new Date(r.entrada + "T00:00:00") : null;
      const outDate = r.salida ? new Date(r.salida + "T00:00:00") : null;
      if (outDate && f && outDate <= f) return false;
      if (inDate && t && inDate >= t) return false;
      return true;
    });
  } catch (err) {
    console.error("[Sheets:fetchRows]", err.message);
    return [];
  }
}

/**
 * Upsert reserva en GAS (action=upsert_booking).
 */
async function upsertBooking(data) {
  if (!BASE || !TOKEN) return { ok: false, error: "sheets_not_configured" };
  try {
    const res = await fetch(BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TOKEN}`
      },
      body: JSON.stringify({ action: "upsert_booking", ...data })
    });
    return await res.json();
  } catch (err) {
    console.error("[Sheets:upsertBooking]", err.message);
    return { ok: false, error: "request_failed" };
  }
}

/**
 * Actualizar estado de pago (action=payment_update).
 */
async function updatePayment(bookingId, pay_status) {
  if (!BASE || !TOKEN) return { ok: false, error: "sheets_not_configured" };
  try {
    const res = await fetch(BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TOKEN}`
      },
      body: JSON.stringify({ action: "payment_update", booking_id: bookingId, pay_status })
    });
    return await res.json();
  } catch (err) {
    console.error("[Sheets:updatePayment]", err.message);
    return { ok: false, error: "request_failed" };
  }
}

/**
 * Calcular camas ocupadas (bookings + holds).
 */
function calcOccupiedBeds(rows, holdsMap) {
  const occ = { 1: new Set(), 3: new Set(), 5: new Set(), 6: new Set() };
  for (const r of rows) {
    const status = String(r.pay_status || "").toLowerCase();
    if (!["approved", "paid", "confirmed", "succeeded"].includes(status)) continue;
    let camas = {};
    try {
      camas = r.camas_json ? JSON.parse(r.camas_json) : r.camas || {};
    } catch {
      camas = r.camas || {};
    }
    for (const [roomId, beds] of Object.entries(camas)) {
      (beds || []).forEach((b) => occ[Number(roomId)]?.add(Number(b)));
    }
  }
  if (holdsMap) {
    for (const [roomId, beds] of Object.entries(holdsMap)) {
      (beds || []).forEach((b) => occ[Number(roomId)]?.add(Number(b)));
    }
  }
  const res = {};
  for (const id of [1, 3, 5, 6]) res[id] = Array.from(occ[id] || []).sort((a, b) => a - b);
  return res;
}

/**
 * Consultar estado de pago de una reserva.
 */
async function getPaymentStatus(bookingId) {
  const rows = await fetchRowsFromSheet();
  const b = rows.find((r) => String(r.booking_id) === String(bookingId));
  return b ? String(b.pay_status || "").toLowerCase() : null;
}

module.exports = { fetchRowsFromSheet, upsertBooking, updatePayment, calcOccupiedBeds, getPaymentStatus };
