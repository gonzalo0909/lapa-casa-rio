"use strict";
/**
 * services/bookings.js — Router Express para reservas
 * POST /bookings  → upsert en Google Sheets (via Web App)
 * GET  /bookings  → lista (debug)
 */
const express = require("express");
const router = express.Router();

const { postToSheets, fetchRowsFromSheet } = require("./sheets");

/* ============ GET (debug) ============ */
router.get("/", async (_req, res) => {
  try {
    const rows = await fetchRowsFromSheet();
    res.json({ ok: true, rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/* ============ POST (upsert) ============ */
router.post("/", async (req, res) => {
  try {
    const b = Object(req.body || {});
    const booking_id = String(b.booking_id || b.bookingId || `BKG-${Date.now()}`);

    const payload = {
      action: "upsert_booking",
      booking_id,
      nombre:   (b.nombre   || "").trim(),
      email:    (b.email    || "").trim(),
      telefono: (b.telefono || "").trim(),
      entrada:  (b.entrada  || "").trim(),
      salida:   (b.salida   || "").trim(),
      hombres:  Number(b.hombres || 0) || 0,
      mujeres:  Number(b.mujeres || 0) || 0,
      camas:    b.camas || b.camas_json || {},
      total:    Number(b.total || 0) || 0,
      pay_status: (b.pay_status || "").trim()
    };

    const out = await postToSheets(payload);
    res.json({
      ok: true,
      booking_id: out.booking_id || booking_id,
      message: out.message || "Upsert OK"
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

module.exports = router;
