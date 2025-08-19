"use strict";
/**
 * Lapa Casa — Backend consolidado (Express)
 * - Monta: health, availability, bookings, holds, payments (Stripe/MP), crons, events, inbound-email
 * - Webhooks Stripe/MP (raw para Stripe)
 * - Admin: estáticos + login con cookie-session + whitelist IP opcional
 * - Endpoints extra: /payments/status
 */

require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieSession = require("cookie-session");

// === ENV
const PORT = process.env.PORT || 3000;
const COMMIT = process.env.COMMIT || "dev";
const BASE_URL = (process.env.BASE_URL || "").replace(/\/+$/,"");
const HOLD_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES || 10);
const CORS_ALLOW = String(process.env.CORS_ALLOW_ORIGINS || "")
  .split(",").map(s=>s.trim()).filter(Boolean);
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "change-me";
const INBOUND_TOKEN = (process.env.INBOUND_TOKEN || "").trim();

// ==== App
const app = express();
app.set("trust proxy", 1);

// ==== Helpers
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

// ==== CORS
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

// ==== Security
app.use(helmet({ crossOriginResourcePolicy:false }));

// ==== Static first (landing, /book/, /admin/)
app.use(express.static(path.join(__dirname, "public"), { extensions:["html"] }));
app.get("/book", (_req,res)=> res.sendFile(path.join(__dirname,"public","book","index.html")));
app.get("/admin", (_req,res)=> res.sendFile(path.join(__dirname,"public","admin","index.html")));

// ==== Sessions (para /admin/login)
app.use(cookieSession({
  name:"sess",
  secret: SESSION_SECRET,
  sameSite:"lax",
  httpOnly:true,
}));

// ==== Admin IP whitelist (opcional)
const adminIpWhitelist = (process.env.ADMIN_IP_WHITELIST || "")
  .split(",").map(s=>s.trim()).filter(Boolean);
function ipAllowed(req){
  if (!adminIpWhitelist.length) return true;
  const ip = (req.headers["x-forwarded-for"]||"").split(",")[0].trim() || req.ip || "";
  const x = ip.toLowerCase();
  return adminIpWhitelist.some(w=>{
    const s = w.toLowerCase();
    if (s.includes("/")) { // prefijo simple
      const pref = s.split("/")[0];
      return x.startsWith(pref);
    }
    return x===s;
  });
}
// protege POST de login/logout y /admin/* JSON
app.use((req,res,next)=>{
  if (req.path.startsWith("/admin") && req.method==="POST" && !ipAllowed(req)){
    return res.status(403).json({ ok:false, error:"ip_forbidden" });
  }
  next();
});

// ==== Stripe webhook (RAW *antes* del JSON parser)
const { buildStripeWebhookHandler } = require("./services/payments-stripe");
const { buildMpWebhookHandler }     = require("./services/payments-mp");
const { notifySheets, fetchRowsFromSheet } = require("./services/sheets");
const { getHold } = require("./services/holds");

app.post("/webhooks/stripe",
  express.raw({ type:"application/json" }),
  buildStripeWebhookHandler({
    notifySheets,
    isDuplicate: isDup,
    log: (...a)=>console.log("[stripe]",...a),
  })
);

// MP webhook (no requiere raw)
app.post("/webhooks/mp",
  buildMpWebhookHandler({
    notifySheets,
    isDuplicate: isDup,
    log: (...a)=>console.log("[mp]",...a),
  })
);

// ==== JSON parser (después del webhook RAW)
app.use(express.json());

// ==== Routers (API)
app.use("/api/health", require("./routes/health"));
app.use("/availability", require("./routes/availability"));
app.use("/bookings", require("./routes/bookings"));
app.use("/api/bookings", require("./routes/bookings")); // alias
app.use("/holds", require("./routes/holds"));
try { app.use("/api/events", require("./routes/events")); } catch { /* opcional */ }

// admin auth (login/logout)
try { app.use("/admin", require("./routes/admin-auth")); } catch {}

// crons (para GAS)
try { app.use("/api/crons", require("./routes/crons")); } catch {}

// inbound email (idempotente) — solo si hay token
try {
  if (INBOUND_TOKEN) require("./routes/inbound-email")(app);
} catch {}

// ==== Payments public endpoints (compat front) — total sólido desde HOLD
const stripeSrv = require("./services/payments-stripe");
const mpSrv     = require("./services/payments-mp");

app.post("/payments/stripe/session", async (req,res)=>{
  try{
    const order = Object(req.body?.order || req.body || {});
    const holdId = order.booking_id || order.bookingId;
    if (!holdId) throw new Error("missing_booking_id");
    const hold = getHold(holdId);
    if (!hold) throw new Error("hold_not_found_or_expired");
    order.total = Number(hold.meta?.total || 0); // ignora total de cliente
    order.booking_id = holdId;
    if (!("total" in order) || order.total <= 0) throw new Error("missing_total");
    const out = await stripeSrv.createCheckoutSession(order, { baseUrl: getBaseUrl(req) });
    res.json({ ok:true, ...out });
  }catch(e){ res.status(400).json({ ok:false, error:String(e.message||e) }); }
});

app.post("/payments/mp/preference", async (req,res)=>{
  try{
    const order = Object(req.body?.order || req.body || {});
    const holdId = order.booking_id || order.bookingId;
    if (!holdId) throw new Error("missing_booking_id");
    const hold = getHold(holdId);
    if (!hold) throw new Error("hold_not_found_or_expired");
    order.total = Number(hold.meta?.total || 0); // ignora total de cliente
    order.booking_id = holdId;
    if (!("total" in order) || order.total <= 0) throw new Error("missing_total");
    const out = await mpSrv.createPreference(order, { baseUrl: getBaseUrl(req) });
    res.json({ ok:true, ...out });
  }catch(e){ res.status(400).json({ ok:false, error:String(e.message||e) }); }
});

// Estado de pago (para el front)
app.get("/payments/status", async (req,res)=>{
  try{
    const bookingId = String(req.query.bookingId || req.query.booking_id || "").trim();
    if (!bookingId) return res.json({ ok:true, paid:false, status:"pending" });
    const rows = await fetchRowsFromSheet();
    const row = rows.find(r=> String(r.booking_id||"")===bookingId);
    const status = (row?.pay_status || "pending").toLowerCase();
    res.json({ ok:true, paid: status==="paid" || status==="approved", status });
  }catch(e){ res.json({ ok:true, paid:false, status:"pending" }); }
});

// Pago OK de prueba (fallback si falta HTML)
app.get("/pago-exitoso-test", (req,res)=>{
  const file = path.join(__dirname,"public","pago-exitoso-test","index.html");
  res.sendFile(file, (err)=> {
    if (err) {
      res.type("html").send(`<!doctype html><meta charset="utf-8"><title>Pago aprobado</title>
        <body style="font-family:Arial;text-align:center;padding:50px">
        <h1 style="color:green">✅ Pago aprobado</h1>
        <p><a href="/book/?paid=1">Volver a reservar</a></p></body>`);
    }
  });
});

// ==== Diag simple
app.get("/api/diag", (_req,res)=> res.json({
  ok:true, service:"lapa-casa-backend", commit:COMMIT, now:new Date().toISOString(),
  env:{
    BASE_URL: !!BASE_URL,
    HOLD_TTL_MINUTES,
    CORS_ALLOW_ORIGINS: CORS_ALLOW.length,
  }
}));

// ==== 404 SPA-ish (GET sin extensión -> /public/<path>/index.html)
app.use((req,res,next)=>{
  if (req.method !== "GET") return next();
  if (path.extname(req.path)) return next();
  const safe = path.join(__dirname, "public", req.path, "index.html");
  res.sendFile(safe, (err)=> err ? res.status(404).send("Not found") : undefined);
});

// ==== Start
if (require.main === module) {
  app.listen(PORT, ()=> console.log(`[lapa-casa] up :${PORT} commit=${COMMIT}`));
}

module.exports = app;
