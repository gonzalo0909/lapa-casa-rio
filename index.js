"use strict";
/**
 * Lapa Casa — Backend (Express) COMPAT + Channel Manager
 * - Endpoints que usa el front (/book 18): availability, holds, bookings, pagos, webhooks.
 * - Forward a Google Sheets (GAS) y iCal export/import.
 */

require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const app = express();
app.set("trust proxy", 1);

// ===== ENV / CONST
const COMMIT = process.env.COMMIT || "dev";
const HOLD_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES || 10);
const CRON_TOKEN = (process.env.CRON_TOKEN || "").trim();

// CORS allow-list
const allowList = String(process.env.CORS_ALLOW_ORIGINS || "")
  .split(",").map(s=>s.trim()).filter(Boolean);

// ===== Helpers
function getBaseUrl(req){
  const env = (process.env.BASE_URL || "").replace(/\/+$/,"");
  if (env) return env;
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host  = req.headers["x-forwarded-host"] || req.headers.host;
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

// ===== Services
const holds = require("./services/holds");
const bookingsRouter = require("./services/bookings"); // si usas router propio, cámbialo a ./routes/bookings
const { fetchRowsFromSheet, calcOccupiedBeds, notifySheets } = require("./services/sheets");
const { createCheckoutSession, buildStripeWebhookHandler } = require("./services/payments-stripe");
const { createPreference, buildMpWebhookHandler } = require("./services/payments-mp");

// events.js puede exportar handler por defecto o { eventsHandler }
let eventsModule = null;
try { eventsModule = require("./services/events"); } catch { /* opcional */ }

// ===== Security & CORS
app.use(helmet({ crossOriginResourcePolicy:false }));
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

// ===== Static (front intacto)
app.use(express.static(path.join(__dirname, "public"), { extensions:["html"] }));

// ===== Stripe raw webhook FIRST
app.post(
  "/webhooks/stripe",
  express.raw({ type:"application/json" }),
  buildStripeWebhookHandler({
    notifySheets: (p)=>notifySheets(p),
    isDuplicate: isDup,
    log: (...a)=>console.log("[stripe]",...a),
  })
);

// ===== JSON parser (resto)
app.use(express.json({ limit:"2mb" }));

// ===== Health/Diag
app.get("/api/health", (_req,res)=> res.json({
  ok:true, service:"lapa-casa-backend", commit:COMMIT, now:new Date().toISOString()
}));
app.get("/api/diag", (_req,res)=> res.json({
  ok:true, commit:COMMIT, env:{
    BASE_URL:!!process.env.BASE_URL,
    CORS_ALLOW_ORIGINS:allowList.length,
    HOLD_TTL_MINUTES:HOLD_TTL_MINUTES,
    BOOKINGS_WEBHOOK_URL:!!process.env.BOOKINGS_WEBAPP_URL,
    STRIPE_SECRET_KEY:!!process.env.STRIPE_SECRET_KEY || !!process.env.STRIPE_SK,
    STRIPE_WEBHOOK_SECRET:!!process.env.STRIPE_WEBHOOK_SECRET,
    MP_ACCESS_TOKEN:!!process.env.MP_ACCESS_TOKEN,
    ENABLE_EVENTS:String(process.env.ENABLE_EVENTS||"")
  }
}));

// ===== Disponibilidad
async function availabilityHandler(req,res){
  try{
    const from = (req.query.from||"").toString().slice(0,10);
    const to   = (req.query.to||"").toString().slice(0,10);
    const today = new Date();
    const dFrom = from || today.toISOString().slice(0,10);
    const dTo   = to   || new Date(today.getTime()+30*86400000).toISOString().slice(0,10);
    const rows = await fetchRowsFromSheet();
    const occupied = calcOccupiedBeds(rows, dFrom, dTo, holds.getHoldsMap?.() || {});
    res.json({ ok:true, from:dFrom, to:dTo, occupied });
  }catch(e){
    res.status(500).json({ ok:false, error:String(e.message||e) });
  }
}
// Front (book 18) usa /availability; Admin usa /api/availability
app.get("/availability", availabilityHandler);
app.get("/api/availability", availabilityHandler);

// ===== Holds
function holdsStartHandler(req,res){
  try{
    const { holdId, ttlMinutes=HOLD_TTL_MINUTES, payload={} } = Object(req.body||{});
    res.json(holds.createHold({ holdId, ttlMinutes, payload }));
  }catch(e){ res.status(500).json({ ok:false, error:String(e.message||e) }); }
}
function holdsConfirmHandler(req,res){
  try{
    const { holdId } = Object(req.body||{});
    res.json(holds.confirmHold(String(holdId||"")));
  }catch(e){ res.status(500).json({ ok:false, error:String(e.message||e) }); }
}
function holdsReleaseHandler(req,res){
  try{
    const { holdId } = Object(req.body||{});
    res.json(holds.releaseHold(String(holdId||"")));
  }catch(e){ res.status(500).json({ ok:false, error:String(e.message||e) }); }
}
app.post("/holds/start",   holdsStartHandler);
app.post("/holds/confirm", holdsConfirmHandler);
app.post("/holds/release", holdsReleaseHandler);
// alias legacy
app.post("/api/holds/start",   holdsStartHandler);
app.post("/api/holds/confirm", holdsConfirmHandler);
app.post("/api/holds/release", holdsReleaseHandler);

// ===== Cron holds sweep (GAS)
app.get("/crons/holds-sweep", (req,res)=>{
  const tok = (req.query?.token||"").toString();
  if (!CRON_TOKEN || tok !== CRON_TOKEN) return res.status(401).json({ ok:false, error:"unauthorized" });
  res.json({ ok:true, ...holds.sweepExpired() });
});

// ===== Bookings (Front usa /bookings; Admin lee /api/bookings)
try {
  app.use("/bookings", bookingsRouter);
  app.use("/api/bookings", bookingsRouter);
} catch {
  // opcional si se usa services/bookings estilo función:
  app.post("/bookings", async (req,res)=>{
    try{
      const up = require("./services/bookings");
      const saved = await up.saveBooking(req.body||{});
      res.json({ ok:true, booking:saved });
    }catch(e){ res.status(500).json({ ok:false, error:String(e.message||e) }); }
  });
  app.get("/api/bookings", async (_req,res)=>{
    try{
      const up = require("./services/bookings");
      const rows = await up.listBookings();
      res.json({ ok:true, rows });
    }catch(e){ res.status(500).json({ ok:false, error:String(e.message||e) }); }
  });
}

// ===== Pagos — Stripe (Front usa /payments/stripe/session)
app.post("/payments/stripe/session", async (req,res)=>{
  try{
    const order = Object(req.body?.order || req.body || {});
    if (!("total" in order)) throw new Error("missing_total");
    const out = await createCheckoutSession(order, { baseUrl: getBaseUrl(req) });
    res.json({ ok:true, ...out });
  }catch(e){
    console.error(e);
    res.status(400).json({ ok:false, error:String(e.message||e) });
  }
});

// ===== Pagos — Mercado Pago (Front usa /payments/mp/preference)
app.post("/payments/mp/preference", async (req,res)=>{
  try{
    const order = Object(req.body?.order || req.body || {});
    if (!("total" in order)) throw new Error("missing_total");
    const out = await createPreference(order, { baseUrl: getBaseUrl(req) });
    res.json({ ok:true, ...out });
  }catch(e){
    console.error(e);
    res.status(400).json({ ok:false, error:String(e.message||e) });
  }
});

// ===== Webhooks MP (raw no requerido)
const mpWebhook = buildMpWebhookHandler({
  notifySheets: (p)=>notifySheets(p),
  isDuplicate: isDup,
  log: (...a)=>console.log("[mp]",...a),
});
app.post("/webhooks/mp", mpWebhook);
app.get("/webhooks/mp", (_req,res)=> res.json({ ok:true, ping:true }));

// ===== Eventos (opcional)
if (eventsModule) {
  if (typeof eventsModule === "function") app.get("/api/events", eventsModule);
  else if (typeof eventsModule.getEvents === "function") {
    app.get("/api/events", async (_req,res)=>{
      try{
        const now = new Date();
        const events = await eventsModule.getEvents({ from: now, to: new Date(now.getTime()+30*864e5), limit: 50 });
        res.json({ ok:true, events });
      }catch(e){ res.status(500).json({ ok:false, error:"events_failed" }); }
    });
  } else {
    app.get("/api/events", (_req,res)=> res.json({ ok:true, events: [] }));
  }
} else {
  app.get("/api/events", (_req,res)=> res.json({ ok:true, events: [] }));
}

// ===== Páginas (no tocamos tu HTML)
app.get("/book",  (_req,res)=> res.sendFile(path.join(__dirname, "public", "book",  "index.html")));
app.get("/admin", (_req,res)=> res.sendFile(path.join(__dirname, "public", "admin", "index.html")));
app.get("/pago-exitoso-test", (_req,res)=> res.sendFile(path.join(__dirname, "public", "pago-exitoso-test", "index.html")));

// ===== 404 SPA-ish (solo GET sin extensión)
/* sirve /public/<path>/index.html para rutas SPA */
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
