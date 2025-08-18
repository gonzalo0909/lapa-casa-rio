// index.js
"use strict";
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const Stripe = require("stripe");
const { MercadoPagoConfig } = require("mercadopago");
const path = require("path");

const bookingsRoutes = require("./routes/bookings");
const availabilityRoutes = require("./routes/availability");
const eventsRoutes = require("./routes/events");
const holdsRoutes = require("./routes/holds");

// ====== ENV
const BASE_URL = (process.env.BASE_URL || "").replace(/\/$/, "") || "https://lapa-casa-backend.onrender.com";
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";
const STRIPE_SK = process.env.STRIPE_SK || process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const ADMIN_USER = process.env.ADMIN_USER || "";
const ADMIN_PASS = process.env.ADMIN_PASS || "";
const ADMIN_REALM = "LapaCasaAdmin";
const CRON_TOKEN = process.env.CRON_TOKEN || "";
const HOLD_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES || 10);

const app = express();

// ====== MIDDLEWARE
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ====== ROUTES
app.use("/bookings", bookingsRoutes);
app.use("/availability", availabilityRoutes);
app.use("/events", eventsRoutes);
app.use("/holds", holdsRoutes);

// ====== HEALTH CHECK
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "lapa-casa-backend", ts: Date.now() });
});

// ====== STATIC (public)
app.use(express.static(path.join(__dirname, "public")));

// ====== START
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend Lapa Casa escuchando en http://localhost:${PORT}`);
});
