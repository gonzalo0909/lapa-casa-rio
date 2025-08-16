"use strict";
/**
 * /services/payments-mp.js
 * Mercado Pago Checkout + Webhooks
 */

const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();

const MP_TOKEN = process.env.MP_ACCESS_TOKEN || "";
const FRONTEND_URL = process.env.FRONTEND_URL || "";

/* ================== CREAR PREFERENCE ================== */
router.post("/create_preference", async (req, res) => {
  try {
    if (!MP_TOKEN) return res.status(500).json({ ok: false, error: "mp_not_configured" });

    const { booking_id, total, currency = "BRL" } = req.body || {};
    if (!booking_id || !total) return res.status(400).json({ ok: false, error: "missing_params" });

    const preference = {
      items: [{
        title: `Reserva ${booking_id}`,
        unit_price: Number(total),
        quantity: 1,
        currency_id: currency
      }],
      back_urls: {
        success: `${FRONTEND_URL}?status=success&booking=${booking_id}`,
        failure: `${FRONTEND_URL}?status=failure&booking=${booking_id}`,
        pending: `${FRONTEND_URL}?status=pending&booking=${booking_id}`
      },
      auto_return: "approved",
      metadata: { booking_id }
    };

    const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MP_TOKEN}`
      },
      body: JSON.stringify(preference)
    });

    const out = await r.json();
    res.json({ ok: true, init_point: out.init_point, id: out.id });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/* ================== WEBHOOK ================== */
router.post("/webhook", async (req, res) => {
  try {
    const body = req.body || {};
    console.log("🔔 Webhook Mercado Pago:", body);

    // Aquí se debería validar y luego llamar a bookings/payment_update
    // Ejemplo: if (body.type === "payment" && body.data && body.data.id)

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

module.exports = router;
