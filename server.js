const express = require('express');
const path = require('path');
const fs = require('fs');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3001;

// PATHS CORRECTOS para tu estructura real
const frontendSrcPath = path.join(__dirname, 'frontend', 'src');

console.log(`Servidor iniciando...`);
console.log(`Frontend path: ${frontendSrcPath}`);

// Middlewares básicos
app.use(compression());
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// STATIC FILES - CONFIGURACIÓN CORRECTA
app.use(express.static(frontendSrcPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    }
    res.setHeader('Cache-Control', 'no-cache');
  }
}));

// APIs
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
  }, 500);
});

app.post('/api/bookings', (req, res) => {
  res.json({
    id: `BK${Date.now()}`,
    status: 'confirmed'
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
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/admin/*', (req, res) => {
  const token = req.headers['x-admin-token'];
  if (!token) return res.status(401).json({ error: 'Token required' });
  res.json({ message: 'Admin simulado', data: [] });
});

// Service Worker
app.get('/sw.js', (req, res) => {
  const swPath = path.join(frontendSrcPath, 'sw.js');
  res.setHeader('Content-Type', 'application/javascript');
  if (fs.existsSync(swPath)) {
    res.sendFile(swPath);
  } else {
    res.send('// SW not found');
  }
});

// Catch-all
app.get('*', (req, res) => {
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
    return res.status(404).send('File not found');
  }
  
  const indexPath = path.join(frontendSrcPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend not found');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Verificar archivos críticos
  const criticalFiles = [
    path.join(frontendSrcPath, 'index.html'),
    path.join(frontendSrcPath, 'assets', 'js', 'config.js'),
    path.join(frontendSrcPath, 'assets', 'js', 'main.js')
  ];
  
  criticalFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`✓ Found: ${path.basename(file)}`);
    } else {
      console.log(`✗ Missing: ${file}`);
    }
  });
});
