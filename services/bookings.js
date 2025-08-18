// services/bookings.js
"use strict";
/**
 * /services/bookings.js — Router Express
 * POST /        → upsert_booking (Sheets)
 * GET  /        → rows (Sheets)
 */
const express = require("express");
const router = express.Router();
const { postToSheets, fetchRowsFromSheet } = require("./sheets");

// JSON solo para este router
router.use(express.json({ limit: "1mb" }));

// Crea/actualiza una reserva en Sheets
router.post("/", async (req, res) => {
  try {
    const p = Object(req.body || {});
    const booking_id = String(p.booking_id || p.bookingId || `BKG-${Date.now()}`);

    const payload = {
      action: "upsert_booking",
      booking_id,
      nombre:   p.nombre   || "",
      email:    p.email    || "",
      telefono: p.telefono || "",
      entrada:  p.entrada  || "",
      salida:   p.salida   || "",
      hombres:  Number(p.hombres || 0),
      mujeres:  Number(p.mujeres || 0),
      total:    Number(p.total   || 0),
      camas:    p.camas || {},
      pay_status: p.pay_status || "pending",
    };

    const out = await postToSheets(payload);
    if (!out || out.ok !== true) throw new Error(out?.error || "sheets_error");

    res.json({ ok: true, booking_id });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e.message || e) });
  }
});

// Lista reservas desde Sheets
router.get("/", async (_req, res) => {
  try {
    const rows = await fetchRowsFromSheet();
    res.json({ ok: true, rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

module.exports = router;
