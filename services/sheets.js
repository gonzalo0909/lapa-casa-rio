"use strict";

/**
 * /services/sheets.js
 * Conexión con Google Apps Script (upsert, rows)
 */

const fetch = require("node-fetch");

const SHEET_ID   = process.env.SHEET_ID   || "";
const SHEET_NAME = process.env.SHEET_NAME || "Reservas";
const SHEET_URL  = process.env.BOOKINGS_WEBAPP_URL || "";

async function postToSheet(payload={}) {
  if (!SHEET_URL) return { ok:false, error:"sheet_url_not_configured" };
  try {
    const r = await fetch(SHEET_URL, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
    return await r.json();
  } catch (err) {
    return { ok:false, error:String(err.message||err) };
  }
}

async function upsertBooking(booking={}) {
  return postToSheet({ action:"upsert_booking", ...booking });
}

async function updatePayment(booking_id, status) {
  return postToSheet({ action:"payment_update", booking_id, status });
}

async function exportRows() {
  try {
    const r = await fetch(`${SHEET_URL}?mode=rows`);
    return await r.json();
  } catch (err) {
    return { ok:false, error:String(err.message||err) };
  }
}

module.exports = { upsertBooking, updatePayment, exportRows };
