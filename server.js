"use strict";

/**
 * server.js
 * Seguridad, CORS, rate-limit, logs, métricas y webhooks (Stripe RAW)
 */

const express = require("express");
const path = require("path");
const fs = require("fs");
const compression = require("compression");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const morgan = require("morgan");

const { registerMetrics, metricsMiddleware } = require("./api/services/metrics");
const { requestLogger } = require("./api/services/logger");
const payments = require("./api/routes/payments");

const app = express();
const PORT = process.env.PORT || 3001;

// Seguridad
app.use(helmet());
app.use(cors({
  origin: ["https://lapacasahostel.com", "https://www.lapacasahostel.com"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-admin-token"]
}));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false }));

// Logs
app.use(morgan("tiny"));
app.use(requestLogger);

// Stripe webhook requiere RAW antes de json()
app.post("/api/payments/stripe/webhook", express.raw({ type: "application/json" }), payments.stripeWebhook);
// MP webhook con JSON
app.post("/api/payments/mp/webhook", express.json({ limit: "2mb" }), payments.mpWebhook);

// Resto middlewares
app.use(compression());
app.use(express.json({ limit: "2mb" }));

// Rutas API
app.use("/api/availability", require("./api/routes/availability"));
app.use("/api/bookings", require("./api/routes/bookings"));
app.use("/api/holds", require("./api/routes/holds").router);
app.use("/api/payments", payments.router);
app.use("/api/ical", require("./api/routes/ical"));

// Métricas / Health
app.get("/api/metrics", metricsMiddleware, async (_req, res) => {
  res.set("Content-Type", registerMetrics.contentType);
  res.end(await registerMetrics.metrics());
});
app.get("/api/health", (_req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));

// Admin protegido
app.get("/api/admin/*", (req, res) => {
  const token = req.headers["x-admin-token"];
  if (!token || token !== process.env.ADMIN_TOKEN) return res.status(401).json({ error: "unauthorized" });
  res.json({ ok: true });
});

// Frontend estático
const frontendSrcPath = path.join(__dirname, "frontend", "src");
app.use(express.static(frontendSrcPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".js")) res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    else if (filePath.endsWith(".css")) res.setHeader("Content-Type", "text/css; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
  }
}));

// Service Worker
app.get("/sw.js", (_req, res) => {
  const p = path.join(frontendSrcPath, "sw.js");
  res.setHeader("Content-Type", "application/javascript");
  fs.existsSync(p) ? res.sendFile(p) : res.send("// SW not found");
});

// Catch-all
app.get("*", (req, res) => {
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) return res.status(404).send("File not found");
  const indexPath = path.join(frontendSrcPath, "index.html");
  fs.existsSync(indexPath) ? res.sendFile(indexPath) : res.status(404).send("Frontend not found");
});

app.listen(PORT, () => {
  console.log(`🚀 Server on ${PORT}`);
  console.log(`Frontend path: ${frontendSrcPath}`);
});
