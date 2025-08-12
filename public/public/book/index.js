"use strict";
require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

// ===== Stripe / MP
const Stripe = require("stripe");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");

// ===== ENV
const PUBLIC_BASE = process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || ""; // p.ej. https://lapacasahostel.com
const BOOKINGS_WEBAPP_URL = process.env.BOOKINGS_WEBAPP_URL || ""; // Google Apps Script Web App URL
const STRIPE_SK = process.env.STRIPE_SK || process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const CRON_TOKEN = process.env.CRON_TOKEN || "";
const HOLD_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES || 10);

// CORS allowlist (coma-separado). Vacío = abierto.
const CORS_ALLOW_ORIGINS = (process.env.CORS_ALLOW_ORIGINS || "").split(",").map(s=>s.trim()).filter(Boolean);

// Capacidades (ajusta si cambia)
const ROOMS = {
  "1": { name: "Cuarto 1 (12 mixto)", cap: 12 },
  "3": { name: "Cuarto 3 (12 mixto)", cap: 12 },
  "5": { name: "Cuarto 5 (7 mixto)",  cap: 7  },
  "6": { name: "Cuarto 6 (7 femenino)", cap: 7 }
};

// Buffers anti-overbooking (opcional)
const DEFAULT_ROOM_BUFFER = Number(process.env.BOOKING_BUFFER_PER_ROOM || 0);
const ROOM_BUFFER_1 = Number(process.env.ROOM_BUFFER_1 || DEFAULT_ROOM_BUFFER);
const ROOM_BUFFER_3 = Number(process.env.ROOM_BUFFER_3 || DEFAULT_ROOM_BUFFER);
const ROOM_BUFFER_5 = Number(process.env.ROOM_BUFFER_5 || DEFAULT_ROOM_BUFFER);
const ROOM_BUFFER_6 = Number(process.env.ROOM_BUFFER_6 || DEFAULT_ROOM_BUFFER);

// iCal (futuro, opcional)
const ICAL_ROOM_1 = process.env.ICAL_ROOM_1 || "";
const ICAL_ROOM_3 = process.env.ICAL_ROOM_3 || "";
const ICAL_ROOM_5 = process.env.ICAL_ROOM_5 || "";
const ICAL_ROOM_6 = process.env.ICAL_ROOM_6 || "";

// ===== App
const app = express();
app.set("trust proxy", 1);

// ========= Logs simples en memoria =========
const LOG_MAX = 200;
const logs = [];
function logPush(type, payload) {
  logs.push({ ts: Date.now(), type, payload });
  if (logs.length > LOG_MAX) logs.shift();
}
function redact(v) {
  if (!v) return "—";
  const s = String(v);
  if (s.length <= 10) return "•••";
  return s.slice(0, 6) + "…" + s.slice(-4);
}

// ========= Stripe Webhook (raw) — antes de json() =========
const stripe = STRIPE_SK ? new Stripe(STRIPE_SK) : null;
app.post("/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) return res.status(200).send("ok");
    const sig = req.headers["stripe-signature"];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      logPush("stripe_error", { where: "invalid_signature", msg: err.message });
      return res.status(400).send("invalid signature");
    }

    const notifySheets = async (bookingId, status, total) => {
      if (!bookingId || !BOOKINGS_WEBAPP_URL) return;
      try {
        await fetch(BOOKINGS_WEBAPP_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "payment_update", booking_id: bookingId, status, total }),
        });
        logPush("sheets_update", { via: "stripe_webhook", bookingId, status, total });
        invalidateAvailabilityCache();
      } catch (e) {
        logPush("sheets_error", { via: "stripe", msg: e?.message || String(e) });
      }
    };

    const t = event.type;
    if (t === "checkout.session.completed") {
      const s = event.data.object;
      const bookingId = s.client_reference_id || s.metadata?.bookingId || "";
      const total = (s.amount_total || 0) / 100;
      await notifySheets(bookingId, "approved", total);
    }
    if (t === "checkout.session.expired" || t === "checkout.session.async_payment_failed") {
      const s = event.data.object;
      const bookingId = s.client_reference_id || s.metadata?.bookingId || "";
      await notifySheets(bookingId, "rejected", (s.amount_total || 0) / 100);
    }
    if (t === "payment_intent.payment_failed") {
      const pi = event.data.object;
      const bookingId = pi?.metadata?.bookingId || "";
      await notifySheets(bookingId, "rejected", (pi.amount || 0) / 100);
    }
    if (t === "charge.refunded" || t === "charge.refund.updated") {
      const c = event.data.object;
      const amount = (c.amount || 0) / 100;
      let bookingId = "";
      try {
        const pi = c.payment_intent;
        if (pi) {
          const piObj = await stripe.paymentIntents.retrieve(pi);
          bookingId = piObj?.metadata?.bookingId || "";
        }
      } catch {}
      await notifySheets(bookingId, "refunded", amount);
    }

    return res.status(200).send("ok");
  } catch (e) {
    logPush("stripe_error", { where: "handler", msg: e?.message || String(e) });
    return res.status(200).send("ok");
  }
});

// ========= Middlewares comunes =========
const corsOptions = {
  origin: (origin, cb) => {
    if (!CORS_ALLOW_ORIGINS.length) return cb(null, true);
    if (!origin) return cb(null, true);
    const ok = CORS_ALLOW_ORIGINS.some(p => {
      try {
        if (p === "*") return true;
        if (p.startsWith("http://") || p.startsWith("https://")) return origin === p;
        const u = new URL(origin);
        return u.host === p || u.host.endsWith("." + p);
      } catch { return origin === p; }
    });
    cb(null, ok);
  },
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());

// ========= Static (web + /book) =========
const PUBLIC_DIR = path.join(process.cwd(), "public");
app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));

// ========= Health =========
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "lapa-casa-backend", ts: Date.now() }));

// ========= Stripe Checkout Session =========
app.post("/api/payments/stripe/session", async (req, res) => {
  try {
    if (!stripe) return res.status(400).json({ error: "stripe_not_configured" });

    const order = req.body?.order || {};
    const amountBRL = Math.max(100, Math.round((order.total || 0) * 100)); // mínimo R$1,00

    const origin =
      PUBLIC_BASE ||
      (req.headers.origin && /^https?:\/\//.test(req.headers.origin) ? req.headers.origin : `https://${req.headers.host}`);

    const successUrl = `${origin}/book?paid=1&bid=${encodeURIComponent(order.bookingId || "")}`;
    const cancelUrl  = `${origin}/book?cancel=1&bid=${encodeURIComponent(order.bookingId || "")}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      currency: "brl",
      line_items: [{
        price_data: {
          currency: "brl",
          product_data: { name: "Reserva Lapa Casa Hostel" },
          unit_amount: amountBRL
        },
        quantity: 1
      }],
      client_reference_id: order.bookingId || null,
      metadata: { bookingId: order.bookingId || "", email: order.email || "", nights: String(order.nights || 1) },
      success_url: successUrl,
      cancel_url: cancelUrl
    });

    res.json({ id: session.id });
  } catch (err) {
    logPush("stripe_error", { where: "create_session", msg: err?.message || String(err) });
    res.status(500).json({ error: "stripe_session_error" });
  }
});

// ========= Mercado Pago Preference + Webhook =========
const mpClient = MP_ACCESS_TOKEN ? new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN }) : null;
app.post("/api/payments/mp/preference", async (req, res) => {
  try {
    if (!mpClient) return res.status(500).json({ error: "mp_token_missing" });

    const { title = "Reserva Lapa Casa Hostel", unit_price = 100, quantity = 1, currency_id = "BRL", metadata = {} } =
      req.body || {};
    const orderId = (metadata && (metadata.orderId || metadata.bookingId)) || `order-${Date.now()}`;

    const origin =
      PUBLIC_BASE ||
      (req.headers.origin && /^https?:\/\//.test(req.headers.origin) ? req.headers.origin : `https://${req.headers.host}`);

    const preferenceBody = {
      items: [{ title, unit_price: Number(unit_price), quantity: Number(quantity), currency_id }],
      back_urls: {
        success: `${origin}/book?paid=1&bid=${encodeURIComponent(orderId)}`,
        failure: `${origin}/book?cancel=1&bid=${encodeURIComponent(orderId)}`,
        pending: `${origin}/book?cancel=1&bid=${encodeURIComponent(orderId)}`
      },
      auto_return: "approved",
      metadata,
      external_reference: orderId,
      notification_url: `${origin.replace(/\/$/,"")}/webhooks/mp`
    };

    const pref = new Preference(mpClient);
    const result = await pref.create({ body: preferenceBody });
    const initPoint = result.init_point || result.body?.init_point;
    const id = result.id || result.body?.id;

    res.json({ preferenceId: id, init_point: initPoint });
  } catch (err) {
    logPush("mp_error", { where: "create_preference", msg: err?.message || String(err) });
    res.status(500).json({ error: "mp_preference_failed" });
  }
});

app.post("/webhooks/mp", async (req, res) => {
  try {
    const type = req.query.type || req.body?.type;
    const paymentId = req.query["data.id"] || req.body?.data?.id || req.body?.id;

    if (type !== "payment" || !paymentId) {
      logPush("mp_event_ignored", { type, paymentId });
      return res.status(200).send("ok");
    }
    if (!mpClient) return res.status(200).send("ok");

    const pay = new Payment(mpClient);
    const payment = await pay.get({ id: paymentId });

    const status = payment?.status; // approved | rejected | pending | refunded | canceled
    const externalRef = payment?.external_reference || ""; // orderId / bookingId
    const total = payment?.transaction_amount;

    logPush("mp_event", { paymentId, status, externalRef, total });

    if (BOOKINGS_WEBAPP_URL && externalRef) {
      try {
        await fetch(BOOKINGS_WEBAPP_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "payment_update", booking_id: externalRef, status, total }),
        });
        logPush("sheets_update", { via: "mp_webhook", bookingId: externalRef, status, total });
        invalidateAvailabilityCache();
      } catch (e) {
        logPush("sheets_error", { via: "mp", msg: e?.message || String(e) });
      }
    }
    return res.status(200).send("ok");
  } catch (e) {
    logPush("mp_error", { where: "webhook", msg: e?.message || String(e) });
    return res.status(200).send("ok");
  }
});

// ========= Forward a Google Sheets (GAS) =========
app.post("/api/bookings", async (req, res) => {
  try {
    if (!BOOKINGS_WEBAPP_URL) return res.status(500).json({ ok: false, error: "no_webhook_url" });

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

    // Intento 1: upsert_booking
    let r = await fetch(BOOKINGS_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let text = await r.text();
    let j;
    try { j = JSON.parse(text); } catch { j = { raw: text }; }

    // Fallback: createBooking
    if (!r.ok || j?.ok === false) {
      const fallback = Object.assign({}, payload);
      delete fallback.action;
      r = await fetch(BOOKINGS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fallback),
      });
      text = await r.text();
      try { j = JSON.parse(text); } catch { j = { raw: text }; }
    }

    invalidateAvailabilityCache();
    return res.status(r.ok ? 200 : 500).json(j);
  } catch (e) {
    logPush("bookings_error", { msg: e?.message || String(e) });
    return res.status(500).json({ ok: false, error: "forward_failed" });
  }
});

// ========= Availability (lee de GAS) =========
const availabilityCache = new Map(); // key = `${from}:${to}` -> {ts,data}
const AVAIL_TTL_MS = 60_000;

function invalidateAvailabilityCache() { availabilityCache.clear(); }

app.get("/api/availability", async (req, res) => {
  try {
    const from = String(req.query.from || "").slice(0, 10);
    const to = String(req.query.to || "").slice(0, 10);
    if (!from || !to) return res.status(400).json({ ok: false, error: "missing_from_to" });

    const key = `${from}:${to}`;
    const now = Date.now();
    const cached = availabilityCache.get(key);
    if (cached && now - cached.ts < AVAIL_TTL_MS) return res.json(cached.data);

    const rows = await fetchRowsFromSheet_();
    const occupied = calcOccupiedBeds_(rows, from, to);
    const out = { ok: true, from, to, occupied };

    availabilityCache.set(key, { ts: now, data: out });
    return res.json(out);
  } catch (e) {
    logPush("availability_error", { msg: e?.message || String(e) });
    return res.status(500).json({ ok: false, error: "availability_failed" });
  }
});

// ========= HOLDs (anti-overbooking) =========
const holdsMem = new Map(); // holdId -> { expiresAt }

app.post("/api/holds/start", async (req, res) => {
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
    if (BOOKINGS_WEBAPP_URL) {
      await fetch(BOOKINGS_WEBAPP_URL, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
    }

    holdsMem.set(holdId, { expiresAt });
    invalidateAvailabilityCache();
    return res.json({ ok:true, holdId, expiresAt });
  } catch (e) {
    logPush("hold_start_error", { msg: e?.message || String(e) });
    return res.status(500).json({ ok:false, error:"hold_start_failed" });
  }
});

app.post("/api/holds/release", async (req, res) => {
  try {
    const holdId = req.body?.holdId || "";
    if (!holdId) return res.status(400).json({ ok:false, error:"missing_holdId" });

    const payload = { action:"upsert_booking", booking_id: holdId, pay_status:"released" };
    if (BOOKINGS_WEBAPP_URL) {
      await fetch(BOOKINGS_WEBAPP_URL, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
    }

    holdsMem.delete(holdId);
    invalidateAvailabilityCache();
    return res.json({ ok:true, holdId });
  } catch (e) {
    logPush("hold_release_error", { msg: e?.message || String(e) });
    return res.status(500).json({ ok:false, error:"hold_release_failed" });
  }
});

app.post("/api/holds/confirm", async (req, res) => {
  try {
    const holdId = req.body?.holdId || "";
    const newStatus = req.body?.status || "paid"; // paid|pending
    if (!holdId) return res.status(400).json({ ok:false, error:"missing_holdId" });

    const payload = { action:"upsert_booking", booking_id: holdId, pay_status: newStatus };
    if (BOOKINGS_WEBAPP_URL) {
      await fetch(BOOKINGS_WEBAPP_URL, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
    }

    holdsMem.delete(holdId);
    invalidateAvailabilityCache();
    return res.json({ ok:true, holdId, status:newStatus });
  } catch (e) {
    logPush("hold_confirm_error", { msg: e?.message || String(e) });
    return res.status(500).json({ ok:false, error:"hold_confirm_failed" });
  }
});

// ========= Cron: barrer HOLDs vencidos =========
app.get("/api/crons/holds-sweep", async (req, res) => {
  try {
    if (!CRON_TOKEN || (req.query.token || "") !== CRON_TOKEN) return res.status(401).json({ ok:false, error:"unauthorized" });
    const now = Date.now();
    let released = 0;
    for (const [holdId, info] of [...holdsMem.entries()]) {
      if (info.expiresAt && info.expiresAt <= now) {
        try {
          const payload = { action:"upsert_booking", booking_id: holdId, pay_status:"released" };
          if (BOOKINGS_WEBAPP_URL) {
            await fetch(BOOKINGS_WEBAPP_URL, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
          }
        } catch (e) {
          logPush("holds_sweep_warn", { holdId, msg: e?.message || String(e) });
        }
        holdsMem.delete(holdId);
        released++;
      }
    }
    if (released) invalidateAvailabilityCache();
    return res.json({ ok:true, released });
  } catch (e) {
    logPush("holds_sweep_error", { msg: e?.message || String(e) });
    return res.status(500).json({ ok:false, error:"holds_sweep_failed" });
  }
});

// ========= /api/events (placeholder seguro) =========
app.get("/api/events", async (_req, res) => {
  // Lista mínima; puedes reemplazar luego con fuentes reales y cache.
  return res.json({ ok: true, events: [] });
});

// ========= Admin =========
app.get("/admin", async (req, res) => {
  const bearer = (req.headers.authorization || "").split(" ")[1] || req.query.token || "";
  if (!ADMIN_TOKEN || bearer !== ADMIN_TOKEN) return res.status(401).send("Unauthorized");

  let rows = [];
  try { rows = await fetchRowsFromSheet_(); } catch (e) { logPush("admin_error", { where:"rows", msg:e?.message||String(e) }); }

  const envState = {
    BASE_URL: PUBLIC_BASE || "—",
    BOOKINGS_WEBAPP_URL: !!BOOKINGS_WEBAPP_URL,
    MP_ACCESS_TOKEN: redact(MP_ACCESS_TOKEN),
    STRIPE_SK: redact(STRIPE_SK),
    STRIPE_WEBHOOK_SECRET: redact(STRIPE_WEBHOOK_SECRET),
    ADMIN_TOKEN: ADMIN_TOKEN ? "set" : "—",
    CRON_TOKEN: CRON_TOKEN ? "set" : "—",
    HOLD_TTL_MINUTES,
    CORS_ALLOW_ORIGINS: CORS_ALLOW_ORIGINS.length ? CORS_ALLOW_ORIGINS.join(",") : "(open)",
  };

  const lastLogs = [...logs].reverse().slice(0, 50);
  const escapeHTML = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const html = `<!doctype html><meta charset="utf-8">
  <title>Lapa Admin</title>
  <style>
    body{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;padding:20px;color:#111}
    h1{margin:0 0 10px}
    code,pre{background:#f6f8fa;padding:4px 6px;border-radius:6px}
  </style>
  <h1>Admin</h1>
  <h3>ENV</h3>
  <pre>${escapeHTML(JSON.stringify(envState,null,2))}</pre>
  <h3>Últimas reservas (max 50)</h3>
  <pre class="muted">${escapeHTML(JSON.stringify(rows.slice(-50),null,2))}</pre>
  <h3>Logs</h3>
  <pre>${escapeHTML(JSON.stringify(lastLogs,null,2))}</pre>
  `;
  res.type("html").send(html);
});

// ========= iCal (export básico de días full) =========
app.get("/api/ical/:roomId.ics", async (req, res) => {
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

// ========= Helpers: GAS / Availability / iCal =========
async function fetchRowsFromSheet_() {
  if (!BOOKINGS_WEBAPP_URL) return [];
  const r = await fetch(`${BOOKINGS_WEBAPP_URL}?mode=rows`);
  const j = await r.json().catch(() => ({ ok: false, rows: [] }));
  return Array.isArray(j.rows) ? j.rows : [];
}

function calcOccupiedBeds_(rows, from, to) {
  const start = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  const occupied = {}; // roomId -> Set()

  const ACTIVE = new Set(["paid", "pending", "authorized", "in_process", "approved", "hold"]);

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

  // Buffers
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
  for (const [roomId, set] of Object.entries(occupied)) out[roomId] = Array.from(set).sort((a, b) => a - b);
  return out;
}

function countBedsByDay_(rows, roomId) {
  const counts = {}; // 'YYYY-MM-DD' -> number
  const ACTIVE = new Set(["paid", "pending", "authorized", "in_process", "approved", "hold"]);
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
      const dtEnd   = ( () => { const t = new Date(toDate(prev)); t.setDate(t.getDate()+1); return t.toISOString().slice(0,10); } )();
      ranges.push({ start: dtStart, end: dtEnd });
      a = cur;
    }
    prev = cur;
  }
  const endLast = ( () => { const t = new Date(toDate(prev)); t.setDate(t.getDate()+1); return t.toISOString().slice(0,10); } )();
  ranges.push({ start:a, end:endLast });
  return ranges;
}

function buildICS_(calName, ranges) {
  const lines = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//Lapa Casa//Channel Manager//ES");
  lines.push(`X-WR-CALNAME:${String(calName).replace(/([,;])/g,"\\$1")} (FULL DAYS)`);
  for (const r of ranges) {
    const uid = `lapa-${crypto.randomUUID()}@lapacasa`;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${formatICSDateTime_(new Date())}`);
    lines.push(`DTSTART;VALUE=DATE:${r.start.replace(/-/g,"")}`);
    lines.push(`DTEND;VALUE=DATE:${r.end.replace(/-/g,"")}`);
    lines.push(`SUMMARY:${"Ocupado (sin disponibilidad)".replace(/([,;])/g,"\\$1")}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function formatICSDateTime_(d) {
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

// ====== Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en :${PORT}`));
