// routes/payments-status.js
"use strict";
const express = require("express");
const router = express.Router();
const holds = require("../services/holds");

router.get("/", (req,res)=>{
  try{
    const id = String(req.query.bookingId||"");
    if(!id) return res.status(400).json({ ok:false, error:"missing_bookingId" });
    const st = holds.getPaymentStatus(id);
    res.json({ ok:true, bookingId:id, ...st });
  }catch(e){
    res.status(500).json({ ok:false, error:String(e.message||e) });
  }
});

module.exports = router;
