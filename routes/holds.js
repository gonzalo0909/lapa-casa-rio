"use strict";

const express = require("express");
const router = express.Router();
const holds = require("../services/holds");
const sheets = require("../services/sheets");

// POST /holds/start
// { holdId, entrada, salida, camas, total, nombre, email, telefono, hombres, mujeres }
router.post("/start", (req, res) => {
  try {
    const b = Object(req.body || {});
    if (!b.holdId || !b.entrada || !b.salida || !b.camas) {
      return res.status(400).json({ ok: false, error: "missing_fields" });
    }
    const h = holds.startHold(b.holdId, b);
    return res.json({ ok: true, holdId: h.id, expiresAt: h.expiresAt });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// POST /holds/confirm
// { holdId, status: 'paid' | 'manual' }
router.post("/confirm", async (req, res) => {
  try {
    const { holdId } = Object(req.body || {});
    if (!holdId) return res.status(400).json({ ok: false, error: "missing_holdId" });
    const h = holds.confirmHold(holdId);
    if (!h) return res.status(404).json({ ok: false, error: "hold_not_found" });

    // Registrar reserva confirmada a "Sheets" (memoria)
    await sheets.appendBookingRow({
      bookingId: holdId,
      ...h.payload,
      pay_status: "approved",
      confirmedAt: new Date().toISOString(),
    });

    return res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// POST /holds/release
// { holdId }
router.post("/release", (req, res) => {
  try {
    const { holdId } = Object(req.body || {});
    if (!holdId) return res.status(400).json({ ok: false, error: "missing_holdId" });
    const ok = holds.releaseHold(holdId);
    return res.json({ ok: true, released: ok });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

module.exports = router;
