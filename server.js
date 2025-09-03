const express = require('express');
const path = require('path');
const fs = require('fs');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3001;

// Rutas corregidas para carpeta frontend
const frontendPath = path.join(__dirname, 'frontend');
const indexHtmlPath = path.join(frontendPath, 'index.html');
const assetsPath = path.join(frontendPath, 'assets');

console.log(`Buscando frontend en: ${frontendPath}`);
console.log(`Index HTML esperado en: ${indexHtmlPath}`);
console.log(`Assets esperados en: ${assetsPath}`);

// Verificar si los archivos existen
if (fs.existsSync(indexHtmlPath)) {
  console.log('✅ index.html encontrado');
} else {
  console.log('❌ index.html NO encontrado');
}

if (fs.existsSync(assetsPath)) {
  console.log('✅ Carpeta assets encontrada');
} else {
  console.log('❌ Carpeta assets NO encontrada');
}

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

// Servir archivos estáticos desde carpeta frontend
app.use('/assets', express.static(assetsPath));
app.use(express.static(frontendPath));

// APIs mock para desarrollo
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
    redirectUrl: '#',
    qrCode: 'QR_SIMULADO',
    pixKey: 'pix@lapacasa.com'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    frontend: 'funcionando',
    indexExists: fs.existsSync(indexHtmlPath),
    assetsExists: fs.existsSync(assetsPath),
    frontendPath: frontendPath
  });
});

app.get('/api/admin/*', (req, res) => {
  res.json({ message: 'Admin simulado', data: [] });
});

// Service Worker
app.get('/sw.js', (req, res) => {
  const swPath = path.join(frontendPath, 'sw.js');
  if (fs.existsSync(swPath)) {
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(swPath);
  } else {
    res.status(404).send('Service Worker no encontrado');
  }
});

// Ruta catch-all - servir index.html desde frontend
app.get('*', (req, res) => {
  if (fs.existsSync(indexHtmlPath)) {
    res.sendFile(indexHtmlPath);
  } else {
    res.status(404).send(`
      <h1>Frontend Lapa Casa Hostel</h1>
      <p>❌ index.html no encontrado en: ${indexHtmlPath}</p>
      <p>Estructura del proyecto:</p>
      <pre>
├── server.js
├── package.json
└── frontend/          ← Aquí deberían estar los archivos
    ├── index.html
    ├── assets/
    └── js/
      </pre>
      <p>Archivos en carpeta frontend:</p>
      <pre>${fs.existsSync(frontendPath) ? fs.readdirSync(frontendPath).join('\n') : 'Carpeta frontend no existe'}</pre>
    `);
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log(`Sirviendo frontend desde: ${frontendPath}`);
});
