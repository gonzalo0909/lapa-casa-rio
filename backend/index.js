"use strict";

const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const app = express();
const PORT = process.env.PORT || 3000;

/* ===== CORS ===== */
const ALLOW = String(process.env.CORS_ALLOW_ORIGINS || "")
  .split(",").map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    try {
      const host = origin.replace(/^https?:\/\//, "").replace(/\/$/, "");
      cb(null, ALLOW.includes(host));
    } catch { cb(null, false); }
  },
  credentials: true
}));

/* ===== Seguridad / límites ===== */
app.use(helmet({ contentSecurityPolicy: false }));
app.set("trust proxy", true);
app.use(rateLimit({ windowMs: 60_000, max: 200 }));

/* ===== Stripe webhook RAW ANTES de json() ===== */
const { stripeWebhook, mpWebhook, router: paymentsRouter } = require("./routes/payments");
app.post("/api/payments/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook
);

/* ===== JSON body ===== */
app.use(express.json({ limit: "1mb" }));

/* ===== Webhook Mercado Pago ===== */
app.post("/api/payments/mercadopago/webhook", mpWebhook);

/* ===== Ping / Health ===== */
app.get("/api/ping", (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.use("/api/health", require("./routes/health"));

/* ===== Rutas API ===== */
app.use("/api/availability", require("./routes/availability"));
app.use("/api/holds", require("./routes/holds"));
app.use("/api/bookings", require("./routes/bookings"));
app.use("/api/payments", paymentsRouter);

/* ===== Frontend estático ===== */
const FRONTEND_DIR = path.join(__dirname, "..", "public");
app.use(express.static(FRONTEND_DIR));
app.get(["/", "/book", "/admin"], (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

/* ===== 404 / errores ===== */
app.use((req, res) => res.status(404).json({ ok: false, error: "not_found" }));
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ ok: false, error: "internal_error" });
});

app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
