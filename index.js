"use strict";
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const Stripe = require("stripe");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");

/* ========================
   ENV / CONFIG (Render)
   ======================== */
const BASE_URL = process.env.BASE_URL || "https://lapa-casa-backend.onrender.com";
const BOOKINGS_WEBAPP_URL = process.env.BOOKINGS_WEBAPP_URL || ""; // GAS WebApp URL (exec)
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";         // MP access token
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET || process.env.MERCADO_PAGO_CHECKOUT_API_WEBHOOK_SECRET || ""; // secreto firma WH MP
const STRIPE_SK = process.env.STRIPE_SK || process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || ""; // protege /admin
const CRON_TOKEN = process.env.CRON_TOKEN || "";   // protege /crons
const HOLD_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES || 10);

// CORS allowlist coma-separada. Vacío = abierto.
const CORS_ALLOW_ORIGINS = (process.env.CORS_ALLOW_ORIGINS || "").split(",").map(s=>s.trim()).filter(Boolean);

// Buffers anti-overbooking
const DEFAULT_ROOM_BUFFER = Number(process.env.BOOKING_BUFFER_PER_ROOM || 0);
const ROOM_BUFFER_1 = Number(process.env.ROOM_BUFFER_1 || DEFAULT_ROOM_BUFFER);
const ROOM_BUFFER_3 = Number(process.env.ROOM_BUFFER_3 || DEFAULT_ROOM_BUFFER);
const ROOM_BUFFER_5 = Number(process.env.ROOM_BUFFER_5 || DEFAULT_ROOM_BUFFER);
const ROOM_BUFFER_6 = Number(process.env.ROOM_BUFFER_6 || DEFAULT_ROOM_BUFFER);

// iCal IMPORT por cuarto (Hostelworld/Airbnb/etc). Pegar URLs ICS aquí como env vars.
const ICAL_ROOM_1 = process.env.ICAL_ROOM_1 || "";
const ICAL_ROOM_3 = process.env.ICAL_ROOM_3 || "";
const ICAL_ROOM_5 = process.env.ICAL_ROOM_5 || "";
const ICAL_ROOM_6 = process.env.ICAL_ROOM_6 || "";

/* ========================
   Datos fijos
   ======================== */
const ROOMS = {
  "1": { name: "Cuarto 1 (12 mixto)", cap: 12 },
  "3": { name: "Cuarto 3 (12 mixto)", cap: 12 },
  "5": { name: "Cuarto 5 (7 mixto)",  cap: 7  },
  "6": { name: "Cuarto 6 (7 femenino)", cap: 7 }
};
const SHEET_HEADERS = [
  "booking_id","nombre","email","telefono",
  "entrada","salida","hombres","mujeres",
  "camas_json","total","pay_status","created_at"
];

/* ========================
   App / security / utils
   ======================== */
const app = express();
app.set("trust proxy", 1);

// ===== Stripe webhook (raw) ANTES del JSON parser
const stripe = STRIPE_SK ? new Stripe(STRIPE_SK) : null;
app.post(["/webhooks/stripe","/api/webhooks/stripe"], express.raw({ type: "application/json" }), async (req, res) => {
  try {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) return res.status(200).send("ok");
    const sig = req.headers["stripe-signature"];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      logPush("stripe_error", { where: "invalid_signature", msg: err?.message || String(err) });
      return res.status(400).send("invalid signature");
    }

    // Idempotencia (dedupe por event.id)
    if (isDuplicateEvent(`stripe:${event.id}`)) return res.status(200).send("dup");

    const t = event.type;
    logPush("stripe_event", { type: t, id: event.id });
    const notifySheets = async (bookingId, status, total) => {
      if (!bookingId || !BOOKINGS_WEBAPP_URL) return;
      await postToSheets({ action:"payment_update", booking_id: bookingId, status, total });
      invalidateAvailabilityCache();
    };

    if (t === "checkout.session.completed") {
      const s = event.data.object;
      const bookingId = s.client_reference_id || s.metadata?.bookingId || "";
      const total = (s.amount_total || 0) / 100;
      await notifySheets(bookingId, "approved", total);
    } else if (t === "checkout.session.expired" || t === "checkout.session.async_payment_failed") {
      const s = event.data.object;
      const bookingId = s.client_reference_id || s.metadata?.bookingId || "";
      await notifySheets(bookingId, "rejected", (s.amount_total || 0) / 100);
    } else if (t === "charge.refunded" || t === "charge.refund.updated") {
      const c = event.data.object;
      const pi = c.payment_intent;
      let bookingId = "";
      if (pi) {
        try {
          const piObj = await stripe.paymentIntents.retrieve(pi, { expand: ["charges.data.balance_transaction"] });
          bookingId = piObj?.metadata?.bookingId || "";
        } catch {}
      }
      await notifySheets(bookingId, "refunded", (c.amount || 0) / 100);
    } else if (t === "payment_intent.payment_failed") {
      const pi = event.data.object;
      const bookingId = pi?.metadata?.bookingId || "";
      await notifySheets(bookingId, "rejected", (pi.amount || 0) / 100);
    }

    return res.status(200).send("ok");
  } catch (e) {
    logPush("stripe_error", { where: "handler", msg: e?.message || String(e) });
    return res.status(200).send("ok");
  }
});

// ===== Middlewares después del webhook Stripe
const ALLOWED = CORS_ALLOW_ORIGINS;
const corsOptions = {
  origin: (origin, cb) => {
    if (ALLOWED.length === 0) return cb(null, true);
    if (!origin) return cb(null, true);
    const ok = ALLOWED.some(p => matchOrigin(origin, p));
    cb(null, ok);
  },
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static("public"));

// Rate limit simple
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

// Logs memoria + dedupe webhooks
const LOG_MAX = 200;
const logs = [];
function logPush(type, payload){ logs.push({ ts: Date.now(), type, payload }); if (logs.length>LOG_MAX) logs.shift(); }
const recentEvents = new Map(); // key->ts
function isDuplicateEvent(key, ttlMs = 15*60_000) {
  const now = Date.now();
  for (const [k,ts] of [...recentEvents.entries()]) if (now - ts > ttlMs) recentEvents.delete(k);
  if (recentEvents.has(key)) return true;
  recentEvents.set(key, now);
  return false;
}

/* ========================
   Health / raíz
   ======================== */
app.get(["/","/api/health"], (_req, res) => {
  if (_req.path === "/") return res.send("Backend Lapa Casa activo 🚀");
  res.json({ ok:true, service:"lapa-casa-backend", ts: Date.now() });
});

/* ========================
   Stripe Checkout Session
   ======================== */
function handleStripeSession(){
  return async (req, res) => {
    try {
      if (!stripe) return res.status(400).json({ error: "stripe_not_configured" });
      const order = req.body?.order || {};
      const amountBRL = Math.max(100, Math.round((order.total || 0) * 100)); // mínimo R$1,00

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        currency: "brl",
        line_items: [{
          price_data: { currency:"brl", product_data: { name:"Reserva Lapa Casa Hostel" }, unit_amount: amountBRL },
          quantity: 1
        }],
        client_reference_id: order.bookingId || null,
        metadata: { bookingId: order.bookingId || "", email: order.email || "", nights: String(order.nights || 1) },
        success_url: `${BASE_URL}/book?paid=1`,
        cancel_url: `${BASE_URL}/book?cancel=1`,
      });

      res.json({ id: session.id });
    } catch (err) {
      logPush("stripe_error", { where: "create_session", msg: err?.message || String(err) });
      res.status(500).json({ error: "stripe_session_error" });
    }
  };
}
app.post(["/payments/stripe/session","/api/payments/stripe/session"], rateLimit(30), handleStripeSession());

/* ========================
   Mercado Pago Preference
   ======================== */
const mpClient = MP_ACCESS_TOKEN ? new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN }) : null;
app.get(["/pago-exitoso-test","/api/pago-exitoso-test"], (_req, res) =>
  res.type("html").send(`<!doctype html><meta charset="utf-8"><title>Pago aprobado</title><body style="font-family:Arial;text-align:center;padding:50px"><h1 style="color:green">✅ Pago aprobado</h1><p>Tu pago de prueba en Mercado Pago fue exitoso.</p></body>`)
);
app.get(["/pago-fallido-test","/api/pago-fallido-test"], (_req, res) =>
  res.type("html").send(`<!doctype html><meta charset="utf-8"><title>Pago rechazado</title><body style="font-family:Arial;text-align:center;padding:50px"><h1 style="color:red">❌ Pago rechazado</h1><p>Tu pago de prueba fue rechazado o cancelado.</p></body>`)
);

function handleCreatePreference(){
  return async (req, res) => {
    try {
      if (!mpClient) return res.status(500).json({ error: "mp_token_missing" });
      const { title="Reserva Lapa Casa Hostel", unit_price=100, quantity=1, currency_id="BRL", metadata={} } = req.body || {};
      const orderId = (metadata && (metadata.orderId || metadata.bookingId)) || `order-${Date.now()}`;
      const pref = new Preference(mpClient);
      const body = {
        items: [{ title, unit_price: Number(unit_price), quantity: Number(quantity), currency_id }],
        back_urls: { success: `${BASE_URL}/pago-exitoso-test`, failure: `${BASE_URL}/pago-fallido-test`, pending: `${BASE_URL}/pago-fallido-test` },
        auto_return: "approved",
        metadata,
        external_reference: orderId,
        notification_url: `${BASE_URL}/webhooks/mp`,
      };
      const result = await pref.create({ body });
      const initPoint = result.init_point || result.body?.init_point;
      const id = result.id || result.body?.id;
      res.json({ preferenceId: id, init_point: initPoint });
    } catch (err) {
      logPush("mp_error", { where: "create_preference", msg: err?.message || String(err) });
      res.status(500).json({ error: "mp_preference_failed" });
    }
  };
}
app.post(["/payments/mp/preference","/api/payments/mp/preference"], rateLimit(30), handleCreatePreference());

/* ========================
   Webhook Mercado Pago (con firma + dedupe)
   ======================== */
function verifyMpSignature(req, paymentId) {
  try {
    const sig = req.headers["x-signature"];
    const reqId = req.headers["x-request-id"];
    if (!MP_WEBHOOK_SECRET || !sig || !reqId || !paymentId) return false;

    // x-signature: "ts=1699999999,v1=abcdef..."
    const parts = String(sig).split(",");
    let ts, v1;
    for (const p of parts) {
      const [k,v] = p.split("=");
      if (k && v) {
        if (k.trim() === "ts") ts = v.trim();
        if (k.trim() === "v1") v1 = v.trim();
      }
    }
    if (!ts || !v1) return false;
    const manifest = `id:${paymentId};request-id:${reqId};ts:${ts};`;
    const calc = crypto.createHmac("sha256", MP_WEBHOOK_SECRET).update(manifest).digest("hex");
    return calc === v1;
  } catch {
    return false;
  }
}

app.post(["/webhooks/mp","/api/webhooks/mp"], async (req, res) => {
  try {
    const type = req.query.type || req.body?.type;
    const paymentId = req.query["data.id"] || req.body?.data?.id || req.body?.id;

    if (type !== "payment" || !paymentId) {
      logPush("mp_event_ignored", { type, paymentId });
      return res.status(200).send("ok");
    }

    // Verificación de firma (si configuraste MP_WEBHOOK_SECRET)
    if (MP_WEBHOOK_SECRET) {
      const ok = verifyMpSignature(req, paymentId);
      if (!ok) {
        logPush("mp_signature_fail", { paymentId });
        return res.status(401).send("invalid signature"); // corta si no valida
      }
    }

    // Idempotencia dedupe por paymentId
    if (isDuplicateEvent(`mp:${paymentId}`)) return res.status(200).send("dup");

    if (!mpClient) return res.status(200).send("ok");
    const pay = new Payment(mpClient);
    const payment = await pay.get({ id: paymentId });
    const status = payment?.status; // approved | rejected | pending | refunded | canceled
    const externalRef = payment?.external_reference || ""; // orderId / bookingId
    const total = payment?.transaction_amount;

    logPush("mp_event", { paymentId, status, externalRef, total });

    if (BOOKINGS_WEBAPP_URL && externalRef) {
      await postToSheets({ action:"payment_update", booking_id: externalRef, status, total });
      invalidateAvailabilityCache();
    }

    return res.status(200).send("ok");
  } catch (e) {
    logPush("mp_error", { where: "webhook", msg: e?.message || String(e) });
    return res.status(200).send("ok");
  }
});

/* ========================
   Forward a Google Sheets (idempotencia + retry)
   ======================== */
function handleBookings(){
  return async (req, res) => {
    try {
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

      // Intento con retry + fallback create
      let j = await postToSheets(payload);
      if (!j?.ok) {
        const fallback = { ...payload }; delete fallback.action;
        j = await postToSheets(fallback);
      }

      invalidateAvailabilityCache();
      return res.status(j?.ok ? 200 : 500).json(j);
    } catch (e) {
      logPush("bookings_error", { msg: e?.message || String(e) });
      return res.status(500).json({ ok:false, error:"forward_failed" });
    }
  };
}
app.post(["/bookings","/api/bookings"], rateLimit(60), handleBookings());

/* ========================
   Availability (cache TTL)
   ======================== */
const availabilityCache = new Map(); // key = from:to -> {ts,data}
const AVAIL_TTL_MS = 60_000;

function handleAvailability(){
  return async (req, res) => {
    try {
      const from = String(req.query.from || "").slice(0,10);
      const to = String(req.query.to || "").slice(0,10);
      if (!from || !to) return res.status(400).json({ ok:false, error:"missing_from_to" });

      const key = `${from}:${to}`; const now = Date.now();
      const cached = availabilityCache.get(key);
      if (cached && now - cached.ts < AVAIL_TTL_MS) return res.json(cached.data);

      const rows = await fetchRowsFromSheet_();
      const occupied = calcOccupiedBeds_(rows, from, to);
      const out = { ok:true, from, to, occupied };
      availabilityCache.set(key, { ts: now, data: out });
      return res.json(out);
    } catch (e) {
      logPush("availability_error", { msg: e?.message || String(e) });
      return res.status(500).json({ ok:false, error:"availability_failed" });
    }
  };
}
app.get(["/availability","/api/availability"], handleAvailability());

/* ========================
   HOLDs anti-overbooking
   ======================== */
const holdsMem = new Map(); // holdId -> {expiresAt}

function handleHoldStart(){
  return async (req, res) => {
    try {
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
      return res.json({ ok:true, holdId, expiresAt });
    } catch (e) {
      logPush("hold_start_error", { msg: e?.message || String(e) });
      return res.status(500).json({ ok:false, error:"hold_start_failed" });
    }
  };
}
function handleHoldRelease(){
  return async (req, res) => {
    try {
      const holdId = req.body?.holdId || "";
      if (!holdId) return res.status(400).json({ ok:false, error:"missing_holdId" });
      await postToSheets({ action:"upsert_booking", booking_id: holdId, pay_status:"released" });
      holdsMem.delete(holdId);
      invalidateAvailabilityCache();
      return res.json({ ok:true, holdId });
    } catch (e) {
      logPush("hold_release_error", { msg: e?.message || String(e) });
      return res.status(500).json({ ok:false, error:"hold_release_failed" });
    }
  };
}
function handleHoldConfirm(){
  return async (req, res) => {
    try {
      const holdId = req.body?.holdId || "";
      const newStatus = req.body?.status || "paid"; // paid|pending
      if (!holdId) return res.status(400).json({ ok:false, error:"missing_holdId" });
      await postToSheets({ action:"upsert_booking", booking_id: holdId, pay_status: newStatus });
      holdsMem.delete(holdId);
      invalidateAvailabilityCache();
      return res.json({ ok:true, holdId, status:newStatus });
    } catch (e) {
      logPush("hold_confirm_error", { msg: e?.message || String(e) });
      return res.status(500).json({ ok:false, error:"hold_confirm_failed" });
    }
  };
}
app.post(["/holds/start","/api/holds/start"], rateLimit(60), handleHoldStart());
app.post(["/holds/release","/api/holds/release"], rateLimit(60), handleHoldRelease());
app.post(["/holds/confirm","/api/holds/confirm"], rateLimit(60), handleHoldConfirm());

/* ========================
   Admin (token) + CSV
   ======================== */
app.get(["/admin","/api/admin"], async (req, res) => {
  const bearer = (req.headers.authorization || "").split(" ")[1] || req.query.token || "";
  if (!ADMIN_TOKEN || bearer !== ADMIN_TOKEN) return res.status(401).send("Unauthorized");

  const envState = {
    BASE_URL,
    BOOKINGS_WEBAPP_URL: !!BOOKINGS_WEBAPP_URL,
    MP_ACCESS_TOKEN: redact(MP_ACCESS_TOKEN),
    MP_WEBHOOK_SECRET: MP_WEBHOOK_SECRET ? "set" : "—",
    STRIPE_SK: redact(STRIPE_SK),
    STRIPE_WEBHOOK_SECRET: redact(STRIPE_WEBHOOK_SECRET),
    ADMIN_TOKEN: ADMIN_TOKEN ? "set" : "—",
    CRON_TOKEN: CRON_TOKEN ? "set" : "—",
    HOLD_TTL_MINUTES,
    CORS_ALLOW_ORIGINS: CORS_ALLOW_ORIGINS.join(",") || "(open)",
    DEFAULT_ROOM_BUFFER,
    ROOM_BUFFER_1, ROOM_BUFFER_3, ROOM_BUFFER_5, ROOM_BUFFER_6
  };

  let rows = [];
  try { rows = await fetchRowsFromSheet_(); }
  catch (e) { logPush("admin_error", { where:"rows", msg: e?.message || String(e) }); }

  const lastLogs = [...logs].reverse().slice(0, 50);
  const html = `<!doctype html><meta charset="utf-8">
  <title>Lapa Admin</title>
  <style>
    body{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;padding:20px;color:#111}
    h1{margin:0 0 10px} code,pre{background:#f6f8fa;padding:4px 6px;border-radius:6px}
    table{border-collapse:collapse;width:100%;margin-top:10px}
    th,td{border:1px solid #e5e7eb;padding:6px 8px;font-size:13px;text-align:left}
    th{background:#fafafa}.muted{color:#6b7280} a.btn{display:inline-block;margin-top:8px;padding:6px 10px;border:1px solid #e5e7eb;border-radius:8px;text-decoration:none}
  </style>
  <h1>Admin</h1>
  <h3>ENV</h3>
  <pre>${escapeHTML(JSON.stringify(envState,null,2))}</pre>
  <h3>Últimas reservas (max 50)</h3>
  <pre class="muted">${escapeHTML(JSON.stringify(rows.slice(-50),null,2))}</pre>
  <h3>Logs recientes</h3>
  <pre>${escapeHTML(JSON.stringify(lastLogs,null,2))}</pre>
  <a class="btn" href="/admin/rows.csv?token=${encodeURIComponent(bearer)}">Descargar CSV</a>
  `;
  res.type("html").send(html);
});

app.get(["/admin/rows.csv","/api/admin/rows.csv"], async (req, res) => {
  const bearer = (req.headers.authorization || "").split(" ")[1] || req.query.token || "";
  if (!ADMIN_TOKEN || bearer !== ADMIN_TOKEN) return res.status(401).send("Unauthorized");
  try {
    const rows = await fetchRowsFromSheet_();
    const csv = toCSV_(rows, SHEET_HEADERS);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="reservas.csv"`);
    return res.send(csv);
  } catch (e) {
    logPush("admin_csv_error", { msg: e?.message || String(e) });
    return res.status(500).send("ERROR");
  }
});

/* ========================
   iCal EXPORT + IMPORT (Hostelworld/Airbnb/…)
   ======================== */
app.get(["/ical/:roomId.ics","/api/ical/:roomId.ics"], async (req, res) => {
  try {
    const roomId = String(req.params.roomId || "").replace(/[^0-9]/g, "");
    if (!ROOMS[roomId]) return res.status(404).send("Not found");
    const rows = await fetchRowsFromSheet_();
    const dayCounts = countBedsByDay_(rows, roomId);
    const cap = ROOMS[roomId].cap;
    const busyDays = Object.keys(dayCounts).filter(d => dayCounts[d] >= cap).sort();
    const ranges = mergeContiguousDates_(busyDays);
    const ics = buildICS_(ROOMS[roomId].name, ranges);
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    return res.send(ics);
  } catch (e) {
    logPush("ical_export_error", { msg: e?.message || String(e) });
    return res.status(500).send("ERROR");
  }
});

// Pull de iCal externos -> upsert en Sheets para bloquear
app.get(["/crons/ical-pull","/api/crons/ical-pull"], async (req, res) => {
  try {
    if (!CRON_TOKEN || (req.query.token || "") !== CRON_TOKEN) return res.status(401).json({ ok:false, error:"unauthorized" });

    const sources = [
      ["1", ICAL_ROOM_1],
      ["3", ICAL_ROOM_3],
      ["5", ICAL_ROOM_5],
      ["6", ICAL_ROOM_6],
    ].filter(([,url])=> !!url);

    let upserts = 0;
    for (const [roomId, url] of sources) {
      const text = await (await fetch(url)).text();
      const events = parseICS_(text);
      const cap = ROOMS[roomId].cap;
      const camas = Array.from({length:cap}, (_,i)=>i+1); // bloquear todas

      for (const ev of events) {
        const bid = makeIcalBookingId_(roomId, ev.start, ev.end, url);
        const payload = {
          action: "upsert_booking",
          booking_id: bid,
          nombre: `BLOCK-ICAL Room ${roomId}`,
          email: "",
          telefono: "",
          entrada: ev.start,
          salida: ev.end,
          hombres: 0, mujeres: 0,
          camas_json: JSON.stringify({ [roomId]: camas }),
          total: 0,
          pay_status: "paid"
        };
        try { await postToSheets(payload); upserts++; }
        catch (e) { logPush("ical_pull_upsert_error", { roomId, ev, msg: e?.message || String(e) }); }
      }
    }
    invalidateAvailabilityCache();
    return res.json({ ok:true, upserts });
  } catch (e) {
    logPush("ical_import_error", { msg: e?.message || String(e) });
    return res.status(500).json({ ok:false, error:"ical_pull_failed" });
  }
});

/* ========================
   Helpers Sheets / Avail / iCal / CSV / CORS / Retry
   ======================== */
async function fetchRowsFromSheet_() {
  const url = `${BOOKINGS_WEBAPP_URL}?mode=rows`;
  const r = await fetchWithRetry(url, { method:"GET" });
  const j = await r.json().catch(() => ({ ok:false, rows:[] }));
  return Array.isArray(j.rows) ? j.rows : [];
}

function calcOccupiedBeds_(rows, from, to) {
  const start = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  const occupied = {}; // roomId -> Set()

  // Estados que bloquean
  const ACTIVE = new Set(["paid","pending","authorized","in_process","approved","hold","released"]); // released cuenta como bloqueado hasta sweep

  for (const row of rows) {
    const status = String(row.pay_status || "").toLowerCase();
    if (!ACTIVE.has(status)) continue;

    const entrada = row.entrada ? new Date(String(row.entrada) + "T00:00:00") : null;
    const salida  = row.salida  ? new Date(String(row.salida)  + "T00:00:00") : null;
    if (!entrada || !salida) continue;
    if (!(entrada < end && salida > start)) continue; // overlap

    let cjson = row.camas_json || row.camas || "";
    try { if (typeof cjson === "string") cjson = cjson ? JSON.parse(cjson) : {}; } catch { cjson = {}; }
    if (cjson && typeof cjson === "object") {
      for (const [roomId, beds] of Object.entries(cjson)) {
        if (!occupied[roomId]) occupied[roomId] = new Set();
        (Array.isArray(beds) ? beds : []).forEach((b) => occupied[roomId].add(Number(b)));
      }
    }
  }

  // Aplicar buffers (ocupación virtual)
  const buffers = {
    "1": Math.max(0, Math.min(ROOMS["1"].cap, ROOM_BUFFER_1)),
    "3": Math.max(0, Math.min(ROOMS["3"].cap, ROOM_BUFFER_3)),
    "5": Math.max(0, Math.min(ROOMS["5"].cap, ROOM_BUFFER_5)),
    "6": Math.max(0, Math.min(ROOMS["6"].cap, ROOM_BUFFER_6)),
  };
  for (const roomId of Object.keys(ROOMS)) {
    const cap = ROOMS[roomId].cap;
    if (!occupied[roomId]) occupied[roomId] = new Set();
    const set = occupied[roomId];
    const need = Math.max(0, Math.min(buffers[roomId], cap - set.size));
    if (need > 0) {
      for (let b = 1, added = 0; b <= cap && added < need; b++) {
        if (!set.has(b)) { set.add(b); added++; }
      }
    }
  }

  const out = {};
  for (const [roomId, set] of Object.entries(occupied)) out[roomId] = Array.from(set).sort((a,b)=>a-b);
  return out;
}

function countBedsByDay_(rows, roomId) {
  const counts = {}; // 'YYYY-MM-DD' -> number
  const ACTIVE = new Set(["paid","pending","authorized","in_process","approved","hold"]);
  for (const row of rows) {
    const status = String(row.pay_status || "").toLowerCase();
    if (!ACTIVE.has(status)) continue;

    let cjson = row.camas_json || row.camas || "";
    try { if (typeof cjson === "string") cjson = cjson ? JSON.parse(cjson) : {}; } catch { cjson = {}; }
    const beds = (cjson && cjson[roomId]) ? (Array.isArray(cjson[roomId]) ? cjson[roomId] : []) : [];
    if (!beds.length) continue;

    const entrada = row.entrada ? new Date(String(row.entrada)+'T00:00:00') : null;
    const salida  = row.salida  ? new Date(String(row.salida )+'T00:00:00') : null;
    if (!entrada || !salida) continue;

    for (let d = new Date(entrada); d < salida; d.setDate(d.getDate()+1)) {
      const key = d.toISOString().slice(0,10);
      counts[key] = (counts[key] || 0) + beds.length;
    }
  }
  return counts;
}

function mergeContiguousDates_(days) {
  if (!days.length) return [];
  const toDate = s => new Date(s+"T00:00:00");
  const ranges = [];
  let a = days[0], prev = days[0];
  for (let i=1;i<days.length;i++){
    const cur = days[i];
    const dprev = toDate(prev), dcur = toDate(cur);
    const nextOfPrev = new Date(dprev); nextOfPrev.setDate(nextOfPrev.getDate()+1);
    if (dcur.getTime() !== nextOfPrev.getTime()) {
      const dtStart = a;
      const dtEnd   = (()=>{ const t=new Date(toDate(prev)); t.setDate(t.getDate()+1); return t.toISOString().slice(0,10);})();
      ranges.push({ start: dtStart, end: dtEnd });
      a = cur;
    }
    prev = cur;
  }
  const endLast = (()=>{ const t=new Date(toDate(prev)); t.setDate(t.getDate()+1); return t.toISOString().slice(0,10);})();
  ranges.push({ start:a, end:endLast });
  return ranges;
}

function buildICS_(calName, ranges) {
  const lines = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//Lapa Casa//Channel Manager//ES");
  lines.push(`X-WR-CALNAME:${escapeICS_(calName)} (FULL DAYS)`);
  for (const r of ranges) {
    const uid = `lapa-${crypto.randomUUID()}@lapacasa`;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${formatICSDateTime_(new Date())}`);
    lines.push(`DTSTART;VALUE=DATE:${r.start.replace(/-/g,"")}`);
    lines.push(`DTEND;VALUE=DATE:${r.end.replace(/-/g,"")}`);
    lines.push(`SUMMARY:${escapeICS_("Ocupado (sin disponibilidad)")}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
function formatICSDateTime_(d){
  const pad = n => String(n).padStart(2,"0");
  return d.getUTCFullYear()
    + pad(d.getUTCMonth()+1)
    + pad(d.getUTCDate())
    + "T"
    + pad(d.getUTCHours())
    + pad(d.getUTCMinutes())
    + pad(d.getUTCSeconds())
    + "Z";
}
function escapeICS_(s){ return String(s).replace(/([,;])/g,"\\$1").replace(/\n/g,"\\n"); }

function parseICS_(text) {
  const lines = String(text||"").split(/\r?\n/);
  const events = [];
  let inEvent = false, dtStart = null, dtEnd = null;
  for (let raw of lines) {
    const line = raw.trim();
    if (line === "BEGIN:VEVENT") { inEvent=true; dtStart=null; dtEnd=null; continue; }
    if (line === "END:VEVENT") {
      if (dtStart) {
        const start = toISODate_(dtStart);
        const end   = toISODate_(dtEnd || dtStart);
        events.push({ start, end });
      }
      inEvent = false; continue;
    }
    if (!inEvent) continue;
    if (line.startsWith("DTSTART")) {
      dtStart = line.split(":").pop();
    } else if (line.startsWith("DTEND")) {
      dtEnd = line.split(":").pop();
    }
  }
  return events;
}
function toISODate_(v){ const s=String(v||"").trim(); const y=s.slice(0,4), m=s.slice(4,6), d=s.slice(6,8); return `${y}-${m}-${d}`; }
function makeIcalBookingId_(roomId, start, end, sourceUrl) {
  const h = crypto.createHash("md5").update(`${roomId}|${start}|${end}|${sourceUrl}`).digest("hex").slice(0,12);
  return `ICAL-${roomId}-${start.replace(/-/g,"")}-${end.replace(/-/g,"")}-${h}`;
}

function toCSV_(rows, headers) {
  const esc = (v) => { if (v==null) return ""; const s=String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  const lines = [];
  lines.push(headers.join(","));
  for (const r of rows) {
    const line = headers.map(h => {
      let v = r[h];
      if (h === "created_at" && v) { try { v = new Date(v).toISOString(); } catch {} }
      return esc(v);
    }).join(",");
    lines.push(line);
  }
  return lines.join("\n");
}
function escapeHTML(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function matchOrigin(origin, pattern){
  try{
    if (pattern==="*") return true;
    if (pattern.startsWith("http://")||pattern.startsWith("https://")) return origin===pattern;
    const u=new URL(origin); const host=u.host;
    return host===pattern || host.endsWith("."+pattern);
  }catch{ return origin===pattern; }
}
function redact(v){ if(!v) return "—"; const s=String(v); return s.length<=10 ? "•••" : s.slice(0,6)+"…"+s.slice(-4); }

// fetch con reintentos (GAS)
async function fetchWithRetry(url, opts={}, attempts=3){
  let e;
  for (let i=0;i<attempts;i++){
    try{
      const r = await fetch(url, opts);
      if (!r.ok) throw new Error(`status_${r.status}`);
      return r;
    }catch(err){
      e = err;
      await new Promise(r => setTimeout(r, 400 * Math.pow(2,i))); // 400ms, 800ms, 1600ms
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

/* ========================
   Server
   ======================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
