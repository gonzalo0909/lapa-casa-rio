"use strict";
const express = require("express");
const router = express.Router();
const Stripe = require("stripe");

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

/* ====== Stripe Checkout Session ====== */
router.post("/stripe/session", async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ ok: false, error: "stripe_not_configured" });

    const { order } = req.body || {};
    // TODO: construir line items desde order.total / descripción real
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "brl",
            unit_amount: Math.max(100, (order?.total || 100) * 100),
            product_data: { name: "Reserva Lapa Casa Hostel" },
          },
          quantity: 1,
        },
      ],
      success_url: (process.env.BOOKINGS_WEBAPP_URL || "https://lapacasahostel.com") + "/#/book?pay=success",
      cancel_url: (process.env.BOOKINGS_WEBAPP_URL || "https://lapacasahostel.com") + "/#/book?pay=cancel",
      metadata: { bookingId: order?.bookingId || "" },
    });

    return res.json({ ok: true, id: session.id });
  } catch (e) {
    console.error("Stripe session error:", e);
    return res.status(500).json({ ok: false, error: "stripe_session_error" });
  }
});

/* ====== Stripe Webhook (RAW en server.js) ====== */
async function stripeWebhook(req, res) {
  try {
    if (!stripe) return res.status(500).json({ ok: false, error: "stripe_not_configured" });
    const sig = req.headers["stripe-signature"];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!sig || !secret) return res.status(400).json({ ok: false, error: "missing_webhook_secret" });

    const event = stripe.webhooks.constructEvent(req.body, sig, secret);

    // Ejemplo: marcar como pagado
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const bookingId = session.metadata?.bookingId;
      console.log("Stripe paid booking:", bookingId);
      // TODO: actualizar tu DB: bookingId -> paid
    }

    return res.json({ ok: true, received: true });
  } catch (e) {
    console.error("Stripe webhook error:", e.message);
    return res.status(400).json({ ok: false, error: "invalid_signature" });
  }
}

module.exports = { router, stripeWebhook };
