"use strict";
const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const { randomUUID } = require("crypto");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const FRONTEND = process.env.FRONTEND_URL || "/book";
const MP_TOKEN = process.env.MP_ACCESS_TOKEN || "";

function parseAmount(p) {
  const raw = p?.total ?? p?.unit_price ?? p?.amount ?? p?.value;
  const n = Number(String(raw ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/* ===== Mercado Pago — Checkout Pro ===== */
router.post("/mp/preference", async (req, res) => {
  try {
    const p = req.body?.order || req.body || {};
    const amount = parseAmount(p);
    if (amount <= 0) return res.status(400).json({ error: "invalid_amount" });

    const email = p.email || p.payer?.email || p.metadata?.email || "";
    const bookingId = String(p.bookingId || p.metadata?.bookingId || `BKG-${Date.now()}`);

    const preference = {
      items: [{ title: "Reserva Lapa Casa Hostel", quantity: 1, currency_id: "BRL", unit_price: amount }],
      payer: email ? { email } : undefined,
      metadata: { bookingId },
      external_reference: bookingId,
      payment_methods: { default_payment_option_id: "pix" },
      back_urls: {
        success: `${FRONTEND}?paid=1`,
        failure: `${FRONTEND}?paid=0`,
        pending: `${FRONTEND}?paid=pending`
      },
      auto_return: "approved",
      notification_url: process.env.BOOKINGS_WEBHOOK_URL_MP || undefined
    };

    const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(preference)
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error("MP preference failed:", r.status, txt);
      return res.status(502).json({ error: "mp_error", status: r.status, detail: txt });
    }

    const j = await r.json();
    res.json({ init_point: j.init_point });
  } catch (e) {
    console.error("MP error:", e);
    res.status(500).json({ error: "mp_error", detail: String(e) });
  }
});

/* ===== Mercado Pago — Pix directo ===== */
router.post("/mp/pix", async (req, res) => {
  try {
    const p = req.body?.order || req.body || {};
    const amount = parseAmount(p);
    if (amount <= 0) return res.status(400).json({ error: "invalid_amount" });

    const email = (p.email || p.payer?.email || "guest@example.com").toString().trim();
    const bookingId = String(p.bookingId || p.metadata?.bookingId || `BKG-${Date.now()}`);

    const payload = {
      transaction_amount: Number(amount),
      description: "Reserva Lapa Casa Hostel",
      payment_method_id: "pix",
      external_reference: bookingId,
      payer: { email }
      // opcional: date_of_expiration: new Date(Date.now()+24*3600e3).toISOString()
    };

    const idemp = randomUUID();
    const r = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idemp
      },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error("MP PIX payment failed:", r.status, txt);
      return res.status(502).json({ error: "mp_pix_error", status: r.status, detail: txt });
    }

    const j = await r.json();
    const t = j?.point_of_interaction?.transaction_data || {};
    res.json({
      id: j.id,
      status: j.status,
      status_detail: j.status_detail,
      qr_code_base64: t.qr_code_base64 || null,
      qr_code: t.qr_code || null,
      ticket_url: t.ticket_url || null,
      external_reference: bookingId
    });
  } catch (e) {
    console.error("MP PIX error:", e);
    res.status(500).json({ error: "mp_pix_error", detail: String(e) });
  }
});

/* ===== Stripe — tarjeta ===== */
router.post("/stripe/session", async (req, res) => {
  try {
    const p = req.body?.order || req.body || {};
    const amount = parseAmount(p);
    if (amount <= 0) return res.status(400).json({ error: "invalid_amount" });

    const bookingId = String(p.bookingId || p.metadata?.bookingId || `BKG-${Date.now()}`);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "brl",
          product_data: { name: "Reserva Lapa Casa Hostel" },
          unit_amount: Math.round(amount * 100)
        },
        quantity: 1
      }],
      metadata: { bookingId },
      mode: "payment",
      success_url: `${FRONTEND}?paid=1`,
      cancel_url: `${FRONTEND}?paid=0`
    });

    res.json({ id: session.id });
  } catch (e) {
    console.error("Stripe error:", e);
    res.status(500).json({ error: "stripe_error", detail: String(e) });
  }
});

/* ===== Webhook MP (normaliza estados) ===== */
router.post("/mp/webhook", async (req, res) => {
  try {
    const data = req.body || {};
    const id = data.data?.id || data.id || data.resource || null;
    if (!id) return res.json({ received: true });

    const detail = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { Authorization: `Bearer ${MP_TOKEN}` }
    }).then(r => r.json());

    const bookingId = detail?.external_reference || detail?.metadata?.bookingId;
    const status = String(detail?.status || "").toLowerCase();

    if (bookingId) {
      const sheets = require("../services/sheets");
      const holds  = require("../services/holdsStore");
      if (status === "approved") {
        await sheets.updatePayment(bookingId, "approved");
        await holds.confirmHold(bookingId, "paid");
      } else if (["rejected","cancelled","refunded","charged_back"].includes(status)) {
        await sheets.updatePayment(bookingId, status);
        await holds.releaseHold(bookingId);
      }
    }
    res.json({ received: true });
  } catch (e) {
    console.error("MP webhook error", e);
    res.status(200).json({ received: true });
  }
});

module.exports = router;
