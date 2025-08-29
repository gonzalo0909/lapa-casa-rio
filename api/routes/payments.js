/**
 * routes/payments.js
 * Gestiona pagos con Stripe y Mercado Pago (v2)
 * Webhooks, sesiones y manejo de errores
 */

"use strict";

const express = require("express");
const router = express.Router();

// Stripe
const Stripe = require("stripe");
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// Mercado Pago v2
let mpClient = null;
let Preference = null;

if (process.env.MP_ACCESS_TOKEN) {
  try {
    const mercadopago = require("mercadopago");
    Preference = mercadopago.Preference;
    mpClient = new mercadopago.MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
  } catch (err) {
    console.error("Error al inicializar Mercado Pago:", err.message);
  }
}

// Helper: valida datos del pedido
function validateOrder(order) {
  return order && 
         typeof order.total === "number" && 
         order.total > 0 && 
         order.nights && 
         order.nights > 0;
}

/* ===== Stripe: crear sesión ===== */
router.post("/stripe/session", async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ ok: false, error: "stripe_not_configured" });

    const { order } = req.body || {};
    if (!validateOrder(order)) {
      return res.status(400).json({ ok: false, error: "invalid_order_data" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "brl",
            unit_amount: Math.round(order.total * 100),
            product_data: { name: `Reserva (${order.nights} noches)` },
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/book?pay=success`,
      cancel_url: `${process.env.FRONTEND_URL}/book?pay=cancel`,
      metadata: { bookingId: String(order.bookingId || "") },
    });

    return res.json({ ok: true, id: session.id });
  } catch (err) {
    console.error("Error creando sesión Stripe:", err.message);
    return res.status(500).json({ ok: false, error: "stripe_session_error" });
  }
});

/* ===== MP: crear checkout ===== */
router.post("/mp/checkout", async (req, res) => {
  try {
    if (!mpClient || !Preference) {
      return res.status(500).json({ ok: false, error: "mercadopago_not_configured" });
    }

    const { order } = req.body || {};
    if (!validateOrder(order)) {
      return res.status(400).json({ ok: false, error: "invalid_order_data" });
    }

    const preference = new Preference(mpClient);
    const response = await preference.create({
      body: {
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
        external_reference: String(order.bookingId || ""),
        notification_url: `${process.env.WEBHOOK_BASE_URL}/api/payments/mp/webhook`,
      },
    });

    return res.json({ 
      ok: true, 
      init_point: response.init_point 
    });
  } catch (err) {
    console.error("Error creando checkout MP:", err.message);
    return res.status(500).json({ ok: false, error: "mp_checkout_error" });
  }
});

/* ===== Webhook MP (GET/POST) ===== */
async function mpWebhook(req, res) {
  const id = req.query?.id || req.body?.data?.id;
  const topic = req.query?.topic || req.body?.type;

  if (!id || !topic) {
    return res.status(400).send("Bad Request");
  }

  if (!mpClient) {
    console.warn("MP webhook recibido pero MP no configurado");
    return res.status(200).send("OK");
  }

  try {
    if (topic === "payment") {
      const payment = await new (require("mercadopago").Payment)(mpClient).get({ id });
      const data = payment.body;

      if (data.status === "approved" && data.external_reference) {
        console.log("✅ Pago confirmado en MP:", data.external_reference);
        // Aquí podrías actualizar el estado en Google Sheets
      } else {
        console.log(`⚠️ Pago MP no aprobado: ${data.status}`);
      }
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("Error webhook MP:", err.message);
    res.status(400).send("Error");
  }
}

/* ===== Webhook Stripe (RAW) ===== */
async function stripeWebhook(req, res) {
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
    console.error("Stripe firma inválida:", err.message);
    return res.status(400).json({ ok: false, error: "invalid_signature" });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    if (session.metadata?.bookingId) {
      console.log("✅ Pago completado en Stripe:", session.metadata.bookingId);
      // Aquí podrías actualizar el estado en Google Sheets
    }
  }

  res.json({ received: true });
}

module.exports = { router, stripeWebhook, mpWebhook };
