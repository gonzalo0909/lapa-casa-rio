// services/sheets.js
"use strict";

/**
 * Notificaciones a Google Apps Script / Sheets (webhooks).
 * Usa BOOKING_WEBHOOK_URL_* si están, si no, no rompe.
 */

const { mapBookingToSheetRow } = require("./sheets-mapper");

const WEBHOOK_STRIPE = process.env.BOOKINGS_WEBHOOK_URL_STRIPE || "";
const WEBHOOK_MP     = process.env.BOOKINGS_WEBHOOK_URL_MP || "";
const WEBAPP_URL     = process.env.BOOKINGS_WEBAPP_URL || "";

async function safePost(url, body){
  if(!url) return;
  try{
    await fetch(url, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(body)
    });
  }catch(_e){
    // swallow
  }
}

async function notifySheets(payload){
  const provider = payload.provider || "unknown";
  const url = provider==="stripe" ? WEBHOOK_STRIPE : (provider==="mp" ? WEBHOOK_MP : WEBAPP_URL);
  await safePost(url, payload);
}

async function notifyBookingRegistered(order){
  const row = mapBookingToSheetRow(order);
  await safePost(WEBAPP_URL, { type:"booking_registered", row });
}

async function notifyPaymentUpdate({ provider, bookingId, status, raw }){
  await notifySheets({ type:"payment_update", provider, bookingId, status, raw });
}

module.exports = {
  notifySheets,
  notifyBookingRegistered,
  notifyPaymentUpdate,
};
