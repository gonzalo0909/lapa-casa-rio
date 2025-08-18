"use strict";
/**
 * /routes/webhooks.js
 * Webhooks Stripe + Mercado Pago
 */
const express = require("express");
const Stripe = require("stripe");
const crypto = require("crypto");

const router = express.Router();

// === ENV ===
const STRIPE_SK = process.env.STRIPE_SK || process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";

// === Stripe init ===
const stripe = STRIPE_SK ? new Stripe(STRIPE_SK, { apiVersion: "2024-06-20" }) : null;

// === Notify helper (ej: enviar a Sheets/DB) ===
async function notifyPaymentUpdate(update) {
  console.log("💳 Payment update:", update);
  // Aquí podés enviar update a Google Sheets o DB
}

/* ================== STRIPE WEBHOOK ================== */
router.post("/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return res.status(500).json({ ok: false, error: "stripe_not_configured" });
  }
  let event;
  try {
    const sig = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(req.body, sig,
