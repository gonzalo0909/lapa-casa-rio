"use strict";
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

/* ================== APP & PORT ================== */
const app = express();
const PORT = process.env.PORT || 3000;

/* ================== AUTH ADMIN ================== */
function requireAdmin(req, res, next) {
  const hdr = (req.headers.authorization || "").trim();
  const tok = hdr.startsWith("Bearer ") ? hdr.slice(7) : hdr;
  if (!process.env.ADMIN_TOKEN || tok !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  next();
}

/* ================== WEBHOOK STRIPE (RAW) ================== */
const { stripeWebhook } = require("./routes/payments");
app.post(
  "/api/payments/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook
);

/* ================== SECURITY HEADERS ================== */
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

/* ================== CORS ================== */
const ALLOW = String(process.env.CORS_ALLOW_ORIGINS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();
    const full = u.host.toLowerCase();
    return ALLOW.some((dom) => {
      const domHost = dom.split(":")[0];
      return (
        host === domHost ||
        host.endsWith("." + domHost) ||
        full === dom ||
        full.endsWith("." + dom)
      );
    });
  } catch {
    const host = origin.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase();
    const hostNoPort = host.split(":")[0];
    return ALLOW.some((dom) => host === dom || hostNoPort === dom || host.endsWith("." + dom));
  }
}

app.use(
  cors({
    origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
    credentials: true,
  })
);

/* ================== JSON BODY (después de webhook) ================== */
app.use(express.json({ limit: "1mb" }));

/* ================== HEALTH ================== */
app.get("/api/ping", (_req, res) =>
  res.json({ ok: true, ts: new Date().toISOString() })
);

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    env: {
      FRONTEND_URL: !!process.env.FRONTEND_URL,
      MP_ACCESS_TOKEN: !!process.env.MP_ACCESS_TOKEN,
      STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: !!process.env.STRIPE_WEBHOOK_SECRET,
      BOOKINGS_WEBAPP_URL: !!process.env.BOOKINGS_WEBAPP_URL,
      CORS_ALLOW_ORIGINS: ALLOW,
    },
  });
});

/* ================== RATE LIMIT (ADMIN/APIs sensibles) ================== */
const adminLimiter = rateLimit({ windowMs: 60_000, max: 60 }); // 60 req/min

/* ================== ROUTES ================== */
const availabilityRouter = require("./routes/availability");
const holdsHandlers = require("./routes/holds");          // { router, list, confirm, release }
const bookingsRouter = require("./routes/bookings");
const payments = require("./routes/payments");            // { router, stripeWebhook }

app.use("/api/availability", availabilityRouter);
app.use("/api/payments", payments.router);

/* ---- Rutas públicas de holds (si las usás desde el book) ---- */
app.use("/api/holds", holdsHandlers.router);

/* ---- Rutas ADMIN protegidas ---- */
app.get("/api/holds/list", adminLimiter, requireAdmin, holdsHandlers.list);
app.post("/api/holds/confirm", adminLimiter, requireAdmin, holdsHandlers.confirm);
app.post("/api/holds/release", adminLimiter, requireAdmin, holdsHandlers.release);
app.use("/api/bookings", adminLimiter, requireAdmin, bookingsRouter);

/* ================== FRONTEND ESTÁTICO ================== */
const FRONTEND_DIR = path.join(__dirname, "../frontend");
app.use(express.static(FRONTEND_DIR));

// NOINDEX sólo para /admin
app.get("/admin", (_req, res) => {
  res.set("X-Robots-Tag", "noindex, nofollow");
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

// público
app.get(["/", "/book"], (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

/* ================== 404 & ERRORS ================== */
app.use((req, res) => res.status(404).json({ ok: false, error: "not_found" }));
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ ok: false, error: "internal_error" });
});

/* ================== START ================== */
app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
