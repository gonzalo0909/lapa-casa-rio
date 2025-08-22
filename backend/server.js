"use strict";
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const Stripe = require("stripe");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 3000;
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ---------- CORS ----------
const allow = (process.env.CORS_ALLOW_ORIGINS || "")
  .split(",").map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const host = origin.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return cb(null, allow.includes(host));
  },
  credentials: true
}));

// ---------- CSP / Seguridad ----------
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "https://js.stripe.com", "https://sdk.mercadopago.com"],
      "img-src": ["'self'", "data:"],
      "style-src": ["'self'"],
      "connect-src": ["'self'", "https://api.mercadopago.com", "https://api.stripe.com"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// ---------- Stripe Webhook (RAW) ----------
app.post("/api/payments/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const sig = req.headers["stripe-signature"];
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const bookingId = session.metadata?.bookingId;
      if (bookingId) {
        const sheets = require("./services/sheets");
        const holds  = require("./services/holdsStore");
        await sheets.updatePayment(bookingId, "approved");
        await holds.confirmHold(bookingId, "paid");
      }
    }
    if (event.type === "payment_intent.payment_failed") {
      const pi = event.data.object;
      const bookingId = pi.metadata?.bookingId;
      if (bookingId) {
        const holds = require("./services/holdsStore");
        await holds.releaseHold(bookingId);
      }
    }
    res.json({ received: true });
  } catch (e) {
    console.error("stripe webhook error", e);
    res.status(400).send(`Webhook Error: ${String(e.message || e)}`);
  }
});

// ---------- JSON parser (resto de rutas) ----------
app.use(express.json({ limit: "1mb" }));

// ---------- Ping / Health ----------
app.get("/api/ping", (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Admin guard
function adminAuth(req, res, next) {
  const tok = process.env.ADMIN_TOKEN;
  if (!tok) return res.status(501).json({ ok: false, error: "ADMIN_TOKEN_missing" });
  const h = req.headers.authorization || "";
  if (h === `Bearer ${tok}`) return next();
  return res.status(401).json({ ok: false, error: "unauthorized" });
}

// /api/admin/health
app.get("/api/admin/health", adminAuth, async (_req, res) => {
  const needEnv = ["MP_ACCESS_TOKEN", "STRIPE_SECRET_KEY", "FRONTEND_URL"];
  const envOk = needEnv.every(k => (process.env[k] || "").length > 0);

  // MP HEAD (2s timeout)
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

  // Stripe ping (balance) con timeout 2s
  const stripeReach = await Promise.race([
    stripe.balance.retrieve().then(() => true).catch(() => false),
    new Promise(resolve => setTimeout(() => resolve(false), 2000))
  ]);

  res.json({
    ok: envOk && mpReach && stripeReach,
    envOk, mpReach, stripeReach,
    time: new Date().toISOString(),
    uptime_s: Math.round(process.uptime())
  });
});

// /api/admin/stats (ligero, sin bloquear)
app.get("/api/admin/stats", adminAuth, async (_req, res) => {
  let holds = { total: 0, active: 0, paid_pending: 0 };
  try {
    const store = require("./services/holdsStore");
    holds = store.getStats ? store.getStats() : holds;
  } catch {}
  res.json({ ok: true, holds });
});

// ---------- Rutas API ----------
try { app.use("/api/availability", require("./routes/availability")); } catch {}
try { app.use("/api/holds", require("./routes/holds")); } catch {}
try { app.use("/api/bookings", require("./routes/bookings")); } catch {}
try { app.use("/api/payments", require("./routes/payments")); } catch {}

// ---------- Frontend estático ----------
const FRONTEND_DIR = path.join(__dirname, "..", "frontend");
app.use(express.static(FRONTEND_DIR));
app.get(["/", "/book"], (_req, res) => res.sendFile(path.join(FRONTEND_DIR, "index.html")));

// ---------- Listen ----------
app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
