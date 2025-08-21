const express = require('express');
const router = express.Router();
const Stripe = require('stripe');

// ===== Stripe (server-side) =====
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ===== Mercado Pago (REST) =====
// Usamos fetch (Node 22+) para crear la preferencia sin SDKs que cambian API

// Crea preferencia de Mercado Pago
router.post('/mp/preference', async (req, res) => {
  try {
    // Acepta { order: {...} } o el body directo
    const order = req.body.order || req.body;
    if (!order) {
      return res.status(400).json({ error: 'invalid_payload', detail: 'Falta order' });
    }

    const amount = Number(order.total || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'invalid_amount', detail: 'total debe ser > 0' });
    }
    const email = String(order.email || '').trim();
    if (!email) {
      return res.status(400).json({ error: 'invalid_email', detail: 'email requerido' });
    }

    const preference = {
      items: [
        {
          title: 'Reserva Lapa Casa Hostel',
          quantity: 1,
          currency_id: 'BRL',
          unit_price: amount
        }
      ],
      payer: { email },
      metadata: { bookingId: String(order.bookingId || '') },
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
    // init_point: link de checkout clásico
    return res.json({ init_point: mpJson.init_point });
  } catch (e) {
    console.error('MP error:', e);
    return res.status(500).json({ error: 'mp_error', detail: String(e) });
  }
});

// Crea sesión de Stripe Checkout
router.post('/stripe/session', async (req, res) => {
  try {
    const order = req.body.order || req.body;
    if (!order) {
      return res.status(400).json({ error: 'invalid_payload', detail: 'Falta order' });
    }

    const amount = Number(order.total || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'invalid_amount', detail: 'total debe ser > 0' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: { name: 'Reserva Lapa Casa Hostel' },
            unit_amount: Math.round(amount * 100) // centavos
          },
          quantity: 1
        }
      ],
      metadata: { bookingId: String(order.bookingId || '') },
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

// Webhook Stripe (placeholder)
router.post('/webhooks/stripe', async (req, res) => {
  // Valida firma con STRIPE_WEBHOOK_SECRET si lo usas
  return res.json({ received: true });
});

module.exports = router;
