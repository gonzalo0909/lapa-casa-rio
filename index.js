"use strict";
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const Stripe = require("stripe");

// ===== ENV
const {
  BASE_URL = "https://lapacasahostel.com",
  BOOKINGS_WEBAPP_URL = "",
  ADMIN_USER = "admin",
  ADMIN_PASS = "admin",
  ADMIN_SESSION_SECRET = "change_me",
  STRIPE_SK = "",
  STRIPE_WEBHOOK_SECRET = "",
  MP_ACCESS_TOKEN = "",
  HOLD_TTL_MINUTES = "10",
  BOOKING_BUFFER_PER_ROOM = "0",
  ROOM_BUFFER_1 = BOOKING_BUFFER_PER_ROOM,
  ROOM_BUFFER_3 = BOOKING_BUFFER_PER_ROOM,
  ROOM_BUFFER_5 = BOOKING_BUFFER_PER_ROOM,
  ROOM_BUFFER_6 = BOOKING_BUFFER_PER_ROOM,
  CRON_TOKEN = "",
  ICAL_ROOM_1 = "",
  ICAL_ROOM_3 = "",
  ICAL_ROOM_5 = "",
  ICAL_ROOM_6 = "",
  CORS_ALLOW_ORIGINS = "",            // ej: "https://lapacasahostel.com,https://www.lapacasahostel.com"
  EVENTS_SOURCES = ""                 // ej: "https://tu-cdn/events.json,https://otro.json"
} = process.env;

// ===== Constantes
const PORT = process.env.PORT || 3000;
const ROOMS = {
  "1": { name: "Cuarto 1 (12 mixto)", cap: 12 },
  "3": { name: "Cuarto 3 (12 mixto)", cap: 12 },
  "5": { name: "Cuarto 5 (7 mixto)",  cap: 7  },
  "6": { name: "Cuarto 6 (7 femenino)", cap: 7 }
};
const ACTIVE_STATES = new Set(["paid","pending","authorized","in_process","approved","hold"]);

// ===== App
const app = express();
app.set("trust proxy", 1);

// ===== Static (marketing + reservas)
app.use(express.static("public", { extensions: ["html"] }));

// ===== Pequeño CSP y headers seguros básicos (sin libs extras)
app.use((_, res, next) => {
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  next();
});

// ===== Request-Id + logs
app.use((req, res, next) => {
  const id = (req.headers["x-request-id"] || crypto.randomUUID());
  res.locals.rid = id;
  res.setHeader("X-Request-Id", id);
  next();
});
const LOG_MAX = 500; const logs = [];
function logPush(type, payload) {
  logs.push({ ts: Date.now(), type, rid: payload?.rid, payload });
  if (logs.length > LOG_MAX) logs.shift();
}
function redact(v){ if(!v) return "—"; const s=String(v); return s.length<=10?"•••":s.slice(0,6)+"…"+s.slice(-4); }

// ===== CORS allowlist
const ALLOWED = CORS_ALLOW_ORIGINS.split(",").map(s=>s.trim()).filter(Boolean);
const corsOptions = {
  origin: (origin, cb) => {
    if (ALLOWED.length === 0) return cb(null, true);
    if (!origin) return cb(null, true);
    const ok = ALLOWED.some(p => origin === p || origin.endsWith("."+p.replace(/^https?:\/\//,"").replace(/\/$/,"")));
    cb(null, ok);
  },
  credentials: true
};
app.use(cors(corsOptions));

// ===== Parsers
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser(ADMIN_SESSION_SECRET));

// ===== Util: fetch con retry exponencial
async function fetchJSON(url, opts={}, tries=4){
  let lastErr; const baseDelay=250;
  for(let i=0;i<tries;i++){
    try{
      const r = await fetch(url, opts);
      const txt = await r.text();
      let j; try { j = JSON.parse(txt); } catch { j = { raw: txt }; }
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${txt.slice(0,160)}`);
      return j;
    }catch(e){
      lastErr = e;
      await new Promise(r=>setTimeout(r, baseDelay*Math.pow(2,i)));
    }
  }
  throw lastErr;
}

// ===== Health
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "lapa-casa-backend", ts: Date.now() }));

// ===== Stripe webhook (raw)
const stripe = STRIPE_SK ? new Stripe(STRIPE_SK) : null;
const seenStripeEvents = new Set(); // idempotencia en proceso
app.post("/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  const rid = res.locals.rid;
  try {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) return res.status(200).send("ok");
    const sig = req.headers["stripe-signature"];
    let event;
    try { event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET); }
    catch (err) { logPush("stripe_invalid_signature", { rid, msg: err.message }); return res.status(400).send("invalid signature"); }

    if (seenStripeEvents.has(event.id)) { return res.status(200).send("dup"); }
    seenStripeEvents.add(event.id); setTimeout(()=>seenStripeEvents.delete(event.id), 10*60*1000);

    const t = event.type;
    const notifySheets = async (bookingId, status, total) => {
      if (!bookingId || !BOOKINGS_WEBAPP_URL) return;
      try {
        await fetchJSON(BOOKINGS_WEBAPP_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action:"payment_update", booking_id: bookingId, status, total })
        });
        logPush("sheets_update", { rid, via:"stripe_webhook", bookingId, status, total });
        invalidateAvailabilityCache();
      } catch (e) { logPush("sheets_error", { rid, via:"stripe", msg: e?.message || String(e) }); }
    };

    if (t === "checkout.session.completed") {
      const s = event.data.object;
      await notifySheets(s.client_reference_id || s.metadata?.bookingId || "", "approved", (s.amount_total||0)/100);
    } else if (t === "checkout.session.expired" || t === "checkout.session.async_payment_failed") {
      const s = event.data.object;
      await notifySheets(s.client_reference_id || s.metadata?.bookingId || "", "rejected", (s.amount_total||0)/100);
    } else if (t === "charge.refunded" || t === "charge.refund.updated") {
      const c = event.data.object;
      let bookingId = c.metadata?.bookingId || "";
      if (!bookingId && c.payment_intent) {
        try { const pi = await stripe.paymentIntents.retrieve(c.payment_intent, { expand: ["charges.data.balance_transaction"] }); bookingId = pi?.metadata?.bookingId || ""; } catch {}
      }
      await notifySheets(bookingId, "refunded", (c.amount||0)/100);
    } else if (t === "payment_intent.payment_failed") {
      const pi = event.data.object;
      await notifySheets(pi?.metadata?.bookingId || "", "rejected", (pi.amount||0)/100);
    }

    res.status(200).send("ok");
  } catch (e) {
    logPush("stripe_error", { rid, where: "handler", msg: e?.message || String(e) });
    res.status(200).send("ok");
  }
});

// ===== Mercado Pago
const mpClient = MP_ACCESS_TOKEN ? new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN }) : null;
const seenMP = new Set(); // idempotencia simple (por paymentId)
app.post("/webhooks/mp", async (req, res) => {
  const rid = res.locals.rid;
  try {
    const type = req.query.type || req.body?.type;
    const paymentId = req.query["data.id"] || req.body?.data?.id || req.body?.id;
    if (type !== "payment" || !paymentId || !mpClient) { logPush("mp_event_ignored", { rid, type, paymentId }); return res.status(200).send("ok"); }
    if (seenMP.has(paymentId)) return res.status(200).send("dup");
    seenMP.add(paymentId); setTimeout(()=>seenMP.delete(paymentId), 10*60*1000);

    const pay = new Payment(mpClient);
    const payment = await pay.get({ id: paymentId });

    const status = payment?.status;
    const externalRef = payment?.external_reference || "";
    const total = payment?.transaction_amount;

    if (BOOKINGS_WEBAPP_URL && externalRef) {
      try {
        await fetchJSON(BOOKINGS_WEBAPP_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action:"payment_update", booking_id: externalRef, status, total })
        });
        logPush("sheets_update", { rid, via:"mp_webhook", bookingId: externalRef, status, total });
        invalidateAvailabilityCache();
      } catch (e) { logPush("sheets_error", { rid, via:"mp", msg: e?.message || String(e) }); }
    }
    res.status(200).send("ok");
  } catch (e) {
    logPush("mp_error", { rid, where:"webhook", msg: e?.message || String(e) });
    res.status(200).send("ok");
  }
});

// ===== Rate limit simple
const rlStore = new Map();
function rateLimit(maxPerMin = 60) {
  const WINDOW = 60_000;
  return (req, res, next) => {
    const ip = req.ip || "unknown";
    const now = Date.now();
    const rec = rlStore.get(ip) || { count: 0, reset: now + WINDOW };
    if (now > rec.reset) { rec.count = 0; rec.reset = now + WINDOW; }
    rec.count++; rlStore.set(ip, rec);
    if (rec.count > maxPerMin) return res.status(429).json({ ok: false, error: "rate_limited" });
    next();
  };
}

// ===== Stripe Checkout
app.post("/payments/stripe/session", rateLimit(30), async (req, res) => {
  const rid = res.locals.rid;
  try {
    if (!stripe) return res.status(400).json({ error: "stripe_not_configured" });
    const order = req.body?.order || {};
    const amountBRL = Math.max(100, Math.round((order.total || 0) * 100));
    const successUrl = `${BASE_URL.replace(/\/+$/,'')}/book/?paid=1`;
    const cancelUrl  = `${BASE_URL.replace(/\/+$/,'')}/book/?cancel=1`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      currency: "brl",
      line_items: [{ price_data: { currency:"brl", product_data:{ name:"Reserva Lapa Casa Hostel" }, unit_amount: amountBRL }, quantity: 1 }],
      client_reference_id: order.bookingId || null,
      metadata: { bookingId: order.bookingId || "", email: order.email || "", nights: String(order.nights || 1) },
      success_url: successUrl,
      cancel_url: cancelUrl
    });
    res.json({ id: session.id });
  } catch (err) {
    logPush("stripe_error", { rid, where:"create_session", msg: err?.message || String(err) });
    res.status(500).json({ error: "stripe_session_error" });
  }
});

// ===== Mercado Pago Preference
app.post("/payments/mp/preference", rateLimit(30), async (req, res) => {
  const rid = res.locals.rid;
  try {
    if (!mpClient) return res.status(500).json({ error: "mp_token_missing" });
    const { title="Reserva Lapa Casa Hostel", unit_price=100, quantity=1, currency_id="BRL", metadata={} } = req.body || {};
    const orderId = (metadata && (metadata.orderId || metadata.bookingId)) || `order-${Date.now()}`;
    const pref = new Preference(mpClient);
    const result = await pref.create({
      body: {
        items: [{ title, unit_price: Number(unit_price), quantity: Number(quantity), currency_id }],
        back_urls: { success: `${BASE_URL}/book/?paid=1`, failure: `${BASE_URL}/book/?cancel=1`, pending: `${BASE_URL}/book/?cancel=1` },
        auto_return: "approved",
        metadata, external_reference: orderId,
        notification_url: `${BASE_URL}/webhooks/mp`
      }
    });
    res.json({ preferenceId: (result.id||result.body?.id), init_point: (result.init_point||result.body?.init_point) });
  } catch (err) {
    logPush("mp_error", { rid, where:"create_preference", msg: err?.message || String(err) });
    res.status(500).json({ error: "mp_preference_failed" });
  }
});

// ===== Forward a Sheets (idempotencia suave + retry)
const processedBookings = new Set(); // window 10 min
app.post("/bookings", rateLimit(60), async (req, res) => {
  const rid = res.locals.rid;
  try {
    if (!BOOKINGS_WEBAPP_URL) return res.status(500).json({ ok:false, error:"no_webhook_url" });
    const body = req.body || {};
    const booking_id = String(body.booking_id || body.bookingId || `BKG-${Date.now()}`);

    if (processedBookings.has(booking_id)) return res.status(200).json({ ok:true, dedup:true, booking_id });
    processedBookings.add(booking_id); setTimeout(()=>processedBookings.delete(booking_id), 10*60*1000);

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
      pay_status: body.pay_status || "pending"
    };

    const j = await fetchJSON(BOOKINGS_WEBAPP_URL, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) }, 4);
    invalidateAvailabilityCache();
    res.status(200).json(j);
  } catch (e) {
    logPush("bookings_error", { rid, msg: e?.message || String(e) });
    res.status(500).json({ ok:false, error:"forward_failed" });
  }
});

// ===== Disponibilidad (cacheada)
const availabilityCache = new Map(); // key `${from}:${to}` -> {ts,data}
const AVAIL_TTL_MS = 60_000;
function invalidateAvailabilityCache(){ availabilityCache.clear(); }

app.get("/availability", async (req, res) => {
  const rid = res.locals.rid;
  try {
    const from = String(req.query.from || "").slice(0,10);
    const to   = String(req.query.to   || "").slice(0,10);
    if (!from || !to) return res.status(400).json({ ok:false, error:"missing_from_to" });

    const key = `${from}:${to}`, now = Date.now();
    const cached = availabilityCache.get(key);
    if (cached && now - cached.ts < AVAIL_TTL_MS) return res.json(cached.data);

    const rows = await fetchJSON(`${BOOKINGS_WEBAPP_URL}?mode=rows`, {}, 3).then(r=>r.rows||[]);
    const occupied = calcOccupiedBeds(rows, from, to);
    const out = { ok:true, from, to, occupied };
    availabilityCache.set(key, { ts: now, data: out });
    res.json(out);
  } catch (e) {
    logPush("availability_error", { rid, msg: e?.message || String(e) });
    res.status(500).json({ ok:false, error:"availability_failed" });
  }
});

function calcOccupiedBeds(rows, from, to) {
  const start = new Date(from+"T00:00:00"), end = new Date(to+"T00:00:00");
  const occupied = {};
  for (const row of rows) {
    const status = String(row.pay_status||"").toLowerCase(); if (!ACTIVE_STATES.has(status)) continue;
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
  const buffers = {
    "1": Math.max(0, Math.min(ROOMS["1"].cap, Number(ROOM_BUFFER_1||0))),
    "3": Math.max(0, Math.min(ROOMS["3"].cap, Number(ROOM_BUFFER_3||0))),
    "5": Math.max(0, Math.min(ROOMS["5"].cap, Number(ROOM_BUFFER_5||0))),
    "6": Math.max(0, Math.min(ROOMS["6"].cap, Number(ROOM_BUFFER_6||0)))
  };
  for (const roomId of Object.keys(ROOMS)) {
    const cap = ROOMS[roomId].cap;
    if (!occupied[roomId]) occupied[roomId] = new Set();
    const set = occupied[roomId];
    const need = Math.max(0, Math.min(buffers[roomId], cap - set.size));
    for (let b=1, added=0; b<=cap && added<need; b++) if (!set.has(b)) { set.add(b); added++; }
  }
  const out = {}; for (const [roomId, set] of Object.entries(occupied)) out[roomId] = Array.from(set).sort((a,b)=>a-b);
  return out;
}

// ===== iCal EXPORT
app.get("/ical/:roomId.ics", async (req, res) => {
  try {
    const roomId = String(req.params.roomId||"").replace(/[^0-9]/g,"");
    if (!ROOMS[roomId]) return res.status(404).send("Not found");
    const rows = await fetchJSON(`${BOOKINGS_WEBAPP_URL}?mode=rows`, {}, 3).then(r=>r.rows||[]);
    const dayCounts = countBedsByDay(rows, roomId);
    const cap = ROOMS[roomId].cap;
    const busyDays = Object.keys(dayCounts).filter(d=>dayCounts[d] >= cap).sort();
    const ranges = mergeContiguousDates(busyDays);
    const ics = buildICS(ROOMS[roomId].name, ranges);
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.send(ics);
  } catch (e) { res.status(500).send("ERROR"); }
});

// ===== iCal IMPORT (crón)
app.get("/crons/ical-pull", async (req, res) => {
  if (!CRON_TOKEN || (req.query.token||"") !== CRON_TOKEN) return res.status(401).json({ ok:false, error:"unauthorized" });
  try {
    const sources = [
      ["1", ICAL_ROOM_1], ["3", ICAL_ROOM_3], ["5", ICAL_ROOM_5], ["6", ICAL_ROOM_6]
    ].filter(([,url])=> !!url);
    let upserts = 0;
    for (const [roomId, url] of sources) {
      const text = await (await fetch(url)).text();
      const events = parseICS(text);
      const cap = ROOMS[roomId].cap;
      const camas = Array.from({length:cap}, (_,i)=>i+1);
      for (const ev of events) {
        const bid = makeIcalBookingId(roomId, ev.start, ev.end, url);
        const payload = {
          action: "upsert_booking",
          booking_id: bid, nombre: `BLOCK-ICAL Room ${roomId}`, email:"",
          telefono:"", entrada: ev.start, salida: ev.end, hombres:0, mujeres:0,
          camas_json: JSON.stringify({ [roomId]: camas }), total:0, pay_status:"paid"
        };
        try { await fetchJSON(BOOKINGS_WEBAPP_URL, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) }, 3); upserts++; }
        catch(e){ logPush("ical_pull_upsert_error", { msg:e?.message||String(e), roomId, ev }); }
      }
    }
    invalidateAvailabilityCache();
    res.json({ ok:true, upserts });
  } catch (e) { res.status(500).json({ ok:false, error:"ical_pull_failed" }); }
});

// ===== Admin (login + logout)
function requireAdmin(req, res, next){
  const logged = req.signedCookies?.ADMIN_SESSION === "yes";
  if (!logged) return res.redirect("/admin/login");
  next();
}
app.get("/admin/login", (_req, res) => {
  res.type("html").send(`<!doctype html><meta charset="utf-8"><title>Login</title>
  <style>body{font-family:system-ui;padding:40px}form{max-width:320px;margin:auto;display:grid;gap:8px}</style>
  <h2>Admin Login</h2>
  <form method="post" action="/admin/login">
    <input name="u" placeholder="usuario" required>
    <input name="p" placeholder="clave" type="password" required>
    <button>Entrar</button>
  </form>`);
});
app.post("/admin/login", express.urlencoded({extended:false}), (req, res) => {
  const { u, p } = req.body || {};
  if (u === ADMIN_USER && p === ADMIN_PASS) { res.cookie("ADMIN_SESSION","yes",{ httpOnly:true, signed:true, sameSite:"lax" }); return res.redirect("/admin"); }
  return res.redirect("/admin/login");
});
app.post("/admin/logout", requireAdmin, (_req, res) => { res.clearCookie("ADMIN_SESSION"); res.redirect("/admin/login"); });

app.get("/admin", requireAdmin, async (_req, res) => {
  const envState = {
    BASE_URL,
    BOOKINGS_WEBAPP_URL: !!BOOKINGS_WEBAPP_URL,
    MP_ACCESS_TOKEN: redact(process.env.MP_ACCESS_TOKEN),
    STRIPE_SK: redact(STRIPE_SK),
    STRIPE_WEBHOOK_SECRET: STRIPE_WEBHOOK_SECRET ? "set" : "—",
    HOLD_TTL_MINUTES,
    ROOM_BUFFER_1, ROOM_BUFFER_3, ROOM_BUFFER_5, ROOM_BUFFER_6,
    ALLOWLIST: ALLOWED()
  };
  let rows = [];
  try { const j = await fetchJSON(`${BOOKINGS_WEBAPP_URL}?mode=rows`, {}, 3); rows = j.rows || []; }
  catch (e) { logPush("admin_error", { where:"rows", msg:e?.message||String(e) }); }
  const lastLogs = [...logs].reverse().slice(0, 100);

  res.type("html").send(`<!doctype html><meta charset="utf-8"><title>Lapa Admin</title>
  <style>body{font-family:system-ui;padding:20px;color:#111}h1{margin:0 0 10px}
  pre{background:#f6f8fa;padding:8px;border-radius:8px;overflow:auto}
  form{display:inline}</style>
  <h1>Admin</h1>
  <form method="post" action="/admin/logout"><button>Salir</button></form>
  <h3>ENV (seguro)</h3><pre>${escapeHTML(JSON.stringify(envState,null,2))}</pre>
  <h3>Últimas reservas (max 50)</h3><pre>${escapeHTML(JSON.stringify(rows.slice(-50),null,2))}</pre>
  <h3>Logs recientes</h3><pre>${escapeHTML(JSON.stringify(lastLogs,null,2))}</pre>
  <a href="/admin/rows.csv">Descargar CSV</a>`);
});
app.get("/admin/rows.csv", requireAdmin, async (_req, res) => {
  try {
    const j = await fetchJSON(`${BOOKINGS_WEBAPP_URL}?mode=rows`, {}, 3);
    const rows = j.rows || [];
    const headers = ["booking_id","nombre","email","telefono","entrada","salida","hombres","mujeres","camas_json","total","pay_status","created_at"];
    const csv = toCSV(rows, headers);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="reservas.csv"`);
    res.send(csv);
  } catch (e) { res.status(500).send("ERROR"); }
});

// ===== Eventos (cache 24h) desde fuentes JSON si EVENTS_SOURCES
const eventsCache = { ts:0, data: [] };
app.get("/api/events", async (_req, res) => {
  const now = Date.now();
  if (eventsCache.data.length && (now - eventsCache.ts) < 24*60*60*1000) return res.json({ ok:true, events: eventsCache.data });
  try {
    const urls = EVENTS_SOURCES.split(",").map(s=>s.trim()).filter(Boolean);
    let out = [];
    for (const u of urls) {
      try { const j = await fetchJSON(u, {}, 2); out = out.concat(Array.isArray(j)?j:(j.events||[])); } catch {}
    }
    if (!out.length) {
      out = [
        { title:"Samba do Mercado", area:"Centro", date:"2025-09-01", link:"https://example.com" },
        { title:"Feira de Arte", area:"Lapa", date:"2025-09-05", link:"https://example.com" }
      ];
    }
    eventsCache.ts = now; eventsCache.data = out;
    res.json({ ok:true, events: out });
  } catch { res.json({ ok:true, events: [] }); }
});

// ===== Holds (anti-overbooking)
const holdsMem = new Map();
app.post("/holds/start", rateLimit(60), async (req, res) => {
  try {
    const b = req.body || {};
    const holdId = b.holdId || b.bookingId || `HOLD-${Date.now()}`;
    const ttlMin = Number(b.ttlMinutes || HOLD_TTL_MINUTES);
    const expiresAt = Date.now() + ttlMin * 60_000;

    const payload = {
      action: "upsert_booking",
      booking_id: holdId, nombre: b.nombre || "HOLD", email: b.email || "", telefono: b.telefono || "",
      entrada: b.entrada || "", salida: b.salida || "", hombres: Number(b.hombres || 0), mujeres: Number(b.mujeres || 0),
      camas_json: JSON.stringify(b.camas || {}), total: Number(b.total || 0), pay_status: "hold"
    };
    await fetchJSON(BOOKINGS_WEBAPP_URL, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) }, 3);

    holdsMem.set(holdId, { expiresAt });
    invalidateAvailabilityCache();
    res.json({ ok:true, holdId, expiresAt });
  } catch (e) { res.status(500).json({ ok:false, error:"hold_start_failed" }); }
});
app.post("/holds/release", rateLimit(60), async (req, res) => {
  try {
    const holdId = req.body?.holdId || "";
    if (!holdId) return res.status(400).json({ ok:false, error:"missing_holdId" });
    await fetchJSON(BOOKINGS_WEBAPP_URL, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ action:"upsert_booking", booking_id: holdId, pay_status:"released" }) }, 3);
    holdsMem.delete(holdId); invalidateAvailabilityCache();
    res.json({ ok:true, holdId });
  } catch (e) { res.status(500).json({ ok:false, error:"hold_release_failed" }); }
});
app.post("/holds/confirm", rateLimit(60), async (req, res) => {
  try {
    const holdId = req.body?.holdId || ""; const newStatus = req.body?.status || "paid";
    if (!holdId) return res.status(400).json({ ok:false, error:"missing_holdId" });
    await fetchJSON(BOOKINGS_WEBAPP_URL, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ action:"upsert_booking", booking_id: holdId, pay_status:newStatus }) }, 3);
    holdsMem.delete(holdId); invalidateAvailabilityCache();
    res.json({ ok:true, holdId, status:newStatus });
  } catch (e) { res.status(500).json({ ok:false, error:"hold_confirm_failed" }); }
});

// ===== Helpers (iCal y CSV)
function countBedsByDay(rows, roomId) {
  const counts = {};
  for (const row of rows) {
    const status = String(row.pay_status||"").toLowerCase(); if (!ACTIVE_STATES.has(status)) continue;
    let cjson = row.camas_json || row.camas || ""; try { if (typeof cjson==="string") cjson = cjson?JSON.parse(cjson):{}; } catch { cjson = {}; }
    const beds = (cjson && cjson[roomId]) ? (Array.isArray(cjson[roomId])?cjson[roomId]:[]) : [];
    if (!beds.length) continue;
    const entrada = row.entrada ? new Date(String(row.entrada)+'T00:00:00') : null;
    const salida  = row.salida  ? new Date(String(row.salida )+'T00:00:00') : null;
    if (!entrada || !salida) continue;
    for (let d=new Date(entrada); d<salida; d.setDate(d.getDate()+1)) {
      const key = d.toISOString().slice(0,10);
      counts[key] = (counts[key]||0) + beds.length;
    }
  }
  return counts;
}
function mergeContiguousDates(days){
  if (!days.length) return [];
  const toDate = s=>new Date(s+"T00:00:00"); const ranges=[]; let a=days[0], prev=days[0];
  for(let i=1;i<days.length;i++){
    const cur=days[i]; const dprev=toDate(prev), dcur=toDate(cur);
    const next=new Date(dprev); next.setDate(next.getDate()+1);
    if (dcur.getTime()!==next.getTime()) { const end = (d=>{const t=new Date(toDate(prev));t.setDate(t.getDate()+1);return t.toISOString().slice(0,10);})(); ranges.push({start:a,end}); a=cur; }
    prev=cur;
  }
  const endLast=(d=>{const t=new Date(new Date(prev+"T00:00:00")); t.setDate(t.getDate()+1); return t.toISOString().slice(0,10);})();
  ranges.push({start:a, end:endLast}); return ranges;
}
function buildICS(calName, ranges){
  const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Lapa Casa//Channel Manager//ES",`X-WR-CALNAME:${escapeICS(calName)} (FULL DAYS)`];
  for(const r of ranges){
    const uid=`lapa-${crypto.randomUUID()}@lapacasa`;
    lines.push("BEGIN:VEVENT",`UID:${uid}`,`DTSTAMP:${icsTS(new Date())}`,`DTSTART;VALUE=DATE:${r.start.replace(/-/g,"")}`,`DTEND;VALUE=DATE:${r.end.replace(/-/g,"")}`,`SUMMARY:${escapeICS("Ocupado (sin disponibilidad)")}`,"END:VEVENT");
  }
  lines.push("END:VCALENDAR"); return lines.join("\r\n");
}
function icsTS(d){ const p=n=>String(n).padStart(2,"0"); return d.getUTCFullYear()+p(d.getUTCMonth()+1)+p(d.getUTCDate())+"T"+p(d.getUTCHours())+p(d.getUTCMinutes())+p(d.getUTCSeconds())+"Z"; }
function escapeICS(s){ return String(s).replace(/([,;])/g,"\\$1").replace(/\n/g,"\\n"); }
function parseICS(text){
  const lines=String(text||"").split(/\r?\n/); const events=[]; let inEv=false, ds=null, de=null;
  for(const raw of lines){
    const line=raw.trim();
    if(line==="BEGIN:VEVENT"){ inEv=true; ds=null; de=null; continue; }
    if(line==="END:VEVENT"){ if(ds){ const start=toISO(ds), end=toISO(de||ds); events.push({start,end}); } inEv=false; continue; }
    if(!inEv) continue;
    if(line.startsWith("DTSTART")) ds=line.split(":").pop();
    else if(line.startsWith("DTEND")) de=line.split(":").pop();
  } return events;
}
function toISO(v){ const s=String(v||"").trim(); const y=s.slice(0,4), m=s.slice(4,6), d=s.slice(6,8); return `${y}-${m}-${d}`; }
function makeIcalBookingId(roomId,start,end,src){ return `ICAL-${roomId}-${start.replace(/-/g,"")}-${end.replace(/-/g,"")}-${crypto.createHash("md5").update(`${roomId}|${start}|${end}|${src}`).digest("hex").slice(0,12)}`; }

function toCSV(rows, headers){
  const esc=v=>{ if(v==null) return ""; const s=String(v); return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; };
  const lines=[headers.join(",")];
  for(const r of rows){ lines.push(headers.map(h=>{ let v=r[h]; if(h==="created_at"&&v){ try{ v=new Date(v).toISOString(); }catch{} } return esc(v); }).join(",")); }
  return lines.join("\n");
}
function escapeHTML(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function ALLOWED(){ return CORS_ALLOW_ORIGINS || "(open)"; }

// ===== Integración Booking inbound (emails)
require("./integrations/booking-inbound")(app);

// ===== Server
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
