require('dotenv').config();
const express = require('express');
const app = express();
const bookings = require('./routes/bookings');
const holds    = require('./routes/holds');
const payments = require('./routes/payments');

app.use(express.json());

// CORS
app.use((req, res, next) => {
  const allowed = process.env.CORS_ALLOW_ORIGINS.split(',');
  const origin  = req.headers.origin || '';
  if (allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Rutas
app.use('/bookings', bookings);
app.use('/holds',    holds);
app.use('/payments', payments);

// Endpoint de salud
app.get('/ping', (_, res) => res.json({ ok: true, ts: Date.now() }));

app.listen(process.env.PORT || 3000, () => {
  console.log(`Servidor escuchando en el puerto ${process.env.PORT || 3000}`);
});
