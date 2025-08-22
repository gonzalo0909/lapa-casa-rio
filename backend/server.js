"use strict";
const path = require("path");
const express = require("express");
const cors = require("cors");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Stripe webhook RAW ANTES de json() =====
const payments = require("./routes/payments");
app.post("/api/payments/stripe/webhook",
  express.raw({ type: "application/json" }),
  payments.stripeWebhook
);

// ===== CORS =====
const ALLOW = String(process.env.CORS_ALLOW_ORIGINS || "")
  .split(",").map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl/health
    const host = origin.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return cb(null, ALLOW.includes(host));
  },
  credentials: true
}));

// ===== JSON body =====
app.use(express.json({ limit: "1mb" }));

// ===== PING / HEALTH =====
app.get("/api/ping", (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.get("/api/health", async (_req,res)=>{
  res.json({
    ok:true,
    env:{
      FRONTEND_URL: !!process.env.FRONTEND_URL,
      MP_ACCESS_TOKEN: !!process.env.MP_ACCESS_TOKEN,
      STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: !!process.env.STRIPE_WEBHOOK_SECRET,
      BOOKINGS_WEBAPP_URL: !!process.env.BOOKINGS_WEBAPP_URL
    }
  });
});

// ===== Rutas API =====
app.use("/api/availability", require("./routes/availability")); // ya la tenés
app.use("/api/holds", require("./routes/holds"));               // ya la tenés
app.use("/api/bookings", require("./routes/bookings"));
app.use("/api/payments", payments.router);

// ===== Frontend estático =====
const FRONTEND_DIR = path.join(__dirname, "..", "frontend");
app.use(express.static(FRONTEND_DIR));
app.get(["/", "/book", "/admin"], (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

// ===== 404 / errores =====
app.use((req, res) => res.status(404).json({ ok:false, error:"not_found" }));
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ ok:false, error:"internal_error" });
});

app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
