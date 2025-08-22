"use strict";
const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const { randomUUID } = require("crypto");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// --- helpers ---
function parseAmount(p) {
  const raw = p?.total ?? p?.unit_price ?? p?.amount ?? p?.value;
  const n = Number(String(raw ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
async function notifyGASPayment(bookingId, status) {
  const url = process.env.BOOKINGS_WEBAPP_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "payment_update",
        booking_id: bookingId,
        pay_status: status,
      }),
    });
  } catch (e) {
    console.error("notifyGASPayment error:", e);
  }
}

/* ===== Mercado Pago — Checkout Pro ===== */
router.post("/mp/preference", async (req, res) => {
  try {
    const p = req.body?.order || req.body || {};
    const amount = parseAmount(p);
    if (amount <= 0) return res.status(400).json({ ok: false, error: "invalid_amount" });

    const email = p.email || p.payer?.email || p.metadata?.email || "guest@example.com";
    const bookingId = String(p.bookingId || p.metadata?.bookingId || `BKG-${Date.now()}`);
    const backBase = process.env.FRONTEND_URL || "/book";

    const preference = {
      items: [{ title: "Reserva Lapa Casa Hostel", quantity: 1, currency_id: "BRL", unit_price: amount }],
      payer: { email },
      metadata: { bookingId },
      external_reference: bookingId,
      payment_methods: { default_payment_option_id: "pix" },
      back_urls: {
        success: `${backBase}?paid=1`,
        failure: `${backBase}?paid=0`,
        pending: `${backBase}?paid=pending`,
      },
      auto_return: "approved",
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preference),
    });

    if (!mpRes.ok) {
      const txt = await mpRes.text();
      console.error("MP preference failed:", mpRes.status, txt);
      return res.status(502).json({ ok: false, error: "mp_error", status: mpRes.status, detail: txt });
    }
    const mpJson = await mpRes.json();
    return res.json({ ok: true, init_point: mpJson.init_point });
  } catch (e) {
    console.error("MP error:", e);
    return res.status(500).json({ ok: false, error: "mp_error", detail: String(e) });
  }
});

/* ===== Mercado Pago — PIX directo ===== */
router.post("/mp/pix", async (req, res) => {
  try {
    const p = req.body?.order || req.body || {};
    const amount = parseAmount(p);
    if (amount <= 0) return res.status(400).json({ ok: false, error: "invalid_amount" });

    const email = (p.email || p.payer?.email || "guest@example.com").toString().trim();
    const bookingId = String(p.bookingId || p.metadata?.bookingId || `BKG-${Date.now()}`);

    const payload = {
      transaction_amount: Number(amount),
      description: "Reserva Lapa Casa Hostel",
      payment_method_id: "pix",
      external_reference: bookingId,
      payer: { email },
    };

    const idemp = randomUUID();
    const payRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idemp,
      },
      body: JSON.stringify(payload),
    });

    if (!payRes.ok) {
      const txt = await payRes.text();
      console.error("MP PIX failed:", payRes.status, txt);
      return res.status(502).json({ ok: false, error: "mp_pix_error", status: payRes.status, detail: txt });
    }

    const j = await payRes.json();
    const t = j?.point_of_interaction?.transaction_data || {};
    return res.json({
      ok: true,
      id: j.id,
      status: j.status,
      status_detail: j.status_detail,
      qr_code_base64: t.qr_code_base64 || null,
      qr_code: t.qr_code || null,
      ticket_url: t.ticket_url || null,
      external_reference: bookingId,
    });
  } catch (e) {
    console.error("MP PIX error:", e);
    return res.status(500).json({ ok: false, error: "mp_pix_error", detail: String(e) });
  }
});

/* ===== Stripe — Checkout Session ===== */
router.post("/stripe/session", async (req, res) => {
  try {
    const p = req.body?.order || req.body || {};
    const amount = parseAmount(p);
    if (amount <= 0) return res.status(400).json({ ok: false, error: "invalid_amount" });

    const bookingId = String(p.bookingId || p.metadata?.bookingId || `BKG-${Date.now()}`);
    const backBase = process.env.FRONTEND_URL || "/book";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "brl",
            product_data: { name: "Reserva Lapa Casa Hostel" },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: { bookingId },
      mode: "payment",
      success_url: `${backBase}?paid=1`,
      cancel_url: `${backBase}?paid=0`,
    });

    res.json({ ok: true, id: session.id });
  } catch (e) {
    console.error("Stripe session error:", e);
    res.status(500).json({ ok: false, error: "stripe_error", detail: String(e) });
  }
});

/* ===== Stripe — Webhook handler (exportado) ===== */
async function stripeWebhook(req, res) {
  try {
    const sig = req.headers["stripe-signature"];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!sig || !secret) return res.status(400).send("missing_signature");

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err) {
      console.error("Stripe signature error:", err.message);
      return res.status(400).send(`signature_error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const bookingId = session.metadata?.bookingId || session.client_reference_id || "";
      if (bookingId) await notifyGASPayment(bookingId, "approved");
    }
    res.json({ received: true });
  } catch (e) {
    console.error("Stripe webhook err:", e);
    res.status(500).send("webhook_error");
  }
}

module.exports = { router, stripeWebhook };
