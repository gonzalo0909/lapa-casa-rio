// routes/holds.js
"use strict";
const express = require("express");
const router = express.Router();
const holds = require("../services/holds");

router.post("/start", (req,res)=>{
  try{
    const b = Object(req.body||{});
    if(!b.holdId) b.holdId = `BKG-${Date.now()}`;
    holds.startHold(b.holdId, b);
    res.json({ ok:true, holdId:b.holdId, ttl_minutes: holds.getTtlMinutes() });
  }catch(e){
    res.status(400).json({ ok:false, error:String(e.message||e) });
  }
});

router.post("/confirm", (req,res)=>{
  try{
    const { holdId, status } = Object(req.body||{});
    if(!holdId) return res.status(400).json({ ok:false, error:"missing_holdId" });
    const ok = holds.confirmHold(holdId, status||"paid");
    if(!ok) return res.status(404).json({ ok:false, error:"not_found" });
    res.json({ ok:true });
  }catch(e){
    res.status(400).json({ ok:false, error:String(e.message||e) });
  }
});

router.post("/release", (req,res)=>{
  try{
    const { holdId } = Object(req.body||{});
    if(!holdId) return res.status(400).json({ ok:false, error:"missing_holdId" });
    holds.releaseHold(holdId);
    res.json({ ok:true });
  }catch(e){
    res.status(400).json({ ok:false, error:String(e.message||e) });
  }
});

module.exports = router;
