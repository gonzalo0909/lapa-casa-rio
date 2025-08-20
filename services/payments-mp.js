"use strict";

// Crea preferencia "mock": redirige a /pago-exitoso-test
module.exports.createPreference = async (order, { baseUrl } = {}) => {
  const url = (baseUrl || "") + "/pago-exitoso-test";
  return { init_point: url };
};

// Webhook de MP (demo)
module.exports.buildMpWebhookHandler = ({ notifySheets, isDuplicate, log } = {}) => {
  return async (req, res) => {
    try {
      const id = "mp:" + String(req.body?.id || Date.now());
      if (isDuplicate && isDuplicate(id)) return res.json({ ok: true, deduped: true });
      if (notifySheets) await notifySheets({ provider: "mp", raw: req.body });
      res.json({ ok: true });
    } catch (e) {
      log && log("webhook error", e);
      res.status(400).json({ ok: false, error: String(e.message || e) });
    }
  };
};
