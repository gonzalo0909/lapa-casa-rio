"use strict";
/**
 * Pagos – Stripe + Mercado Pago
 */

const express = require("express");
const Stripe = require("stripe");
const mercadopago = require("mercadopago");

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";

const router = express.Router();

let stripe;
if (STRIPE_SECRET_KEY) stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2022-11-15" });
if (MP_ACCESS_TOKEN) mercadopago.configure({ access_token: MP_ACCESS_TOKEN });

/* ================== STRIPE ================== */
router.post("/stripe/session", async (req,res)=>{
  try {
    if (!stripe) return res.status(500).json({ ok:false, error:"stripe_not_configured" });
    const { amount, bookingId, success_url, cancel_url } = req.body || {};
    if (!amount) return res.status(400).json({ ok:false, error:"missing_amount" });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "brl",
          unit_amount: Math.round(amount*100),
          product_data: { name: `Reserva ${bookingId||""}` }
        },
        quantity: 1
      }],
      success_url: success_url || "https://lapacasahostel.com/success",
      cancel_url: cancel_url || "https://lapacasahostel.com/cancel",
      metadata: { booking_id: bookingId||"" }
    });
    res.json({ ok:true, id: session.id, url: session.url });
  } catch(e) {
    res.status(500).json({ ok:false, error:String(e.message||e) });
  }
});

// Stripe webhook
router.post("/stripe/webhook", express.raw({ type:"application/json" }), (req,res)=>{
  if (!STRIPE_WEBHOOK_SECRET || !stripe) return res.status(400).end();
  const sig = req.headers["stripe-signature"];
  let event;
  try { event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET); }
  catch(err) { return res.status(400).send(`Webhook Error: ${err.message}`); }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    console.log("✅ Pago Stripe completado:", session.metadata.booking_id);
    // 👉 aquí podemos llamar a /bookings/payment_update
  }
  res.json({ ok:true });
});

/* ================== MERCADO PAGO ================== */
router.post("/mp/preference", async (req,res)=>{
  try {
    if (!MP_ACCESS_TOKEN) return res.status(500).json({ ok:false, error:"mp_not_configured" });
    const { amount, bookingId } = req.body || {};
    if (!amount) return res.status(400).json({ ok:false, error:"missing_amount" });

    const pref = await mercadopago.preferences.create({
      items: [{
        title: `Reserva ${bookingId||""}`,
        unit_price: Number(amount),
        quantity: 1
      }],
      back_urls: {
        success: "https://lapacasahostel.com/success",
        failure: "https://lapacasahostel.com/cancel",
        pending: "https://lapacasahostel.com/pending"
      },
      auto_return: "approved",
      metadata: { booking_id: bookingId||"" }
    });
    res.json({ ok:true, id: pref.body.id, init_point: pref.body.init_point });
  } catch(e) {
    res.status(500).json({ ok:false, error:String(e.message||e) });
  }
});

// Mercado Pago webhook
router.post("/mp/webhook", express.json(), (req,res)=>{
  try {
    const data = req.body || {};
    console.log("📩 Webhook MercadoPago:", JSON.stringify(data).slice(0,200));
    // 👉 aquí también llamaríamos a /bookings/payment_update
    res.json({ ok:true });
  } catch(e) {
    res.status(500).json({ ok:false, error:String(e.message||e) });
  }
});

module.exports = router;
