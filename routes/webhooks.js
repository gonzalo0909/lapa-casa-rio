"use strict";

const express = require("express");
const router = express.Router();

const { buildStripeWebhookHandler } = require("../services/payments-stripe");
const { buildMpWebhookHandler } = require("../services/payments-mp");
const { notifySheets } = require("../services/sheets");

// ===== Deduper simple (evita procesar el mismo evento 2 veces)
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
const isDuplicate = deduper();
const log = (...a) => console.log("[webhook]", ...a);

// ===== Stripe (raw body requerido)
const stripeHandler = buildStripeWebhookHandler({ notifySheets, isDuplicate, log });
router.post("/stripe", express.raw({ type: "application/json" }), stripeHandler);

// ===== Mercado Pago
const mpHandler = buildMpWebhookHandler({ notifySheets, isDuplicate, log });
router.post("/mp", mpHandler);
router.get("/mp", (_req, res) => res.json({ ok: true, ping: true }));

module.exports = router;
