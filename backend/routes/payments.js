const express = require('express');
const router = express.Router();
const Stripe = require('stripe');

// Inicializamos Stripe con tu clave secreta
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Crear preferencia de Mercado Pago mediante llamada REST
router.post('/mp/preference', async (req, res) => {
  try {
    const { order } = req.body;
    const preference = {
      items: [{
        title: 'Reserva Lapa Casa Hostel',
        quantity: 1,
        currency_id: 'BRL',
        unit_price: Number(order.total || 0)
      }],
      payer: {
        email: order.email
      },
      metadata: {
        bookingId: order.bookingId
      },
      back_urls: {
        success: `${process.env.FRONTEND_URL}?paid=1`,
        failure: `${process.env.FRONTEND_URL}?paid=0`
      },
      auto_return: 'approved'
    };

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preference)
    });

    if (!mpRes.ok) {
      const errorBody = await mpRes.text();
      throw new Error(`MP API error: ${mpRes.status} ${errorBody}`);
    }

    const mpJson = await mpRes.json();
    return res.json({ init_point: mpJson.init_point });
  } catch (e) {
    console.error('MP error:', e);
    return res.status(500).json({ error: 'mp_error', detail: String(e) });
  }
});

// Crear una sesión de Stripe
router.post('/stripe/session', async (req, res) => {
  try {
    const { order } = req.body;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: { name: 'Reserva Lapa Casa Hostel' },
          unit_amount: Number(order.total || 0) * 100
        },
        quantity: 1
      }],
      metadata: { bookingId: order.bookingId },
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}?paid=1`,
      cancel_url: `${process.env.FRONTEND_URL}?paid=0`
    });
    res.json({ id: session.id });
  } catch (e) {
    console.error('Stripe error:', e);
    res.status(500).json({ error: 'stripe_error', detail: String(e) });
  }
});

// Webhook de Stripe
router.post('/webhooks/stripe', async (req, res) => {
  res.json({ received: true });
});

module.exports = router;
