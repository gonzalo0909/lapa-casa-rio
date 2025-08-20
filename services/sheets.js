"use strict";

/**
 * Envío a Google Sheets via Google Apps Script WebApp (BOOKINGS_WEBAPP_URL).
 * Usa `fetch` nativo de Node 18+.
 */

const { mapHoldToSheet, mapPaidToSheet, mapReleaseToSheet } = require("./sheets-mapper");

const WEBAPP_URL = process.env.BOOKINGS_WEBAPP_URL; // ej: https://script.google.com/macros/s/.../exec

async function postToWebApp(payload) {
  if (!WEBAPP_URL) return { ok: false, skipped: true, reason: "BOOKINGS_WEBAPP_URL not set" };
  const res = await fetch(WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  let json = null;
  try { json = await res.json(); } catch { /* WebApp puede responder texto */ }
  return { ok: res.ok, status: res.status, data: json };
}

async function notifyHoldStarted(hold) {
  const payload = mapHoldToSheet(hold);
  return postToWebApp(payload);
}

async function notifyPaid(info) {
  const payload = mapPaidToSheet(info);
  return postToWebApp(payload);
}

async function notifyReleased(hold) {
  const payload = mapReleaseToSheet(hold);
  return postToWebApp(payload);
}

// API genérica para webhooks (lo usa payments-*.js)
async function notifySheets(genericPayload) {
  // Acepta objetos con {kind:'hold'|'paid'|'release', ...}
  const kind = genericPayload?.kind;
  if (kind === "hold") return notifyHoldStarted(genericPayload);
  if (kind === "paid") return notifyPaid(genericPayload);
  if (kind === "release") return notifyReleased(genericPayload);
  // fallback: intenta mandar tal cual
  return postToWebApp(genericPayload);
}

module.exports = {
  notifySheets,
  notifyHoldStarted,
  notifyPaid,
  notifyReleased,
};
