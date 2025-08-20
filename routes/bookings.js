// routes/bookings.js
"use strict";
const express = require("express");
const router = express.Router();
const holds = require("../services/holds");
const { notifyBookingRegistered } = require("../services/sheets");

// Crea/actualiza un registro “pending” antes de ir a pagos
router.post("/", async (req,res)=>{
  try{
    const order = Object(req.body||{});
    if (!order.bookingId) order.bookingId = `BKG-${Date.now()}`;
    if (!("total" in order)) return res.status(400).json({ok:false,error:"missing_total"});
    // Persistimos como “pending” (o actualizamos si existe)
    holds.upsertBooking(order.bookingId, { ...order, pay_status:"pending" });
    await notifyBookingRegistered(order).catch(()=>{});
    return res.json({ ok:true, bookingId: order.bookingId });
  }catch(e){
    res.status(400).json({ ok:false, error:String(e.message||e) });
  }
});

module.exports = router;
