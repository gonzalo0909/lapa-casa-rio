"use strict";
const express = require("express");
const router = express.Router();
const Stripe = require("stripe");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY || "");

function adminAuth(req, res, next) {
  const tok = process.env.ADMIN_TOKEN;
  if (!tok) return res.status(501).json({ ok: false, error: "ADMIN_TOKEN_missing" });
  const h = req.headers.authorization || "";
  if (h === `Bearer ${tok}`) return next();
  return res.status(401).json({ ok: false, error: "unauthorized" });
}

// Público: chequeo liviano
router.get("/health", async (_req, res) => {
  const needEnv = ["FRONTEND_URL"];
  const envOk = needEnv.every(k => (process.env[k] || "").length > 0);
  res.json({ ok: envOk, envOk, time: new Date().toISOString() });
});

// Admin: chequeo profundo + stats
router.get("/admin/health", adminAuth, async (_req, res) => {
  const needEnv = ["MP_ACCESS_TOKEN", "STRIPE_SECRET_KEY", "FRONTEND_URL"];
  const envOk = needEnv.every(k => (process.env[k] || "").length > 0);

  const mpReach = await (async () => {
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 2000);
      const r = await fetch("https://api.mercadopago.com", {
        method: "HEAD",
        headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN || ""}` },
        signal: ctrl.signal
      });
      clearTimeout(t);
      return r.ok;
    } catch { return false; }
  })();

  const stripeReach = await Promise.race([
    stripe.balance.retrieve().then(() => true).catch(() => false),
    new Promise(resolve => setTimeout(() => resolve(false), 2000))
  ]);

  let holds = { total: 0, active: 0, paid_pending: 0 };
  try {
    const store = require("../services/holdsStore");
    holds = store.getStats ? store.getStats() : holds;
  } catch {}

  res.json({
    ok: envOk && mpReach && stripeReach,
    envOk, mpReach, stripeReach, holds,
    time: new Date().toISOString(),
    uptime_s: Math.round(process.uptime())
  });
});

module.exports = router;
