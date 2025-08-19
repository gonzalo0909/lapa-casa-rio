"use strict";

const express = require("express");
const router = express.Router();

const { buildStripeWebhookHandler } = require("../services/payments-stripe");
const { buildMpWebhookHandler } = require("../services/payments-mp");
const { notifySheets } = require("../services/sheets");

// deduper simple en memoria
function deduper(max = 1000, ttlMs = 10 * 60 * 1000) {
  const m = new Map();
  return (key) => {
    const now = Date.now();
    for (const [k, ts] of m) if (now - ts > ttlMs) m.delete(k);
    if (m.has(key)) return true;
    m.set(key, now);
    if (m.size > max) m.delete(m.keys().next().value);
    return false;
  };
}
const isDup = deduper();

// Stripe requiere raw body SOLO aquí
router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  buildStripeWebhookHandler({
    notifySheets: (p) => notifySheets(p),
    isDuplicate: isDup,
    log: (...a) => console.log("[stripe]", ...a),
  })
);

// Mercado Pago acepta JSON normal
router.post(
  "/mp",
  express.json(),
  buildMpWebhookHandler({
    notifySheets: (p) => notifySheets(p),
    isDuplicate: isDup,
    log: (...a) => console.log("[mp]", ...a),
  })
);

// ping opcional
router.get("/mp", (_req, res) => res.json({ ok: true, ping: true }));

module.exports = router;
