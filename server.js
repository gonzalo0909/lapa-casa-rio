/**
 * routes/payments.js
 * Gestiona pagos con Stripe y Mercado Pago
 */

"use strict";

const express = require("express");
const router = express.Router();

const Stripe = require("stripe");
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// Cliente de Mercado Pago (corregido)
let mercadopago = null;
if (process.env.MP_ACCESS_TOKEN) {
  const mp = require("mercadopago");
  mp.configure({ accessToken: process.env.MP_ACCESS_TOKEN });
  mercadopago = mp;
}

/* ===== POST /api/payments/stripe/session ===== */
router.post("/stripe/session", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ ok: false, error: "stripe_not_configured" });
    }

    const { order } = req.body || {};
    if (!order || !order.total) {
      return res.status(400).json({ ok: false, error: "missing_order_or_total" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "brl",
            unit_amount: Math.round(order.total * 100),
            product_data: {
              name: `Reserva (${order.nights} noches)`,
            },
          },
          quantity: 1,
        },
      ],
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

/* ===== POST /api/payments/mp/checkout ===== */
router.post("/mp/checkout", async (req, res) => {
  try {
    if (!mercadopago) {
      return res.status(500).json({ ok: false, error: "mercadopago_not_configured" });
    }

    const { order } = req.body || {};
    if (!order || !order.total) {
      return res.status(400).json({ ok: false, error: "missing_order_or_total" });
    }

    const preference = {
      items: [
        {
          title: `Reserva (${order.nights} noches)`,
          quantity: 1,
          currency_id: "BRL",
          unit_price: order.total,
        }
      ],
      back_urls: {
        success: `${process.env.FRONTEND_URL || "https://lapacasahostel.com/book"}?pay=success`,
        failure: `${process.env.FRONTEND_URL || "https://lapacasahostel.com/book"}?pay=fail`,
        pending: `${process.env.FRONTEND_URL || "https://lapacasahostel.com/book"}?pay=pending`
      },
      auto_return: "approved",
      external_reference: order.bookingId,
      notification_url: `${process.env.WEBHOOK_BASE_URL || "https://api.lapacasahostel.com"}/api/payments/mp/webhook`
    };

    const pref = await mercadopago.preferences.create(preference);
    return res.json({ ok: true, init_point: pref.body.init_point });
  } catch (err) {
    console.error("Error al crear checkout de Mercado Pago:", err.message);
    return res.status(500).json({ ok: false, error: "mp_checkout_error" });
  }
});

/* ===== Webhook de Mercado Pago ===== */
async function mpWebhook(req, res) {
  try {
    const { id, topic } = req.query || {};
    if (topic === "payment" && id) {
      const payment = await mercadopago.payment.findById(id);
      const bookingId = payment.body.external_reference;
      if (bookingId) {
        console.log("✅ Pago de Mercado Pago confirmado:", bookingId);
      }
    }
    res.status(200).send("OK");
  } catch (err) {
    console.error("Error en webhook de Mercado Pago:", err.message);
    res.status(400).send("Error");
  }
}

/* ===== Webhook de Stripe ===== */
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

module.exports = { router, stripeWebhook, mpWebhook };
