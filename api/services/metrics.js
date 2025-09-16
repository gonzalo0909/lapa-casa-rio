// Metrics service (Prometheus) — normalized routes (no query string, low cardinality)
const client = require("prom-client");

// Collect default process/node metrics
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ register: client.register, prefix: "lch_" });

// Buckets ~0.5ms … 6s
const httpRequestDuration = new client.Histogram({
  name: "lch_http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.0005, 0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 3, 6],
});

const httpRequestsTotal = new client.Counter({
  name: "lch_http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

/**
 * Derive a normalized route pattern (no query string, no raw originalUrl).
 * Prefer Express' route path (with params like :id), then pathname.
 */
function getRoutePattern(req) {
  // If mounted router matched (lowest-cardinality)
  if (req.route && req.route.path) {
    const base = req.baseUrl || "";
    return `${base}${req.route.path}`;
  }

  // Fallbacks without querystring
  if (req._parsedUrl && req._parsedUrl.pathname) {
    return req._parsedUrl.pathname;
  }

  if (typeof req.path === "string") return req.path;

  if (typeof req.originalUrl === "string") {
    const idx = req.originalUrl.indexOf("?");
    return idx >= 0 ? req.originalUrl.slice(0, idx) : req.originalUrl;
  }

  return "unknown";
}

function middleware(req, res, next) {
  const start = process.hrtime.bigint();

  // Finish event to ensure labels are correct after route is resolved
  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const durationSeconds = Number(end - start) / 1e9;

    const labels = {
      method: (req.method || "GET").toUpperCase(),
      route: getRoutePattern(req),
      status_code: String(res.statusCode || 200),
    };

    httpRequestDuration.observe(labels, durationSeconds);
    httpRequestsTotal.inc(labels, 1);
  });

  next();
}

async function metricsHandler(_req, res) {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
}

module.exports = {
  middleware,
  metricsHandler,
  register: client.register,
};
