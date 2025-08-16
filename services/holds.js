"use strict";
/**
 * /services/holds.js
 * Bloqueos temporales de camas (para evitar overbooking)
 */

const express = require("express");
const router = express.Router();

const HOLD_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES || 10);

// Memoria simple en backend (puede migrar a Redis/DB)
let holds = {};

/* ================== HELPERS ================== */
function cleanExpired() {
  const now = Date.now();
  for (const k of Object.keys(holds)) {
    if (holds[k].expires <= now) delete holds[k];
  }
}

/* ================== RUTAS ================== */
// Crear hold
router.post("/start", (req, res) => {
  cleanExpired();
  const { room_id, count = 1 } = req.body || {};
  if (!room_id) return res.status(400).json({ ok: false, error: "missing_room_id" });

  const key = `${room_id}-${Date.now()}`;
  holds[key] = {
    room_id,
    count,
    created: Date.now(),
    expires: Date.now() + HOLD_TTL_MINUTES * 60 * 1000
  };
  res.json({ ok: true, hold_id: key, ttl_minutes: HOLD_TTL_MINUTES });
});

// Confirmar hold
router.post("/confirm", (req, res) => {
  const { hold_id } = req.body || {};
  if (!hold_id || !holds[hold_id]) return res.status(400).json({ ok: false, error: "invalid_hold" });
  const data = holds[hold_id];
  delete holds[hold_id];
  res.json({ ok: true, confirmed: data });
});

// Liberar hold manual
router.post("/release", (req, res) => {
  const { hold_id } = req.body || {};
  if (hold_id && holds[hold_id]) {
    delete holds[hold_id];
    return res.json({ ok: true, released: hold_id });
  }
  res.json({ ok: false, error: "not_found" });
});

// Sweep (limpieza manual)
router.post("/sweep", (_req, res) => {
  cleanExpired();
  res.json({ ok: true, holds_count: Object.keys(holds).length });
});

module.exports = router;
