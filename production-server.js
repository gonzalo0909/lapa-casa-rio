"use strict";

/**
 * production-server.js
 * Entry optimizado para producción en Render/Hostinger
 */

const express = require("express");
const compression = require("compression");
const helmet = require("helmet");
const cors = require("cors");
const path = require("path");

const { registerMetrics, metricsMiddleware } = require("./api/services/metrics");
const { requestLogger } = require("./api/services/logger");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(helmet());
app.use(cors({
  origin: [
    "https://lapacasahostel.com",
    "https://www.lapacasahostel.com"
  ]
}));
app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use(requestLogger);

// Rutas API
app.use("/api/availability", require("./api/routes/availability"));
app.use("/api/bookings", require("./api/routes/bookings"));
app.use("/api/holds", require("./api/routes/holds").router);
app.use("/api/payments", require("./api/routes/payments").router);

// Métricas y health
app.get("/api/metrics", metricsMiddleware, async (req, res) => {
  res.set("Content-Type", registerMetrics.contentType);
  res.end(await registerMetrics.metrics());
});
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Frontend estático
const frontendSrcPath = path.join(__dirname, "frontend", "src");
app.use(express.static(frontendSrcPath));

// Catch-all
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendSrcPath, "index.html"));
});

app.listen(PORT, () => console.log(`🚀 Prod server on port ${PORT}`));
