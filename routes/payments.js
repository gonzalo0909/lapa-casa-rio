// /routes/payments.js
"use strict";

const express = require("express");
const Stripe = require("stripe");
const {
  MercadoPagoConfig,
  Preference,
  Payment,
} = require("mercadopago");

const router = express.Router();

// ====== ENV ======
const STRIPE_SK = process.env.STRIPE_SK || process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";

const stripe = STRIPE_SK ? new Stripe(STRIPE_SK) : null;
const mpClient = MP_ACCESS_TOKEN ? new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN }) : null;

// ====== STRIPE ======

// Crear checkout
router.post("/stripe/create", async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ ok: false, error: "stripe_not_configu
