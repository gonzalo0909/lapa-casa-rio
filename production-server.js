const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

// Servicios/utilidades
const metrics = require("./api/services/metrics");
const logger = require("./api/services/logger");

// Rutas
const apiRouter = require("./api");
const icalRouter = require("./api/routes/ical");

const app = express();

// CORS (config estándar; no depende de Stripe)
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Middlewares globales
app.use(bodyParser.json());
app.use(metrics.middleware);

// Rutas principales
app.use("/api/ical", icalRouter);   // ✅ siempre expone /api/ical
app.use("/api", apiRouter);

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  logger.info(`Production server running on port ${PORT}`);
});

module.exports = app;
