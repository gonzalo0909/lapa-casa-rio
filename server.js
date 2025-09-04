const express = require('express');
const path = require('path');
const fs = require('fs');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3001;

// Ruta exacta donde están los archivos del frontend
const frontendPath = path.join(__dirname, 'frontend', 'src');

console.log('Iniciando servidor Lapa Casa Hostel...');
console.log(`Sirviendo archivos desde: ${frontendPath}`);

// Middlewares básicos
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Headers de seguridad y CORS
app.use((req, res, next) => {
  // CORS para desarrollo
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Admin-Token');
  
  // Headers de seguridad
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
  // Manejar preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// CRÍTICO: Middleware para servir archivos estáticos
// Debe ir ANTES de cualquier ruta API que pueda interferir
app.use(express.static(frontendPath, {
  maxAge: '1d',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Asegurar Content-Type correcto para archivos JavaScript
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    } else if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
  }
}));

// Servir explícitamente la carpeta assets
app.use('/assets', express.static(path.join(frontendPath, 'assets'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    }
  }
}));

// APIs MOCK para desarrollo - Endpoints que espera el frontend
app.post('/api/availability', (req, res) => {
  console.log('API: Checking availability', req.body);
  
  // Simular delay de red
  setTimeout(() => {
    res.json({
      success: true,
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
      message: 'Disponibilidad simulada - modo desarrollo'
    });
  }, 800);
});

app.post('/api/bookings', (req, res) => {
  console.log('API: Creating booking', req.body);
  
  setTimeout(() => {
    res.json({
      success: true,
      id: `BK${Date.now()}`,
      status: 'confirmed',
      confirmationCode: `LAPA${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      message: 'Reserva simulada creada exitosamente'
    });
  }, 1200);
});

app.post('/api/holds', (req, res) => {
  console.log('API: Creating hold', req.body);
  
  res.json({
    success: true,
    id: `HOLD${Date.now()}`,
    expires: new Date(Date.now() + 3 * 60 * 1000), // 3 minutos
    beds: req.body.beds || [],
    message: 'Hold temporal creado'
  });
});

// Endpoints de pago simulados
app.post('/api/payments/stripe', (req, res) => {
  console.log('API: Stripe payment', req.body);
  
  setTimeout(() => {
    res.json({
      success: true,
      id: `stripe_${Date.now()}`,
      status: 'pending',
      redirectUrl: `${req.protocol}://${req.get('host')}/payment-success`,
      message: 'Pago Stripe simulado'
    });
  }, 1000);
});

app.post('/api/payments/mercadopago', (req, res) => {
  console.log('API: MercadoPago payment', req.body);
  
  setTimeout(() => {
    res.json({
      success: true,
      id: `mp_${Date.now()}`,
      status: 'pending',
      redirectUrl: `${req.protocol}://${req.get('host')}/payment-success`,
      message: 'Pago MercadoPago simulado'
    });
  }, 1000);
});

app.post('/api/payments/pix', (req, res) => {
  console.log('API: PIX payment', req.body);
  
  res.json({
    success: true,
    id: `pix_${Date.now()}`,
    status: 'pending',
    qrCode: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzAwMCIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+UVI8L3RleHQ+PC9zdmc+',
    pixKey: 'pix@lapacasahostel.com',
    amount: req.body.amount,
    message: 'QR PIX simulado generado'
  });
});

app.post('/api/payments/:paymentId/verify', (req, res) => {
  console.log('API: Verify payment', req.params.paymentId);
  
  res.json({
    success: true,
    status: 'completed',
    verified: true,
    message: 'Pago verificado (simulado)'
  });
});

// Endpoints de administración
app.get('/api/admin/health', (req, res) => {
  const token = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Token de admin requerido' });
  }
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    server: 'frontend-mock',
    version: '2.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    message: 'Health check simulado'
  });
});

app.get('/api/admin/holds', (req, res) => {
  const token = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Token de admin requerido' });
  }
  
  res.json({
    success: true,
    holds: [
      {
        id: 'HOLD123',
        beds: ['1-5', '1-8'],
        expires: new Date(Date.now() + 120000),
        guestInfo: { email: 'test@example.com' }
      }
    ],
    message: 'Holds simulados'
  });
});

app.get('/api/admin/bookings', (req, res) => {
  const token = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Token de admin requerido' });
  }
  
  res.json({
    success: true,
    bookings: [
      {
        id: 'BK123',
        guest: { nome: 'Juan Pérez', email: 'juan@example.com' },
        checkIn: '2024-12-01',
        checkOut: '2024-12-03',
        beds: ['1-1', '1-2'],
        status: 'confirmed'
      }
    ],
    total: 1,
    message: 'Reservas simuladas'
  });
});

// Health check público
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'lapa-casa-frontend',
    version: '2.0.0'
  });
});

// Service Worker
app.get('/sw.js', (req, res) => {
  const swPath = path.join(frontendPath, 'sw.js');
  
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache');
  
  if (fs.existsSync(swPath)) {
    res.sendFile(swPath);
  } else {
    res.send('// Service Worker no encontrado');
  }
});

// Ruta de debug para verificar archivos
app.get('/debug', (req, res) => {
  let debugInfo = `<h2>Debug - Lapa Casa Hostel</h2>`;
  debugInfo += `<p><strong>Frontend Path:</strong> ${frontendPath}</p>`;
  debugInfo += `<p><strong>__dirname:</strong> ${__dirname}</p>`;
  debugInfo += `<p><strong>process.cwd():</strong> ${process.cwd()}</p>`;
  
  try {
    if (fs.existsSync(frontendPath)) {
      debugInfo += `<h3>Archivos en frontend/src:</h3><ul>`;
      
      const files = fs.readdirSync(frontendPath, { withFileTypes: true });
      files.forEach(file => {
        if (file.isDirectory()) {
          const subPath = path.join(frontendPath, file.name);
          const subFiles = fs.readdirSync(subPath);
          debugInfo += `<li><strong>${file.name}/</strong>: ${subFiles.join(', ')}</li>`;
        } else {
          debugInfo += `<li>${file.name}</li>`;
        }
      });
      
      debugInfo += `</ul>`;
    } else {
      debugInfo += `<p style="color: red;">Frontend path no existe: ${frontendPath}</p>`;
    }
    
    debugInfo += `<h3>Test Links:</h3>`;
    debugInfo += `<p><a href="/assets/css/styles.css" target="_blank">CSS</a> | `;
    debugInfo += `<a href="/assets/js/config.js" target="_blank">Config JS</a> | `;
    debugInfo += `<a href="/assets/js/main.js" target="_blank">Main JS</a></p>`;
    
  } catch (error) {
    debugInfo += `<p style="color: red;">Error: ${error.message}</p>`;
  }
  
  res.send(debugInfo);
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('Error del servidor:', err);
  res.status(500).json({
    error: true,
    message: 'Error interno del servidor',
    timestamp: new Date().toISOString()
  });
});

// IMPORTANTE: Catch-all route DEBE ir al final
// Solo debe manejar navegación SPA, no archivos estáticos
app.get('*', (req, res) => {
  const indexPath = path.join(frontendPath, 'index.html');
  
  // No servir index.html para requests de archivos
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    return res.status(404).send('Archivo no encontrado');
  }
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send(`
      <h1>Lapa Casa Hostel - Frontend no encontrado</h1>
      <p>index.html no existe en: ${indexPath}</p>
      <p><a href="/debug">Ver información de debug</a></p>
    `);
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🏠 Lapa Casa Hostel Frontend`);
  console.log(`🌐 Puerto: ${PORT}`);
  console.log(`📁 Archivos: ${frontendPath}`);
  console.log(`🚀 Estado: Funcionando`);
  console.log(`🔧 Debug: ${process.env.NODE_ENV === 'development' ? '/debug' : 'Deshabilitado'}`);
});

// Manejo graceful de shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Cerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Cerrando servidor...');
  process.exit(0);
});
