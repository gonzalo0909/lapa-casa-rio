"use strict";
const express = require("express");
const router = express.Router();
const {
  listHolds,
  getHold,
  startHold,
  confirmHold,
  releaseHold,
  sweepExpired
} = require("../services/holdsStore");

router.post("/start", (req, res) => {
  try { return res.json(startHold(req.body || {})); }
  catch (e) { return res.status(500).json({ ok:false, error:String(e) }); }
});

router.post("/confirm", (req, res) => {
  try {
    const { holdId, status } = req.body || {};
    if (!holdId) return res.status(400).json({ ok:false, error:"holdId requerido" });
    const out = confirmHold(holdId, status || "paid");
    if (!out.ok) return res.status(404).json(out);
    return res.json(out);
  } catch (e) { return res.status(500).json({ ok:false, error:String(e) }); }
});

router.post("/release", (req, res) => {
  try {
    const { holdId } = req.body || {};
    if (!holdId) return res.status(400).json({ ok:false, error:"holdId requerido" });
    return res.json(releaseHold(holdId));
  } catch (e) { return res.status(500).json({ ok:false, error:String(e) }); }
});

router.get("/list", (_req, res) => {
  sweepExpired();
  return res.json({ ok:true, holds: listHolds() });
});

router.get("/:id", (req, res) => {
  const item = getHold(String(req.params.id || ""));
  if (!item) return res.status(404).json({ ok:false, error:"hold_not_found" });
  return res.json({ ok:true, hold:item });
});

module.exports = router;
