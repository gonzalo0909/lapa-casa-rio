"use strict";
const express = require("express");
const router = express.Router();

const bookings = new Map();

/**
 * Crea/guarda una reserva (en memoria para demo).
 */
router.post("/", (req, res) => {
  const b = req.body || {};
  if (!b.bookingId || !b.total) {
    return res.status(400).json({ ok: false, error: "missing_bookingId_or_total" });
  }
  bookings.set(String(b.bookingId), { ...b, createdAt: Date.now() });
  return res.json({ ok: true, id: b.bookingId });
});

/**
 * (Opcional) Estado de pago consultado por el front.
 * Si la reserva existe y tenía pay_status='pending', seguirá pending.
 * Si tu webhook marcó algo, podrías reflejarlo acá.
 */
router.get("/status", (req, res) => {
  const id = String(req.query.bookingId || "");
  if (!id) return res.status(400).json({ ok: false, error: "missing_bookingId" });
  const row = bookings.get(id);
  if (!row) return res.json({ ok: true, status: "unknown", paid: false });
  // demo: si el front usó “Simular pago aprobado”, confirmará por /holds/confirm
  return res.json({ ok: true, status: row.pay_status || "pending", paid: row.pay_status === "paid" });
});

module.exports = router;
