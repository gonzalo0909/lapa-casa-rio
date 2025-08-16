"use strict";

/**
 * /services/sheets.js
 * Router Express para integrar con Google Apps Script (GAS):
 *  - POST /sheets/upsert         → { action:"upsert_booking", ... }
 *  - POST /sheets/payment_update → { action:"payment_update", booking_id, status }
 *  - GET  /sheets/rows           → proxy de ?mode=rows
 *  - GET  /sheets/diag           → diagnóstico rápido
 *
 * Requiere ENV: BOOKINGS_WEBAPP_URL (URL pública del WebApp GAS /exec)
 */

const express = require("express");
const router = express.Router();

const SHEET_URL = process.env.BOOKINGS_WEBAPP_URL || "";

/* ================== HELPERS ================== */
async function callSheet(payload = {}) {
  if (!SHEET_URL) return { ok: false, error: "sheet_url_not_configured" };
  try {
    const r = await fetch(SHEET_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const text = await r.text();
    try { return JSON.parse(text); } catch { return { ok:false, error:"invalid_json", raw:text }; }
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

async function fetchRows() {
  if (!SHEET_URL) return { ok: false, error: "sheet_url_not_configured" };
  try {
    const r = await fetch(`${SHEET_URL}?mode=rows`, { method: "GET" });
    const text = await r.text();
    try { return JSON.parse(text); } catch { return { ok:false, error:"invalid_json", raw:text }; }
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

/* ================== RUTAS ================== */
// Upsert reserva (alta/actualización idempotente)
router.post("/upsert", async (req, res) => {
  try {
    const out = await callSheet({ action: "upsert_booking", ...(req.body || {}) });
    res.status(out?.ok ? 200 : 500).json(out);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Actualización de pago (NO crea filas nuevas)
router.post("/payment_update", async (req, res) => {
  try {
    const { booking_id, status, pay_status } = req.body || {};
    if (!booking_id) return res.status(400).json({ ok:false, error:"missing_booking_id" });
    const out = await callSheet({ action: "payment_update", booking_id, status: status || pay_status });
    res.status(out?.ok ? 200 : 500).json(out);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Filas completas (para /availability y admin)
router.get("/rows", async (_req, res) => {
  try {
    const out = await fetchRows();
    res.status(out?.ok ? 200 : 500).json(out);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Diagnóstico simple
router.get("/diag", (_req, res) => {
  res.json({
    ok: true,
    service: "sheets",
    sheet_url_configured: Boolean(SHEET_URL),
    ts: Date.now()
  });
});

module.exports = router;
