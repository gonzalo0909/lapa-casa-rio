"use strict";

/**
 * services/metrics.js
 * Exposición de métricas Prometheus
 */

const client = require("prom-client");

const registerMetrics = new client.Registry();
client.collectDefaultMetrics({ register: registerMetrics });

const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duración de requests HTTP en segundos",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.1, 0.3, 1.5, 5, 10]
});
registerMetrics.registerMetric(httpRequestDuration);

function metricsMiddleware(req, res, next) {
  const end = httpRequestDuration.startTimer();
  res.on("finish", () => {
    end({ method: req.method, route: req.originalUrl, status_code: res.statusCode });
  });
  next();
}

module.exports = { registerMetrics, metricsMiddleware };
