// index.js
"use strict";
/**
 * Lapa Casa — Backend (Express)
 */
require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieSession = require("cookie-session");

const app = express();
app.set("trust proxy", 1);

// ===== ENV
const PORT = process.env.PORT || 3000;
const COMMIT = process.env.COMMIT || "dev";
const BASE_URL = (process.env.BASE_URL || "").replace(/\/+$/, "");
const HOLD_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES || 10);
const CORS_ALLOW = String(process.env.CORS_ALLOW_ORIGINS || "")
  .split(",").map(s => s.trim()).filter(Boolean);
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "change-me";

// ===== Utils
function getBaseUrl(req){
  if (BASE_URL) return BASE_URL;
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host  = req.headers["x-forwarded-host"]  || req.headers.host;
  return `${proto}://${host}`;
}
function deduper(max=1000, ttlMs=10*60*1000){
  const m=new Map();
  return (key)=>{
    const now=Date.now();
    for (const [k,ts] of m) if (now-ts>ttlMs) m.delete(k);
    if (m.has(key)) return true;
    m.set(key, now);
    if (m.size>max) m.delete(m.keys().next().value);
    return false;
  };
}
const isDup = deduper();

// ===== Middleware base
app.use(cors({
  origin: (origin, cb)=>{
    if (!origin) return cb(null,true);
    if (!CORS_ALLOW.length) return cb(null,true);
    try{
      const host = new URL(origin).hostname.toLowerCase();
      const allowHosts = CORS_ALLOW.map(v=>v.replace(/^https?:\/\//,"").toLowerCase());
      const ok = allowHosts.some(a => host===a || host.endsWith("."+a));
      return cb(null, ok);
    }catch{ return cb(null,false); }
  },
  credentials:true,
  methods:["GET","POST","OPTIONS"],
  allowedHeaders:["Content-Type","Stripe-Signature"]
}));
app.use(helmet({ crossOriginResourcePolicy:false }));
app.use(cookieSession({ name:"sess", secret:SESSION_SECRET, sameSite:"lax", httpOnly:true }));

// ===== Static
app.use(express.static(path.join(__dirname, "public"), { extensions:["html"] }));
app.get("/book", (_req,res)=> res.sendFile(path.join(__dirname,"public","book","index.html")));
app.get("/admin",(_req,res)=> res.sendFile(path.join(__dirname,"public","admin","index.html")));

// ===== Services
const stripeSrv = require("./services/payments-stripe");
const mpSrv     = require("./services/payments-mp");
const { buildStripeWebhookHandler } = require("./services/payments-stripe");
const { buildMpWebhookHandler }     = require("./services/payments-mp");
const { notifySheets }              = require("./services/sheets");

// ===== Webhooks
app.post("/webhooks/stripe",
  express.raw({ type:"application/json" }),
  buildStripeWebhookHandler({ notifySheets, isDuplicate:isDup, log:(...a)=>console.log("[stripe]",...a) })
);
app.post("/webhooks/mp",
  express.json(),
  buildMpWebhookHandler({ notifySheets, isDuplicate:isDup, log:(...a)=>console.log("[mp]",...a) })
);

// ===== JSON parser (resto)
app.use(express.json());

// ===== Routers (base)
app.use("/api/health", require("./routes/health"));
try { app.use("/api/events", require("./routes/events")); } catch {}
app.use("/availability", require("./routes/availability"));
app.use("/bookings",     require("./routes/bookings"));
app.use("/holds",        require("./routes/holds"));
try { app.use("/payments/status", require("./routes/payments-status")); } catch {}

// Aliases /api
app.use("/api/availability", require("./routes/availability"));
app.use("/api/bookings",     require("./routes/bookings"));
app.use("/api/holds",        require("./routes/holds"));
try { app.use("/api/payments/status", require("./routes/payments-status")); } catch {}

// ===== Payments public
app.post("/payments/stripe/session", async (req,res)=>{
  try{
    const orderIn = Object(req.body?.order || req.body || {});
    if (!("total" in orderIn)) throw new Error("missing_total");
    const out = await stripeSrv.createCheckoutSession(orderIn, { baseUrl:getBaseUrl(req) });
    res.json({ ok:true, ...out });
  }catch(e){ res.status(400).json({ ok:false, error:String(e.message||e) }); }
});
app.post("/api/payments/stripe/session", async (req,res)=>{
  try{
    const orderIn = Object(req.body?.order || req.body || {});
    if (!("total" in orderIn)) throw new Error("missing_total");
    const out = await stripeSrv.createCheckoutSession(orderIn, { baseUrl:getBaseUrl(req) });
    res.json({ ok:true, ...out });
  }catch(e){ res.status(400).json({ ok:false, error:String(e.message||e) }); }
});
app.post("/payments/mp/preference", async (req,res)=>{
  try{
    const b = req.body || {};
    const order = b.order ? b.order : {
      booking_id: b.booking_id || b.external_reference || (b.metadata && (b.metadata.booking_id || b.metadata.bookingId)),
      total: (typeof b.total !== "undefined") ? b.total : b.unit_price
    };
    if (!("total" in order)) throw new Error("missing_total");
    const out = await mpSrv.createPreference(order, { baseUrl:getBaseUrl(req) });
    res.json({ ok:true, ...out });
  }catch(e){ res.status(400).json({ ok:false, error:String(e.message||e) }); }
});
app.post("/api/payments/mp/preference", async (req,res)=>{
  try{
    const b = req.body || {};
    const order = b.order ? b.order : {
      booking_id: b.booking_id || b.external_reference || (b.metadata && (b.metadata.booking_id || b.metadata.bookingId)),
      total: (typeof b.total !== "undefined") ? b.total : b.unit_price
    };
    if (!("total" in order)) throw new Error("missing_total");
    const out = await mpSrv.createPreference(order, { baseUrl:getBaseUrl(req) });
    res.json({ ok:true, ...out });
  }catch(e){ res.status(400).json({ ok:false, error:String(e.message||e) }); }
});

// ===== Diag
app.get("/api/diag", (_req,res)=> res.json({
  ok:true, service:"lapa-casa-backend", commit:COMMIT, now:new Date().toISOString(),
  env:{ BASE_URL:!!BASE_URL, HOLD_TTL_MINUTES, CORS_ALLOW_ORIGINS:CORS_ALLOW.length }
}));

// ===== Fallback SPA-ish
app.use((req,res,next)=>{
  if (req.method !== "GET") return next();
  if (path.extname(req.path)) return next();
  const safe = path.join(__dirname, "public", req.path, "index.html");
  res.sendFile(safe, (err)=> { if (err) res.status(404).send("Not found"); });
});

// ===== Start
if (require.main === module) {
  app.listen(PORT, ()=> console.log(`[lapa-casa] up :${PORT} commit=${COMMIT}`));
}

module.exports = app;
