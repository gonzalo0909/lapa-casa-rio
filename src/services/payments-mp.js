"use strict";

function buildMpWebhookHandler({ notifySheets, isDuplicate, log }) {
  return (req, res) => {
    log("MP webhook recibido");
    res.json({ ok: true });
  };
}

async function createPreference(order, { baseUrl }) {
  return { prefId: "fake_mp_pref", baseUrl };
}

module.exports = { buildMpWebhookHandler, createPreference };
