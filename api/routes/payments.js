/**
 * routes/payments.js
 * Gestiona pagos con Stripe
 * Incluye creación de sesión y webhook
 */

"use strict";

const express = require("express");
const router = express.Router();

const Stripe = require("stripe");
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

/* ====== Crear sesión de pago con Stripe ====== */
router.post("/stripe/session", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ ok: false, error: "stripe_not_configured" });
    }

    const { order } = req.body || {};
    if (!order || !order.total) {
      return res.status(400).json({ ok: false, error: "missing_order_or_total" });
    }

    const lineItems = [{
      price_data: {
        currency: "brl",
        unit_amount: Math.round(order.total * 100),
        product_data: {
          name: `Reserva (${order.nights} noches)`,
        },
      },
      quantity: 1,
    }];

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      success_url: `${process.env.FRONTEND_URL || "https://lapacasahostel.com/book"}?pay=success`,
      cancel_url: `${process.env.FRONTEND_URL || "https://lapacasahostel.com/book"}?pay=cancel`,
      metadata: {
        bookingId: order.bookingId || "",
      },
    });

    return res.json({ ok: true, id: session.id });
  } catch (err) {
    console.error("Error al crear sesión de Stripe:", err.message);
    return res.status(500).json({ ok: false, error: "stripe_session_error" });
  }
});

/* ====== Webhook de Stripe ====== */
async function stripeWebhook(req, res) {
  try {
    if (!stripe) {
      return res.status(500).json({ ok: false, error: "stripe_not_configured" });
    }

    const sig = req.headers["stripe-signature"];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !secret) {
      return res.status(400).json({ ok: false, error: "missing_webhook_signature" });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err) {
      console.error("Webhook signature error:", err.message);
      return res.status(400).json({ ok: false, error: "invalid_signature" });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const bookingId = session.metadata?.bookingId;
      if (bookingId) {
        console.log("✅ Pago exitoso para booking:", bookingId);
      }
    }

    res.json({ ok: true, received: true });
  } catch (err) {
    console.error("Error en webhook de Stripe:", err.message);
    res.status(400).json({ ok: false, error: "webhook_error" });
  }
}

module.exports = { router, stripeWebhook };
