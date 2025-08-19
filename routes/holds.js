"use strict";
const { Router } = require("express");
const {
  createHold,
  confirmHold,
  releaseHold,
  sweepExpired,
  getHoldsMap,
} = require("../services/holds");

const HOLD_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES || 10);
const router = Router();

/**
 * POST /holds/start
 * body: { holdId?, ttlMinutes?, nombre,email,telefono,entrada,salida,hombres,mujeres,camas,total }
 */
router.post("/start", async (req, res) => {
  try {
    const b = req.body || {};
    const ttl = Number(b.ttlMinutes || HOLD_TTL_MINUTES);
    const payload = {
      ...b,
      camas: b.camas || b.camas_json || {},
    };
    const out = createHold({
      holdId: b.holdId || b.bookingId,
      ttlMinutes: ttl,
      payload,
    });
    return res.json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

/**
 * POST /holds/confirm
 * body: { holdId, status? }  (status default "paid")
 */
router.post("/confirm", async (req, res) => {
  try {
    const id = String(req.body?.holdId || "");
    if (!id) return res.status(400).json({ ok: false, error: "missing_holdId" });
    const status = String(req.body?.status || "paid");
    const out = confirmHold(id);
    out.status = status;
    return res.json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

/**
 * POST /holds/release
 * body: { holdId }
 */
router.post("/release", async (req, res) => {
  try {
    const id = String(req.body?.holdId || "");
    if (!id) return res.status(400).json({ ok: false, error: "missing_holdId" });
    const out = releaseHold(id);
    return res.json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

/**
 * GET /holds/state
 * Devuelve resumen de holds activos por habitación
 */
router.get("/state", (_req, res) => {
  const map = getHoldsMap();
  const counts = Object.fromEntries(
    Object.entries(map).map(([k, v]) => [k, Array.from(v).length])
  );
  res.json({ ok: true, rooms: counts });
});

/**
 * GET /holds/sweep
 * Limpia holds vencidos (para usar con cron)
 */
router.get("/sweep", (_req, res) => {
  const out = sweepExpired();
  res.json({ ok: true, ...out });
});

module.exports = router;
