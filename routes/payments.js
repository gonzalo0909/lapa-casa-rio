"use strict";

const express = require("express");
const router = express.Router();

const { createCheckoutSession } = require("../services/payments-stripe");
const { createPreference } = require("../services/payments-mp");

// base URL (env o inferida del request)
function getBaseUrl(req) {
  const env = String(process.env.BASE_URL || "").replace(/\/+$/, "");
  if (env) return env;
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host  = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

// POST /payments/stripe/session  -> { order: { booking_id,total,email,nights } } | también plano
router.post("/stripe/session", async (req, res) => {
  try {
    const order = req.body?.order || req.body || {};
    if (order.total == null) return res.status(400).json({ ok:false, error:"missing_total" });
    const out = await createCheckoutSession(order, { baseUrl: getBaseUrl(req) });
    res.json({ ok:true, ...out });
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e.message||e) });
  }
});

// POST /payments/mp/preference   -> { order: { booking_id,total } } | también plano
router.post("/mp/preference", async (req, res) => {
  try {
    const order = req.body?.order || req.body || {};
    if (order.total == null) return res.status(400).json({ ok:false, error:"missing_total" });
    const out = await createPreference(order, { baseUrl: getBaseUrl(req) });
    res.json({ ok:true, ...out });
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e.message||e) });
  }
});

module.exports = router;
