const express = require('express');
const router = express.Router();

// Crear hold
router.post('/start', async (req, res) => {
  const { holdId } = req.body || {};
  res.json({ ok:true, holdId: holdId || `HLD-${Date.now()}` });
});

// Liberar hold
router.post('/release', async (req, res) => {
  res.json({ ok:true });
});

// Confirmar hold
router.post('/confirm', async (req, res) => {
  res.json({ ok:true });
});

module.exports = router;
