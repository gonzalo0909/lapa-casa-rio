const express = require('express');
const path = require('path');
const fs = require('fs');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3001;

// PATHS EXACTOS basados en tu estructura real
const frontendSrcPath = path.join(__dirname, 'frontend', 'src');

console.log(`Servidor iniciando...`);
console.log(`Frontend path: ${frontendSrcPath}`);

// ORDEN CRÍTICO DE MIDDLEWARES

// 1. MIDDLEWARES BÁSICOS PRIMERO
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. CORS Y HEADERS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// 3. LOGGING PARA DEBUG
app.use((req, res, next) => {
  if (req.path.includes('.js') || req.path.includes('.css')) {
    console.log(`Request: ${req.method} ${req.path}`);
  }
  next();
});

// 4. STATIC FILES MIDDLEWARE - DEBE IR ANTES DE APIS
// Configuración específica para tu estructura: js/ fuera de assets/
app.use('/assets/js', express.static(path.join(frontendSrcPath, 'js'), {
  setHeaders: (res, filePath) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache'); // Para desarrollo
    console.log(`Serving JS: ${filePath}`);
  }
}));

// CSS dentro de assets/
app.use('/assets/css', express.static(path.join(frontendSrcPath, 'assets', 'css'), {
  setHeaders: (res, filePath) => {
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    console.log(`Serving CSS: ${filePath}`);
  }
}));

// Otros archivos estáticos
app.use(express.static(frontendSrcPath, {
  index: false, // No auto-servir index.html aquí
  setHeaders: (res, filePath) => {
    res.setHeader('Cache-Control', 'no-cache');
  }
}));

// 5. APIS DESPUÉS DE STATIC FILES
app.post('/api/availability', (req, res) => {
  console.log('API: availability check');
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
  console.log('API: booking creation');
  res.json({
    id: `BK${Date.now()}`,
    status: 'confirmed',
    message: 'Booking simulado'
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
  const token = req.headers['x-admin-token'];
  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }
  res.json({ message: 'Admin simulado', data: [] });
});

// 6. RUTAS ESPECIALES
app.get('/sw.js', (req, res) => {
  const swPath = path.join(frontendSrcPath, 'sw.js');
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache');
  
  if (fs.existsSync(swPath)) {
    res.sendFile(swPath);
  } else {
    res.send('// SW not found');
  }
});

// DEBUG ROUTE
app.get('/debug-files', (req, res) => {
  let html = '<h2>Debug - File Structure</h2>';
  html += `<p>Frontend path: ${frontendSrcPath}</p>`;
  
  try {
    // Verificar estructura
    const jsPath = path.join(frontendSrcPath, 'js');
    const assetsPath = path.join(frontendSrcPath, 'assets');
    
    html += `<h3>JS folder (${jsPath}):</h3>`;
    if (fs.existsSync(jsPath)) {
      const jsFiles = fs.readdirSync(jsPath, { withFileTypes: true });
      html += '<ul>';
      jsFiles.forEach(file => {
        if (file.isDirectory()) {
          const subFiles = fs.readdirSync(path.join(jsPath, file.name));
          html += `<li><strong>${file.name}/</strong>: ${subFiles.join(', ')}</li>`;
        } else {
          html += `<li>${file.name}</li>`;
        }
      });
      html += '</ul>';
    } else {
      html += '<p style="color:red;">JS folder not found</p>';
    }
    
    html += `<h3>Assets folder (${assetsPath}):</h3>`;
    if (fs.existsSync(assetsPath)) {
      const assetFiles = fs.readdirSync(assetsPath, { withFileTypes: true });
      html += '<ul>';
      assetFiles.forEach(file => {
        if (file.isDirectory()) {
          const subFiles = fs.readdirSync(path.join(assetsPath, file.name));
          html += `<li><strong>${file.name}/</strong>: ${subFiles.join(', ')}</li>`;
        } else {
          html += `<li>${file.name}</li>`;
        }
      });
      html += '</ul>';
    } else {
      html += '<p style="color:red;">Assets folder not found</p>';
    }
    
    html += '<h3>Test Direct Links:</h3>';
    html += '<ul>';
    html += '<li><a href="/assets/js/config.js" target="_blank">/assets/js/config.js</a></li>';
    html += '<li><a href="/assets/js/main.js" target="_blank">/assets/js/main.js</a></li>';
    html += '<li><a href="/assets/css/styles.css" target="_blank">/assets/css/styles.css</a></li>';
    html += '</ul>';
    
  } catch (error) {
    html += `<p style="color:red;">Error: ${error.message}</p>`;
  }
  
  res.send(html);
});

// 7. CATCH-ALL ROUTE - DEBE IR AL FINAL
app.get('*', (req, res) => {
  // NO interceptar peticiones de archivos
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|map)$/)) {
    console.log(`File not found: ${req.path}`);
    return res.status(404).send(`File not found: ${req.path}`);
  }
  
  // Servir index.html solo para páginas
  const indexPath = path.join(frontendSrcPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    console.log(`Serving index.html for: ${req.path}`);
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend not found');
  }
});

// ERROR HANDLER
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// START SERVER
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Serving frontend from: ${frontendSrcPath}`);
  console.log(`Debug available at: /debug-files`);
  
  // Verificar archivos críticos al inicio
  const criticalFiles = [
    path.join(frontendSrcPath, 'index.html'),
    path.join(frontendSrcPath, 'js', 'config.js'),
    path.join(frontendSrcPath, 'js', 'main.js')
  ];
  
  criticalFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`✓ Found: ${path.basename(file)}`);
    } else {
      console.log(`✗ Missing: ${file}`);
    }
  });
});
