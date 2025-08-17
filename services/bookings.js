"use strict";

/**
 * /services/bookings.js
 * Gestión de reservas (crear, modificar, cancelar)
 */

const { upsertBooking, updatePayment } = require("./sheets");
const { startHold, releaseHold } = require("./holds");
const { v4: uuidv4 } = require("uuid");

let bookings = {}; // memoria temporal { booking_id: {...} }

/* Crear reserva */
function createBooking(data={}) {
  const booking_id = uuidv4();
  const booking = { booking_id, status:"pending", ...data };
  bookings[booking_id] = booking;

  // sincronizar en Sheets
  upsertBooking(booking).catch(err=>console.error("Sheet error",err));
  return { ok:true, booking };
}

/* Confirmar pago */
function confirmPayment(booking_id, status="paid") {
  const b = bookings[booking_id];
  if (!b) return { ok:false, error:"not_found" };
  b.status = status;

  updatePayment(booking_id, status).catch(err=>console.error("Sheet error",err));
  return { ok:true, booking:b };
}

/* Cancelar reserva */
function cancelBooking(booking_id) {
  if (!bookings[booking_id]) return { ok:false, error:"not_found" };
  delete bookings[booking_id];
  releaseHold(booking_id);
  return { ok:true, booking_id };
}

/* Listar reservas */
function listBookings() {
  return Object.values(bookings);
}

module.exports = { createBooking, confirmPayment, cancelBooking, listBookings };
