"use strict";

const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 3000;

function requireAdmin(req, res, next) {
  const auth = (req.headers.authorization || "").trim();
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  next();
}

const { stripeWebhook } = require("./routes/payments");
app.post("/api/payments/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhook);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

const ALLOWED = String(process.env.CORS_ALLOW_ORIGINS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
app.use(cors({ origin: (origin, cb) => cb(null, !origin || ALLOWED.some(dom => origin.toLowerCase().includes(dom))) }));

app.use(express.json({ limit: "1mb" }));

app.get("/api/ping", (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.get("/api/health", (_, res) => res.json({ ok: true, env: { STRIPE: !!process.env.STRIPE_SECRET_KEY } }));

const adminLimiter = rateLimit({ windowMs: 60_000, max: 60 });

app.use("/api/availability", require("./routes/availability"));
app.use("/api/payments", require("./routes/payments").router);
app.use("/api/holds", require("./routes/holds").router);

app.get("/api/holds/list", adminLimiter, requireAdmin, require("./routes/holds").list);
app.post("/api/holds/confirm", adminLimiter, requireAdmin, require("./routes/holds").confirm);
app.post("/api/holds/release", adminLimiter, requireAdmin, require("./routes/holds").release);
app.use("/api/bookings", adminLimiter, requireAdmin, require("./routes/bookings"));

const FRONTEND = path.join(__dirname, "frontend");
app.use(express.static(FRONTEND));

app.get("/", (_, res) => res.sendFile(path.join(FRONTEND, "index.html")));
app.get("/book", (_, res) => res.sendFile(path.join(FRONTEND, "index.html")));
app.get("/admin", (_, res) => { res.set("X-Robots-Tag", "noindex, nofollow"); res.sendFile(path.join(FRONTEND, "index.html")); });

app.use((_, res) => res.status(404).json({ ok: false, error: "not_found" }));
app.use((err, _, res, __) => { console.error("Error:", err); res.status(500).json({ ok: false, error: "internal_error" }); });

app.listen(PORT, () => console.log(`Servidor listo en puerto ${PORT}`));
