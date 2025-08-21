const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/ping', (_req, res) => res.json({ ok: true }));

app.use('/api/payments', require('./routes/payments'));

const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_DIR));
app.get(['/book', '/'], (_req, res) =>
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'))
);

app.listen(PORT, () => console.log(`Server :${PORT}`));
