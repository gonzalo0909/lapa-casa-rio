"use strict";

/**
 * server.js
 * Backend principal del Channel Manager - Lapa Casa Hostel
 */

const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config({ path: path.join(__dirname, ".env") });

/* ================== APP & PORT ================== */
const app = express();
const PORT = process.env.PORT || 3000;

/* Para rate limit y proxies */
app.set("trust proxy", 1);

/* ================== VALIDACIÓN DE ADMIN_TOKEN ================== */
if (!process.env.ADMIN_TOKEN) {
  console.error("FATAL: Falta ADMIN_TOKEN en .env — No se puede iniciar el servidor");
  process.exit(1);
}

/* ================== AUTENTICACIÓN ADMIN ================== */
function requireAdmin(req, res, next) {
  const authHeader = (req.headers.authorization || "").trim();
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  next();
}

/* ================== WEBHOOKS (Stripe RAW primero) ================== */
const { stripeWebhook, mpWebhook } = require("./api/routes/payments");

app.post("/api/payments/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhook);
app.get("/api/payments/mp/webhook", mpWebhook);
app.post("/api/payments/mp/webhook", express.json(), mpWebhook);

/* ================== SEGURIDAD ================== */
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
}));

/* ================== CORS ================== */
const ALLOWED_ORIGINS = (process.env.CORS_ALLOW_ORIGINS || "")
  .split(",")
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    return ALLOWED_ORIGINS.some(domain => host === domain || host.endsWith("." + domain));
  } catch {
    return false;
  }
}

app.use(cors({ origin: (origin, cb) => cb(null, isAllowedOrigin(origin)), credentials: true }));

/* ================== BODY PARSER ================== */
app.use(express.json({ limit: "1mb" }));

/* ================== HEALTH & PING ================== */
app.get("/api/ping", (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.get("/api/health", (_, res) => res.json({ ok: true }));

/* ================== RATE LIMITING ================== */
const adminLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });

/* ================== RUTAS API ================== */
app.use("/api/availability", require("./api/routes/availability"));
app.use("/api/payments", require("./api/routes/payments").router);
app.use("/api/holds", require("./api/routes/holds").router);
app.use("/api/bookings", adminLimiter, requireAdmin, require("./api/routes/bookings"));

/* ================== SERVIDOR ESTÁTICO ================== */
const FRONTEND_DIR = path.join(__dirname, "frontend");
app.use(express.static(FRONTEND_DIR));

app.get("/", (_, res) => res.sendFile(path.join(FRONTEND_DIR, "index.html")));
app.get("/book", (_, res) => res.sendFile(path.join(FRONTEND_DIR, "index.html")));

/* ================== 404 & ERRORES ================== */
app.use((_, res) => res.status(404).json({ ok: false, error: "not_found" }));
app.use((err, _, res, __) => {
  console.error("Error no manejado:", err);
  res.status(500).json({ ok: false, error: "internal_error" });
});

/* ================== INICIO DEL SERVIDOR ================== */
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});

module.exports = app;
