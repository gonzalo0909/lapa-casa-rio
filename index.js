"use strict";

// Core
require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

// Routers / Services
const availabilityRouter = require("./routes/availability");
const bookingsRouter     = require("./routes/bookings");
const holdsRouter        = require("./routes/holds");
const adminRouter        = require("./routes/admin");
const eventsRouter       = require("./routes/events");
const { createCheckoutSession, buildStripeWebhookHandler } = require("./services/payments-stripe");
const { createPreference,       buildMpWebhookHandler      } = require("./services/payments-mp");
const { notifySheets } = require("./services/sheets");
const { sweepExpired } = require("./services/holds");

// App
const app = express();
app.set("trust proxy", 1);

// ===== CORS (allowlist)
const allowList = String(process.env.CORS_ALLOW_ORIGINS || "")
  .split(",").map(s=>s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb)=>{
    if (!origin) return cb(null, true);
    if (!allowList.length || allowList.includes(origin) ||
        allowList.some(o => origin === o || origin.endsWith("."+o.replace(/^https?:\/\//,""))))
      return cb(null, true);
    return cb(new Error("CORS blocked"));
  },
  credentials:true,
  methods:["GET","POST","OPTIONS"],
  allowedHeaders:["Content-Type","Stripe-Signature"],
}));

// Security + JSON (⚠️ Stripe raw va antes)
app.use(helmet({ crossOriginResourcePolicy:false }));

// ===== Helpers
const COMMIT = process.env.COMMIT || "dev";
const CRON_TOKEN = (process.env.CRON_TOKEN || "").trim();
const BASE_URL = (process.env.BASE_URL || "").replace(/\/+$/,"");
function getBaseUrl(req){
  if (BASE_URL) return BASE_URL;
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host  = req.headers["x-forwarded-host"]  || req.headers.host;
  return `${proto}://${host}`;
}
function deduper(max=1000, ttl=10*60*1000){
  const m=new Map();
  return (key)=>{
    const now=Date.now();
    for (const [k,ts] of m) if (now-ts>ttl) m.delete(k);
    if (m.has(key)) return true;
    m.set(key, now);
    if (m.size>max) m.delete(m.keys().next().value);
    return false;
  };
}
const isDup = deduper();

// ===== Webhooks (Stripe raw primero)
app.post(
  "/webhooks/stripe",
  express.raw({ type:"application/json" }),
  buildStripeWebhookHandler({
    notifySheets: (payload)=>notifySheets(payload),
    isDuplicate: isDup,
    log: (...a)=>console.log("[stripe]",...a),
  })
);

// Resto JSON
app.use(express.json({ limit:"2mb" }));

// Mercado Pago webhook
const mpWebhook = buildMpWebhookHandler({
  notifySheets: (payload)=>notifySheets(payload),
  isDuplicate: isDup,
  log: (...a)=>console.log("[mp]",...a),
});
app.post("/webhooks/mp", mpWebhook);
app.get("/webhooks/mp", (_req,res)=> res.json({ ok:true, ping:true }));

// ===== API básicas
app.get("/api/health", (_req,res)=> res.json({
  ok:true, service:"lapa-casa-backend", commit:COMMIT, now:new Date().toISOString()
}));

// Diag (flags de env)
app.get("/api/diag", (_req,res)=> res.json({
  ok:true, commit:COMMIT, now:new Date().toISOString(),
  env:{
    BASE_URL:!!process.env.BASE_URL,
    CORS_ALLOW_ORIGINS:allowList.length,
    HOLD_TTL_MINUTES:Number(process.env.HOLD_TTL_MINUTES||10),
    BOOKINGS_WEBAPP_URL:!!process.env.BOOKINGS_WEBAPP_URL,
    STRIPE_SECRET_KEY:!!process.env.STRIPE_SECRET_KEY || !!process.env.STRIPE_SK,
    STRIPE_WEBHOOK_SECRET:!!process.env.STRIPE_WEBHOOK_SECRET,
    MP_ACCESS_TOKEN:!!process.env.MP_ACCESS_TOKEN,
    ENABLE_EVENTS:String(process.env.ENABLE_EVENTS||""),
  }
}));

// Cron sweep holds (usado por GAS)
app.get("/api/crons/holds-sweep", (req,res)=>{
  const tok = String(req.query?.token||"");
  if (!CRON_TOKEN || tok !== CRON_TOKEN) return res.status(401).json({ ok:false, error:"unauthorized" });
  return res.json({ ok:true, ...sweepExpired() });
});

// ===== Payments endpoints (compat con front “book 18”)
app.post("/payments/stripe/session", async (req,res)=>{
  try{
    const order = Object(req.body?.order || req.body || {});
    if (!("total" in order)) throw new Error("missing_total");
    const out = await createCheckoutSession(order, { baseUrl: getBaseUrl(req) });
    res.json({ ok:true, ...out });
  }catch(e){ res.status(400).json({ ok:false, error:String(e.message||e) }); }
});

app.post("/payments/mp/preference", async (req,res)=>{
  try{
    const order = Object(req.body?.order || req.body || {});
    if (!("total" in order)) throw new Error("missing_total");
    const out = await createPreference(order, { baseUrl: getBaseUrl(req) });
    res.json({ ok:true, ...out });
  }catch(e){ res.status(400).json({ ok:false, error:String(e.message||e) }); }
});

// ===== Routers de dominio
app.use("/availability", availabilityR
