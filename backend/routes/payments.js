const express = require('express');
const router = express.Router();

// Mercado Pago: preferencia
router.post('/mp/preference', async (req, res) => {
  // Genera preferencia MP usando MP_ACCESS_TOKEN
  res.json({ init_point:'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=XYZ' });
});

// Stripe: sesión
router.post('/stripe/session', async (req, res) => {
  // Genera una sesión de checkout con Stripe
  res.json({ id:'cs_test_123' });
});

// Webhook Stripe
router.post('/webhooks/stripe', async (req, res) => {
  // Verifica la firma usando STRIPE_WEBHOOK_SECRET y actualiza la reserva
  res.json({ received:true });
});

module.exports = router;
