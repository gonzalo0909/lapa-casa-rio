"use strict";
/**
 * Lapa Casa — Backend (Express)
 * - Estáticos (home y /book), reservas (Sheets), disponibilidad + HOLDs,
 *   pagos Stripe/MP con webhooks, admin opcional, eventos opcional.
 * - Incluye wrapper asMiddleware() para evitar "Router.use() requires a middleware function…".
 */
require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const cookieSession = require("cookie-session");

/* ---------- ENV ---------- */
const COMMIT = process.env.COMMIT || "dev";
const HOLD_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES || 10);
const CRON_TOKEN = String(process.env.CRON_TOKEN || "").trim();
const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";

/* ---------- App ---------- */
const app = express();
app.set("trust proxy", 1);

/* ---------- CORS ---------- */
const allowList = String(process.env.CORS_ALLOW_ORIGINS || "")
  .split(",").map(s=>s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb)=>{
    if (!origin) return cb(null, true);
    const ok = !allowList.length || allowList.some(a=>{
      if (!a) return false;
      try { return new URL(origin).hostname === a || new URL(origin).hostname.endsWith(`.${a}`); }
      catch { return origin.includes(a); }
    });
    return ok ? cb(null, true) : cb(new Error("CORS blocked"), false);
  },
  credentials:true,
  methods:["GET","POST","OPTIONS"],
  allowedHeaders:["Content-Type","Stripe-Signature"],
}));

/* ---------- Static ---------- */
app.use(express.static(path.join(__dirname, "public"), { extensions:["html"] }));
app.get("/book", (_req,res)=> res.sendFile(path.join(__dirname,"public","book","index.html")));

/* ---------- Sesión (cookie-session) ---------- */
app.use(cookieSession({
  name: "lc_admin",
  keys: [ process.env.ADMIN_SESSION_SECRET || "change_me" ],
  maxAge: 12 * 60 * 60 * 1000,
  sameSite: "lax",
  secure: isProd
}));
// shim destroy() para algunos routers
app.use((req,res,next)=>{
  if (req.session && typeof req.session.destroy !== "function") {
    req.session.destroy = (cb)=>{ req.session = null; if (cb) cb(); };
  }
  next();
});

/* ---------- Helpers ---------- */
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
function asMiddleware(mod, name) {
  const m = mod && (mod.default || mod.router || mod);
  if (typeof m !== "function") {
    throw new TypeError(`${name} no es un middleware Express (recibí ${typeof m})`);
  }
  return m;
}

/* ---------- Services ---------- */
const holds = require("./services/holds");
const { fetchRowsFromSheet, calcOccupiedBeds, notifySheets } = require("./services/sheets");

// Stripe (solo si hay claves)
let stripeSvc = null;
try { stripeSvc = require("./services/payments-stripe"); } catch {}
const stripeKeysOK = !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);

// MP (solo si hay token)
let mpSvc = null;
try { mpSvc = require("./services/payments-mp"); } catch {}
const mpOK = !!process.env.MP_ACCESS_TOKEN;

// Eventos (opcional)
let eventsModule = null;
try { eventsModule = require("./services/events"); } catch {}

/* ---------- Webhook Stripe (raw primero) ---------- */
if (stripeSvc && stripeKeysOK) {
  app.post("/webhooks/stripe",
    express.raw({ type: "application/json" }),
    stripeSvc.buildStripeWebhookHandler({
      notifySheets,
      isDuplicate: isDup,
      log: (...a)=>console.log("[stripe]",...a),
    })
  );
} else {
  console.warn("[stripe] deshabilitado (faltan STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET)");
}

/* ---------- JSON parser resto ---------- */
app.use(express.json({ limit:"2mb" }));

/* ---------- Health/Diag ---------- */
app.get("/api/health", (_req,res)=> res.json({
  ok:true, service:"lapa-casa-backend", commit:COMMIT, now:new Date().toISOString()
}));
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

/* ---------- Disponibilidad (incluye HOLDs) ---------- */
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

/* ---------- HOLDs start/confirm/release + cron ---------- */
function holdsStartHandler(req,res){
  try{
    const body = Object(req.body||{});
    const holdId = body.holdId;
    const ttlMinutes = body.ttlMinutes ?? HOLD_TTL_MINUTES;
    const payload = (body && typeof body.payload === "object") ? body.payload : body; // compat front
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
// alias legacy
app.post("/api/holds/start", holdsStartHandler);
app.post("/api/holds/confirm", holdsConfirmHandler);
app.post("/api/holds/release", holdsReleaseHandler);

app.get("/crons/holds-sweep", (req,res)=>{
  const tok = (req.query?.token||"").toString();
  if (!CRON_TOKEN || tok !== CRON_TOKEN) return res.status(401).json({ ok:false, error:"unauthorized" });
  res.json({ ok:true, ...holds.sweepExpired() });
});

/* ---------- Bookings Router (Sheets) ---------- */
const bookingsRouter = asMiddleware(require("./services/bookings"), "bookingsRouter");
app.use("/bookings", bookingsRouter);
app.use("/api/bookings", bookingsRouter);

/* ---------- Admin (opcional) ---------- */
try {
  const adminRouter = asMiddleware(require("./routes/admin"), "adminRouter");
  app.use("/admin", adminRouter);
} catch (e) {
  console.warn("[admin] opcional:", e.message);
}
app.get("/admin", (_req,res)=> res.sendFile(path.join(__dirname, "admin", "index.html")));

/* ---------- Pagos Stripe ---------- */
if (stripeSvc && stripeKeysOK) {
  app.post("/payments/stripe/session", async (req,res)=>{
    try{
      const order = Object(req.body?.order || req.body || {});
      if (!("total" in order)) throw new Error("missing_total");
      const out = await stripeSvc.createCheckoutSession(order, { baseUrl: getBaseUrl(req) });
      res.json({ ok:true, ...out });
    }catch(e){ res.status(400).json({ ok:false, error:String(e.message||e) }); }
  });

  // alias compat
  app.post("/payments/stripe/create_intent", async (req,res)=>{
    try{
      const order = Object(req.body?.order || req.body || {});
      if (!("total" in order)) throw new Error("missing_total");
      const out = await stripeSvc.createCheckoutSession(order, { baseUrl: getBaseUrl(req) });
      res.json({ ok:true, ...out });
    }catch(e){ res.status(400).json({ ok:false, error:String(e.message||e) }); }
  });
}

/* ---------- Pagos Mercado Pago ---------- */
if (mpSvc && mpOK) {
  app.post("/payments/mp/preference", async (req,res)=>{
    try{
      const b = Object(req.body||{});
      const order = b.order ? b.order : {
        booking_id: b?.metadata?.bookingId || b.booking_id || b.bookingId,
        total: Number(b.unit_price || b.total || 0)
      };
      if (!("total" in order)) throw new Error("missing_total");
      const out = await mpSvc.createPreference(order, { baseUrl: getBaseUrl(req) });
      res.json({ ok:true, ...out });
    }catch(e){ res.status(400).json({ ok:false, error:String(e.message||e) }); }
  });

  const mpWebhook = mpSvc.buildMpWebhookHandler({
    notifySheets,
    isDuplicate: isDup,
    log: (...a)=>console.log("[mp]",...a),
  });
  app.post("/webhooks/mp", mpWebhook);
  app.get("/webhooks/mp", (_req,res)=> res.json({ ok:true, ping:true }));
} else {
  console.warn("[mercado-pago] deshabilitado (falta MP_ACCESS_TOKEN)");
}

/* ---------- Eventos (opcional) ---------- */
if (eventsModule) {
  if (typeof eventsModule === "function") app.get("/api/events", eventsModule);
  else if (typeof eventsModule.eventsHandler === "function") app.get("/api/events", eventsModule.eventsHandler);
  else if (typeof eventsModule.getEvents === "function") {
    app.get("/api/events", async (_req,res)=>{
      try { const events = await eventsModule.getEvents(); res.json({ ok:true, events }); }
      catch { res.json({ ok:true, events: [] }); }
    });
  } else app.get("/api/events", (_req,res)=> res.json({ ok:true, events: [] }));
} else {
  app.get("/api/events", (_req,res)=> res.json({ ok:true, events: [] }));
}

/* ---------- Páginas extra ---------- */
app.get("/pago-exitoso-test", (_req,res)=> {
  // Servido como página estática en /public/pago-exitoso-test/index.html
  res.sendFile(path.join(__dirname, "public", "pago-exitoso-test", "index.html"));
});

/* ---------- 404 SPA-ish ---------- */
app.use((req,res,next)=>{
  if (req.method!=="GET" || path.extname(req.path)) return next();
  const safe = path.join(__dirname, "public", req.path, "index.html");
  res.sendFile(safe, (err)=> err ? res.status(404).send("Not found") : undefined);
});

/* ---------- Start ---------- */
if (require.main === module) {
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, ()=> console.log(`[lapa-casa] up :${PORT} commit=${COMMIT}`));
}

module.exports = app;
