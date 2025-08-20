"use strict";

function buildStripeWebhookHandler({ notifySheets, isDuplicate, log }) {
  return (req, res) => {
    log("Stripe webhook recibido");
    res.json({ ok: true });
  };
}

async function createCheckoutSession(order, { baseUrl }) {
  return { sessionId: "fake_stripe_session", baseUrl };
}

module.exports = { buildStripeWebhookHandler, createCheckoutSession };
