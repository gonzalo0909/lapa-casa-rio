// index.js
"use strict";
/**
 * Lapa Casa — Backend thin index (Express)
 * Endpoints: health, availability, bookings, holds, payments (Stripe/MP), webhooks, events
 * Sirve estáticos /, /book/, /admin/ y fallback SPA-ish.
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

// ==== App
const app = express();
app.set("trust proxy", 1);

// ==== Helpers
function getBaseUrl(req) {
  if (BASE_URL) return BASE_URL;
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host  = req.headers["x-forwarded-host"]  || req.headers.host;
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
app.use(cors({
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
  allowedHeaders: ["Content-Type", "Stripe-Signature"]
}));

// ==== Security
app.use(helmet({ crossOriginResourcePolicy: false }));

// ==== Static first
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));
app.get("/book", (_req, res) => res.sendFile(path.join(__dirname, "public", "book", "index.html")));
app.get("/admin", (_req, res) => res.sendFile(path.join(__dirname, "public", "admin", "index.html")));

// ==== Sessions (para /admin/login en router)
app.use(cookieSession({
  name: "sess",
  secret: SESSION_SECRET,
  sameSite: "lax",
  httpOnly: true,
}));

// ==== Services
const stripeSrv = require("./services/payments-stripe");
const mpSrv     = require("./services/payments-mp");

// ==== Webhooks
const { buildStripeWebhookHandler } = require("./services/payments-stripe");
const { buildMpWebhookHandler }     = require("./services/payments-mp");
const { notifySheets }              = require("./services/sheets");

// Stripe requiere RAW
app.post("/webhooks/stripe",
  express.raw({ type: "application/json" }),
  buildStripeWebhookHandler({
    notifySheets,
    isDuplicate: isDup,
    log: (...a) => consol
