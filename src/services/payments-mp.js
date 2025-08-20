"use strict";

function buildMpWebhookHandler({ notifySheets, isDuplicate, log }) {
  return (req, res) => {
    try {
      log("MP webhook recibido", { body: req.body });
      notifySheets && notifySheets({ src: "mp", ts: Date.now(), raw: true });
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ ok: false, error: String(e.message || e) });
    }
  };
}

async function createPreference(order, { baseUrl }) {
  // En real: crear preferencia con SDK de MP.
  // Para demo devolvemos un "init_point" que te lleva a una página de pago-aprobado de prueba.
  return { init_point: `${baseUrl || ""}/pago-exitoso-test` };
}

module.exports = { buildMpWebhookHandler, createPreference };
