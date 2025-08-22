"use strict";
const express = require("express");
const router = express.Router();
const store = require("../services/holdsStore");

router.post("/start", (req, res) => {
  try { const r = store.startHold(req.body||{}); res.json({ ok:true, ...r }); }
  catch(e){ res.status(500).json({ ok:false, error:String(e) }); }
});

router.post("/confirm", (req, res) => {
  try {
    const { holdId, status } = req.body||{};
    if(!holdId) return res.status(400).json({ ok:false, error:"holdId requerido" });
    const ok = store.confirmHold(holdId, status||"paid");
    if(!ok) return res.status(404).json({ ok:false, error:"hold_not_found" });
    res.json({ ok:true });
  } catch(e){ res.status(500).json({ ok:false, error:String(e) }); }
});

router.post("/release", (req, res) => {
  try {
    const { holdId } = req.body||{};
    if(!holdId) return res.status(400).json({ ok:false, error:"holdId requerido" });
    store.releaseHold(holdId);
    res.json({ ok:true });
  } catch(e){ res.status(500).json({ ok:false, error:String(e) }); }
});

// Listar holds (admin)
router.get("/list", (_req,res)=>{
  try { res.json({ ok:true, holds: store.listHolds() }); }
  catch(e){ res.status(500).json({ ok:false, error:String(e) }); }
});

// Stats (admin)
router.get("/_stats", (_req,res)=>{
  try { res.json({ ok:true, ...store.getStats() }); }
  catch(e){ res.status(500).json({ ok:false, error:String(e) }); }
});

module.exports = router;
