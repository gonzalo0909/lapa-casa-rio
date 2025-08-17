"use strict";
require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const session = require("express-session");

const app = express();
const COMMIT = process.env.COMMIT || "dev";
const HOLD_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES || 10);
const CRON_TOKEN = (process.env.CRON_TOKEN || "").trim();

// ===== CORS
const allowList = String(process.env.CORS_ALLOW_ORIGINS || "")
  .split(",").map(s=>s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb)=>{
    if (!origin) return cb(null, true);
    if (!allowList.length || allowList.includes(origin)) return cb(null, true);
    return cb(new Error("CORS blocked"), false);
  },
  credentials:true,
  methods:["GET","POST","OPTIONS"],
  allowedHeaders:["Content-Type","Stripe-Signature"],
}));

// ===== Sesiones Admin
app.use(session({
  secret: process.env.ADMIN_SESSION_SECRET || "changeme",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true }
}));

// ===== Static público
app.use(express.static(path.join(__dirname, "public"), { extensions:["html"] }));

// ===== Services
const holds = require("./services/holds");
const bookingsRouter = require("./services/bookings");
const { fetchRowsFromSheet, calcOccupiedBeds, notifySheets } = require("./services/sheets");
const { createCheckoutSession, buildStripeWebhookHandler } = require("./services/payments-stripe");
const { createPreference, buildMpWebhookHandler } = require("./services/payments-mp");

// ===== Admin routes
app.use("/admin", require("./routes/admin"));

// … (resto del código idéntico como ya lo tenías) …

// ===== Start
if (require.main === module) {
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, ()=> console.log(`[lapa-casa] up :${PORT} commit=${COMMIT}`));
}
module.exports = app;
