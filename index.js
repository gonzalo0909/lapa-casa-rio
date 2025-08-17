"use strict";
require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const cookieSession = require("cookie-session"); // ⬅️ reemplaza express-session

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

// ===== Sesiones Admin (cookie-session, apto prod)
app.set("trust proxy", 1); // necesario en Render para cookies secure
app.use(cookieSession({
  name: "lc.sid",
  keys: [process.env.ADMIN_SESSION_SECRET || "changeme"],
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
  sameSite: "lax",
  secure: true,     // cookie solo sobre HTTPS
  httpOnly: true
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

// ===== Stripe raw webhook FIRST
app.post("/webhooks/stripe",
  express.raw({ type:"application/json" }),
  buildStripeWebhookHandler({
    notifySheets,
    isDuplicate: (()=>{ const m=new Map(); return (k)=>{const t=Date.now(); if(m.has(k)) return true; m.set(k,t); return false; };})(),
    log: (...a)=>console.log("[stripe]",...a),
  })
);

// JSON parser (resto)
app.use(express.json({ limit:"2mb" }));

// ===== Health
app.get("/api/health", (_req,res)=> res.json({ ok:true, service:"lapa-casa-backend", commit:COMMIT, now:new Date().toISOString() }));

// ===== Disponibilidad
app.get("/api/availability", async (req,res)=>{
  try{
    const from = (req.query.from||"").toString().slice(0,10);
    const to   = (req.query.to||"").toString().slice(0,10);
    const today = new Date();
    const dFrom = from || today.toISOString().slice(0,10);
    const dTo = to || new Date(today.getTime()+30*86400000).toISOString().slice(0,10);
    const rows = await fetchRowsFromSheet();
    const occupied = calcOccupiedBeds(rows, dFrom, dTo);
    res.json({ ok:true, from:dFrom, to:dTo, occupied });
  }catch(e){ res.status(500).json({ ok:false, error:String(e.message||e) }); }
});

// ===== Holds
function holdsStartHandler(req,res){ try{ const { holdId, ttlMinutes=HOLD_TTL_MINUTES, payload={} } = Object(req.body||{}); res.json(holds.createHold({ holdId, ttlMinutes, payload })); }catch(e){ res.status(500).json({ ok:false, error:String(e.message||e) }); } }
function holdsConfirmHandler(req,res){ try{ const { holdId } = Object(req.body||{}); res.json(holds.confirmHold(String(holdId||""))); }catch(e){ res.status(500).json({ ok:false, error:String(e.message||e) }); } }
function holdsReleaseHandler(req,res){ try{ const { holdId } = Object(req.body||{}); res.json(holds.releaseHold(String(holdId||""))); }catch(e){ res.status(500).json({ ok:false, error:String(e.message||e) }); } }
app.post("/holds/start", holdsStartHandler);
app.post("/holds/confirm", holdsConfirmHandler);
app.post("/holds/release", holdsReleaseHandler);
app.post("/api/holds/start", holdsStartHandler);
app.post("/api/holds/confirm", holdsConfirmHandler);
app.post("/api/holds/release", holdsReleaseHandler);

// ===== Cron holds sweep (GAS)
app.get("/crons/holds-sweep", (req,res)=>{
  const tok = (req.query?.token||"").toString();
  if (!CRON_TOKEN || tok !== CRON_TOKEN) return res.status(401).json({ ok:false, error:"unauthorized" });
  res.json({ ok:true, ...holds.sweepExpired() });
});

// ===== Bookings
app.use("/bookings", bookingsRouter);
app.use("/api/bookings", bookingsRouter);

// ===== Pagos — Stripe
app.post("/payments/stripe/session", async (req,res)=>{
  try{
    const order = Object(req.body?.order || {});
    if (!("total" in order)) throw new Error("missing_total");
    const out = await createCheckoutSession(order, { baseUrl: getBaseUrl(req) });
    res.json({ ok:true, ...out });
  }catch(e){ res.status(400).json({ ok:false, error:String(e.message||e) }); }
});
app.post("/payments/stripe/create_intent", async (req,res)=>{
  try{
    const order = Object(req.body?.order || req.body || {});
    if (!("total" in order)) throw new Error("missing_total");
    const out = await createCheckoutSession(order, { baseUrl: getBaseUrl(req) });
    res.json({ ok:true, ...out });
  }catch(e){ res.status(400).json({ ok:false, error:String(e.message||e) }); }
});

// ===== Pagos — Mercado Pago
app.post("/payments/mp/preference", async (req,res)=>{
  try{
    const order = Object(req.body?.order || {});
    if (!("total" in order)) throw new Error("missing_total");
    const out = await createPreference(order, { baseUrl: getBaseUrl(req) });
    res.json({ ok:true, ...out });
  }catch(e){ res.status(400).json({ ok:false, error:String(e.message||e) }); }
});
const { buildMpWebhookHandler } = require("./services/payments-mp");
app.post("/webhooks/mp", buildMpWebhookHandler({ notifySheets, isDuplicate:()=>false, log:(...a)=>console.log("[mp]",...a) }));
app.get("/webhooks/mp", (_req,res)=> res.json({ ok:true, ping:true }));

// ===== Páginas SPA-ish
app.get("/book", (_req,res)=> res.sendFile(path.join(__dirname, "public", "book.html")));
app.get("/admin", (_req,res)=> res.sendFile(path.join(__dirname, "admin", "index.html")));
app.use((req,res,next)=>{
  if (req.method!=="GET" || path.extname(req.path)) return next();
  const safe = path.join(__dirname, "public", req.path, "index.html");
  res.sendFile(safe, (err)=> err ? res.status(404).send("Not found") : undefined);
});

// ===== Helpers
function getBaseUrl(req){
  const env = (process.env.BASE_URL || "").replace(/\/+$/,"");
  if (env) return env;
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

// ===== Start
if (require.main === module) {
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, ()=> console.log(`[lapa-casa] up :${PORT} commit=${COMMIT}`));
}
module.exports = app;
