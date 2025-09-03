const express = require('express');
const path = require('path');
const fs = require('fs');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3001;

// Rutas corregidas para frontend/src
const frontendSrcPath = path.join(__dirname, 'frontend', 'src');
const indexHtmlPath = path.join(frontendSrcPath, 'index.html');
const assetsPath = path.join(frontendSrcPath, 'assets');

console.log(`Frontend path: ${frontendSrcPath}`);
console.log(`Index HTML: ${indexHtmlPath}`);

// Middlewares
app.use(compression());
app.use(express.json());

// Headers de seguridad y CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Servir archivos estáticos desde frontend/src
app.use('/assets', express.static(assetsPath));
app.use(express.static(frontendSrcPath));

// APIs mock
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
      }
    });
  }, 800);
});

app.post('/api/bookings', (req, res) => {
  res.json({
    id: `BK${Date.now()}`,
    status: 'confirmed',
    message: 'Reserva simulada'
  });
});

app.post('/api/holds', (req, res) => {
  res.json({
    id: `HOLD${Date.now()}`,
    expires: new Date(Date.now() + 180000)
  });
});

app.post('/api/payments/*', (req, res) => {
  res.json({
    id: `PAY${Date.now()}`,
    status: 'pending',
    redirectUrl: '#'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    frontend: 'funcionando'
  });
});

app.get('/api/admin/*', (req, res) => {
  res.json({ message: 'Admin simulado', data: [] });
});

// Service Worker
app.get('/sw.js', (req, res) => {
  const swPath = path.join(frontendSrcPath, 'sw.js');
  if (fs.existsSync(swPath)) {
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(swPath);
  } else {
    res.status(404).send('SW no encontrado');
  }
});

// Catch-all - servir desde frontend/src
app.get('*', (req, res) => {
  if (fs.existsSync(indexHtmlPath)) {
    res.sendFile(indexHtmlPath);
  } else {
    res.status(404).send('Frontend no encontrado');
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log(`Sirviendo desde: ${frontendSrcPath}`);
});
