"use strict";

/**
 * services/metrics.js
 * Prometheus metrics: default + HTTP duration + request count
 */

const client = require("prom-client");

const registerMetrics = new client.Registry();
client.collectDefaultMetrics({ register: registerMetrics });

const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.05, 0.1, 0.3, 1.5, 5, 10]
});
registerMetrics.registerMetric(httpRequestDuration);

const httpRequestCount = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"]
});
registerMetrics.registerMetric(httpRequestCount);

function metricsMiddleware(req, res, next) {
  const end = httpRequestDuration.startTimer();
  res.on("finish", () => {
    const labels = {
      method: req.method,
      route: req.route?.path || req.originalUrl || "unknown",
      status_code: res.statusCode
    };
    end(labels);
    httpRequestCount.inc(labels);
  });
  next();
}

module.exports = { registerMetrics, metricsMiddleware };
