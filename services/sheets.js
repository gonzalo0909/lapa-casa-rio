"use strict";
const fetch = require("node-fetch");

const GAS_URL = process.env.BOOKINGS_WEBAPP_URL; // .../exec
if (!GAS_URL) throw new Error("Falta env BOOKINGS_WEBAPP_URL");

async function getRows() {
  const url = `${GAS_URL}?mode=rows`;
  const r = await fetch(url, { timeout: 15000 });
  if (!r.ok) throw new Error(`GAS rows ${r.status}`);
  const j = await r.json();
  if (!j.ok || !Array.isArray(j.rows)) return [];
  return j.rows;
}

async function upsertPaid(booking) {
  const r = await fetch(GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "upsert_booking",
      booking_id: booking.booking_id || booking.bookingId,
      nombre: booking.nombre || "",
      email: booking.email || "",
      telefono: booking.telefono || "",
      entrada: booking.entrada,
      salida: booking.salida,
      hombres: booking.hombres || 0,
      mujeres: booking.mujeres || 0,
      camas: booking.camas || {},
      total: booking.total || 0,
      pay_status: "paid",
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(`GAS upsert failed: ${j.error || r.status}`);
  return j;
}

module.exports = { getRows, upsertPaid };
