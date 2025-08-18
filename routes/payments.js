"use strict";

const express = require("express");
const router = express.Router();
const stripeSrv = require("../services/payments-stripe");
const mpSrv = require("../services/payments-mp");

// stripe
router.post("/stripe/create", async (req, res) => {
  try {
    const intent = await stripeSrv.createPaymentIntent(req.body);
    res.json({ ok: true, intent });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// mercado pago
router.post("/mp/create", async (req, res) => {
  try {
    const pref = await mpSrv.createPreference(req.body, { baseUrl: process.env.BASE_URL });
    res.json({ ok: true, pref });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
