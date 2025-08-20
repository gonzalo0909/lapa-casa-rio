"use strict";

/**
 * Transforma órdenes/holds a un payload estable para Google Apps Script (Sheets).
 * Mantén claves simples para que el WebApp las procese fácil.
 */

function mapHoldToSheet(hold) {
  return {
    type: "hold_started",
    holdId: hold.holdId,
    bookingId: hold.holdId,
    name: hold.nombre || "",
    email: hold.email || "",
    phone: hold.telefono || "",
    checkin: hold.entrada,
    checkout: hold.salida,
    men: Number(hold.hombres || 0),
    women: Number(hold.mujeres || 0),
    beds_json: JSON.stringify(hold.camas || {}),
    total_brl: Number(hold.total || 0),
    status: "hold",
    ts: new Date().toISOString(),
  };
}

function mapPaidToSheet(info) {
  // info puede venir del webhook de Stripe/MP o de confirmHold
  return {
    type: "booking_paid",
    holdId: info.holdId || info.bookingId,
    bookingId: info.bookingId || info.holdId,
    provider: info.provider || "unknown",
    provider_charge_id: info.chargeId || info.paymentId || "",
    email: info.email || "",
    amount_brl: Number(info.total || 0),
    currency: "BRL",
    status: "paid",
    ts: new Date().toISOString(),
  };
}

function mapReleaseToSheet(hold) {
  return {
    type: "hold_released",
    holdId: hold.holdId,
    bookingId: hold.holdId,
    status: "released",
    ts: new Date().toISOString(),
  };
}

module.exports = {
  mapHoldToSheet,
  mapPaidToSheet,
  mapReleaseToSheet,
};
