"use strict";
/**
 * services/bookings.js — Lógica de reservas
 */

const { upsertRow, listRows } = require("./sheets");
const { createHold, confirmHold, releaseHold } = require("./holds");

// util para generar IDs únicos
function toBookingId(seed = "") {
  return "BKG-" + Buffer.from(seed).toString("base64url").slice(0, 10);
}

/** Guarda o actualiza una reserva */
async function saveBooking(inObj = {}) {
  const booking_id =
    inObj.booking_id ||
    inObj.bookingId ||
    toBookingId(
      `${inObj.email || ""}|${inObj.entrada || ""}|${inObj.salida || ""}|${Date.now()}`
    );

  const row = {
    booking_id,
    nombre: inObj.nombre || "",
    email: inObj.email || "",
    telefono: inObj.telefono || "",
    entrada: inObj.entrada || "",
    salida: inObj.salida || "",
    hombres: Number(inObj.hombres || 0),
    mujeres: Number(inObj.mujeres || 0),
    camas_json: JSON.stringify(inObj.camas || {}),
    total: Number(inObj.total || 0),
    pay_status: inObj.pay_status || "pending",
    created_at: new Date().toISOString(),
  };

  await upsertRow(row);
  return row;
}

/** Lista reservas (puede filtrar por rango de fechas) */
async function listBookings({ from, to } = {}) {
  const rows = await listRows();
  return rows.filter((r) => {
    const ent = new Date(r.entrada);
    if (from && ent < new Date(from)) return false;
    if (to && ent > new Date(to)) return false;
    return true;
  });
}

/** Crea hold temporal para evitar overbooking */
function holdBooking(holdId, camas = {}, meta = {}) {
  return createHold({ holdId, ttlMinutes: 10, payload: { camas }, meta });
}

/** Confirma un hold (cuando se paga) */
function confirmBookingHold(holdId) {
  return confirmHold(holdId);
}

/** Libera un hold (si expira o se cancela) */
function releaseBookingHold(holdId) {
  return releaseHold(holdId);
}

module.exports = {
  saveBooking,
  listBookings,
  holdBooking,
  confirmBookingHold,
  releaseBookingHold,
};
