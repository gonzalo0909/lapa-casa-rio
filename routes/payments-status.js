"use strict";

/**
 * GET /payments/status?bookingId=...
 * Devuelve { ok:true, bookingId, status, total }
 * Fuente: Google Sheets (via services/sheets.fetchRowsFromSheet)
 */
const express = require("express");
const router = express.Router();
const { fetchRowsFromSheet } = require("../services/sheets");

router.get("/", async (req, res) => {
  try {
    const bookingId = String(req.query.bookingId || req.query.id || "").trim();
    if (!bookingId) return res.status(400).json({ ok:false, error:"missing_bookingId" });

    const rows = await fetchRowsFromSheet();
    const row = rows.find(r => String(r.booking_id) === bookingId);

    if (!row) return res.json({ ok:true, bookingId, status:"not_found", total:0 });

    const status = String(row.pay_status || "pending");
    const total  = Number(row.total || 0);
    return res.json({ ok:true, bookingId, status, total });
  } catch (e) {
    return res.status(500).json({ ok:false, error:String(e?.message||e) });
  }
});

module.exports = router;
