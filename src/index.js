"use strict";
/**
 * Lapa Casa — Backend Express
 * - API bajo BACKEND_BASE (por defecto /api)
 * - Alias legacy sin /api para compatibilidad
 * - Sirve /, /book/, /admin/, /pago-exitoso-test/
 */
require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieSession = require("cookie-session");

// === ENV
const PORT = process.env.PORT || 3000;
const COMMIT = process.env.COMMIT || "dev";
const BASE_URL = (process.env.BASE_URL || "").replace(/\/+$/, "");
const HOLD_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES || 10);
const CORS_ALLOW = String(process.env.CORS_ALLOW_ORIGINS || "")
  .split(",").map(s => s.trim()).filter(Boolean);
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "change-me";
const BACKEND_BASE = (process.env.BACKEND_BASE || "/api").replace(/\/+$/, "") || "/api";

// ==== App
const app = express();
app.set("trust proxy", 1);

// ==== Helpers
function getBaseUrl(req) {
  if (BASE_URL) return BASE_URL;
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}
function deduper(max = 1000, ttlMs = 10 * 60 * 1000) {
  const m = new Map();
  return (key) => {
    const now = Date.now();
    for (const [k, ts] of m) if (now - ts > ttlMs) m.delete(k);
    if (m.has(key)) return true;
    m.set(key, now);
    if (m.size > max) m.delete(m.keys().next().value);
    return false;
  };
}
const isDup = deduper();

// ==== CORS
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (!CORS_ALLOW.length) return cb(null, true);
      try {
        const host = new URL(origin).hostname.toLowerCase();
        const allowHosts = CORS_ALLOW.map(v => v.replace(/^https?:\/\//, "").toLowerCase());
        const ok = allowHosts.some(a => host === a || host.endsWith("." + a));
        return cb(null, ok);
      } catch {
        return cb(null, false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Stripe-Signature"],
  })
);

// ==== Security (permitimos inline JS y Stripe para que el front funcione)
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "'unsafe-inline'", "https://js.stripe.com"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:"],
        "connect-src": ["'self'", "https://api.mercadopago.com"],
        "frame-src": ["'self'", "https://js.stripe.com", "https://checkout.stripe.com"],
        "frame-ancestors": ["'self'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"]
      },
    },
  })
);

// ==== Tiny config para el front (opcional)
app.get("/config.js", (_req, res) => {
  res.type("application/javascript")
     .send(`window.BACKEND_BASE_URL=${JSON.stringify(BACKEND_BASE)};`);
});

// ==== Static first
const PUBLIC_DIR = path.join(__dirname, "..", "public");
app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));
app.get("/book", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "book", "index.html")));
app.get("/admin", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "admin", "index.html")));

// ==== Sessions
app.use(
  cookieSession({
    name: "sess",
    secret: SESSION_SECRET,
    sameSite: "lax",
    httpOnly: true,
  })
);

// ==== Stripe/MP webhooks (Stripe RAW antes del JSON parser)
const { buildStripeWebhookHandler, createCheckoutSession } = require("./services/payments-stripe");
const { buildMpWebhookHandler, createPreference } = require("./services/payments-mp");
const { notifySheets } = require("./services/sheets");

app.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  buildStripeWebhookHandler({ notifySheets, isDuplicate: isDup, log: (...a) => console.log("[stripe]", ...a) })
);
app.post(
  "/webhooks/mp",
  buildMpWebhookHandler({ notifySheets, isDuplicate: isDup, log: (...a) => console.log("[mp]", ...a) })
);

// ==== JSON parser (después del webhook RAW)
app.use(express.json());

// ==== API bajo BACKEND_BASE
const api = express.Router();
api.use("/health", require("./routes/health"));
api.use("/availability", require("./routes/availability"));
api.use("/bookings", require("./routes/bookings"));
api.use("/holds", require("./routes/holds"));
try { api.use("/events", require("./routes/events")); } catch {}
try { api.use("/crons", require("./routes/crons")); } catch {}

api.post("/payments/stripe/session", async (req, res) => {
  try {
    const orderIn = Object(req.body?.order || req.body || {});
    if (!("total" in orderIn)) throw new Error("missing_total");
    const out = await createCheckoutSession(orderIn, { baseUrl: getBaseUrl(req) });
    res.json({ ok: true, ...out });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e.message || e) });
  }
});

api.post("/payments/mp/preference", async (req, res) => {
  try {
    const b = req.body || {};
    const order = b.order
      ? b.order
      : {
          booking_id:
            b.booking_id ||
            b.external_reference ||
            (b.metadata && (b.metadata.booking_id || b.metadata.bookingId)),
          total: typeof b.total !== "undefined" ? b.total : b.unit_price,
        };
    if (!("total" in order)) throw new Error("missing_total");
    const out = await createPreference(order, { baseUrl: getBaseUrl(req) });
    res.json({ ok: true, ...out });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e.message || e) });
  }
});

api.get("/diag", (_req, res) =>
  res.json({
    ok: true,
    service: "lapa-casa-backend",
    commit: COMMIT,
    now: new Date().toISOString(),
    env: {
      BASE_URL: !!BASE_URL,
      HOLD_TTL_MINUTES,
      CORS_ALLOW_ORIGINS: CORS_ALLOW.length,
      BACKEND_BASE: BACKEND_BASE,
    },
  })
);

app.use(BACKEND_BASE, api);

// ==== ALIASES LEGACY (sin /api) — para compatibilidad con front/links viejos
const legacy = express.Router();
legacy.use("/availability", require("./routes/availability"));
legacy.use("/bookings", require("./routes/bookings"));
legacy.use("/holds", require("./routes/holds"));
legacy.post("/payments/stripe/session", async (req, res) => {
  try {
    const orderIn = Object(req.body?.order || req.body || {});
    if (!("total" in orderIn)) throw new Error("missing_total");
    const out = await createCheckoutSession(orderIn, { baseUrl: getBaseUrl(req) });
    res.json({ ok: true, ...out });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e.message || e) });
  }
});
legacy.post("/payments/mp/preference", async (req, res) => {
  try {
    const b = req.body || {};
    const order = b.order
      ? b.order
      : {
          booking_id:
            b.booking_id ||
            b.external_reference ||
            (b.metadata && (b.metadata.booking_id || b.metadata.bookingId)),
          total: typeof b.total !== "undefined" ? b.total : b.unit_price,
        };
    if (!("total" in order)) throw new Error("missing_total");
    const out = await createPreference(order, { baseUrl: getBaseUrl(req) });
    res.json({ ok: true, ...out });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e.message || e) });
  }
});
app.use("/", legacy);

// ==== 404 SPA-ish para rutas estáticas tipo /book, /admin
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  if (path.extname(req.path)) return next();
  const safe = path.join(PUBLIC_DIR, req.path, "index.html");
  res.sendFile(safe, (err) => (err ? res.status(404).send("Not found") : undefined));
});

// ==== Start
if (require.main === module) {
  app.listen(PORT, () => console.log(`[lapa-casa] up :${PORT} commit=${COMMIT} api=${BACKEND_BASE}`));
}
module.exports = app;
