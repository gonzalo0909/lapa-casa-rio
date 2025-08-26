/**
 * services/sheets.js
 * Conecta con Google Sheets a través de una API externa
 * Obtiene y procesa datos de reservas para calcular disponibilidad
 */

"use strict";

/**
 * Obtiene filas de Google Sheets que coincidan con el rango de fechas
 * @param {string} from - Fecha de entrada (YYYY-MM-DD)
 * @param {string} to - Fecha de salida (YYYY-MM-DD)
 * @returns {Array} Lista de reservas
 */
async function fetchRowsFromSheet(from, to) {
  const base = process.env.BOOKINGS_WEBAPP_URL;
  if (!base) return [];

  const url = `${base}?mode=rows`;
  try {
    const response = await fetch(url, {
      headers: { "Accept": "application/json" }
    });

    if (!response.ok) return [];

    const data = await response.json().catch(() => ({}));
    const rows = Array.isArray(data.rows) ? data.rows : [];

    // Si no hay fechas, devolver todo
    if (!from && !to) return rows;

    const fromDate = from ? new Date(`${from}T00:00:00`) : null;
    const toDate = to ? new Date(`${to}T00:00:00`) : null;

    return rows.filter(row => {
      const checkIn = row.entrada ? new Date(`${row.entrada}T00:00:00`) : null;
      const checkOut = row.salida ? new Date(`${row.salida}T00:00:00`) : null;

      // No superposición: salida del booking <= entrada del rango
      if (checkOut && fromDate && checkOut <= fromDate) return false;
      // No superposición: entrada del booking >= salida del rango
      if (checkIn && toDate && checkIn >= toDate) return false;

      return true;
    });
  } catch (err) {
    console.error("[Sheets] Error al obtener filas:", err.message);
    return [];
  }
}

/**
 * Calcula camas ocupadas combinando bookings (Sheets) y holds (memoria)
 * @param {Array} rows - Reservas de Sheets
 * @param {Object} holdsMap - Camas bloqueadas por holds
 * @returns {Object} Mapa de camas ocupadas por habitación
 */
function calcOccupiedBeds(rows, holdsMap) {
  const occupied = { 1: new Set(), 3: new Set(), 5: new Set(), 6: new Set() };

  for (const row of rows) {
    const status = String(row.pay_status || '').toLowerCase();
    if (!['approved', 'paid', 'confirmed', 'succeeded'].includes(status)) continue;

    let camas = {};
    try {
      camas = row.camas_json ? JSON.parse(row.camas_json) : (row.camas || {});
    } catch (e) {
      camas = row.camas || {};
    }

    for (const [roomId, beds] of Object.entries(camas)) {
      (beds || []).forEach(bedId => {
        const room = Number(roomId);
        if (occupied[room]) occupied[room].add(Number(bedId));
      });
    }
  }

  // Añadir holds activos
  if (holdsMap) {
    for (const [roomId, beds] of Object.entries(holdsMap)) {
      const room = Number(roomId);
      if (occupied[room]) {
        (beds || []).forEach(bedId => occupied[room].add(Number(bedId)));
      }
    }
  }

  // Convertir Sets a arrays ordenados
  const result = {};
  for (const roomId of [1, 3, 5, 6]) {
    result[roomId] = Array.from(occupied[roomId] || []).sort((a, b) => a - b);
  }
  return result;
}

/**
 * Verifica el estado de pago de una reserva por booking_id
 * @param {string} bookingId
 * @returns {string|null} Estado de pago o null si no existe
 */
async function getPaymentStatus(bookingId) {
  const base = process.env.BOOKINGS_WEBAPP_URL;
  if (!base) return null;

  const url = `${base}?mode=rows`;
  try {
    const response = await fetch(url, {
      headers: { "Accept": "application/json" }
    });

    if (!response.ok) return null;

    const data = await response.json().catch(() => ({}));
    const rows = Array.isArray(data.rows) ? data.rows : [];
    const booking = rows.find(row => String(row.booking_id || '') === String(bookingId));

    return booking ? String(booking.pay_status || '').toLowerCase() : null;
  } catch (err) {
    console.error("[Sheets] Error al obtener estado de pago:", err.message);
    return null;
  }
}

module.exports = { fetchRowsFromSheet, calcOccupiedBeds, getPaymentStatus };
