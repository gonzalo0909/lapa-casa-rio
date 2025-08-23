"use strict";
const express = require("express");
const router = express.Router();
const Stripe = require("stripe");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY || "");

router.get("/", async (_req, res) => {
  const needEnv = ["BOOKINGS_WEBAPP_URL","MP_ACCESS_TOKEN","STRIPE_SECRET_KEY","STRIPE_WEBHOOK_SECRET","FRONTEND_URL"];
  const envOk = needEnv.every(k => (process.env[k] || "").length > 0);

  const mpReach = await (async () => {
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 2000);
      const r = await fetch("https://api.mercadopago.com", {
        method: "HEAD",
        headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN || ""}` },
        signal: ctrl.signal
      });
      clearTimeout(t);
      return r.ok;
    } catch { return false; }
  })();

  const stripeReach = await Promise.race([
    stripe.balance.retrieve().then(() => true).catch(() => false),
    new Promise(resolve => setTimeout(() => resolve(false), 2000))
  ]);

  res.json({
    ok: envOk && mpReach && stripeReach,
    envOk, mpReach, stripeReach,
    time: new Date().toISOString()
  });
});

module.exports = router;
