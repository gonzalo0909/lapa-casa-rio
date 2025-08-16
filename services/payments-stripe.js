"use strict";
/**
 * /services/payments-stripe.js
 * Stripe Checkout + Webhooks
 */

const express = require("express");
const Stripe = require("stripe");
const router = express.Router();

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SK || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const FRONTEND_URL = process.env.FRONTEND_URL || "";

const stripe = STRIPE_KEY ? new Stripe(STRIPE_KEY) : null;

/* ================== CREAR SESIÓN DE PAGO ================== */
router.post("/create_session", async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ ok: false, error: "stripe_not_configured" });

    const { booking_id, total, currency = "brl" } = req.body || {};
    if (!booking_id || !total) return res.status(400).json({ ok: false, error: "missing_params" });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency,
          product_data: { name: `Reserva ${booking_id}` },
          unit_amount: Math.round(total * 100) // centavos
        },
        quantity: 1
      }],
      mode: "payment",
      success_url: `${FRONTEND_URL}?status=success&booking=${booking_id}`,
      cancel_url: `${FRONTEND_URL}?status=cancel&booking=${booking_id}`,
      metadata: { booking_id }
    });

    res.json({ ok: true, url: session.url });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/* ================== WEBHOOK ================== */
router.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  let event;
  try {
    const sig = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ ok: false, error: "invalid_signature" });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    console.log("✅ Pago completado:", session.metadata.booking_id);
    // Aquí podrías llamar a bookings/payment_update
  }

  res.json({ ok: true, received: true });
});

module.exports = router;
