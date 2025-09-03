const express = require('express');
const path = require('path');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Middleware de compresión
app.use(compression());

// Headers de seguridad
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // CORS para desarrollo
  if (!isProduction) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  }
  
  next();
});

// Servir archivos estáticos desde src/
app.use(express.static(path.join(__dirname, 'src'), {
  maxAge: isProduction ? '1y' : '0',
  etag: true,
  lastModified: true
}));

// Servir assets con caché largo
app.use('/assets', express.static(path.join(__dirname, 'src/assets'), {
  maxAge: isProduction ? '1y' : '0',
  immutable: isProduction
}));

// Service Worker
app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'src/sw.js'));
});

// Manifest PWA
app.get('/manifest.json', (req, res) => {
  const manifest = {
    name: "Lapa Casa Hostel - Reservas",
    short_name: "Lapa Casa",
    description: "Sistema de reservas para Lapa Casa Hostel",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#f59e0b",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "64x64 32x32 24x24 16x16",
        type: "image/x-icon"
      }
    ]
  };
  
  res.setHeader('Content-Type', 'application/json');
  res.json(manifest);
});

// API Mock para desarrollo (opcional)
if (!isProduction) {
  app.post('/api/availability', (req, res) => {
    setTimeout(() => {
      res.json({
        room1: 12,
        room3: 12,
        room5: 7,
        room6: 7,
        totalAvailable: 38,
        occupiedBeds: {},
        message: 'Datos de prueba - modo desarrollo'
      });
    }, 1000);
  });
  
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: 'development',
      message: 'Frontend server funcionando'
    });
  });
}

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('Error del servidor:', err);
  res.status(500).json({
    error: true,
    message: isProduction ? 'Error interno del servidor' : err.message
  });
});

// Ruta catch-all para SPA (debe ir al final)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'index.html'), (err) => {
    if (err) {
      console.error('Error sirviendo index.html:', err);
      res.status(404).send('Página no encontrada');
    }
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🏠 Lapa Casa Hostel Frontend`);
  console.log(`📱 Puerto: ${PORT}`);
  console.log(`🚀 Ambiente: ${isProduction ? 'production' : 'development'}`);
  console.log(`🌐 URL: ${isProduction ? 'https://tu-app.render.com' : `http://localhost:${PORT}`}`);
});

// Manejo de señales para shutdown graceful
process.on('SIGTERM', () => {
  console.log('🛑 Cerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Cerrando servidor...');
  process.exit(0);
});
