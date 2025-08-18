"use strict";

const express = require("express");
const router = express.Router();
const stripeSrv = require("../services/payments-stripe");
const mpSrv = require("../services/payments-mp");

// stripe webhook
router.post("/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const event = await stripeSrv.handleWebhook(req);
    res.json({ ok: true, event });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// mercado pago webhook
router.post("/mp", async (req, res) => {
  try {
    const event = await mpSrv.handleWebhook(req.body);
    res.json({ ok: true, event });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;
