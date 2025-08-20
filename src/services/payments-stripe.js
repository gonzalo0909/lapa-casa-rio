"use strict";
// Sandbox simple: “finge” crear una sesión y procesa webhooks de forma no destructiva.

function buildStripeWebhookHandler({ notifySheets, isDuplicate, log }) {
  return (req, res) => {
    try {
      const sig = req.headers["stripe-signature"];
      // En real: verificar firma con STRIPE_WEBHOOK_SECRET y stripe.webhooks.constructEvent(...)
      log("Stripe webhook recibido", { len: req.body?.length || 0, sig: !!sig });
      // Notificar planilla si hace falta (event minimal)
      notifySheets && notifySheets({ src: "stripe", ts: Date.now(), raw: true });
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ ok: false, error: String(e.message || e) });
    }
  };
}

async function createCheckoutSession(order, { baseUrl }) {
  // En real: usar SDK Stripe y devolver session.id
  return { id: "sess_demo_" + Date.now(), baseUrl };
}

module.exports = { buildStripeWebhookHandler, createCheckoutSession };
