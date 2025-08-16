"use strict";
/**
 * /services/bookings.js
 * Altas, updates y sync con Google Sheets
 */

const express = require("express");
const { upsertBooking, updatePayment } = require("./sheets");

const router = express.Router();

/* ================== RUTAS ================== */
// Alta / upsert reserva
router.post("/", async (req, res) => {
  try {
    const b = req.body || {};
    const booking = {
      booking_id: b.booking_id || `PING-${Date.now()}`,
      nombre: b.nombre || "",
      email: b.email || "",
      telefono: b.telefono || "",
      entrada: b.entrada || "",
      salida: b.salida || "",
      hombres: Number(b.hombres || 0),
      mujeres: Number(b.mujeres || 0),
      camas_json: JSON.stringify(b.camas || []),
      total: Number(b.total || 0),
      pay_status: b.pay_status || "pending",
      created_at: new Date().toISOString()
    };
    const out = await upsertBooking(booking);
    res.json({ ok: true, booking, sheet: out });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// Update pago
router.post("/payment_update", async (req, res) => {
  try {
    const { booking_id, status } = req.body || {};
    if (!booking_id) return res.status(400).json({ ok: false, error: "missing_booking_id" });
    const out = await updatePayment(booking_id, status);
    res.json({ ok: true, sheet: out });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// Diagnóstico
router.get("/diag", (_req, res) => {
  res.json({ ok: true, service: "bookings", ts: Date.now() });
});

module.exports = router;
