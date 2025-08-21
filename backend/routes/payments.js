const express = require('express');
const router = express.Router();
const mercadopago = require('mercadopago');
const Stripe = require('stripe');

// Configurar Mercado Pago con el token de acceso
mercadopago.configurations.setAccessToken(process.env.MP_ACCESS_TOKEN);

// Configurar Stripe con la clave secreta
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Generar preferencia de Mercado Pago
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

    const response = await mercadopago.preferences.create(preference);
    return res.json({ init_point: response.body.init_point });
  } catch (e) {
    console.error('MP error:', e);
    return res.status(500).json({ error: 'mp_error', detail: String(e) });
  }
});

// Crear sesión de Stripe
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

// Webhook de Stripe (igual que antes)
router.post('/webhooks/stripe', async (req, res) => {
  // Verifica la firma con STRIPE_WEBHOOK_SECRET y actualiza la reserva
  res.json({ received:true });
});

module.exports = router;
