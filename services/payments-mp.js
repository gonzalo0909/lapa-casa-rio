"use strict";

/**
 * /services/payments-mp.js
 * Mercado Pago: crear preference + webhook (con firma opcional)
 */

const express = require("express");
const crypto = require("crypto");
const fetch = require("node-fetch");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const router = express.Router();

/* ========= ENV ========= */
const BASE_URL = (process.env.BASE_URL || "").replace(/\/$/, "") || "https://lapacasahostel.com";
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET || process.env.MERCADO_PAGO_CHECKOUT_API_WEBHOOK_SECRET || "";
const BOOKINGS_WEBAPP_URL = process.env.BOOKINGS_WEBAPP_URL || "";

/* ========= MP Client ========= */
const mpClient = MP_ACCESS_TOKEN ? new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN }) : null;

/* ========= Helpers ========= */
async function postToSheets(payload = {}) {
  if (!BOOKINGS_WEBAPP_URL) return { ok: false, error: "no_webhook_url" };
  try {
    const r = await fetch(BOOKINGS_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const t = await r.text();
    try { return JSON.parse(t); } catch { return { ok:false, raw:t }; }
  } catch (e) { return { ok:false, error:String(e?.message||e) }; }
}

function verifyMpSignature(req, paymentId) {
  try {
    const sig = req.headers["x-signature"];
    const reqId = req.headers["x-request-id"];
    if (!MP_WEBHOOK_SECRET || !sig || !reqId || !paymentId) return false;
    const parts = String(sig).split(",");
    let ts, v1;
    for (const p of parts) {
      const [k, v] = p.split("=");
      if (!k || !v) continue;
      if (k.trim() === "ts") ts = v.trim();
      if (k.trim() === "v1") v1 = v.trim();
    }
    if (!ts || !v1) return false;
    const manifest = `id:${paymentId};request-id:${reqId};ts:${ts};`;
    const calc = crypto.createHmac("sha256", MP_WEBHOOK_SECRET).update(manifest).digest("hex");
    return calc === v1;
  } catch { return false; }
}

/* ========= Routes ========= */

/** Crear preference */
router.post("/payments/mp/preference", async (req, res) => {
  try {
    if (!mpClient) return res.status(500).json({ error: "mp_token_missing" });
    const { title = "Reserva Lapa Casa Hostel", unit_price = 100, quantity = 1, currency_id = "BRL", metadata = {} } = req.body || {};
    const orderId = (metadata && (metadata.orderId || metadata.bookingId)) || `order-${Date.now()}`;

    const pref = new Preference(mpClient);
    const body = {
      items: [{ title, unit_price: Number(unit_price), quantity: Number(quantity), currency_id }],
      back_urls: {
        success: `${BASE_URL}/book?paid=1`,
        failure: `${BASE_URL}/book?cancel=1`,
        pending: `${BASE_URL}/book?cancel=1`
      },
      auto_return: "approved",
      metadata,
      external_reference: orderId,
      notification_url: `${BASE_URL}/webhooks/mp`
    };
    const result = await pref.create({ body });
    const initPoint = result.init_point || result.body?.init_point;
    const id = result.id || result.body?.id;
    res.json({ preferenceId: id, init_point: initPoint });
  } catch (err) {
    res.status(500).json({ error: "mp_preference_failed", detail: String(err?.message || err) });
  }
});

/** Webhook MP */
router.post("/webhooks/mp", async (req, res) => {
  try {
    const type = req.query.type || req.body?.type;
    const paymentId = req.query["data.id"] || req.body?.data?.id || req.body?.id;

    if (type !== "payment" || !paymentId) return res.status(200).send("ok");

    // firma opcional
    if (MP_WEBHOOK_SECRET && !verifyMpSignature(req, paymentId)) return res.status(401).send("invalid signature");

    if (!mpClient) return res.status(200).send("ok");
    const pay = new Payment(mpClient);
    const payment = await pay.get({ id: paymentId });
    const status = payment?.status; // approved, rejected, refunded, etc.
    const externalRef = payment?.external_reference || "";
    const total = payment?.transaction_amount;

    if (BOOKINGS_WEBAPP_URL && externalRef) {
      await postToSheets({ action: "payment_update", booking_id: externalRef, status, total });
    }
    res.status(200).send("ok");
  } catch (e) {
    res.status(200).send("ok");
  }
});

module.exports = router;
