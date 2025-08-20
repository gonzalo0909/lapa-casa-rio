"use strict";

/**
 * Stripe: crea sesiones de Checkout y maneja webhooks.
 */

const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SK, {
  apiVersion: "2024-06-20",
});

const FRONTEND_URL = process.env.FRONTEND_URL || "/book/";
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

function cents(brl) {
  // Evita floats malditos
  return Math.round(Number(brl || 0) * 100);
}

async function createCheckoutSession(order, { baseUrl } = {}) {
  const success = `${FRONTEND_URL}?paid=1`;
  const cancel  = `${FRONTEND_URL}?canceled=1`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    currency: "brl",
    success_url: success,
    cancel_url: cancel,
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "brl",
          product_data: { name: "Reserva Lapa Casa Hostel" },
          unit_amount: cents(order.total),
        },
        quantity: 1,
      },
    ],
    metadata: {
      bookingId: order.bookingId || "",
      email: order.email || "",
      total_brl: String(order.total || 0),
      nights: String(order.nights || ""),
    },
  });

  return { id: session.id };
}

function buildStripeWebhookHandler({ notifySheets, isDuplicate, log = () => {} }) {
  if (!WEBHOOK_SECRET) {
    log("⚠️ STRIPE_WEBHOOK_SECRET not set; webhook will accept events without verify");
  }
  return async function stripeWebhook(req, res) {
    let event = req.body;

    // Verificación de firma
    if (WEBHOOK_SECRET) {
      try {
        const sig = req.headers["stripe-signature"];
        event = Stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
      } catch (err) {
        log("signature error:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }
    }

    // Deduplicar por event.id
    if (isDuplicate && event && event.id && isDuplicate(event.id)) {
      log("duplicate event", event.id);
      return res.json({ ok: true, duplicate: true });
    }

    try {
      if (event.type === "checkout.session.completed") {
        const s = event.data.object;
        const bookingId = s.metadata?.bookingId || s.client_reference_id || s.id;
        const email = s.customer_details?.email || s.metadata?.email || "";
        await notifySheets({
          kind: "paid",
          provider: "stripe",
          bookingId,
          holdId: bookingId,
          email,
          total: (s.amount_total || 0) / 100,
          chargeId: s.payment_intent || s.id,
        });
        log("✓ marked paid", bookingId);
      }
      // Opcional: payment_intent.succeeded
      if (event.type === "payment_intent.succeeded") {
        const pi = event.data.object;
        const bookingId = pi.metadata?.bookingId;
        if (bookingId) {
          await notifySheets({
            kind: "paid",
            provider: "stripe",
            bookingId,
            holdId: bookingId,
            email: pi.metadata?.email || "",
            total: (pi.amount || 0) / 100,
            chargeId: pi.id,
          });
          log("✓ marked paid (PI)", bookingId);
        }
      }
      return res.json({ ok: true, received: true });
    } catch (e) {
      log("webhook error:", e);
      return res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  };
}

module.exports = {
  createCheckoutSession,
  buildStripeWebhookHandler,
};
