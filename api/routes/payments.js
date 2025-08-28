/**
 * routes/payments.js
 * Gestiona pagos con Stripe y Mercado Pago (SDK v2)
 */
"use strict";

const express = require("express");
const router = express.Router();

// ===== Stripe =====
const Stripe = require("stripe");
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// ===== Mercado Pago SDK v2 =====
// npm i mercadopago
let mpClient = null, mpPreference = null, mpPayment = null;
if (process.env.MP_ACCESS_TOKEN) {
  try {
    const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
    mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
    mpPreference = new Preference(mpClient);
    mpPayment = new Payment(mpClient);
  } catch (err) {
    console.error("Error al cargar mercadopago:", err.message);
  }
}

// ===== Helpers =====
function validateOrder(order) {
  return (
    order &&
    Number.isFinite(order.total) &&
    order.total > 0 &&
    Number.isInteger(order.nights) &&
    order.nights > 0
  );
}

function requireEnvOr500(res, keys = []) {
  for (const k of keys) {
    if (!process.env[k]) {
      res.status(500).json({ ok: false, error: `missing_env_${k}` });
      return true;
    }
  }
  return false;
}

/* ================= Stripe ================= */

/** POST /api/payments/stripe/session */
router.post("/stripe/session", async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ ok: false, error: "stripe_not_configured" });
    if (requireEnvOr500(res, ["FRONTEND_URL"])) return;

    const { order } = req.body || {};
    if (!validateOrder(order)) return res.status(400).json({ ok: false, error: "invalid_order_data" });

    const bookingId = String(order.bookingId || "");

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
      metadata: { bookingId },
    });

    return res.json({ ok: true, id: session.id });
  } catch (err) {
    console.error("Error al crear sesión de Stripe:", err);
    return res.status(500).json({ ok: false, error: "stripe_session_error" });
  }
});

/** POST /api/payments/stripe/webhook */
async function stripeWebhook(req, res) {
  try {
    if (!stripe) return res.status(500).json({ ok: false, error: "stripe_not_configured" });

    const sig = req.headers["stripe-signature"];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!sig || !secret) return res.status(400).json({ ok: false, error: "missing_webhook_signature" });

    let event;
    try {
      // IMPORTANTE: req.rawBody debe existir (configurar en server.js)
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
        // TODO: confirmar reserva en base de datos aquí si aplica
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Error en webhook de Stripe:", err);
    res.status(400).json({ ok: false, error: "webhook_error" });
  }
}

/* ================= Mercado Pago (SDK v2) ================= */

/** POST /api/payments/mp/checkout */
router.post("/mp/checkout", async (req, res) => {
  try {
    if (!mpPreference) return res.status(500).json({ ok: false, error: "mercadopago_not_configured" });
    if (requireEnvOr500(res, ["FRONTEND_URL", "WEBHOOK_BASE_URL"])) return;

    const { order } = req.body || {};
    if (!validateOrder(order)) return res.status(400).json({ ok: false, error: "invalid_order_data" });

    const body = {
      items: [
        {
          title: `Reserva (${order.nights} noches)`,
          quantity: 1,
          currency_id: "BRL",
          unit_price: Number(order.total.toFixed(2)),
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

    const pref = await mpPreference.create({ body });
    return res.json({ ok: true, init_point: pref?.init_point || pref?.sandbox_init_point || null });
  } catch (err) {
    console.error("Error al crear checkout de Mercado Pago:", err);
    return res.status(500).json({ ok: false, error: "mp_checkout_error" });
  }
});

/** Webhook de Mercado Pago (GET/POST) */
async function mpWebhook(req, res) {
  try {
    if (!mpPayment) return res.status(500).send("mercadopago_not_configured");

    // MP puede enviar GET ?id=&topic= o POST con body
    const q = req.query || {};
    const b = (req.body && typeof req.body === "object") ? req.body : {};

    // Normalizamos
    const topic = q.topic || b.type || b.topic; // "payment" esperado
    const id = q.id || b.data?.id || b.id;

    if (!id || !topic) return res.status(400).send("Bad Request");

    if (String(topic).toLowerCase().includes("payment")) {
      const payment = await mpPayment.get({ id });
      const data = payment || {};
      const status = data.status || data.body?.status;

      if (status === "approved") {
        const bookingId = data.external_reference || data.body?.external_reference;
        if (bookingId) {
          console.log("✅ Pago confirmado en Mercado Pago:", bookingId);
          // TODO: confirmar reserva en base de datos aquí si aplica
        }
      } else {
        console.log(`Estado de pago MP: ${status}`);
      }
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("Error en webhook de Mercado Pago:", err);
    res.status(400).send("Error");
  }
}

module.exports = { router, stripeWebhook, mpWebhook };
