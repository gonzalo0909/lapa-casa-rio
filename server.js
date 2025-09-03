const express = require('express');
const path = require('path');
const fs = require('fs');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3001;

// Detectar donde está realmente index.html
function findIndexHtml() {
  const possiblePaths = [
    path.join(__dirname, 'index.html'),           // Raíz
    path.join(__dirname, 'src', 'index.html'),   // En src/
    path.join(process.cwd(), 'index.html'),      // Working directory
    path.join(process.cwd(), 'src', 'index.html') // Working directory + src
  ];
  
  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      console.log(`index.html encontrado en: ${filePath}`);
      return filePath;
    }
  }
  
  console.error('index.html no encontrado en ninguna ubicación');
  return null;
}

// Detectar carpeta de assets
function findAssetsDir() {
  const possiblePaths = [
    path.join(__dirname, 'assets'),
    path.join(__dirname, 'src', 'assets'),
    path.join(process.cwd(), 'assets'),
    path.join(process.cwd(), 'src', 'assets')
  ];
  
  for (const dirPath of possiblePaths) {
    if (fs.existsSync(dirPath)) {
      console.log(`Assets encontrados en: ${dirPath}`);
      return dirPath;
    }
  }
  
  console.log('Carpeta assets no encontrada');
  return null;
}

const indexHtmlPath = findIndexHtml();
const assetsPath = findAssetsDir();

// Middlewares
app.use(compression());
app.use(express.json());

// Headers de seguridad
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Servir assets si existe
if (assetsPath) {
  app.use('/assets', express.static(assetsPath));
}

// Servir archivos estáticos desde donde sea que estén
app.use(express.static(__dirname));
app.use(express.static(process.cwd()));

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
    indexFound: !!indexHtmlPath,
    assetsFound: !!assetsPath,
    workingDir: process.cwd(),
    __dirname: __dirname
  });
});

app.get('/api/admin/*', (req, res) => {
  res.json({ message: 'Admin simulado', data: [] });
});

// Ruta catch-all - usar el index.html encontrado
app.get('*', (req, res) => {
  if (indexHtmlPath && fs.existsSync(indexHtmlPath)) {
    res.sendFile(indexHtmlPath);
  } else {
    res.status(404).send(`
      <h1>Frontend Lapa Casa Hostel</h1>
      <p>index.html no encontrado</p>
      <p>Working directory: ${process.cwd()}</p>
      <p>__dirname: ${__dirname}</p>
      <p>Archivos en directorio actual:</p>
      <pre>${fs.readdirSync(process.cwd()).join('\n')}</pre>
    `);
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log(`Working directory: ${process.cwd()}`);
  console.log(`__dirname: ${__dirname}`);
  console.log(`Index HTML: ${indexHtmlPath || 'NO ENCONTRADO'}`);
  console.log(`Assets: ${assetsPath || 'NO ENCONTRADO'}`);
});
