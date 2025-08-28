/**
 * routes/payments.js
 * Gestiona pagos con Stripe y Mercado Pago
 */

"use strict";

const express = require("express");
const router = express.Router();

// === Configuración de Stripe ===
const Stripe = require("stripe");
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// === Configuración de Mercado Pago ===
let mercadopago = null;
if (process.env.MP_ACCESS_TOKEN) {
  try {
    mercadopago = require("mercadopago");
    mercadopago.configure({
      access_token: process.env.MP_ACCESS_TOKEN,
    });
  } catch (error) {
    console.error("Error al cargar mercadopago:", error.message);
  }
}

// === Helper: Validación básica de orden ===
function validateOrder(order) {
  return order && typeof order.total === "number" && order.total > 0 && order.nights && order.nights > 0;
}

/* ===== POST /api/payments/stripe/session ===== */
// Crear sesión de pago con Stripe
router.post("/stripe/session", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ ok: false, error: "stripe_not_configured" });
    }

    const { order } = req.body;
    if (!validateOrder(order)) {
      return res.status(400).json({ ok: false, error: "invalid_order_data" });
    }

    const bookingId = order.bookingId || "";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_ {
            currency: "brl",
            unit_amount: Math.round(order.total * 100), // en centavos
            product_ {
              name: `Reserva (${order.nights} noches)`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/book?pay=success`,
      cancel_url: `${process.env.FRONTEND_URL}/book?pay=cancel`,
      meta {
        bookingId: bookingId,
      },
    });

    return res.json({ ok: true, id: session.id });
  } catch (err) {
    console.error("Error al crear sesión de Stripe:", err.message);
    return res.status(500).json({ ok: false, error: "stripe_session_error" });
  }
});

/* ===== POST /api/payments/mp/checkout ===== */
// Crear preferencia de pago con Mercado Pago
router.post("/mp/checkout", async (req, res) => {
  try {
    if (!mercadopago) {
      return res.status(500).json({ ok: false, error: "mercadopago_not_configured" });
    }

    const { order } = req.body;
    if (!validateOrder(order)) {
      return res.status(400).json({ ok: false, error: "invalid_order_data" });
    }

    const preference = {
      items: [
        {
          title: `Reserva (${order.nights} noches)`,
          quantity: 1,
          currency_id: "BRL",
          unit_price: parseFloat(order.total.toFixed(2)),
        },
      ],
      back_urls: {
        success: `${process.env.FRONTEND_URL}/book?pay=success`,
        failure: `${process.env.FRONTEND_URL}/book?pay=fail`,
        pending: `${process.env.FRONTEND_URL}/book?pay=pending`,
      },
      auto_return: "approved",
      external_reference: order.bookingId || null,
      notification_url: `${process.env.WEBHOOK_BASE_URL}/api/payments/mp/webhook`,
    };

    const pref = await mercadopago.preferences.create(preference);
    return res.json({ ok: true, init_point: pref.body.init_point });
  } catch (err) {
    console.error("Error al crear checkout de Mercado Pago:", err.message);
    return res.status(500).json({ ok: false, error: "mp_checkout_error" });
  }
});

/* ===== Webhook de Mercado Pago: GET /api/payments/mp/webhook ===== */
async function mpWebhook(req, res) {
  try {
    const { id, topic } = req.query || {};

    if (!id || !topic) {
      return res.status(400).send("Bad Request");
    }

    if (topic === "payment") {
      const payment = await mercadopago.payment.findById(id);
      const data = payment.body;

      if (data.status === "approved") {
        const bookingId = data.external_reference;
        if (bookingId) {
          console.log("✅ Pago confirmado en Mercado Pago:", bookingId);
        }
      } else {
        console.log(`Estado de pago pendiente o fallido: ${data.status}`);
      }
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("Error en webhook de Mercado Pago:", err.message);
    res.status(400).send("Error");
  }
}

/* ===== Webhook de Stripe: POST /api/payments/stripe/webhook ===== */
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
      event = stripe.webhooks.constructEvent(req.rawBody, sig, secret);
    } catch (err) {
      console.error("Webhook signature error:", err.message);
      return res.status(400).json({ ok: false, error: "invalid_signature" });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const bookingId = session.metadata?.bookingId;

      if (bookingId) {
        console.log("✅ Pago completado en Stripe:", bookingId);
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Error en webhook de Stripe:", err.message);
    res.status(400).json({ ok: false, error: "webhook_error" });
  }
}

module.exports = { router, stripeWebhook, mpWebhook };
