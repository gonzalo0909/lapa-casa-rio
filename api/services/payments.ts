"use strict";

/**
 * api/routes/payments.js
 * Handlers para Stripe, Mercado Pago y Pix con reconciliación a Google Sheets
 */

const express = require("express");
const router = express.Router();
const { updatePayment } = require("../services/sheets");

router.post("/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  let event;
  try {
    event = JSON.parse(req.body);
  } catch (err) {
    console.error("❌ Stripe webhook parse error:", err.message);
    return res.status(400).send("Invalid payload");
  }

  const type = event.type;
  const bookingId = event.data?.object?.metadata?.bookingId;

  if (!bookingId) {
    console.warn("⚠️ Missing bookingId in Stripe metadata");
    return res.sendStatus(200);
  }

  if (type === "checkout.session.completed") {
    await updatePayment(bookingId, "paid");
    console.log(`✅ Stripe payment confirmed for ${bookingId}`);
  }

  res.sendStatus(200);
});

router.post("/mp/webhook", express.json({ limit: "2mb" }), async (req, res) => {
  const body = req.body;
  const type = body.type;
  const data = body.data || {};
  const bookingId = data.bookingId || data.metadata?.bookingId;

  if (!bookingId) {
    console.warn("⚠️ Missing bookingId in MercadoPago webhook");
    return res.sendStatus(200);
  }

  if (type === "payment" || body.action === "payment.created") {
    await updatePayment(bookingId, "approved");
    console.log(`✅ MercadoPago payment approved for ${bookingId}`);
  }

  res.sendStatus(200);
});

module.exports = {
  router,
  stripeWebhook: router.stack.find(r => r.route?.path === "/stripe/webhook").route.stack[0].handle,
  mpWebhook: router.stack.find(r => r.route?.path === "/mp/webhook").route.stack[0].handle
};
