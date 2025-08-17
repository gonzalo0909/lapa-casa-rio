"use strict";
/**
 * services/bookings.js – Router Express
 * POST /bookings → upsert en Sheets
 */
const express = require("express");
const { postToSheets, fetchRowsFromSheet } = require("./sheets");
const router = express.Router();

router.get("/", async (_req,res)=>{
  try { const rows = await fetchRowsFromSheet(); res.json({ ok:true, rows }); }
  catch(e){ res.status(500).json({ ok:false, error:String(e.message||e) }); }
});
router.post("/", async (req,res)=>{
  try{
    const b = req.body||{};
    const booking_id = String(b.booking_id || b.bookingId || `PING-${Date.now()}`);
    const out = await postToSheets({
      action:"upsert_booking", booking_id,
      nombre:b.nombre||"", email:b.email||"", telefono:b.telefono||"",
      entrada:b.entrada||"", salida:b.salida||"",
      hombres:+b.hombres||0, mujeres:+b.mujeres||0,
      camas: b.camas || b.camas_json || {}, total:+b.total||0,
      pay_status: b.pay_status || ""
    });
    res.json({ ok:true, booking_id: out.booking_id || booking_id, message: out.message || "Upsert OK" });
  }catch(e){ res.status(500).json({ ok:false, error:String(e.message||e) }); }
});
module.exports = router;
