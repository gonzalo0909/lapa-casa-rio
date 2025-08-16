"use strict";
/**
 * Lapa Casa Backend — Render
 * - Mantiene: /book (front), /availability, /bookings, /holds/*
 * - Agrega:   /payments/mp/preference  +  /webhooks/mp
 *             /payments/stripe/session +  /webhooks/stripe
 *             /events (/api/events)
 * - Integra con Google Apps Script (BOOKINGS_WEBAPP_URL)
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");
const Stripe = require("stripe");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");

/* ========= ENV ========= */
const BASE_URL = (process.env.BASE_URL || "").replace(/\/$/, "") || "https://lapa-casa-backend.onrender.com";
const BOOKINGS_WEBAPP_URL = process.env.BOOKINGS_WEBAPP_URL || ""; // GAS WebApp "exec"
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET || process.env.MERCADO_PAGO_CHECKOUT_API_WEBHOOK_SECRET || "";
const STRIPE_SK = process.env.STRIPE_SK || process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const CORS_ALLOW_ORIGINS = (process.env.CORS_ALLOW_ORIGINS || "").split(",").map(s=>s.trim()).filter(Boolean);
const HOLD_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES || 10);

/* ========= App ========= */
const app = express();
app.set("trust proxy", 1);

/* === Stripe Webhook (raw, ANTES de express.json()) === */
const stripe = STRIPE_SK ? new Stripe(STRIPE_SK) : null;
app.post(["/webhooks/stripe","/api/webhooks/stripe"], express.raw({ type: "application/json" }), async (req, res) => {
  try {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) return res.status(200).send("ok");
    const sig = req.headers["stripe-signature"];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      logPush("stripe_error", { where:"invalid_signature", msg: err?.message || String(err) });
      return res.status(400).send("invalid signature");
    }
    if (isDuplicateEvent(`stripe:${event.id}`)) return res.status(200).send("dup");

    const notifySheets = async (bookingId, status, total) => {
      if (!bookingId || !BOOKINGS_WEBAPP_URL) return;
      const r = await postToSheets({ action:"payment_update", booking_id: bookingId, status, total });
      if (!r?.ok) logPush("payment_update_not_found", { provider:"stripe", bookingId, status, total, raw:r });
      invalidateAvailabilityCache();
    };

    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;
        await notifySheets(s.client_reference_id || s.metadata?.bookingId || "", "approved", (s.amount_total||0)/100);
        break;
      }
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const s = event.data.object;
        await notifySheets(s.client_reference_id || s.metadata?.bookingId || "", "rejected", (s.amount_total||0)/100);
        break;
      }
      case "charge.refunded":
      case "charge.refund.updated": {
        const c = event.data.object;
        let bookingId = "";
        const pi = c.payment_intent;
        if (pi) {
          try { const piObj = await stripe.paymentIntents.retrieve(pi); bookingId = piObj?.metadata?.bookingId || ""; } catch {}
        }
        await notifySheets(bookingId, "refunded", (c.amount||0)/100);
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object;
        await notifySheets(pi?.metadata?.bookingId || "", "rejected", (pi.amount||0)/100);
        break;
      }
    }
    res.status(200).send("ok");
  } catch (e) {
    logPush("stripe_error", { where:"handler", msg:e?.message||String(e) });
    res.status(200).send("ok");
  }
});

/* === Middlewares después del webhook Stripe === */
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

/* === Static (landing + /book) === */
app.use(express.static(path.join(__dirname,"public"), { index: "index.html", extensions:["html"] }));

/* === Health === */
app.get(["/","/api/health"], (req,res)=>{
  if (req.path === "/") return res.send("Backend Lapa Casa activo 🚀");
  res.json({ ok:true, service:"lapa-casa-backend", ts:Date.now() });
});

/* === Webhook GET health (evita confusión al abrir en navegador) === */
app.get(["/webhooks/mp","/api/webhooks/mp"], (_req,res)=> res.status(200).send("ok"));
app.get(["/webhooks/stripe","/api/webhooks/stripe"], (_req,res)=> res.status(200).send("ok"));

/* ========= Stripe: crear Checkout Session ========= */
app.post(["/payments/stripe/session","/api/payments/stripe/session"], rateLimit(30), async (req,res)=>{
  try{
    if (!stripe) return res.status(400).json({ error:"stripe_not_configured" });
    const order = req.body?.order || {};
    const amountBRL = Math.max(100, Math.round((order.total || 0) * 100)); // mínimo R$1,00

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      currency: "brl",
      line_items: [{
        price_data: {
          currency:"brl",
          product_data: { name:"Reserva Lapa Casa Hostel" },
          unit_amount: amountBRL
        },
        quantity: 1
      }],
      client_reference_id: order.bookingId || null,
      metadata: { bookingId: order.bookingId || "", email: order.email || "", nights: String(order.nights || 1) },
      success_url: `${BASE_URL}/book?paid=1`,
      cancel_url: `${BASE_URL}/book?cancel=1`,
    });

    res.json({ id: session.id });
  }catch(err){
    logPush("stripe_error",{ where:"create_session", msg:err?.message||String(err) });
    res.status(500).json({ error:"stripe_session_error" });
  }
});

/* ========= Mercado Pago: Preference + Webhook ========= */
const mpClient = MP_ACCESS_TOKEN ? new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN }) : null;

app.get(["/pago-exitoso-test","/api/pago-exitoso-test"], (_req,res)=>
  res.type("html").send(`<!doctype html><meta charset="utf-8"><title>Pago aprobado</title><body style="font-family:Arial;text-align:center;padding:50px"><h1 style="color:green">✅ Pago aprobado</h1><p>Tu pago de prueba en Mercado Pago fue exitoso.</p></body>`)
);

app.post(["/payments/mp/preference","/api/payments/mp/preference"], rateLimit(30), async (req,res)=>{
  try{
    if (!mpClient) return res.status(500).json({ error:"mp_token_missing" });
    const { title="Reserva Lapa Casa Hostel", unit_price=100, quantity=1, currency_id="BRL", metadata={} } = req.body || {};
    const orderId = (metadata && (metadata.orderId || metadata.bookingId)) || `order-${Date.now()}`;

    const pref = new Preference(mpClient);
    const body = {
      items: [{ title, unit_price: Number(unit_price), quantity: Number(quantity), currency_id }],
      back_urls: {
        success: `${BASE_URL}/pago-exitoso-test`,
        failure: `${BASE_URL}/book?cancel=1`,
        pending: `${BASE_URL}/book?cancel=1`
      },
      auto_return: "approved",
      metadata,
      external_reference: orderId,
      notification_url: `${BASE_URL}/webhooks/mp`,
    };
    const result = await pref.create({ body });
    const initPoint = result.init_point || result.body?.init_point;
    const id = result.id || result.body?.id;
    res.json({ preferenceId: id, init_point: initPoint });
  }catch(err){
    logPush("mp_error",{ where:"create_preference", msg:err?.message||String(err) });
    res.status(500).json({ error:"mp_preference_failed" });
  }
});

app.post(["/webhooks/mp","/api/webhooks/mp"], async (req,res)=>{
  try{
    const type = req.query.type || req.body?.type;
    const paymentId = req.query["data.id"] || req.body?.data?.id || req.body?.id;

    if (type !== "payment" || !paymentId) {
      logPush("mp_event_ignored", { type, paymentId });
      return res.status(200).send("ok");
    }

    // firma opcional (viene de MP si configuraste secret)
    if (MP_WEBHOOK_SECRET) {
      const ok = verifyMpSignature(req, paymentId);
      if (!ok) {
        logPush("mp_signature_fail", { paymentId });
        return res.status(401).send("invalid signature");
      }
    }

    if (isDuplicateEvent(`mp:${paymentId}`)) return res.status(200).send("dup");

    if (!mpClient) return res.status(200).send("ok");
    const pay = new Payment(mpClient);
    const payment = await pay.get({ id: paymentId });
    const status = payment?.status;
    const externalRef = payment?.external_reference || "";
    const total = payment?.transaction_amount;

    logPush("mp_event", { paymentId, status, externalRef, total });

    if (BOOKINGS_WEBAPP_URL && externalRef) {
      const r = await postToSheets({ action:"payment_update", booking_id: externalRef, status, total });
      if (!r?.ok) logPush("payment_update_not_found", { provider:"mp", bookingId: externalRef, status, total, raw:r });
      invalidateAvailabilityCache();
    }
    res.status(200).send("ok");
  }catch(e){
    logPush("mp_error",{ where:"webhook", msg:e?.message||String(e) });
    res.status(200).send("ok");
  }
});

function verifyMpSignature(req, paymentId){
  try{
    const sig = req.headers["x-signature"];
    const reqId = req.headers["x-request-id"];
    if (!MP_WEBHOOK_SECRET || !sig || !reqId || !paymentId) return false;
    const parts = String(sig).split(",");
    let ts, v1;
    for (const p of parts) {
      const [k,v] = p.split("="); if (!k || !v) continue;
      if (k.trim()==="ts") ts=v.trim();
      if (k.trim()==="v1") v1=v.trim();
    }
    if (!ts || !v1) return false;
    const manifest = `id:${paymentId};request-id:${reqId};ts:${ts};`;
    const calc = crypto.createHmac("sha256", MP_WEBHOOK_SECRET).update(manifest).digest("hex");
    return calc === v1;
  }catch{ return false; }
}

/* ========= Bookings → Sheets ========= */
app.post(["/bookings","/api/bookings"], rateLimit(60), async (req,res)=>{
  try{
    if (!BOOKINGS_WEBAPP_URL) return res.status(500).json({ ok:false, error:"no_webhook_url" });
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
      hombres: Number(body.hombres || 0),
      mujeres: Number(body.mujeres || 0),
      camas_json: JSON.stringify(body.camas || {}),
      total: Number(body.total || 0),
      pay_status: body.pay_status || "pending",
    };

    let j = await postToSheets(payload);
    if (!j?.ok) { // fallback sin action si tu GAS aún no soporta action
      const fallback = { ...payload }; delete fallback.action;
      j = await postToSheets(fallback);
    }
    invalidateAvailabilityCache();
    return res.status(j?.ok ? 200 : 500).json(j);
  }catch(e){
    logPush("bookings_error",{ msg:e?.message||String(e) });
    res.status(500).json({ ok:false, error:"forward_failed" });
  }
});

/* ========= Availability (simple cache) ========= */
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

    const rows = await fetchRowsFromSheet_();
    const occupied = calcOccupiedBeds_(rows, from, to);
    const out = { ok:true, from, to, occupied };
    availabilityCache.set(key, { ts: now, data: out });
    res.json(out);
  }catch(e){
    logPush("availability_error",{ msg:e?.message||String(e) });
    res.status(500).json({ ok:false, error:"availability_failed" });
  }
});

/* ========= HOLDs (anti-overbooking) ========= */
const holdsMem = new Map(); // holdId -> {expiresAt}

app.post(["/holds/start","/api/holds/start"], rateLimit(60), async (req,res)=>{
  try{
    const b = req.body || {};
    const holdId = b.holdId || b.bookingId || `HOLD-${Date.now()}`;
    const ttlMin = Number(b.ttlMinutes || HOLD_TTL_MINUTES);
    const expiresAt = Date.now() + ttlMin * 60_000;

    const payload = {
      action: "upsert_booking",
      booking_id: holdId,
      nombre: b.nombre || "HOLD",
      email: b.email || "",
      telefono: b.telefono || "",
      entrada: b.entrada || "",
      salida: b.salida || "",
      hombres: Number(b.hombres || 0),
      mujeres: Number(b.mujeres || 0),
      camas_json: JSON.stringify(b.camas || {}),
      total: Number(b.total || 0),
      pay_status: "hold"
    };
    await postToSheets(payload);

    holdsMem.set(holdId, { expiresAt });
    invalidateAvailabilityCache();
    res.json({ ok:true, holdId, expiresAt });
  }catch(e){
    logPush("hold_start_error",{ msg:e?.message||String(e) });
    res.status(500).json({ ok:false, error:"hold_start_failed" });
  }
});

app.post(["/holds/release","/api/holds/release"], rateLimit(60), async (req,res)=>{
  try{
    const holdId = req.body?.holdId || "";
    if (!holdId) return res.status(400).json({ ok:false, error:"missing_holdId" });

    // ✅ Solo actualizar estado si existe (no crear filas vacías)
    const r = await postToSheets({ action:"payment_update", booking_id: holdId, status:"released" });
    if (!r?.ok) logPush("payment_update_not_found", { provider:"hold_release", bookingId: holdId, status:"released", raw:r });

    holdsMem.delete(holdId);
    invalidateAvailabilityCache();
    res.json({ ok:true, holdId });
  }catch(e){
    logPush("hold_release_error",{ msg:e?.message||String(e) });
    res.status(500).json({ ok:false, error:"hold_release_failed" });
  }
});

app.post(["/holds/confirm","/api/holds/confirm"], rateLimit(60), async (req,res)=>{
  try{
    const holdId = req.body?.holdId || "";
    const newStatus = req.body?.status || "paid";
    if (!holdId) return res.status(400).json({ ok:false, error:"missing_holdId" });

    // ✅ Solo actualizar estado si existe (no crear filas vacías)
    const r = await postToSheets({ action:"payment_update", booking_id: holdId, status:newStatus });
    if (!r?.ok) logPush("payment_update_not_found", { provider:"hold_confirm", bookingId: holdId, status:newStatus, raw:r });

    holdsMem.delete(holdId);
    invalidateAvailabilityCache();
    res.json({ ok:true, holdId, status:newStatus });
  }catch(e){
    logPush("hold_confirm_error",{ msg:e?.message||String(e) });
    res.status(500).json({ ok:false, error:"hold_confirm_failed" });
  }
});

/* ========= Events API ========= */
const eventsHandler = require("./services/events");
app.get(["/api/events","/events"], eventsHandler);

/* ========= Helpers Sheets / Avail ========= */
async function fetchRowsFromSheet_() {
  const url = `${BOOKINGS_WEBAPP_URL}?mode=rows`;
  const r = await fetchWithRetry(url, { method:"GET" });
  const j = await r.json().catch(() => ({ ok:false, rows:[] }));
  return Array.isArray(j.rows) ? j.rows : [];
}
function calcOccupiedBeds_(rows, from, to) {
  const start = new Date(from + "T00:00:00");
  const end   = new Date(to   + "T00:00:00");
  const occupied = {};
  const ACTIVE = new Set(["paid","pending","authorized","in_process","approved","hold","released"]);
  for (const row of rows) {
    const status = String(row.pay_status || "").toLowerCase();
    if (!ACTIVE.has(status)) continue;
    const entrada = row.entrada ? new Date(String(row.entrada)+"T00:00:00") : null;
    const salida  = row.salida  ? new Date(String(row.salida )+"T00:00:00") : null;
    if (!entrada || !salida) continue;
    if (!(entrada < end && salida > start)) continue;
    let cjson = row.camas_json || row.camas || "";
    try { if (typeof cjson === "string") cjson = cjson ? JSON.parse(cjson) : {}; } catch { cjson = {}; }
    if (cjson && typeof cjson === "object") {
      for (const [roomId, beds] of Object.entries(cjson)) {
        if (!occupied[roomId]) occupied[roomId] = new Set();
        (Array.isArray(beds) ? beds : []).forEach(b => occupied[roomId].add(Number(b)));
      }
    }
  }
  // convertir a arrays ordenados
  const out = {};
  for (const [roomId, set] of Object.entries(occupied)) out[roomId] = Array.from(set).sort((a,b)=>a-b);
  return out;
}

/* ========= Utils comunes ========= */
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
const recentEvents = new Map();
function isDuplicateEvent(key, ttlMs = 15*60_000){
  const now = Date.now();
  for (const [k,ts] of [...recentEvents.entries()]) if (now - ts > ttlMs) recentEvents.delete(k);
  if (recentEvents.has(key)) return true;
  recentEvents.set(key, now);
  return false;
}
function matchOrigin(origin, pattern){
  try{
    if (pattern==="*") return true;
    if (pattern.startsWith("http://")||pattern.startsWith("https://")) return origin===pattern;
    const u=new URL(origin); const host=u.host;
    return host===pattern || host.endsWith("."+pattern);
  }catch{ return origin===pattern; }
}
async function fetchWithRetry(url, opts={}, attempts=3){
  let e;
  for (let i=0;i<attempts;i++){
    try{
      const r = await fetch(url, opts);
      if (!r.ok) throw new Error(`status_${r.status}`);
      return r;
    }catch(err){
      e = err;
      await new Promise(r => setTimeout(r, 400 * Math.pow(2,i)));
    }
  }
  throw e;
}
async function postToSheets(payload){
  const r = await fetchWithRetry(BOOKINGS_WEBAPP_URL, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(payload)
  });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { ok:false, raw:text }; }
}
function invalidateAvailabilityCache(){ availabilityCache.clear(); }

/* ========= Server ========= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log(`Servidor escuchando en puerto ${PORT}`));
