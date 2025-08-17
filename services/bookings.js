"use strict";
/**
 * /services/bookings.js
 * - createBooking(payload): guarda reserva en Google Sheets
 * - listBookings(): devuelve todas las reservas
 */

const { postToSheets, fetchRowsFromSheet } = require("./sheets");

/**
 * Crea una nueva reserva en la hoja
 */
async function createBooking(payload) {
  if (!payload || !payload.entrada || !payload.salida || !payload.nombre) {
    throw new Error("booking_payload_incomplete");
  }

  const res = await postToSheets({
    action: "upsert_booking",
    ...payload
  });

  if (!res.ok) throw new Error("booking_create_failed");
  return res;
}

/**
 * Lista todas las reservas de la hoja
 */
async function listBookings() {
  return await fetchRowsFromSheet();
}

module.exports = { createBooking, listBookings };
