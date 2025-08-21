const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Ping
app.get('/api/ping', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Rutas API
app.use('/api/payments', require('./routes/payments'));
app.use('/api/holds', require('./routes/holds'));
app.use('/api/availability', require('./routes/availability'));

// (Opcional) estado de pago fake para el botón Confirmar (si no usas webhooks)
app.get('/api/payments/status', (req, res) => {
  // Simple: siempre no pagado; si integras webhooks, responde real por bookingId
  return res.json({ paid: false, status: 'pending' });
});

// Frontend
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_DIR));
app.get(['/book', '/'], (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
