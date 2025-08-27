"use strict";

const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 3000;

// === Autenticación para admin ===
function requireAdmin(req, res, next) {
  const auth = (req.headers.authorization || "").trim();
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  next();
}

// === Webhook de Stripe ===
const { stripeWebhook } = require("./api/routes/payments");
app.post("/api/payments/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhook);

// === Seguridad ===
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// === CORS ===
const ALLOWED = String(process.env.CORS_ALLOW_ORIGINS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const originLower = origin.toLowerCase();
      const isAllowed = ALLOWED.some(
        (domain) => originLower === domain || originLower.endsWith(`.${domain}`)
      );
      cb(null, isAllowed);
    },
  })
);

// === Body parser ===
app.use(express.json({ limit: "1mb" }));

// === Rutas API (primero, antes del frontend) ===
app.use("/api/availability", require("./api/routes/availability"));
app.use("/api/payments", require("./api/routes/payments").router);
app.use("/api/holds", require("./api/routes/holds").router);

// Rutas protegidas
app.get("/api/holds/list", rateLimit({ windowMs: 60_000, max: 60 }), requireAdmin, require("./api/routes/holds").list);
app.post("/api/holds/confirm", rateLimit({ windowMs: 60_000, max: 60 }), requireAdmin, require("./api/routes/holds").confirm);
app.post("/api/holds/release", rateLimit({ windowMs: 60_000, max: 60 }), requireAdmin, require("./api/routes/holds").release);
app.use("/api/bookings", rateLimit({ windowMs: 60_000, max: 60 }), requireAdmin, require("./api/routes/bookings"));

// === Servidor estático (solo después de API) ===
const FRONTEND_DIR = path.join(__dirname, "frontend");
app.use(express.static(FRONTEND_DIR));

app.get("/", (_, res) => res.sendFile(path.join(FRONTEND_DIR, "index.html")));
app.get("/book", (_, res) => res.sendFile(path.join(FRONTEND_DIR, "index.html")));
app.get("/admin", (_, res) => {
  res.set("X-Robots-Tag", "noindex, nofollow");
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

// === 404 ===
app.use((_, res) => res.status(404).json({ ok: false, error: "not_found" }));

// === Manejo de errores ===
app.use((err, _, res, __) => {
  console.error("Error:", err);
  res.status(500).json({ ok: false, error: "internal_error" });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
