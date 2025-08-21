const express = require('express');
const router = express.Router();
const Stripe = require('stripe');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ---------- MP: crea preferencia (acepta {order:{...}} o payload plano con unit_price) ----------
router.post('/mp/preference', async (req, res) => {
  try {
    // Acepta { order: {...} } o el body directo (formato "plano")
    const payload = req.body.order || req.body;

    // monto: intenta en este orden: total, unit_price, amount, value
    const rawAmount = payload.total ?? payload.unit_price ?? payload.amount ?? payload.value;
    const amount = Number(String(rawAmount ?? '').toString().replace(/[^\d.-]/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'invalid_amount', detail: 'El monto debe ser > 0' });
    }

    // email: acepta varias ubicaciones
    const email =
      payload.email ||
      payload.payer?.email ||
      payload.metadata?.email ||
      '';

    const preference = {
      items: [
        { title: 'Reserva Lapa Casa Hostel', quantity: 1, currency_id: 'BRL', unit_price: amount }
      ],
      payer: email ? { email } : undefined,
      metadata: {
        bookingId: String(payload.bookingId || payload.metadata?.bookingId || '')
      },
      back_urls: {
        success: `${process.env.FRONTEND_URL}?paid=1`,
        failure: `${process.env.FRONTEND_URL}?paid=0`,
        pending: `${process.env.FRONTEND_URL}?paid=pending`
      },
      auto_return: 'approved'
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
      const errorBody = await mpRes.text();
      console.error('MP create preference failed:', mpRes.status, errorBody);
      return res.status(502).json({ error: 'mp_error', status: mpRes.status, detail: errorBody });
    }

    const mpJson = await mpRes.json();
    return res.json({ init_point: mpJson.init_point });
  } catch (e) {
    console.error('MP error:', e);
    return res.status(500).json({ error: 'mp_error', detail: String(e) });
  }
});

// ---------- Stripe: sesión de checkout (acepta {order:{...}} o payload plano) ----------
router.post('/stripe/session', async (req, res) => {
  try {
    const payload = req.body.order || req.body;

    const rawAmount = payload.total ?? payload.amount ?? payload.value ?? payload.unit_price;
    const amount = Number(String(rawAmount ?? '').toString().replace(/[^\d.-]/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'invalid_amount', detail: 'El monto debe ser > 0' });
    }

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
      metadata: { bookingId: String(payload.bookingId || payload.metadata?.bookingId || '') },
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}?paid=1`,
      cancel_url: `${process.env.FRONTEND_URL}?paid=0`
    });

    return res.json({ id: session.id });
  } catch (e) {
    console.error('Stripe error:', e);
    return res.status(500).json({ error: 'stripe_error', detail: String(e) });
  }
});

// (Opcional) Webhook Stripe
router.post('/webhooks/stripe', async (req, res) => {
  return res.json({ received: true });
});

module.exports = router;
