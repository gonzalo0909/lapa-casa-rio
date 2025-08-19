"use strict";
const { Router } = require("express");
const router = Router();
const { fetchRowsFromSheet } = require("../services/sheets");

// GET /payments/status?bookingId=...
router.get("/", async (req, res) => {
  try {
    const bookingId = String(req.query.bookingId || "").trim();
    if (!bookingId) return res.status(400).json({ ok:false, error:"missing_bookingId" });
    const rows = await fetchRowsFromSheet();
    const row = rows.find(r => String(r.booking_id) === bookingId);
    if (!row) return res.json({ ok:true, bookingId, status:"unknown", paid:false });
    const st = String(row.pay_status || "").toLowerCase();
    const paid = (st==="paid" || st==="approved" || st==="completed");
    res.json({ ok:true, bookingId, status:st, paid, total: row.total || 0 });
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e.message||e) });
  }
});

module.exports = router;
