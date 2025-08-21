const express = require('express');
const router = express.Router();
const Stripe = require('stripe');

// ===== Stripe (clave en .env: STRIPE_SECRET_KEY) =====
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Util: normaliza monto desde distintos nombres (total, unit_price, amount, value)
function parseAmount(payload) {
  const raw = payload.total ?? payload.unit_price ?? payload.amount ?? payload.value;
  const n = Number(String(raw ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

// ===== Mercado Pago (Checkout Pro con Pix y tarjetas) =====
// Requiere .env: MP_ACCESS_TOKEN y FRONTEND_URL
router.post('/mp/preference', async (req, res) => {
  try {
    const payload = req.body?.order || req.body || {};
    const amount = parseAmount(payload);
    if (amount <= 0) {
      return res.status(400).json({ error: 'invalid_amount', detail: 'El monto debe ser > 0' });
    }

    const email =
      payload.email ||
      payload.payer?.email ||
      payload.metadata?.email ||
      '';

    const bookingId = String(payload.bookingId || payload.metadata?.bookingId || `BKG-${Date.now()}`);
    const backBase = process.env.FRONTEND_URL || 'https://lapacasahostel.com/book';

    const preference = {
      items: [
        { title: 'Reserva Lapa Casa Hostel', quantity: 1, currency_id: 'BRL', unit_price: amount }
      ],
      payer: email ? { email } : undefined,
      metadata: { bookingId },
      external_reference: bookingId,

      // ✅ Pix habilitado (por defecto) + tarjetas disponibles
      payment_methods: {
        excluded_payment_types: [],              // no excluimos nada (Pix, tarjeta, boleto si aplica)
        default_payment_method_id: 'pix'
      },
      binary_mode: false,

      back_urls: {
        success: `${backBase}?paid=1`,
        failure: `${backBase}?paid=0`,
        pending: `${backBase}?paid=pending`
      },
      auto_return: 'approved'
    };

    // Si tienes un webhook de MP en .env, lo agregamos:
    if (process.env.BOOKINGS_WEBHOOK_URL_MP) {
      preference.notification_url = process.env.BOOKINGS_WEBHOOK_URL_MP;
    }

    // Llamada REST (Node 18+ trae fetch nativo)
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
    // init_point abre el Checkout Pro (verás Pix como opción)
    return res.json({ init_point: mpJson.init_point });
  } catch (e) {
    console.error('MP error:', e);
    return res.status(500).json({ error: 'mp_error', detail: String(e) });
  }
});

// ===== Stripe Checkout =====
// Requiere .env: STRIPE_SECRET_KEY y FRONTEND_URL
router.post('/stripe/session', async (req, res) => {
  try {
    const payload = req.body?.order || req.body || {};
    const amount = parseAmount(payload);
    if (amount <= 0) {
      return res.status(400).json({ error: 'invalid_amount', detail: 'El monto debe ser > 0' });
    }

    const bookingId = String(payload.bookingId || payload.metadata?.bookingId || `BKG-${Date.now()}`);
    const backBase = process.env.FRONTEND_URL || 'https://lapacasahostel.com/book';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: { name: 'Reserva Lapa Casa Hostel' },
          unit_amount: Math.round(amount * 100) // centavos
        },
        quantity: 1
      }],
      metadata: { bookingId },
      mode: 'payment',
      success_url: `${backBase}?paid=1`,
      cancel_url: `${backBase}?paid=0`
    });

    return res.json({ id: session.id });
  } catch (e) {
    console.error('Stripe error:', e);
    return res.status(500).json({ error: 'stripe_error', detail: String(e) });
  }
});

// ===== Webhook Stripe (placeholder; valida firma si lo usas) =====
router.post('/webhooks/stripe', async (_req, res) => {
  return res.json({ received: true });
});

module.exports = router;
