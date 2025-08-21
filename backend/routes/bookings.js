const express = require('express');
const router = express.Router();

// Crear una reserva
router.post('/', async (req, res) => {
  const data = req.body || {};
  // Aquí guardarías data en tu base de datos y notificarías a Google Sheets (BOOKINGS_WEBAPP_URL)
  res.json({ ok:true, message:'Reserva registrada', bookingId:data.bookingId || `BKG-${Date.now()}` });
});

// Consultar estado de pago
router.get('/status', async (req, res) => {
  const bookingId = req.query.bookingId;
  // Consulta en la base de datos o en MP/Stripe
  res.json({ ok:true, status:'pending' });
});

module.exports = router;
