"use strict";
/**
 * Lapa Casa — Backend thin index (Express)
 * Endpoints: health, availability, bookings, holds, payments (Stripe/MP), webhooks, events
 * Sirve estáticos /, /book/, /admin/ y fallback SPA-ish.
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

// ==== Static first
app.use(express.static(path.join(__dirname, "public"), { extensions:["html"] }));
app.get("/book", (_req,res)=> res.sendFile(path.join(__dirname,"public","book","index.html")));
app.get("/admin", (_req,res)=> res.sendFile(path.join(__dirname,"public","admin","index.html")));

// ==== Sessions (para /admin/login en router)
app.use(cookieSession({
  name:"sess",
  secret: SESSION_SECRET,
  sameSite:"lax",
  httpOnly:true,
}));

// ==== Stripe webhook (RAW *antes* del JSON parser)
const { buildStripeWebhookHandler } = require("./services/payments-stripe");
const { buildMpWebhookHandler }     = require("./services/payments-mp");
const { notifySheets }              = require("./services/sheets");

app.post("/webhooks/stripe",
  express.raw({ type:"application/json" }),
  buildStripeWebhookHandler({
    notifySheets,
    isDuplicate: isDup,
    log: (...a)=>console.log("[stripe]",...a),
  })
);

// MP webhook
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

// ==== Admin (login/logout) y Crons (sweep holds)
try { app.use("/admin", require("./routes/admin")); } catch {}
try { app.use("/api/crons", require("./routes/crons")); } catch {}

// ==== Payments public endpoints
const stripeSrv = require("./services/payments-stripe");
const mpSrv     = require("./services/payments-mp");

app.post("/payments/stripe/session", async (req,res)=>{
  try{
    const orderIn = Object(req.body?.order || req.body || {});
    if (!("total" in orderIn)) throw new Error("missing_total");
    const out = await stripeSrv.createCheckoutSession(orderIn, { baseUrl: getBaseUrl(req) });
    res.json({ ok:true, ...out });
  }catch(e){ res.status(400).json({ ok:false, error:String(e.message||e) }); }
});

app.post("/payments/mp/preference", async (req,res)=>{
  try{
    // Soporta {order:{ booking_id, total }} o { unit_price, external_reference, metadata }
    const b = req.body || {};
    const order = b.order ? b.order : {
      booking_id: b.booking_id || b.external_reference || (b.metadata && (b.metadata.booking_id || b.metadata.bookingId)),
      total: (typeof b.total !== "undefined") ? b.total : b.unit_price
    };
    if (!("total" in order)) throw new Error("missing_total");
    const out = await mpSrv.createPreference(order, { baseUrl: getBaseUrl(req) });
    res.json({ ok:true, ...out });
  }catch(e){ res.status(400).json({ ok:false, error:String(e.message||e) }); }
});

// Pago OK test
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

// ==== Diag
app.get("/api/diag", (_req,res)=> res.json({
  ok:true, service:"lapa-casa-backend", commit:COMMIT, now:new Date().toISOString(),
  env:{
    BASE_URL: !!BASE_URL,
    HOLD_TTL_MINUTES,
    CORS_ALLOW_ORIGINS: CORS_ALLOW.length,
  }
}));

// ==== 404 SPA-ish
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
