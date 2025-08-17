"use strict";

/**
 * Lapa Casa — Backend (Express) COMPAT
 * Mantiene el front/productión tal cual (no cambia HTML).
 * Expone API de reservas, pagos (Stripe/MP), holds, agenda y webhooks.
 *
 * ENV:
 *  BASE_URL, CORS_ALLOW_ORIGINS, HOLD_TTL_MINUTES=10, CRON_TOKEN
 *  BOOKINGS_WEBHOOK_URL
 *  STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 *  MP_ACCESS_TOKEN
 *  ENABLE_EVENTS=1 (opcional), EVENTS_TTL_HOURS, EVENTS_FEEDS
 */

const path = require("path");
const express = require("express");
const cors = require("cors");

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

// ===== Static (no tocamos tu front)
app.use(express.static(path.join(__dirname, "public"), { extensions:["html"] }));

// ===== Services
const holds = require("./services/holds");
const bookingsRouter = require("./services/bookings");
const { fetchRowsFromSheet, calcOccupiedBeds, notifySheets } = require("./services/sheets");
const { createCheckoutSession, buildStripeWebhookHandler } = require("./services/payments-stripe");
const { createPreference, buildMpWebhookHandler } = require("./services/payments-mp");

// events.js puede exportar un handler por defecto o { eventsHandler }
let eventsModule = null; try { eventsModule = require("./services/events"); } catch {}

// ===== Helpers
function getBaseUrl(req){
  const env = (process.env.BASE_URL || "").replace(/\/+$/,"");
  if (env) return env;
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
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

// ===== Stripe raw webhook FIRST
app.post("/webhooks/stripe",
  express.raw({ type:"application/json" }),
  buildStripeWebhookHandler({
    notifySheets,
    isDuplicate: isDup,
    log: (...a)=>console.log("[stripe]",...a),
  })
);

// JSON parser (resto)
app.use(express.json({ limit:"2mb" }));

// ===== Health/Diag
app.get("/api/health", (_req,res)=> res.json({ ok:true, service:"lapa-casa-backend", commit:COMMIT, now:new Date().toISOString() }));
app.get("/api/diag", (_req,res)=> res.json({
  ok:true, commit:COMMIT,
  env:{
    BASE_URL:!!process.env.BASE_URL,
    CORS_ALLOW_ORIGINS:allowList.length,
    HOLD_TTL_MINUTES:HOLD_TTL_MINUTES,
    BOOKINGS_WEBHOOK_URL:!!process.env.BOOKINGS_WEBHOOK_URL,
    STRIPE_SECRET_KEY:!!process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET:!!process.env.STRIPE_WEBHOOK_SECRET,
    MP_ACCESS_TOKEN:!!process.env.MP_ACCESS_TOKEN,
    ENABLE_EVENTS:String(process.env.ENABLE_EVENTS||"")
  }
}));

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

// ===== Holds (nombres actuales + alias)
app.post("/holds/start", (req,res)=>{
  try{ const { holdId, ttlMinutes=HOLD_TTL_MINUTES, payload={} } = Object(req.body||{});
    res.json(holds.createHold({ holdId, ttlMinutes, payload }));
  }catch(e){ res.status(500).json({ ok:false, error:String(e.message||e) }); }
});
app.post("/holds/confirm", (req,res)=>{
  try{ const { holdId } = Object(req.body||{}); res.json(holds.confirmHold(String(holdId||""))); }
  catch(e){ res.status(500).json({ ok:false, error:String(e.message||e) }); }
});
app.post("/holds/release", (req,res)=>{
  try{ const { holdId } = Object(req.body||{}); res.json(holds.releaseHold(String(holdId||""))); }
  catch(e){ res.status(500).json({ ok:false, error:String(e.message||e) }); }
});
// alias legacy (por si tu front usa /api/holds/*)
app.post("/api/holds/start", (req,res)=> app._router.handle(req,res,()=>{}, "POST", "/holds/start"));
app.post("/api/holds/confirm", (req,res)=> app._router.handle(req,res,()=>{}, "POST", "/holds/confirm"));
app.post("/api/holds/release", (req,res)=> app._router.handle(req,res,()=>{}, "POST", "/holds/release"));

// ===== Cron holds sweep (GAS)
app.get("/crons/holds-sweep", (req,res)=>{
  const tok = (req.query?.token||"").toString();
  if (!CRON_TOKEN || tok !== CRON_TOKEN) return res.status(401).json({ ok:false, error:"unauthorized" });
  res.json({ ok:true, ...holds.sweepExpired() });
});

// ===== Bookings
app.use("/bookings", bookingsRouter);
// alias legacy: /api/bookings
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
// alias legacy: algunos front antiguos usaban /payments/stripe/create_intent
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

// Webhook MP
const mpWebhook = buildMpWebhookHandler({
  notifySheets,
  isDuplicate: isDup,
  log: (...a)=>console.log("[mp]",...a),
});
app.post("/webhooks/mp", mpWebhook);
app.get("/webhooks/mp", (_req,res)=> res.json({ ok:true, ping:true }));

// ===== Eventos
if (eventsModule) {
  if (typeof eventsModule === "function") app.get("/api/events", eventsModule);
  else if (typeof eventsModule.eventsHandler === "function") app.get("/api/events", eventsModule.eventsHandler);
  else app.get("/api/events", (_req,res)=> res.json({ ok:true, events: [] }));
} else {
  app.get("/api/events", (_req,res)=> res.json({ ok:true, events: [] }));
}

// ===== Páginas (no cambiamos tu HTML)
// /book resuelve al build que ya tienes en public/book/index.html
app.get("/book", (_req,res)=> res.sendFile(path.join(__dirname, "public", "book", "index.html")));
// /admin opcional (si subes admin/index.html)
app.get("/admin", (_req,res)=> res.sendFile(path.join(__dirname, "admin", "index.html")));

// ===== 404 SPA-ish (solo GET sin extensión)
app.use((req,res,next)=>{
  if (req.method!=="GET" || path.extname(req.path)) return next();
  const safe = path.join(__dirname, "public", req.path, "index.html");
  res.sendFile(safe, (err)=> err ? res.status(404).send("Not found") : undefined);
});

// ===== Start
if (require.main === module) {
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, ()=> console.log(`[lapa-casa] up :${PORT} commit=${COMMIT}`));
}
module.exports = app;
