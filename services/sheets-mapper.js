// services/sheets-mapper.js
"use strict";

/**
 * Convierte una orden/booking a payload simple para Apps Script/Sheets.
 */
function mapBookingToSheetRow(order){
  return {
    booking_id: order.bookingId,
    nombre: order.nombre || "",
    email: order.email || "",
    telefono: order.telefono || "",
    entrada: order.entrada,
    salida: order.salida,
    hombres: Number(order.hombres||0),
    mujeres: Number(order.mujeres||0),
    total: Number(order.total||0),
    camas_json: JSON.stringify(order.camas||{}),
    nights: Number(order.nights||0),
    status: order.pay_status || "pending",
    ts: new Date().toISOString()
  };
}

module.exports = { mapBookingToSheetRow };
