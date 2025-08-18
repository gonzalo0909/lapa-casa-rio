"use strict";
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const Stripe = require("stripe");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const crypto = require("crypto");
const path = require("path");

// ====== ENV
const BASE_URL = (process.env.BASE_URL || "").replace(/\/$/, "") || "https://lapa-casa-backend.onrender.com";
const BOOKINGS_WEBAPP_URL = process.env.BOOKINGS_WEBAPP_URL || ""; // GAS Web App URL (must allow "Anyone")
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";
const STRIPE_SK = process.env.STRIPE_SK || process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const ADMIN_USER = process.env.ADMIN_USER || "";
const ADMIN_PASS = process.env.ADMIN_PASS || "";
const ADMIN_REALM = "LapaCasaAdmin";
const CRON_TOKEN = process.env.CRON_TOKEN || "";
const HOLD_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES || 10);
const CORS_ALLOW_ORIGINS = (process.env.CORS_ALLOW_ORIGINS || "").split(",").map(s=>s.trim()).filter(Boolean);

// NUEVO (Eventos reales)
const EVENTS_CACHE_TTL_HOURS = parseInt(process.env.EVENTS_CACHE_TTL_HOURS || "24", 10);
const EVENTBRITE_TOKEN = process.env.EVENTBRITE_TOKEN || "";
const EVENTS_ICS_URLS = process.env.EVENTS_ICS_URLS || "";

// Room capacities
const ROOMS = { "1": { name:"Cuarto 1 (12 mixto)", cap:12 }, "3": { name:"Cuarto 3 (12 mixto)", cap:12 }, "5": { name:"Cuarto 5 (7 mixto)", cap:7 }, "6": { name:"Cuarto 6 (7 femenino)", cap:7 } };

// iCal import sources (optional)
const ICAL_ROOM_1 = process.env.ICAL_ROOM_1 || "";
const ICAL_ROOM_3 = process.env.ICAL_ROOM_3 || "";
const ICAL_ROOM_5 = process.env.ICAL_ROOM_5 || "";
const ICAL_ROOM_6 = process.env.ICAL_ROOM_6 || "";

// Overbooking buffers (virtual occupancy per room)
const DEFAULT_ROOM_BUFFER = Number(process.env.BOOKING_BUFFER_PER_ROOM || 0);
const ROOM_BUFFER_1 = Number(process.env.ROOM_BUFFER_1 || DEFAULT_ROOM_BUFFER);
const ROOM_BUFFER_3 = Number(process.env.ROOM_BUFFER_3 || DEFAULT_ROOM_BUFFER);
const ROOM_BUFFER_5 = Number(process.env.ROOM_BUFFER_5 || DEFAULT_ROOM_BUFFER);
const ROOM_BUFFER_6 = Number(process.env.ROOM_BUFFER_6 || DEFAULT_ROOM_BUFFER);

// ====== App
const app = express();
app.set("trust proxy", 1);

// ========= Logs & helpers
const LOG_MAX = 300;
const logs = [];
function logPush(type, payload) {
  logs.push({ ts: Date.now(), type, payload });
  if (logs.length > LOG_MAX) logs.shift();
}
function redact(v){ if(!v) return "—"; const s=String(v); return s.length<=10 ? "•••" : s.slice(0,6)+"…"+s.slice(-4); }

// Request-ID + access log
app.use((req,res,next)=>{
  const rid = crypto.randomUUID();
  res.locals.rid = rid;
  const started = Date.now();
  res.on("finish", ()=>{
    logPush("access", { rid, m:req.method, u:req.originalUrl, s:res.statusCode, ms:Date.now()-started, ip:req.ip });
  });
  next();
});

// ====== Stripe Webhook (raw body required)
const stripe = STRIPE_SK ? new Stripe(STRIPE_SK) : null;
app.post("/webhooks/stripe", express.raw({ type:"application/json" }), async (req,res)=>{
  try{
    if(!stripe || !STRIPE_WEBHOOK_SECRET) return res.status(200).send("ok");
    const sig = req.headers["stripe-signature"];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      logPush("stripe_bad_sig", { msg: err.message });
      return res.status(400).send("invalid signature");
    }

    const t = event.type;
    logPush("stripe_event", { type: t, id: event.id });

    async function notifySheets(bookingId, status, total) {
      if(!bookingId || !BOOKINGS_WEBAPP_URL) return;
      try {
        await fetch(BOOKINGS_WEBAPP_URL, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ action:"payment_update", booking_id: bookingId, status, total }) });
        invalidateAvailabilityCache();
      } catch (e) {
        logPush("sheets_error", { via:"stripe", msg:e?.message||String(e) });
      }
    }

    if (t === "checkout.session.completed") {
      const s = event.data.object;
      const bookingId = s.client_reference_id || s.metadata?.bookingId || "";
      const total = (s.amount_total || 0)/100;
      await notifySheets(bookingId, "approved", total);
    } else if (t === "checkout.session.expired" || t === "checkout.session.async_payment_failed") {
      const s = event.data.object;
      const bookingId = s.client_reference_id || s.metadata?.bookingId || "";
      await notifySheets(bookingId, "rejected", (s.amount_total||0)/100);
    } else if (t === "charge.refunded" || t === "charge.refund.updated") {
      const c = event.data.object;
      let bookingId = "";
      const pi = c.payment_intent;
      if (pi) {
        try {
          const piObj = await stripe.paymentIntents.retrieve(pi);
          bookingId = piObj?.metadata?.bookingId || "";
        } catch {}
      }
      await notifySheets(bookingId, "refunded", (c.amount||0)/100);
    } else if (t === "payment_intent.payment_failed") {
      const pi = event.data.object;
      const bookingId = pi?.metadata?.bookingId || "";
      await notifySheets(bookingId, "rejected", (pi.amount||0)/100);
    }

    return res.status(200).send("ok");
  } catch(e){
    logPush("stripe_webhook_error", { msg: e?.message||String(e) });
    return res.status(200).send("ok");
  }
});

// ====== Security & JSON
app.use(helmet({ crossOriginResourcePolicy: false }));
const corsOptions = {
  origin: (origin, cb)=>{
    if (!CORS_ALLOW_ORIGINS.length) return cb(null, true);
    if (!origin) return cb(null, true);
    const ok = CORS_ALLOW_ORIGINS.some(o => origin === o || origin.endsWith("."+o.replace(/^https?:\/\//,"")));
    cb(null, ok ? true : false);
  },
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());

// ====== Basic auth for /admin
function adminAuth(req,res,next){
  if(!ADMIN_USER || !ADMIN_PASS) return res.status(503).send("Admin disabled");
  const hdr = req.headers.authorization || "";
  if(!hdr.startsWith("Basic ")) { res.set("WWW-Authenticate", `Basic realm="${ADMIN_REALM}"`); return res.status(401).send("Auth required"); }
  const [u,p] = Buffer.from(hdr.split(" ")[1]||"", "base64").toString().split(":");
  if(u===ADMIN_USER && p===ADMIN_PASS) return next();
  res.set("WWW-Authenticate", `Basic realm="${ADMIN_REALM}"`); return res.status(401).send("Unauthorized");
}

// ====== Rate limit trivial
const rlStore = new Map();
function rateLimit(maxPerMin=60){
  const WINDOW=60_000;
  return (req,res,next)=>{
    const ip=req.ip||"unknown";
    const now=Date.now();
    const rec=rlStore.get(ip)||{count:0,reset:now+WINDOW};
    if(now>rec.reset){ rec.count=0; rec.reset=now+WINDOW; }
    rec.count++; rlStore.set(ip,rec);
    if(rec.count>maxPerMin) return res.status(429).json({ ok:false, error:"rate_limited" });
    next();
  };
}

// ====== Health
app.get("/", (_req,res)=> res.send("Backend Lapa Casa activo 🚀"));
app.get("/api/health", (_req,res)=> res.json({ ok:true, ts:Date.now() }));

// ====== Payments: Stripe session
app.post("/payments/stripe/session", rateLimit(30), async (req,res)=>{
  try{
    if(!stripe) return res.status(400).json({ error:"stripe_not_configured" });
    const order = req.body?.order || {};
    const amountBRL = Math.max(100, Math.round((order.total || 0) * 100));
    const session = await stripe.checkout.sessions.create({
      mode:"payment",
      payment_method_types:["card"],
      currency:"brl",
      line_items:[{ price_data:{ currency:"brl", product_data:{ name:"Reserva Lapa Casa Hostel" }, unit_amount: amountBRL }, quantity:1 }],
      client_reference_id: order.bookingId || null,
      metadata: { bookingId: order.bookingId || "", email: order.email || "", nights: String(order.nights||1) },
      success_url: `${BASE_URL}/book/?paid=1`,
      cancel_url: `${BASE_URL}/book/?cancel=1`,
    });
    res.json({ id: session.id });
  }catch(err){
    logPush("stripe_session_error", { msg: err?.message||String(err) });
    res.status(500).json({ error:"stripe_session_error" });
  }
});

// ====== Payments: Mercado Pago
const mpClient = MP_ACCESS_TOKEN ? new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN }) : null;
app.post("/payments/mp/preference", rateLimit(30), async (req,res)=>{
  try{
    if(!mpClient) return res.status(500).json({ error:"mp_token_missing" });
    const { title="Reserva Lapa Casa Hostel", unit_price=100, quantity=1, currency_id="BRL", metadata={} } = req.body||{};
    const orderId = (metadata && (metadata.orderId || metadata.bookingId)) || `order-${Date.now()}`;

    const body = {
      items: [{ title, unit_price:Number(unit_price), quantity:Number(quantity), currency_id }],
      back_urls: { success:`${BASE_URL}/pago-exitoso-test`, failure:`${BASE_URL}/book/?cancel=1`, pending:`${BASE_URL}/book/?cancel=1` },
      auto_return:"approved",
      metadata,
      external_reference: orderId,
      notification_url: `${BASE_URL}/webhooks/mp`,
    };
    const pref = new Preference(mpClient);
    const result = await pref.create({ body });
    const initPoint = result.init_point || result.body?.init_point;
    const id = result.id || result.body?.id;
    res.json({ preferenceId:id, init_point:initPoint });
  }catch(err){
    logPush("mp_pref_error", { msg: err?.message||String(err) });
    res.status(500).json({ error:"mp_preference_failed" });
  }
});

app.get("/pago-exitoso-test", (_req,res)=> res.type("html").send(`<!doctype html><meta charset="utf-8"><title>Pago aprobado</title><body style="font-family:Arial;text-align:center;padding:50px"><h1 style="color:green">✅ Pago aprobado</h1><p>Tu pago de prueba en Mercado Pago fue exitoso.</p><p><a href="/book/?paid=1">Volver a reservar</a></p></body>`));

app.post("/webhooks/mp", async (req,res)=>{
  try{
    const type = req.query.type || req.body?.type;
    const paymentId = req.query["data.id"] || req.body?.data?.id || req.body?.id;
    if(type!=="payment" || !paymentId){ logPush("mp_event_ignored",{type,paymentId}); return res.status(200).send("ok"); }
    if(!mpClient) return res.status(200).send("ok");
    const pay = new Payment(mpClient);
    const payment = await pay.get({ id: paymentId });
    const status = payment?.status;
    const externalRef = payment?.external_reference || "";
    const total = payment?.transaction_amount;
    logPush("mp_event", { paymentId, status, externalRef, total });

    if (BOOKINGS_WEBAPP_URL && externalRef) {
      try {
        await fetch(BOOKINGS_WEBAPP_URL, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ action:"payment_update", booking_id: externalRef, status, total }) });
        invalidateAvailabilityCache();
      } catch(e){ logPush("sheets_error",{ via:"mp", msg:e?.message||String(e) }); }
    }
    return res.status(200).send("ok");
  } catch(e){
    logPush("mp_webhook_error",{ msg:e?.message||String(e) });
    return res.status(200).send("ok");
  }
});

// ====== Forward to Sheets (upsert booking)
async function postGAS(payload){
  const r = await fetch(BOOKINGS_WEBAPP_URL, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
  const text = await r.text();
  let j; try{ j = JSON.parse(text); } catch{ j = { raw:text }; }
  return { ok: r.ok, data: j };
}

app.post("/bookings", rateLimit(60), async (req,res)=>{
  try{
    if(!BOOKINGS_WEBAPP_URL) return res.status(500).json({ ok:false, error:"no_webhook_url" });
    const body = req.body || {};
    const booking_id = body.booking_id || body.bookingId || `BKG-${Date.now()}`;
    const payload = {
      action: "upsert_booking",
      booking_id,
      nombre: body.nombre || "",
      email: body.email || "",
      telefono: body.telefono || "",
      entrada: body.entrada || "",
      salida: body.salida || "",
      hombres: Number(body.hombres||0),
      mujeres: Number(body.mujeres||0),
      camas_json: JSON.stringify(body.camas || {}),
      total: Number(body.total || 0),
      pay_status: body.pay_status || "pending"
    };
    const r1 = await postGAS(payload);
    if(!r1.ok || r1.data?.ok===false){
      // fallback create
      const fb = { ...payload }; delete fb.action;
      const r2 = await postGAS(fb);
      if(!r2.ok) return res.status(500).json(r2.data||{ ok:false });
      invalidateAvailabilityCache();
      return res.status(200).json(r2.data);
    }
    invalidateAvailabilityCache();
    res.status(200).json(r1.data);
  }catch(e){
    logPush("bookings_error",{ msg:e?.message||String(e) });
    res.status(500).json({ ok:false, error:"forward_failed" });
  }
});

// ====== Availability (cache)
const availabilityCache = new Map(); // key = `${from}:${to}` -> {ts,data}
const AVAIL_TTL_MS = 60_000;

function invalidateAvailabilityCache(){ availabilityCache.clear(); }

app.get("/availability", async (req,res)=>{
  try{
    const from = String(req.query.from||"").slice(0,10);
    const to   = String(req.query.to||"").slice(0,10);
    if(!from || !to) return res.status(400).json({ ok:false, error:"missing_from_to" });

    const key = `${from}:${to}`;
    const now = Date.now();
    const cached = availabilityCache.get(key);
    if(cached && now - cached.ts < AVAIL_TTL_MS) return res.json(cached.data);

    const rows = await fetchRowsFromSheet_();
    const occupied = calcOccupiedBeds_(rows, from, to);
    const out = { ok:true, from, to, occupied };
    availabilityCache.set(key, { ts:now, data:out });
    res.json(out);
  }catch(e){
    logPush("availability_error", { msg: e?.message||String(e) });
    res.status(500).json({ ok:false, error:"availability_failed" });
  }
});

// ====== iCal export/import
app.get("/ical/:roomId.ics", async (req,res)=>{
  try{
    const roomId = String(req.params.roomId||"").replace(/\D+/g,"");
    if(!ROOMS[roomId]) return res.status(404).send("Not found");
    const rows = await fetchRowsFromSheet_();
    const busyRanges = busyDateRangesForRoom_(rows, roomId);
    const ics = buildICS_(ROOMS[roomId].name, busyRanges);
    res.setHeader("Content-Type","text/calendar; charset=utf-8");
    res.send(ics);
  }catch(e){
    logPush("ical_export_error",{ msg:e?.message||String(e) });
    res.status(500).send("ERROR");
  }
});

app.get("/crons/ical-pull", async (req,res)=>{
  try{
    if(!CRON_TOKEN || (req.query.token||"")!==CRON_TOKEN) return res.status(401).json({ ok:false, error:"unauthorized" });
    const sources = [["1",ICAL_ROOM_1],["3",ICAL_ROOM_3],["5",ICAL_ROOM_5],["6",ICAL_ROOM_6]].filter(([,u])=>!!u);
    let upserts = 0;
    for(const [roomId, url] of sources){
      const text = await (await fetch(url)).text();
      const events = parseICS_(text);
      const cap = ROOMS[roomId].cap;
      const camas = Array.from({length:cap}, (_,i)=>i+1);
      for(const ev of events){
        const bid = makeIcalBookingId_(roomId, ev.start, ev.end, url);
        const payload = { action:"upsert_booking", booking_id: bid, nombre:`BLOCK-ICAL Room ${roomId}`, email:"", telefono:"",
          entrada: ev.start, salida: ev.end, hombres:0, mujeres:0, camas_json: JSON.stringify({ [roomId]: camas }), total:0, pay_status:"paid" };
        try { await postGAS(payload); upserts++; } catch(e){ logPush("ical_pull_upsert_error",{ roomId, msg:e?.message||String(e) }); }
      }
    }
    invalidateAvailabilityCache();
    res.json({ ok:true, upserts });
  }catch(e){
    logPush("ical_import_error",{ msg:e?.message||String(e) });
    res.status(500).json({ ok:false, error:"ical_pull_failed" });
  }
});

// ====== HOLDs (anti-overbooking)
const holdsMem = new Map(); // holdId -> { expiresAt }
app.post("/holds/start", rateLimit(60), async (req,res)=>{
  try{
    const b = req.body||{};
    const holdId = b.holdId || b.bookingId || `HOLD-${Date.now()}`;
    const ttlMin = Number(b.ttlMinutes || HOLD_TTL_MINUTES);
    const expiresAt = Date.now() + ttlMin*60_000;

    const payload = { action:"upsert_booking", booking_id: holdId, nombre:b.nombre||"HOLD", email:b.email||"", telefono:b.telefono||"",
      entrada:b.entrada||"", salida:b.salida||"", hombres:Number(b.hombres||0), mujeres:Number(b.mujeres||0),
      camas_json: JSON.stringify(b.camas||{}), total:Number(b.total||0), pay_status:"hold" };
    await postGAS(payload);
    holdsMem.set(holdId,{ expiresAt });
    invalidateAvailabilityCache();
    res.json({ ok:true, holdId, expiresAt });
  }catch(e){
    logPush("hold_start_error",{ msg:e?.message||String(e) });
    res.status(500).json({ ok:false, error:"hold_start_failed" });
  }
});

app.post("/holds/release", rateLimit(60), async (req,res)=>{
  try{
    const holdId = req.body?.holdId||"";
    if(!holdId) return res.status(400).json({ ok:false, error:"missing_holdId" });
    await postGAS({ action:"upsert_booking", booking_id: holdId, pay_status:"released" });
    holdsMem.delete(holdId);
    invalidateAvailabilityCache();
    res.json({ ok:true, holdId });
  }catch(e){
    logPush("hold_release_error",{ msg:e?.message||String(e) });
    res.status(500).json({ ok:false, error:"hold_release_failed" });
  }
});

app.post("/holds/confirm", rateLimit(60), async (req,res)=>{
  try{
    const holdId = req.body?.holdId||"";
    const newStatus = req.body?.status || "paid";
    if(!holdId) return res.status(400).json({ ok:false, error:"missing_holdId" });
    await postGAS({ action:"upsert_booking", booking_id: holdId, pay_status:newStatus });
    holdsMem.delete(holdId);
    invalidateAvailabilityCache();
    res.json({ ok:true, holdId, status:newStatus });
  }catch(e){
    logPush("hold_confirm_error",{ msg:e?.message||String(e) });
    res.status(500).json({ ok:false, error:"hold_confirm_failed" });
  }
});

// ====== Eventos REALES (reemplaza placeholder)
const EventsService = require("./services/events");
app.get("/api/events", async (req,res)=>{
  try{
    const now = new Date();
    const from = req.query.from ? new Date(req.query.from) : now;
    const to   = req.query.to   ? new Date(req.query.to)   : new Date(now.getTime() + 30*864e5);
    const limit = Math.min(parseInt(req.query.limit || "50", 10), 100);
    const refresh = req.query.refresh === "1";
    const events = await EventsService.getEvents({ from, to, limit, refresh, ttlHours: EVENTS_CACHE_TTL_HOURS });
    res.json({ ok:true, count: events.length, events });
  }catch(e){
    logPush("events_error", { msg:e?.message||String(e) });
    res.status(500).json({ ok:false, error:"events_failed" });
  }
});

// ====== Admin (Basic Auth)
app.get("/admin", adminAuth, async (_req,res)=>{
  const envState = {
    BASE_URL,
    BOOKINGS_WEBAPP_URL: !!BOOKINGS_WEBAPP_URL,
    MP_ACCESS_TOKEN: redact(MP_ACCESS_TOKEN),
    STRIPE_SK: redact(STRIPE_SK),
    STRIPE_WEBHOOK_SECRET: STRIPE_WEBHOOK_SECRET ? "set" : "—",
    ADMIN: ADMIN_USER ? "set" : "—",
    CRON_TOKEN: CRON_TOKEN ? "set" : "—",
    HOLD_TTL_MINUTES,
    CORS_ALLOW_ORIGINS: CORS_ALLOW_ORIGINS.join(",") || "(open)",
    EVENTS_CACHE_TTL_HOURS,
    EVENTBRITE_TOKEN: EVENTBRITE_TOKEN ? "set" : "—",
    EVENTS_ICS_URLS
  };
  let rows = [];
  try { rows = await fetchRowsFromSheet_(); } catch(e){ logPush("admin_rows_err",{ msg:e?.message||String(e) }); }
  const lastLogs = [...logs].reverse().slice(0,100);
  const escapeHTML = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const html = `<!doctype html><meta charset="utf-8"><title>Lapa Admin</title>
  <style>body{font-family:system-ui,Segoe UI,Roboto,Arial;padding:20px;color:#111}h1{margin:0 0 10px}
  pre,code{background:#f6f8fa;padding:6px;border-radius:8px} table{border-collapse:collapse;width:100%}th,td{border:1px solid #e5e7eb;padding:6px 8px;font-size:13px;text-align:left}th{background:#fafafa}</style>
  <h1>Admin</h1>
  <h3>ENV</h3><pre>${escapeHTML(JSON.stringify(envState,null,2))}</pre>
  <h3>Últimas reservas (max 50)</h3><pre>${escapeHTML(JSON.stringify(rows.slice(-50),null,2))}</pre>
  <h3>Logs recientes</h3><pre>${escapeHTML(JSON.stringify(lastLogs,null,2))}</pre>
  <p><a href="/admin/rows.csv">Descargar CSV</a> · <a href="/api/events?limit=10" target="_blank">Ver eventos</a> · <a href="/privacy.html" target="_blank">Política</a></p>`;
  res.type("html").send(html);
});

app.get("/admin/rows.csv", adminAuth, async (_req,res)=>{
  try{
    const rows = await fetchRowsFromSheet_();
    const headers = ["booking_id","nombre","email","telefono","entrada","salida","hombres","mujeres","camas_json","total","pay_status","created_at"];
    const esc = v=>{ if(v==null) return ""; const s=String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
    const lines = [headers.join(",")];
    for(const r of rows){
      lines.push(headers.map(h=>{
        let v = r[h];
        if(h==="created_at" && v){ try{ v = new Date(v).toISOString(); } catch{} }
        return esc(v);
      }).join(","));
    }
    res.setHeader("Content-Type","text/csv; charset=utf-8");
    res.setHeader("Content-Disposition",'attachment; filename="reservas.csv"');
    res.send(lines.join("\n"));
  }catch(e){
    res.status(500).send("ERROR");
  }
});

// ====== Static (landing + /book)
app.use(express.static(path.join(__dirname,"public"), { index: "index.html", extensions:["html"] }));

// ====== Helpers for availability/iCal
async function fetchRowsFromSheet_(){
  if(!BOOKINGS_WEBAPP_URL) return [];
  const url = `${BOOKINGS_WEBAPP_URL}?mode=rows`;
  const r = await fetch(url);
  const j = await r.json().catch(()=>({ ok:false, rows:[] }));
  return Array.isArray(j.rows) ? j.rows : [];
}

function calcOccupiedBeds_(rows, from, to){
  const start = new Date(from+"T00:00:00"); const end = new Date(to+"T00:00:00");
  const occupied = {};
  const ACTIVE = new Set(["paid","pending","authorized","in_process","approved","hold"]);
  for(const row of rows){
    const status = String(row.pay_status||"").toLowerCase();
    if(!ACTIVE.has(status)) continue;
    const entrada = row.entrada ? new Date(String(row.entrada)+"T00:00:00") : null;
    const salida  = row.salida  ? new Date(String(row.salida )+"T00:00:00") : null;
    if(!entrada || !salida) continue;
    if(!(entrada < end && salida > start)) continue; // overlap
    let cjson = row.camas_json || row.camas || "";
    try { if(typeof cjson === "string") cjson = cjson ? JSON.parse(cjson) : {}; } catch { cjson = {}; }
    if(cjson && typeof cjson==="object"){
      for(const [roomId, beds] of Object.entries(cjson)){
        if(!occupied[roomId]) occupied[roomId] = new Set();
        (Array.isArray(beds) ? beds : []).forEach(b=> occupied[roomId].add(Number(b)));
      }
    }
  }
  // Apply buffers
  const buffers = { "1":Math.max(0,Math.min(ROOMS["1"].cap,ROOM_BUFFER_1)), "3":Math.max(0,Math.min(ROOMS["3"].cap,ROOM_BUFFER_3)), "5":Math.max(0,Math.min(ROOMS["5"].cap,ROOM_BUFFER_5)), "6":Math.max(0,Math.min(ROOMS["6"].cap,ROOM_BUFFER_6)) };
  for(const roomId of Object.keys(ROOMS)){
    const cap = ROOMS[roomId].cap;
    if(!occupied[roomId]) occupied[roomId] = new Set();
    const set = occupied[roomId];
    const need = Math.max(0, Math.min(buffers[roomId], cap - set.size));
    if(need>0){
      for(let b=1, added=0; b<=cap && added<need; b++){
        if(!set.has(b)){ set.add(b); added++; }
      }
    }
  }
  const out = {};
  for(const [roomId,set] of Object.entries(occupied)) out[roomId] = Array.from(set).sort((a,b)=>a-b);
  return out;
}

function countBedsByDay_(rows, roomId){
  const counts={}; const ACTIVE=new Set(["paid","pending","authorized","in_process","approved","hold"]);
  for(const row of rows){
    const status = String(row.pay_status||"").toLowerCase();
    if(!ACTIVE.has(status)) continue;
    let cjson = row.camas_json || row.camas || "";
    try{ if(typeof cjson==="string") cjson = cjson ? JSON.parse(cjson) : {}; } catch{ cjson = {}; }
    const beds = (cjson && cjson[roomId]) ? (Array.isArray(cjson[roomId]) ? cjson[roomId] : []) : [];
    if(!beds.length) continue;
    const entrada = row.entrada ? new Date(String(row.entrada)+"T00:00:00") : null;
    const salida  = row.salida  ? new Date(String(row.salida )+"T00:00:00") : null;
    if(!entrada || !salida) continue;
    for(let d=new Date(entrada); d<salida; d.setDate(d.getDate()+1)){
      const key = d.toISOString().slice(0,10);
      counts[key] = (counts[key]||0) + beds.length;
    }
  }
  return counts;
}

function busyDateRangesForRoom_(rows, roomId){
  const counts = countBedsByDay_(rows, roomId);
  const cap = ROOMS[roomId].cap;
  const busyDays = Object.keys(counts).filter(d => counts[d] >= cap).sort();
  const toDate = s=> new Date(s+"T00:00:00");
  const ranges=[]; if(!busyDays.length) return ranges;
  let a=busyDays[0], prev=busyDays[0];
  for(let i=1;i<busyDays.length;i++){
    const cur = busyDays[i];
    const dprev = toDate(prev), dcur = toDate(cur);
    const nextOfPrev = new Date(dprev); nextOfPrev.setDate(nextOfPrev.getDate()+1);
    if(dcur.getTime() !== nextOfPrev.getTime()){
      const dtStart = a;
      const endLast = (()=>{const t=new Date(toDate(prev)); t.setDate(t.getDate()+1); return t.toISOString().slice(0,10);})();
      ranges.push({ start: dtStart, end: endLast });
      a = cur;
    }
    prev = cur;
  }
  const endLast = (()=>{const t=new Date(toDate(prev)); t.setDate(t.getDate()+1); return t.toISOString().slice(0,10);})();
  ranges.push({ start:a, end:endLast });
  return ranges;
}

function buildICS_(calName, ranges){
  const escapeICS = s=> String(s).replace(/([,;])/g,"\\$1").replace(/\n/g,"\\n");
  const formatDT = d=>{
    const pad=n=>String(n).padStart(2,"0");
    return d.getUTCFullYear()+pad(d.getUTCMonth()+1)+pad(d.getUTCDate())+"T"+pad(d.getUTCHours())+pad(d.getUTCMinutes())+pad(d.getUTCSeconds())+"Z";
  };
  const lines = [];
  lines.push("BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Lapa Casa//Channel Manager//ES",`X-WR-CALNAME:${escapeICS(calName)} (FULL DAYS)`);
  for(const r of ranges){
    const uid = `lapa-${crypto.randomUUID()}@lapacasa`;
    lines.push("BEGIN:VEVENT",`UID:${uid}`,`DTSTAMP:${formatDT(new Date())}`,`DTSTART;VALUE=DATE:${r.start.replace(/-/g,"")}`,`DTEND;VALUE=DATE:${r.end.replace(/-/g,"")}`,`SUMMARY:${escapeICS("Ocupado (sin disponibilidad)")}`,"END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function parseICS_(text){
  const lines = String(text||"").split(/\r?\n/);
  const events=[]; let inEvent=false; let dtStart=null; let dtEnd=null;
  for(const raw of lines){
    const line = raw.trim();
    if(line==="BEGIN:VEVENT"){ inEvent=true; dtStart=null; dtEnd=null; continue; }
    if(line==="END:VEVENT"){ if(dtStart){ const start = toISODate_(dtStart); const end = toISODate_(dtEnd||dtStart); events.push({ start, end }); } inEvent=false; continue; }
    if(!inEvent) continue;
    if(line.startsWith("DTSTART")){ dtStart = line.split(":").pop(); }
    else if(line.startsWith("DTEND")){ dtEnd = line.split(":").pop(); }
  }
  return events;
}
function toISODate_(v){ const s=String(v||"").trim(); const y=s.slice(0,4), m=s.slice(4,6), d=s.slice(6,8); return `${y}-${m}-${d}`; }
function makeIcalBookingId_(roomId, start, end, sourceUrl){ const h=crypto.createHash("md5").update(`${roomId}|${start}|${end}|${sourceUrl}`).digest("hex").slice(0,12); return `ICAL-${roomId}-${start.replace(/-/g,"")}-${end.replace(/-/g,"")}-${h}`; }

// ====== Integrations
try { require("./integrations/booking-inbound")(app); } catch { /* optional */ }

// ====== Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log(`Servidor en puerto ${PORT}`));
