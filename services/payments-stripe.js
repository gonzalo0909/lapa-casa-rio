"use strict";

// Crea una sesión de checkout "mock" para demo
module.exports.createCheckoutSession = async (order, { baseUrl } = {}) => {
  // En producción, integrar con Stripe SDK y devolver session.id real.
  // Para demo, devolvemos un ID simulado y que el frontend redirija.
  return { id: "cs_test_demo_" + (order.bookingId || Date.now()) };
};

// Manejador de webhook de Stripe (demo: valida duplicados y responde 200)
module.exports.buildStripeWebhookHandler = ({ notifySheets, isDuplicate, log } = {}) => {
  return async (req, res) => {
    try {
      const sigOk = true; // En demo no validamos firma
      if (!sigOk) return res.status(400).json({ ok: false, error: "bad_signature" });

      // Dedupe por idempotencia básica si querés (demo)
      const id = String(req.headers["stripe-signature"] || "demo") + ":" + String(req.body?.id || Date.now());
      if (isDuplicate && isDuplicate(id)) return res.json({ ok: true, deduped: true });

      // Notificar a Sheets si aplica (no-op)
      if (notifySheets) await notifySheets({ provider: "stripe", raw: req.body });

      res.json({ ok: true });
    } catch (e) {
      log && log("webhook error", e);
      res.status(400).json({ ok: false, error: String(e.message || e) });
    }
  };
};
