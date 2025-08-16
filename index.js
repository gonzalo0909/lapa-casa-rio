"use strict";
/**
 * Lapa Casa Backend — Render (modular, usando /services/*)
 * Sirve estáticos /public, APIs: health, availability, bookings, holds, events,
 * pagos (Stripe/MP) y webhooks. Idempotencia, CORS, rate-limit.
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const { fetchRowsFromSheet, calcOccupiedBeds, postToSheets } = require("./services/sheets");
const eventsHandler = require("./services/events");
const bookingsRouter = require("./services/bookings");
const { createHold, releaseHold, confirmHold, sweepExpired } = require("./services/holds");
const { createCheckoutSession, buildStripeWebhookHandler } = require("./services/payments-stripe");
const { createPreference, buildMpWebhookHandler } = require("./services/payments-mp");

/* ===== ENV ===== */
const BASE_URL = (process.env.BASE_URL || "").replace(/\/$/, "") || "https://lapa-casa-backend.onrender.com";
const CORS_ALLOW_ORIGINS = (process.env.CORS_ALLOW_ORIGINS || "").split(",").map(s=>s.trim()).filter(Boolean);
const HOLD_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES || 10);
const CRON_TOKEN = process.env.CRON_TOKEN || "";

/* ===== App ===== */
const app = express();
app.set("trust proxy", 1);

/* ===== Stripe webhook (raw) antes de JSON ===== */
app.post(["/webhooks/stripe","/api/webhooks/stripe"], express.raw({ type: "application/json" }),
  buildStripeWebhookHandler({
    notifySheets: async (bookingId, status, total) => {
      await postToSheets({ action:"payment_update", booking_id: bookingId, status, total });
      invalidateAvailabilityCache();
    },
    isDuplicate: makeDeduper(),
    log: logPush
  })
);

/* ===== Middlewares comunes ===== */
const corsOptions = {
  origin: (origin, cb) => {
    if (CORS_ALLOW_ORIGINS.length === 0) return cb(null, true);
    if (!origin) return cb(null, true);
    const ok = CORS_ALLOW_ORIGINS.some(p => matchOrigin(origin, p));
    cb(null, ok);
  },
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());

/* ===== Static ===== */
app.use(express.static(path.join(__dirname,"public"), { index:"index.html", extensions:["html"] }));

/* ===== Health ===== */
app.get(["/","/api/health"], (req,res)=>{
  if (req.path === "/") return res.send("Backend Lapa Casa activo 🚀");
  res.json({ ok:true, service:"lapa-casa-backend", ts:Date.now() });
});

/* ===== Bookings (router dedicado) ===== */
app.use(["/bookings","/api/bookings"], rateLimit(60), bookingsRouter);

/* ===== Availability (cache 60s) ===== */
const availabilityCache = new Map(); // key "from:to" -> {ts,data}
const AVAIL_TTL_MS = 60_000;

app.get(["/availability","/api/availability"], async (req,res)=>{
  try{
    const from = String(req.query.from || "").slice(0,10);
    const to   = String(req.query.to   || "").slice(0,10);
    if (!from || !to) return res.status(400).json({ ok:false, error:"missing_from_to" });

    const key = `${from}:${to}`; const now = Date.now();
    const cached = availabilityCache.get(key);
    if (cached && now - cached.ts < AVAIL_TTL_MS) return res.json(cached.data);

    const rows = await fetchRowsFromSheet();
    const occupied = calcOccupiedBeds(rows, from, to);
    const out = { ok:true, from, to, occupied };
    availabilityCache.set(key, { ts: now, data: out });
    res.json(out);
  }catch(e){
    logPush("availability_error",{ msg:e?.message||String(e) });
    res.status(500).json({ ok:false, error:"availability_failed" });
  }
});

/* ===== HOLDs ===== */
app.post(["/holds/start","/api/holds/start"], rateLimit(60), async (req,res)=>{
  try{
    const b = req.body || {};
    const result = await createHold({
      holdId: b.holdId || b.bookingId,
      ttlMinutes: b.ttlMinutes || HOLD_TTL_MINUTES,
      payload: {
        nombre: b.nombre||"HOLD", email:b.email||"", telefono:b.telefono||"",
        entrada:b.entrada||"", salida:b.salida||"", hombres:+b.hombres||0, mujeres:+b.mujeres||0,
        camas:b.camas||{}, total:+b.total||0
      }
    });
    invalidateAvailabilityCache();
    res.json(result);
  }catch(e){
    logPush("hold_start_error",{ msg:e?.message||String(e) });
    res.status(500).json({ ok:false, error:"hold_start_failed" });
  }
});
app.post(["/holds/release","/api/holds/release"], rateLimit(60), async (req,res)=>{
  try{ const out = await releaseHold(req.body?.holdId||""); invalidateAvailabilityCache(); res.json(out); }
  catch(e){ logPush("hold_release_error",{ msg:e?.message||String(e) }); res.status(500).json({ ok:false, error:"hold_release_failed" }); }
});
app.post(["/holds/confirm","/api/holds/confirm"], rateLimit(60), async (req,res)=>{
  try{ const out = await confirmHold(req.body?.holdId||"", req.body?.status||"paid"); invalidateAvailabilityCache(); res.json(out); }
  catch(e){ logPush("hold_confirm_error",{ msg:e?.message||String(e) }); res.status(500).json({ ok:false, error:"hold_confirm_failed" }); }
});

/* ===== Events ===== */
app.get(["/events","/api/events"], eventsHandler);

/* ===== Pagos: Stripe (checkout session) ===== */
app.post(["/payments/stripe/session","/api/payments/stripe/session"], rateLimit(30), async (req,res)=>{
  try{
    const order = req.body?.order || {};
    const j = await createCheckoutSession(order, { baseUrl: BASE_URL });
    res.json(j);
  }catch(err){
    logPush("stripe_error",{ where:"create_session", msg:err?.message||String(err) });
    res.status(500).json({ error:"stripe_session_error" });
  }
});

/* ===== Pagos: Mercado Pago ===== */
app.get(["/pago-exitoso-test","/api/pago-exitoso-test"], (_req,res)=>
  res.type("html").send(`<!doctype html><meta charset="utf-8"><title>Pago aprobado</title><body style="font-family:Arial;text-align:center;padding:50px"><h1 style="color:green">✅ Pago aprobado</h1><p>Tu pago de prueba en Mercado Pago fue exitoso.</p></body>`)
);
app.post(["/payments/mp/preference","/api/payments/mp/preference"], rateLimit(30), async (req,res)=>{
  try{
    const payload = req.body || {};
    const out = await createPreference(payload, { baseUrl: BASE_URL });
    res.json(out);
  }catch(err){
    logPush("mp_error",{ where:"create_preference", msg:err?.message||String(err) });
    res.status(500).json({ error:"mp_preference_failed" });
  }
});
app.post(["/webhooks/mp","/api/webhooks/mp"],
  buildMpWebhookHandler({
    notifySheets: async (bookingId, status, total)=>{
      await postToSheets({ action:"payment_update", booking_id: bookingId, status, total });
      invalidateAvailabilityCache();
    },
    isDuplicate: makeDeduper(),
    log: logPush
  })
);

/* ===== Cron: barrido de holds (con token) ===== */
app.get(["/crons/holds-sweep","/api/crons/holds-sweep"], (req,res)=>{
  if (!CRON_TOKEN || (req.query.token || "") !== CRON_TOKEN) return res.status(401).json({ ok:false, error:"unauthorized" });
  const stats = sweepExpired();
  invalidateAvailabilityCache();
  res.json({ ok:true, ...stats });
});

/* ===== Utils ===== */
function makeDeduper(ttlMs = 15*60_000){
  const recent = new Map();
  return (key)=>{
    const now = Date.now();
    for (const [k,ts] of [...recent.entries()]) if (now - ts > ttlMs) recent.delete(k);
    if (recent.has(key)) return true;
    recent.set(key, now);
    return false;
  };
}
function invalidateAvailabilityCache(){ availabilityCache.clear(); }
function matchOrigin(origin, pattern){
  try{
    if (pattern==="*") return true;
    if (pattern.startsWith("http://")||pattern.startsWith("https://")) return origin===pattern;
    const u=new URL(origin); const host=u.host;
    return host===pattern || host.endsWith("."+pattern);
  }catch{ return origin===pattern; }
}
const rlStore = new Map();
function rateLimit(maxPerMin = 60) {
  const WINDOW = 60_000;
  return (req, res, next) => {
    const ip = req.ip || "unknown";
    const now = Date.now();
    const rec = rlStore.get(ip) || { count: 0, reset: now + WINDOW };
    if (now > rec.reset) { rec.count = 0; rec.reset = now + WINDOW; }
    rec.count++; rlStore.set(ip, rec);
    if (rec.count > maxPerMin) return res.status(429).json({ ok:false, error:"rate_limited" });
    next();
  };
}
const LOG_MAX = 200;
const logs = [];
function logPush(type, payload){ logs.push({ ts:Date.now(), type, payload }); if (logs.length>LOG_MAX) logs.shift(); }

/* ===== Server ===== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log(`Servidor escuchando en puerto ${PORT}`));
