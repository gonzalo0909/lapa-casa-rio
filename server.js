/**
 * server.js
 * Backend principal del Channel Manager - Lapa Casa Hostel
 * Gestiona disponibilidad, holds, pagos y admin
 */

"use strict";

const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config({ path: path.join(__dirname, ".env") });

/* ================== APP & PORT ================== */
const app = express();
const PORT = process.env.PORT || 3000;

/* ================== AUTENTICACIÓN ADMIN ================== */
function requireAdmin(req, res, next) {
  const authHeader = (req.headers.authorization || "").trim();
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  next();
}

/* ================== WEBHOOK STRIPE (RAW) ================== */
const { stripeWebhook } = require("./api/routes/payments");
app.post(
  "/api/payments/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook
);

/* ================== SEGURIDAD ================== */
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  })
);

/* ================== CORS ================== */
const ALLOWED_ORIGINS = String(process.env.CORS_ALLOW_ORIGINS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    const full = url.host.toLowerCase();
    return ALLOWED_ORIGINS.some((domain) => {
      const domainHost = domain.split(":")[0];
      return (
        host === domainHost ||
        host.endsWith("." + domainHost) ||
        full === domain ||
        full.endsWith("." + domain)
      );
    });
  } catch {
    const cleanOrigin = origin.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase();
    const hostNoPort = cleanOrigin.split(":")[0];
    return ALLOW
