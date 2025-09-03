const express = require('express');
const path = require('path');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(compression());
app.use(express.json());

// Headers de seguridad
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Servir archivos estáticos - SIN duplicar src
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use(express.static(__dirname));

// APIs mock para que funcione el frontend
app.post('/api/availability', (req, res) => {
  setTimeout(() => {
    res.json({
      room1: 10,
      room3: 8,
      room5: 5,
      room6: 6,
      totalAvailable: 29,
      occupiedBeds: {
        room1: [1, 5, 8],
        room3: [2, 7],
        room5: [1, 3],
        room6: []
      },
      message: 'Datos de prueba - frontend funcionando'
    });
  }, 800);
});

app.post('/api/bookings', (req, res) => {
  setTimeout(() => {
    res.json({
      id: `BK${Date.now()}`,
      status: 'confirmed',
      message: 'Reserva simulada creada'
    });
  }, 1200);
});

app.post('/api/holds', (req, res) => {
  res.json({
    id: `HOLD${Date.now()}`,
    expires: new Date(Date.now() + 3 * 60 * 1000),
    message: 'Hold simulado creado'
  });
});

app.post('/api/payments/*', (req, res) => {
  res.json({
    id: `PAY${Date.now()}`,
    status: 'pending',
    redirectUrl: '#',
    qrCode: 'QR_CODE_SIMULADO',
    pixKey: 'pix@lapacasa.com',
    message: 'Pago simulado'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    frontend: 'funcionando',
    backend: 'simulado'
  });
});

// Admin endpoints simulados
app.get('/api/admin/*', (req, res) => {
  res.json({
    message: 'Admin simulado',
    data: []
  });
});

// Service Worker
app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, 'sw.js'));
});

// SPA routing - CORREGIDO sin duplicar src
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'), (err) => {
    if (err) {
      console.error('Error sirviendo index.html:', err);
      res.status(404).send('Archivo index.html no encontrado');
    }
  });
});

app.listen(PORT, () => {
  console.log(`Frontend funcionando en puerto ${PORT}`);
  console.log(`Directorio base: ${__dirname}`);
});
