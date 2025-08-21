require('dotenv').config();
const express = require('express');
const path = require('path');

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

// Endpoint de disponibilidad con prefijo /api
app.get('/api/availability', (req, res) => {
  // Puedes usar req.query.from y req.query.to para filtrar
  res.json({ ok: true, occupied: {} });
});

// Rutas de la API con prefijo /api
app.use('/api/bookings', bookings);
app.use('/api/holds',    holds);
app.use('/api/payments', payments);

// Servir el frontend estático
app.use('/', express.static(path.join(__dirname, '..', 'frontend')));
app.get('/book', (_, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Endpoint de salud
app.get('/ping', (_, res) => res.json({ ok: true, ts: Date.now() }));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`);
});
