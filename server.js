const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const metrics = require("./api/services/metrics");
const logger = require("./api/services/logger");

const app = express();

// ✅ Configuración CORS actualizada para Stripe
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Stripe-Signature" // agregado para compatibilidad con Stripe
    ],
  })
);

// Middlewares globales
app.use(bodyParser.json());
app.use(metrics.middleware);

// Rutas principales
app.use("/api", require("./api"));

// Fallback
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

module.exports = app;
