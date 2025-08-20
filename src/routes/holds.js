"use strict";
const express = require("express");
const router = express.Router();
const { createHold, confirmHold, releaseHold, getHoldsMap } = require("../services/holds");

router.post("/start", (req, res) => {
  const body = req.body || {};
  const holdId = String(body.holdId || body.bookingId || ("HOLD-"+Date.now()));
  createHold({ holdId, ttlMinutes: Number(process.env.HOLD_TTL_MINUTES || 10), payload: body });
  return res.json({ ok: true, holdId });
});

router.post("/confirm", (req, res) => {
  const { holdId, status } = req.body || {};
  if (!holdId) return res.status(400).json({ ok: false, error: "missing_holdId" });
  const ok = confirmHold(holdId);
  if (!ok) return res.status(404).json({ ok: false, error: "hold_not_found" });
  // En real, marcarías booking como paid + liberarías camas del inventario.
  return res.json({ ok: true, holdId, status: status || "paid" });
});

router.post("/release", (req, res) => {
  const { holdId } = req.body || {};
  if (!holdId) return res.status(400).json({ ok: false, error: "missing_holdId" });
  const ok = releaseHold(holdId);
  return res.json({ ok, holdId });
});

router.get("/debug", (_req, res) => {
  res.json({ ok: true, holds: getHoldsMap() });
});

module.exports = router;
