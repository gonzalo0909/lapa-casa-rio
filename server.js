/**
 * server.js
 * Backend principal del Channel Manager - Lapa Casa Hostel
 * Gestiona disponibilidad, holds, pagos y admin
 */

"use strict";

const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config({ path: path.join(__dirname, ".env") });

/* ================== APP & PORT ================== */
const app = express();
const PORT = process.env.PORT || 3000;

/* ================== AUTENTICACIÓN ADMIN ================== */
function requireAdmin(req, res, next) {
  const authHeader = (req.headers.authorization || "").trim();
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  next();
}

/* ================== WEBHOOK STRIPE (RAW) ================== */
const { stripeWebhook, mpWebhook } = require("./api/routes/payments");
app.post(
  "/api/payments/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook
);

app.post("/api/payments/mp/webhook", mpWebhook);

/* ================== SEGURIDAD ================== */
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  })
);

/* ================== CORS ================== */
const ALLOWED_ORIGINS = String(process.env.CORS_ALLOW_ORIGINS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    const full = url.host.toLowerCase();
    return ALLOWED_ORIGINS.some((domain) => {
      const domainHost = domain.split(":")[0];
      return (
        host === domainHost ||
        host.endsWith("." + domainHost) ||
        full === domain ||
        full.endsWith("." + domain)
      );
    });
  } catch {
    const cleanOrigin = origin.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase();
    const hostNoPort = cleanOrigin.split(":")[0];
    return ALLOWED_ORIGINS.some(
      (domain) => cleanOrigin === domain || hostNoPort === domain || cleanOrigin.endsWith("." + domain)
    );
  }
}

app.use(
  cors({
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
    credentials: true,
  })
);

/* ================== BODY PARSER ================== */
app.use(express.json({ limit: "1mb" }));

/* ================== HEALTH & PING ================== */
app.get("/api/ping", (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.get("/api/health", (_, res) => {
  res.json({
    ok: true,
    env: {
      FRONTEND_URL: !!process.env.FRONTEND_URL,
      STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: !!process.env.STRIPE_WEBHOOK_SECRET,
      BOOKINGS_WEBAPP_URL: !!process.env.BOOKINGS_WEBAPP_URL,
      CORS_ALLOW_ORIGINS: ALLOWED_ORIGINS,
      ADMIN_TOKEN: !!process.env.ADMIN_TOKEN,
    },
  });
});

/* ================== RATE LIMITING ================== */
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
});

/* ================== RUTAS API ================== */
app.use("/api/availability", require("./api/routes/availability"));
app.use("/api/payments", require("./api/routes/payments").router);
app.use("/api/holds", require("./api/routes/holds").router);

// Rutas protegidas
app.get("/api/holds/list", adminLimiter, requireAdmin, require("./api/routes/holds").list);
app.post("/api/holds/confirm", adminLimiter, requireAdmin, require("./api/routes/holds").confirm);
app.post("/api/holds/release", adminLimiter, requireAdmin, require("./api/routes/holds").release);
app.use("/api/bookings", adminLimiter, requireAdmin, require("./api/routes/bookings"));

/* ================== SERVIDOR ESTÁTICO ================== */
const FRONTEND_DIR = path.join(__dirname, "frontend");
app.use(express.static(FRONTEND_DIR));

// Rutas públicas
app.get("/", (_, res) => res.sendFile(path.join(FRONTEND_DIR, "index.html")));
app.get("/book", (_, res) => res.sendFile(path.join(FRONTEND_DIR, "index.html")));

// Admin (noindex)
app.get("/admin", (_, res) => {
  res.set("X-Robots-Tag", "noindex, nofollow");
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

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
