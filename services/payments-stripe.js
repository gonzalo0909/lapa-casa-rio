"use strict";

/**
 * /services/payments-stripe.js
 * Pagos vía Stripe
 */

const express = require("express");
const Stripe = require("stripe");
const router = express.Router();

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

if (!STRIPE_KEY) {
  console.error("⚠️ STRIPE_SECRET_KEY no configurada");
}
const stripe = STRIPE_KEY ? new Stripe(STRIPE_KEY) : null;

/* Crear intent de pago */
router.post("/create_intent", async (req,res)=>{
  try {
    if (!stripe) return res.status(500).json({ ok:false, error:"stripe_not_configured" });
    const { amount, currency="brl", metadata } = req.body;
    const intent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata
    });
    res.json({ ok:true, client_secret:intent.client_secret });
  } catch (err) {
    res.status(500).json({ ok:false, error:String(err.message||err) });
  }
});

/* Webhook Stripe */
router.post("/webhook", express.raw({ type:"application/json" }), (req,res)=>{
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("⚠️ Webhook error", err);
    return res.status(400).json({ ok:false, error:"invalid_signature" });
  }

  switch (event.type) {
    case "payment_intent.succeeded":
      console.log("✅ Pago confirmado:", event.data.object.id);
      break;
    case "payment_intent.payment_failed":
      console.log("❌ Pago fallido:", event.data.object.id);
      break;
  }

  res.json({ ok:true });
});

module.exports = router;
