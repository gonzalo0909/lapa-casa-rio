"use strict";

/**
 * Lapa Casa — Backend (Express)
 * Sirve estáticos, API de reservas/pagos/holds, agenda de eventos y webhooks.
 *
 * ENV requeridas:
 * - PORT (opcional, Render lo inyecta)
 * - BASE_URL (ej: https://lapacasahostel.com) — fallback: origen del request
 * - CORS_ALLOW_ORIGINS (coma-separado) — ej: https://lapacasahostel.com,https://www.lapacasahostel.com
 * - HOLD_TTL_MINUTES=10
 * - CRON_TOKEN (para /crons/holds-sweep)
 * - BOOKINGS_WEBHOOK_URL (Apps Script Web App)
 * - STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 * - MP_ACCESS_TOKEN
 * - ENABLE_EVENTS=1 (opcional), EVENTS_TTL_HOURS, EVENTS_FEEDS
 */

const path = require("path");
const express = require("express");
const cors = require("cors");

// ====== App ======
const app = express();

// --- CORS (lista blanca por ENV) ---
const allowList = String(process.env.CORS_ALLOW_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // same-origin / curl
      if (!allowList.length || allowList.includes(origin)) return cb(null, true);
      return cb(new Error("CORS blocked"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Stripe-Signature"],
  })
);

// --- Static files (public/) ---
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

// ====== Servicios (módulos locales) ======
const holds = require("./services/holds");
const bookingsRouter = require("./services/bookings");
const { fetchRowsFromSheet, calcOccupiedBeds, notifySheets } = require("./services/sheets");
const { createCheckoutSession, buildStripeWebhookHandler } = require("./services/payments-stripe");
const { createPreference, buildMpWebhookHandler } = require("./services/payments-mp");

// events.js puede exportar un handler (función) o un objeto con eventsHandler
let eventsModule = null;
try { eventsModule = require("./services/events"); } catch { /* opcional */ }

// ====== Helpers ======
const COMMIT = process.env.COMMIT || "dev";
const CRON_TOKEN = (process.env.CRON_TOKEN || "").trim();
const HOLD_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES || 10);

function getBaseUrl(req) {
  const envBase = (process.env.BASE_URL || "").replace(/\/+$/, "");
  if (envBase) return envBase;
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

// Deduplicador in-memory para webhooks (clave → ts). Limpieza simple por TTL/size.
function makeDeduper(max = 1000, ttlMs = 10 * 60 * 1000) {
  const m = new Map();
  return function isDuplicate(key) {
    const now = Date.now();
    // prune TTL
    for (const [k, ts] of m) {
      if (now - ts > ttlMs) m.delete(k);
    }
    if (m.has(key)) return true;
    m.set(key, now);
    // prune size
    if (m.size > max) {
      const firstKey = m.keys().next().value;
      if (firstKey) m.delete(firstKey);
    }
    return false;
  };
}
const isDup = makeDeduper();

// ====== Middlewares de body ======
// MUY IMPORTANTE: el webhook de Stripe necesita raw body antes del json parser
app.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  buildStripeWebhookHandler({
    notifySheets,
    isDuplicate: isDup,
    log: (...args) => console.log("[stripe]", ...args),
  })
);

// Webhook de MP acepta JSON común
app.use(express.json({ limit: "2mb" }));

// ====== Health / Diag ======
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "lapa-casa-backend",
    commit: COMMIT,
    now: new Date().toISOString(),
  });
});

// (opcional) diagnóstico rápido de flags/entorno sin filtrar secretos
app.get("/api/diag", (_req, res) => {
  res.json({
    ok: true,
    commit: COMMIT,
    env: {
      BASE_URL: !!process.env.BASE_URL,
      CORS_ALLOW_ORIGINS: allowList.length,
      HOLD_TTL_MINUTES,
      BOOKINGS_WEBHOOK_URL: !!process.env.BOOKINGS_WEBHOOK_URL,
      STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: !!process.env.STRIPE_WEBHOOK_SECRET,
      MP_ACCESS_TOKEN: !!process.env.MP_ACCESS_TOKEN,
      ENABLE_EVENTS: String(process.env.ENABLE_EVENTS || ""),
    },
  });
});

// ====== Disponibilidad (Sheets) ======
app.get("/api/availability", async (req, res) => {
  try {
    const from = (req.query.from || "").toString().slice(0, 10);
    const to = (req.query.to || "").toString().slice(0, 10);

    // defaults: hoy → +30 días si no vienen fechas
    const today = new Date();
    const dFrom = from || today.toISOString().slice(0, 10);
    const dTo =
      to ||
      new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);

    const rows = await fetchRowsFromSheet();
    const occupied = calcOccupiedBeds(rows, dFrom, dTo);

    res.json({ ok: true, from: dFrom, to: dTo, occupied });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// ====== Holds (start / confirm / release) ======
app.post("/holds/start", (req, res) => {
  try {
    const { holdId, ttlMinutes = HOLD_TTL_MINUTES, payload = {} } = Object(req.body || {});
    const out = holds.createHold({ holdId, ttlMinutes, payload });
    res.json(out);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});
app.post("/holds/confirm", (req, res) => {
  try {
    const { holdId, status = "paid" } = Object(req.body || {});
    const out = holds.confirmHold(String(holdId || ""));
    res.json(out);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});
app.post("/holds/release", (req, res) => {
  try {
    const { holdId } = Object(req.body || {});
    const out = holds.releaseHold(String(holdId || ""));
    res.json(out);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// Cron: barrer holds vencidos (llamado desde GAS cada 5 min)
app.get("/crons/holds-sweep", (_req, res) => {
  const tok = (_req.query?.token || "").toString();
  if (!CRON_TOKEN || tok !== CRON_TOKEN) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  const out = holds.sweepExpired();
  res.json({ ok: true, ...out });
});

// ====== Bookings (Router) ======
app.use("/bookings", bookingsRouter);

// ====== Pagos — Stripe ======
app.post("/payments/stripe/session", async (req, res) => {
  try {
    const order = Object(req.body?.order || {});
    if (!("total" in order)) throw new Error("missing_total");
    const baseUrl = getBaseUrl(req);
    const out = await createCheckoutSession(order, { baseUrl });
    res.json({ ok: true, ...out });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e.message || e) });
  }
});

// ====== Pagos — Mercado Pago ======
app.post("/payments/mp/preference", async (req, res) => {
  try {
    const order = Object(req.body?.order || {});
    if (!("total" in order)) throw new Error("missing_total");
    const baseUrl = getBaseUrl(req);
    const out = await createPreference(order, { baseUrl });
    res.json({ ok: true, ...out });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e.message || e) });
  }
});

// Webhook MP (acepta POST; GET se ignora con ok:true)
const mpWebhook = buildMpWebhookHandler({
  notifySheets,
  isDuplicate: isDup,
  log: (...args) => console.log("[mp]", ...args),
});
app.post("/webhooks/mp", mpWebhook);
app.get("/webhooks/mp", (_req, res) => res.json({ ok: true, ping: true }));

// ====== Eventos (GET /api/events) ======
if (eventsModule) {
  if (typeof eventsModule === "function") {
    app.get("/api/events", eventsModule);
  } else if (typeof eventsModule.eventsHandler === "function") {
    app.get("/api/events", eventsModule.eventsHandler);
  } else {
    // fallback sin romper
    app.get("/api/events", (_req, res) => res.json({ ok: true, events: [] }));
  }
} else {
  app.get("/api/events", (_req, res) => res.json({ ok: true, events: [] }));
}

// ====== Rutas de páginas ======
// /book → public/book/index.html
app.get("/book", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "book", "index.html"));
});
// /admin → admin/index.html (opcional)
app.get("/admin", (_req, res) => {
  res.sendFile(path.join(__dirname, "admin", "index.html"));
});

// ====== 404 estático (opcional simple) ======
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  // Intentar devolver index.html si piden una ruta "bonita" sin extensión
  if (!path.extname(req.path)) {
    const safe = path.join(__dirname, "public", req.path, "index.html");
    return res.sendFile(safe, (err) => (err ? res.status(404).send("Not found") : undefined));
  }
  return res.status(404).send("Not found");
});

// ====== Start ======
if (require.main === module) {
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`[lapa-casa] up on :${PORT} commit=${COMMIT}`);
  });
}

module.exports = app;
