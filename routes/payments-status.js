"use strict";

const express = require("express");
const router = express.Router();
const holds = require("../services/holds");

// GET /payments/status?bookingId=...
router.get("/status", (req, res) => {
  try {
    const bookingId = String(req.query.bookingId || "");
    if (!bookingId) return res.status(400).json({ ok: false, error: "missing_bookingId" });

    const h = holds.getHold(bookingId);
    const paid = !!(h && h.confirmed === true);
    res.json({ ok: true, bookingId, paid, status: paid ? "approved" : "pending" });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

module.exports = router;
