"use strict";
const express = require("express");
const router = express.Router();
const { fetchRowsFromSheet, getPaymentStatus } = require("../services/sheets");

// GET /api/bookings/status?bookingId=...
router.get("/status", async (req,res)=>{
  try{
    const id = String(req.query.bookingId || '').trim();
    if(!id) return res.status(400).json({ ok:false, error:'missing_bookingId' });
    const status = await getPaymentStatus(id);
    if(!status) return res.json({ ok:true, bookingId:id, status:'pending', paid:false });
    return res.json({ ok:true, bookingId:id, status, paid: ['approved','paid'].includes(status) });
  }catch(e){
    console.error('status error:', e);
    res.status(500).json({ ok:false, error:String(e) });
  }
});

// GET /api/bookings?from=YYYY-MM-DD&to=YYYY-MM-DD&q=...
router.get("/", async (req,res)=>{
  try{
    const { from = '', to = '', q = '' } = req.query;
    const rows = await fetchRowsFromSheet(from, to);
    const qq = String(q || '').toLowerCase();
    const filtered = rows.filter(r=>{
      if(!qq) return true;
      const hay = `${r.booking_id||''} ${r.nombre||''} ${r.email||''} ${r.telefono||''}`.toLowerCase();
      return hay.includes(qq);
    });
    res.json({ ok:true, rows: filtered });
  }catch(e){
    console.error('bookings list error:', e);
    res.status(500).json({ ok:false, error:String(e) });
  }
});

module.exports = router;
