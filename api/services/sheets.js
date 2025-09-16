/**
 * sheets.js — Servicio de integración con Google Sheets (Apps Script)
 * Funciones: lectura/escritura de reservas, cálculo de ocupación,
 * actualización de estados (hold, paid, cancel, etc.)
 */

const fetch = require("node-fetch");

const BOOKINGS_WEBAPP_URL = process.env.BOOKINGS_WEBAPP_URL;
if (!BOOKINGS_WEBAPP_URL) {
  throw new Error("BOOKINGS_WEBAPP_URL not defined in env");
}

/**
 * Insertar o actualizar reserva en Sheets.
 * @param {Object} booking
 * @returns {Promise<Object>}
 */
async function upsertBooking(booking) {
  const res = await fetch(`${BOOKINGS_WEBAPP_URL}?action=upsertBooking`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(booking),
  });

  if (!res.ok) {
    throw new Error(`Sheets upsert failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * Actualizar estado de pago en Sheets.
 * @param {string} reservationCode
 * @param {string} payStatus
 * @returns {Promise<Object>}
 */
async function updatePayment(reservationCode, payStatus) {
  const res = await fetch(`${BOOKINGS_WEBAPP_URL}?action=updatePayment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reservation_code: reservationCode, pay_status: payStatus }),
  });

  if (!res.ok) {
    throw new Error(`Sheets updatePayment failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * Obtener reservas desde Sheets (para disponibilidad).
 */
async function getBookings() {
  const res = await fetch(`${BOOKINGS_WEBAPP_URL}?action=getBookings`);
  if (!res.ok) {
    throw new Error(`Sheets getBookings failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * Calcular ocupación de camas a partir de registros.
 * Considera múltiples estados como válidos (no solo "paid").
 * @param {Array<Object>} bookings
 * @param {string} targetDate (ISO yyyy-mm-dd)
 * @returns {number}
 */
function calcOccupiedBeds(bookings, targetDate) {
  if (!Array.isArray(bookings)) return 0;

  // Estados aceptados como "reserva activa"
  const VALID_STATES = new Set([
    "hold",
    "pending",
    "paid",
    "paid_out",
    "confirmed",
    "processing"
  ]);

  const day = new Date(targetDate);
  let occupied = 0;

  for (const b of bookings) {
    if (!b.checkin_date || !b.checkout_date) continue;
    if (!VALID_STATES.has((b.pay_status || "").toLowerCase())) continue;

    const checkin = new Date(b.checkin_date);
    const checkout = new Date(b.checkout_date);

    if (day >= checkin && day < checkout) {
      occupied += Number(b.beds || 1);
    }
  }

  return occupied;
}

module.exports = {
  upsertBooking,
  updatePayment,
  getBookings,
  calcOccupiedBeds,
};
