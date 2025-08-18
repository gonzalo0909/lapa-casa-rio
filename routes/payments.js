// /routes/payments.js
"use strict";

const express = require("express");
const Stripe = require("stripe");
const {
  MercadoPagoConfig,
  Preference,
  Payment,
} = require("mercadopago");

const router = express.Router();

// ====== ENV ======
const STRIPE_SK = process.env.STRIPE_SK || process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";

const stripe = STRIPE_SK ? new Stripe(STRIPE_SK) : null;
const mpClient = MP_ACCESS_TOKEN ? new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN }) : null;

// ====== STRIPE ======

// Crear checkout
router.post("/stripe/create", async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ ok: false, error: "stripe_not_configured" });
    const { amount, currency = "brl", booking_id = "" } = req.body;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [{
        price_data: {
          currency,
          product_data: { name: `Reserva ${booking_id}` },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      metadata: { booking_id },
      success_url: `${process.env.BASE_URL}/book?status=success`,
      cancel_url: `${process.env.BASE_URL}/book?status=cancel`,
    });
    res.json({ ok: true, url: session.url });
  } catch (err) {
    console.error("Stripe create error:", err);
    res.status(500).json({ ok: false, error: "stripe_error" });
  }
});

// Webhook Stripe
router.post("/stripe/webhook", express.raw({ type: "application/json" }), (req, res) => {
  let event;
  try {
    const sig = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Stripe webhook error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case "checkout.session.completed":
      console.log("✅ Pago Stripe confirmado", event.data.object.id);
      break;
    case "checkout.session.expired":
      console.log("⚠️ Sesión expirada", event.data.object.id);
      break;
    default:
      console.log("ℹ️ Evento Stripe:", event.type);
  }
  res.json({ received: true });
});

// ====== MERCADO PAGO ======

// Crear preferencia
router.post("/mp/create", async (req, res) => {
  try {
    if (!mpClient) return res.status(500).json({ ok: false, error: "mp_not_configured" });
    const { amount, booking_id = "" } = req.body;
    const pref = new Preference(mpClient);
    const preference = await pref.create({
      body: {
        items: [{
          title: `Reserva ${booking_id}`,
          quantity: 1,
          unit_price: Math.round(amount),
          currency_id: "BRL",
        }],
        back_urls: {
          success: `${process.env.BASE_URL}/book?status=success`,
          failure: `${process.env.BASE_URL}/book?status=fail`,
          pending: `${process.env.BASE_URL}/book?status=pending`,
        },
        metadata: { booking_id },
        auto_return: "approved",
      },
    });
    res.json({ ok: true, url: preference.body.init_point });
  } catch (err) {
    console.error("MP create error:", err);
    res.status(500).json({ ok: false, error: "mp_error" });
  }
});

// Webhook MP
router.post("/mp/webhook", express.json(), async (req, res) => {
  try {
    const { type, data } = req.body;
    if (type === "payment" && data && data.id) {
      const payment = await new Payment(mpClient).get({ id: data.id });
      console.log("💰 Pago MP:", payment.body.status, "ID:", payment.body.id);
    }
    res.json({ received: true });
  } catch (err) {
    console.error("MP webhook error:", err);
    res.status(500).json({ ok: false });
  }
});

module.exports = router;
