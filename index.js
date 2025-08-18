// /index.js
"use strict";
/**
 * Lapa Casa — Backend (Express) FINAL (una sola pieza)
 * Mantiene el layout tal cual (home y /book). API: reservas, disponibilidad (con HOLD),
 * pagos (Stripe/MP), webhooks, admin, eventos. Sesión con cookie-session (sin MemoryStore).
 */

require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const cookieSession = require("cookie-session");

const app = express();
const COMMIT = process.env.COMMIT || "dev";
const HOLD_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES || 10);
const CRON_TOKEN = String(process.env.CRON_TOKEN || "").trim();
const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";

// ===== CORS
const allowList = String(process.env.CORS_ALLOW_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const ok = !allowList.length || allowList.some(a => {
      if (!a) return false;
      try { return new URL(origin).hostname === a; } catch { return origin.includes(a); }
    });
    return ok ? cb(null, true) : cb(new Error("CORS blocked"), false);
  },
  credentials: true,
  methods: ["GET","POST","OPTIONS"],
  allowedHeaders: ["Content-Type","Stripe-Signature"],
}));

// ===== Static (no tocamos tu front)
app.use(express.static(path.join(__dirname, "public"), { extensions:["html"] }));

// ===== Sesión (sin MemoryStore)
app.set("trust proxy", 1);
app.use(cookieSession({
  name: "lc_admin",
  keys: [ process.env.ADMIN_SESSION_SECRET || "change_me" ],
  maxAge: 12 * 60 * 60 * 1000, // 12h
  sameSite: "lax",
  secure: isProd
}));
// shim para routes/admin.js (req.session.destroy)
app.use((req,res,next)=>{
  if (req.session && typeof req.session.destroy !== "function") {
    req.session.destroy = (cb)=>{ req.session = null; if (cb) cb(); };
  }
  next();
});

// ===== Services
const holds = require("./services/holds"); // TTL + getHoldsMap()
const bookingsRouter = require("./services/bookings"); // Router POST/GET
const { fetchRowsFromSheet, calcOccupiedBeds, notifySheets } = require("./services/sheets");
const { createCheckoutSession, buildStripeWebhookHandler } = require("./services/payments-stripe");
const { createPreference, buildMpWebhookHandler } = require("./services/payments-mp");

// Eventos (puede exportar función o handler)
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

// ===== Stripe webhook (raw primero)
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
    BOOKINGS_WEBAPP_URL:!!process.env.BOOKINGS_WEBAPP_URL,
    STRIPE_SECRET_KEY:!!process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET:!!process.env.STRIPE_WEBHOOK_SECRET,
    MP_ACCESS_TOKEN:!!process.env.MP_ACCESS_TOKEN,
    ENABLE_EVENTS:String(process.env.ENABLE_EVENTS||"")
  }
}));

// ===== Disponibilidad (incluye HOLDs) + alias
async function availabilityHandler(req,res){
  try{
    const q = req.query||{};
    const from = (q.from||"").toString().slice(0,10);
    const to   = (q.to||"").toString().slice(0,10);
    const today = new Date();
    const dFrom = from || today.toISOString().slice(0,10);
    const dTo   = to   || new Date(today.getTime()+30*86400000).toISOString().slice(0,10);

    const rows = await fetchRowsFromSheet();
    const holdsMap = holds.getHoldsMap();
    const occupied = calcOccupiedBeds(rows, dFrom, dTo, holdsMap);

    res.json({ ok:true, from:dFrom, to:dTo, occupied });
  }catch(e){ res.status(500).json({ ok:false, error:String(e.message||e) }); }
}
app.get("/availability", availabilityHandler);
app.get("/api/availability", availabilityHandler);

// ===== Holds (start/confirm/release) + cron sweep (y alias /api/*)
function holdsStartHandler(req,res){
  try{
    const { holdId, ttlMinutes=HOLD_TTL_MINUTES, payload={} } = Object(req.body||{});
    res.json(holds.createHold({ holdId, ttlMinutes, payload }));
  }catch(e){ res.status(500).json({ ok:false, error:String(e.message||e) }); }
}
function holdsConfirmHandler(req,res){
  try{ res.json(holds.confirmHold(String(req.body?.holdId||""))); }
  catch(e){ res.status(500).json({ ok:false, error:String(e.message||e) }); }
}
function holdsReleaseHandler(req,res){
  try{ res.json(holds.releaseHold(String(req.body?.holdId||""))); }
  catch(e){ res.status(500).json({ ok:false, error:String(e.message||e) }); }
}
app.post("/holds/start", holdsStartHandler);
app.post("/holds/confirm", holdsConfirmHandler);
app.post("/holds/release", holdsReleaseHandler);
app.post("/api/holds/start", holdsStartHandler);
app.post("/api/holds/confirm", holdsConfirmHandler);
app.post("/api/holds/release", holdsReleaseHandler);

app.get("/crons/holds-sweep", (req,res)=>{
  const tok = (req.query?.token||"").toString();
  if (!CRON_TOKEN || tok !== CRON_TOKEN) return res.status(401).json({ ok:false, error:"unauthorized" });
  res.json({ ok:true, ...holds.sweepExpired() });
});

// ===== Bookings (router) + alias
app.use("/bookings", bookingsRouter);
app.use("/api/bookings", bookingsRouter);

// ===== Pagos — Stripe (front envía {order})
app.post("/payments/stripe/session", async (req,res)=>{
  try{
    const order = Object(req.body?.order || req.body || {});
    if (!("total" in order)) throw new Error("missing_total");
    const out = await createCheckoutSession(order, { baseUrl: getBaseUrl(req) });
    res.json({ ok:true, ...out });
  }catch(e){ res.status(400).json({ ok:false, error:String(e.message||e) }); }
});
// compat alias
app.post("/payments/stripe/create_intent", async (req,res)=>{
  try{
    const order = Object(req.body?.order || req.body || {});
    if (!("total" in order)) throw new Error("missing_total");
    const out = await createCheckoutSession(order, { baseUrl: getBaseUrl(req) });
    res.json({ ok:true, ...out });
  }catch(e){ res.status(400).json({ ok:false, error:String(e.message||e) }); }
});

// ===== Pagos — Mercado Pago (compat con body del front actual)
app.post("/payments/mp/preference", async (req,res)=>{
  try{
    const b = Object(req.body||{});
    const order = b.order ? b.order : {
      booking_id: b?.metadata?.bookingId || b.booking_id || b.bookingId,
      total: Number(b.unit_price || b.total || 0)
    };
    if (!("total" in order)) throw new Error("missing_total");
    const out = await createPreference(order, { baseUrl: getBaseUrl(req) });
    res.json({ ok:true, ...out });
  }catch(e){ res.status(400).json({ ok:false, error:String(e.message||e) }); }
});

// ===== Webhook MP
const mpWebhook = buildMpWebhookHandler({
  notifySheets,
  isDuplicate: isDup,
  log: (...a)=>console.log("[mp]",...a),
});
app.post("/webhooks/mp", mpWebhook);
app.get("/webhooks/mp", (_req,res)=> res.json({ ok:true, ping:true }));

// ===== Eventos
if (eventsModule) {
  if (typeof eventsModule === "function") {
    app.get("/api/events", eventsModule);
  } else if (typeof eventsModule.eventsHandler === "function") {
    app.get("/api/events", eventsModule.eventsHandler);
  } else if (typeof eventsModule.getEvents === "function") {
    app.get("/api/events", async (_req,res)=>{
      try { const events = await eventsModule.getEvents(); res.json({ ok:true, events }); }
      catch { res.json({ ok:true, events: [] }); }
    });
  } else {
    app.get("/api/events", (_req,res)=> res.json({ ok:true, events: [] }));
  }
} else {
  app.get("/api/events", (_req,res)=> res.json({ ok:true, events: [] }));
}

// ===== Admin (router + html)
try {
  const adminRouter = require("./routes/admin");
  app.use("/admin", adminRouter);
} catch { /* admin opcional */ }
app.get("/admin", (_req,res)=> res.sendFile(path.join(__dirname, "admin", "index.html")));

// ===== Páginas (no cambiamos tu HTML)
app.get("/book", (_req,res)=> res.sendFile(path.join(__dirname, "public", "book", "index.html")));

// ===== 404 SPA-ish (GET sin extensión)
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
