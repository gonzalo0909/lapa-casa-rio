"use strict";
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const app = express();
const PORT = process.env.PORT || 3000;

/* ===== Stripe webhook RAW antes de json() ===== */
const { stripeWebhook } = require("./routes/payments");
app.post(
  "/api/payments/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook
);

/* ===== Seguridad básica ===== */
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // no romper estáticos si se sirven cruzados
  })
);

/* ===== CORS (arreglado) =====
   - Acepta dominios con o sin subdominio (ej: lapacasahostel.com, www.lapacasahostel.com)
   - Tolera puertos (ej: localhost:5173) y 'https://' / slashes.
*/
const ALLOW = String(process.env.CORS_ALLOW_ORIGINS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true; // requests de same-origin / curl sin Origin
  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase(); // sin puerto
    const full = u.host.toLowerCase();     // con puerto (si trae)
    return ALLOW.some((dom) => {
      // dom puede venir como "lapacasahostel.com" o "localhost:5173"
      const domHost = dom.split(":")[0];
      return (
        host === domHost ||
        host.endsWith("." + domHost) ||
        full === dom ||                      // match exacto con puerto si aplica
        full.endsWith("." + dom)             // subdominio con puerto
      );
    });
  } catch {
    // Origin no es una URL estándar; fallback similar al código previo
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

/* ===== JSON body ===== */
app.use(express.json({ limit: "1mb" }));

/* ===== PING / HEALTH ===== */
app.get("/api/ping", (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
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

/* ===== Rutas API ===== */
app.use("/api/availability", require("./routes/availability"));
app.use("/api/holds", require("./routes/holds"));
app.use("/api/bookings", require("./routes/bookings"));
app.use("/api/payments", require("./routes/payments").router);

/* ===== Frontend estático ===== */
const FRONTEND_DIR = path.join(__dirname, "../frontend");
app.use(express.static(FRONTEND_DIR));
app.get(["/", "/book", "/admin"], (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

/* ===== 404 / errores ===== */
app.use((req, res) => res.status(404).json({ ok: false, error: "not_found" }));
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ ok: false, error: "internal_error" });
});

app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
