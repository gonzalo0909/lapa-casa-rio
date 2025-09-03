const express = require('express');
const path = require('path');
const fs = require('fs');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3001;

// Rutas EXACTAS para frontend/src
const frontendSrcPath = path.join(__dirname, 'frontend', 'src');
const indexHtmlPath = path.join(frontendSrcPath, 'index.html');

console.log(`Sirviendo desde: ${frontendSrcPath}`);

// Middlewares
app.use(compression());
app.use(express.json());

// Headers CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// CRÍTICO: Servir archivos estáticos ANTES de las APIs
// Esto debe ir ANTES de cualquier ruta que pueda interceptar
app.use(express.static(frontendSrcPath, {
  dotfiles: 'deny',
  index: false, // No auto-servir index.html aquí
  setHeaders: (res, path) => {
    // Headers específicos por tipo de archivo
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
}));

// Servir assets específicamente
app.use('/assets', express.static(path.join(frontendSrcPath, 'assets'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
}));

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
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/admin/*', (req, res) => {
  res.json({ message: 'Admin simulado', data: [] });
});

// Service Worker
app.get('/sw.js', (req, res) => {
  const swPath = path.join(frontendSrcPath, 'sw.js');
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache');
  if (fs.existsSync(swPath)) {
    res.sendFile(swPath);
  } else {
    res.status(404).send('// Service Worker no encontrado');
  }
});

// Debug route para verificar archivos
app.get('/debug', (req, res) => {
  const files = fs.readdirSync(frontendSrcPath, { withFileTypes: true });
  const structure = files.map(file => {
    if (file.isDirectory()) {
      const subFiles = fs.readdirSync(path.join(frontendSrcPath, file.name));
      return `${file.name}/: ${subFiles.join(', ')}`;
    }
    return file.name;
  });
  
  res.send(`
    <h3>Archivos en ${frontendSrcPath}:</h3>
    <pre>${structure.join('\n')}</pre>
    <h3>Test links:</h3>
    <a href="/assets/css/styles.css">CSS</a> | 
    <a href="/assets/js/main.js">Main JS</a> | 
    <a href="/assets/js/config.js">Config JS</a>
  `);
});

// IMPORTANTE: Catch-all debe ir AL FINAL
// Solo servir index.html para rutas que no son archivos
app.get('*', (req, res) => {
  // No servir index.html para requests de archivos
  if (req.path.includes('.js') || req.path.includes('.css') || 
      req.path.includes('.png') || req.path.includes('.jpg') || 
      req.path.includes('.ico')) {
    return res.status(404).send('Archivo no encontrado');
  }
  
  if (fs.existsSync(indexHtmlPath)) {
    res.sendFile(indexHtmlPath);
  } else {
    res.status(404).send('Frontend no encontrado');
  }
});

app.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT}`);
  console.log(`Frontend: ${frontendSrcPath}`);
  console.log(`Debug: /debug`);
});
