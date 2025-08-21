const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const { randomUUID } = require('crypto');

// ===== Stripe (tarjeta)
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// helper monto
function parseAmount(p) {
  const raw = p?.total ?? p?.unit_price ?? p?.amount ?? p?.value;
  const n = Number(String(raw ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/* =======================
 * MP — Checkout Pro (tarjeta + Pix en algunas cuentas)
 * ======================= */
router.post('/mp/preference', async (req, res) => {
  try {
    const p = req.body?.order || req.body || {};
    const amount = parseAmount(p);
    if (amount <= 0) return res.status(400).json({ error: 'invalid_amount' });

    const email = p.email || p.payer?.email || p.metadata?.email || '';
    const bookingId = String(p.bookingId || p.metadata?.bookingId || `BKG-${Date.now()}`);
    const backBase  = process.env.FRONTEND_URL || 'https://lapacasahostel.com/book';

    const preference = {
      items: [{ title: 'Reserva Lapa Casa Hostel', quantity: 1, currency_id: 'BRL', unit_price: amount }],
      payer: email ? { email } : undefined,
      metadata: { bookingId },
      external_reference: bookingId,
      payment_methods: {
        excluded_payment_methods: [],
        excluded_payment_types: [],
        default_payment_option_id: 'pix'
      },
      back_urls: {
        success: `${backBase}?paid=1`,
        failure: `${backBase}?paid=0`,
        pending: `${backBase}?paid=pending`
      },
      auto_return: 'approved',
      notification_url: process.env.BOOKINGS_WEBHOOK_URL_MP || undefined
    };

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preference)
    });

    if (!mpRes.ok) {
      const txt = await mpRes.text();
      console.error('MP preference failed:', mpRes.status, txt);
      return res.status(502).json({ error: 'mp_error', status: mpRes.status, detail: txt });
    }

    const mpJson = await mpRes.json();
    return res.json({ init_point: mpJson.init_point });
  } catch (e) {
    console.error('MP error:', e);
    return res.status(500).json({ error: 'mp_error', detail: String(e) });
  }
});

/* =======================
 * MP — PIX por Checkout Transparente (QR y copia/cola)
 * ======================= */
router.post('/mp/pix', async (req, res) => {
  try {
    const p = req.body?.order || req.body || {};
    const amount = parseAmount(p);
    if (amount <= 0) return res.status(400).json({ error: 'invalid_amount' });

    const email = (p.email || p.payer?.email || 'guest@example.com').toString().trim();
    const bookingId = String(p.bookingId || p.metadata?.bookingId || `BKG-${Date.now()}`);

    const payload = {
      transaction_amount: Number(amount),
      description: 'Reserva Lapa Casa Hostel',
      payment_method_id: 'pix',
      external_reference: bookingId,
      payer: { email }
      // opcional: date_of_expiration: new Date(Date.now()+24*3600e3).toISOString()
    };

    const idemp = randomUUID();

    const payRes = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idemp
      },
      body: JSON.stringify(payload)
    });

    if (!payRes.ok) {
      const txt = await payRes.text();
      console.error('MP PIX payment failed:', payRes.status, txt);
      return res.status(502).json({ error: 'mp_pix_error', status: payRes.status, detail: txt });
    }

    const j = await payRes.json();
    const tdata = j?.point_of_interaction?.transaction_data || {};
    // devolvemos lo necesario para mostrar Pix en el front
    return res.json({
      id: j.id,
      status: j.status, // esperado: "pending"
      status_detail: j.status_detail,
      qr_code_base64: tdata.qr_code_base64 || null,
      qr_code: tdata.qr_code || null,
      ticket_url: tdata.ticket_url || null,
      external_reference: bookingId
    });
  } catch (e) {
    console.error('MP PIX error:', e);
    return res.status(500).json({ error: 'mp_pix_error', detail: String(e) });
  }
});

/* =======================
 * Stripe — tarjeta
 * ======================= */
router.post('/stripe/session', async (req, res) => {
  try {
    const p = req.body?.order || req.body || {};
    const amount = parseAmount(p);
    if (amount <= 0) return res.status(400).json({ error: 'invalid_amount' });

    const bookingId = String(p.bookingId || p.metadata?.bookingId || `BKG-${Date.now()}`);
    const backBase  = process.env.FRONTEND_URL || 'https://lapacasahostel.com/book';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: { name: 'Reserva Lapa Casa Hostel' },
          unit_amount: Math.round(amount * 100)
        },
        quantity: 1
      }],
      metadata: { bookingId },
      mode: 'payment',
      success_url: `${backBase}?paid=1`,
      cancel_url: `${backBase}?paid=0`
    });

    res.json({ id: session.id });
  } catch (e) {
    console.error('Stripe error:', e);
    res.status(500).json({ error: 'stripe_error', detail: String(e) });
  }
});

router.post('/webhooks/stripe', async (_req, res) => res.json({ received: true }));

module.exports = router;
