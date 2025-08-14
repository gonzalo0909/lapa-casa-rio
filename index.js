"use strict";
require("dotenv").config();

const path   = require("path");
const crypto = require("crypto");
const express = require("express");
const cors   = require("cors");
const Stripe = require("stripe");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");

/* ========================
   ENV / CONFIG
   ======================== */
const BASE_URL = (process.env.BASE_URL || "").replace(/\/$/, "") || "https://lapa-casa-backend.onrender.com";
const BOOKINGS_WEBAPP_URL = process.env.BOOKINGS_WEBAPP_URL || ""; // URL WebApp GAS (acceso "Cualquiera")
const STRIPE_SK = process.env.STRIPE_SK || process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";
const CRON_TOKEN = process.env.CRON_TOKEN || "";
const HOLD_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES || 10);

// CORS: si no configuras nada, queda abierto (útil en pruebas)
const CORS_ALLOW_ORIGINS = (process.env.CORS_ALLOW_ORIGINS || "").split(",").map(s=>s.trim()).filter(Boolean);

// Habitaciones (capacidad)
const ROOMS = {
  "1": { name: "Cuarto 1 (12 mixto)", cap: 12 },
  "3": { name: "Cuarto 3 (12 mixto)", cap: 12 },
  "5": { name: "Cuarto 5 (7 mixto)",  cap: 7  },
  "6": { name: "Cuarto 6 (7 femenino)", cap: 7 }
};

/* ========================
   APP
   ======================== */
const app = express();
app.set("trust proxy", 1);

// ------ Stripe webhook (raw) VA ANTES del parser JSON
const stripe = STRIPE_SK ? new Stripe(STRIPE_SK) : null;
app.post("/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) return res.status(200).send("ok");
    const sig = req.headers["stripe-signature"];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.warn("stripe invalid signature:", err?.message);
      return res.status(400).send("invalid signature");
    }

    // Notifica a Sheets según evento
    const notifySheets = async (bookingId, status, total) => {
      if (!bookingId || !BOOKINGS_WEBAPP_URL) return;
      await fetch(BOOKINGS_WEBAPP_URL, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action:"payment_update", booking_id: bookingId, status, total })
      });
      invalidateAvailabilityCache();
    };

    const t = event.type;
    if (t === "checkout.session.completed") {
      const s = event.data.object;
      await notifySheets(s.client_reference_id || s.metadata?.bookingId || "", "approved", (s.amount_total||0)/100);
    } else if (t === "checkout.session.expired" || t === "checkout.session.async_payment_failed") {
      const s = event.data.object;
      await notifySheets(s.client_reference_id || s.metadata?.bookingId || "", "rejected", (s.amount_total||0)/100);
    } else if (t === "charge.refunded" || t === "charge.refund.updated") {
      const c = event.data.object;
      let bookingId = "";
      if (c.payment_intent) {
        try {
          const pi = await stripe.paymentIntents.retrieve(c.payment_intent);
          bookingId = pi?.metadata?.bookingId || "";
        } catch {}
      }
      await notifySheets(bookingId, "refunded", (c.amount||0)/100);
    } else if (t === "payment_intent.payment_failed") {
      const pi = event.data.object;
      await notifySheets(pi?.metadata?.bookingId || "", "rejected", (pi.amount||0)/100);
    }

    return res.status(200).send("ok");
  } catch (e) {
    console.error("stripe webhook error:", e);
    return res.status(200).send("ok");
  }
});

// ------ JSON + CORS + estáticos
const corsOptions = {
  origin: (origin, cb) => {
    if (CORS_ALLOW_ORIGINS.length === 0) return cb(null, true);
    if (!origin) return cb(null, true);
    const ok = CORS_ALLOW_ORIGINS.some(p => origin === p || origin.endsWith("." + p.replace(/^https?:\/\//,"")));
    cb(null, ok);
  },
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));
app.get("/book", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "book", "index.html"));
});

// ------ Health
app.get("/", (_req,res)=> res.send("Backend Lapa Casa activo 🚀"));
app.get("/api/health", (_req,res)=> res.json({ ok:true, ts:Date.now() }));

/* ========================
   Pagos – Stripe (crear sesión)
   ======================== */
app.post("/payments/stripe/session", async (req, res) => {
  try {
    if (!stripe) return res.status(400).json({ error: "stripe_not_configured" });
    const order = req.body?.order || {};
    const amountBRL = Math.max(100, Math.round((order.total || 0) * 100)); // mínimo R$1,00
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      currency: "brl",
      line_items: [{
        price_data: { currency:"brl", product_data:{ name:"Reserva Lapa Casa Hostel" }, unit_amount: amountBRL },
        quantity: 1
      }],
      client_reference_id: order.bookingId || null,
      metadata: { bookingId: order.bookingId || "", email: order.email || "", nights: String(order.nights||1) },
      success_url: `${BASE_URL}/book?paid=1`,
      cancel_url: `${BASE_URL}/book?cancel=1`,
    });
    res.json({ id: session.id });
  } catch (err) {
    console.error("stripe session error:", err?.message || err);
    res.status(500).json({ error: "stripe_session_error" });
  }
});

/* ========================
   Pagos – Mercado Pago (preferencia + webhook)
   ======================== */
const mpClient = MP_ACCESS_TOKEN ? new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN }) : null;

app.post("/payments/mp/preference", async (req, res) => {
  try {
    if (!mpClient) return res.status(500).json({ error: "mp_token_missing" });
    const { title="Reserva Lapa Casa Hostel", unit_price=100, quantity=1, currency_id="BRL", metadata={} } = req.body || {};
    const orderId = (metadata && (metadata.orderId || metadata.bookingId)) || `order-${Date.now()}`;

    const pref = new Preference(mpClient);
    const body = {
      items: [{ title, unit_price:Number(unit_price), quantity:Number(quantity), currency_id }],
      back_urls: {
        success: `${BASE_URL}/book?paid=1`,
        failure: `${BASE_URL}/book?cancel=1`,
        pending: `${BASE_URL}/book?cancel=1`
      },
      auto_return: "approved",
      metadata,
      external_reference: orderId,
      notification_url: `${BASE_URL}/webhooks/mp`
    };
    const result = await pref.create({ body });
    res.json({
      preferenceId: result.id || result.body?.id,
      init_point: result.init_point || result.body?.init_point
    });
  } catch (err) {
    console.error("mp preference error:", err?.message || err);
    res.status(500).json({ error: "mp_preference_failed" });
  }
});

app.post("/webhooks/mp", async (req, res) => {
  try {
    const type = req.query.type || req.body?.type;
    const paymentId = req.query["data.id"] || req.body?.data?.id || req.body?.id;
    if (type !== "payment" || !paymentId) return res.status(200).send("ok");

    if (!mpClient) return res.status(200).send("ok");
    const pay = new Payment(mpClient);
    const payment = await pay.get({ id: paymentId });
    const status = payment?.status; // approved | rejected | pending | refunded | canceled
    const externalRef = payment?.external_reference || "";
    const total = payment?.transaction_amount;

    if (BOOKINGS_WEBAPP_URL && externalRef) {
      await fetch(BOOKINGS_WEBAPP_URL, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action:"payment_update", booking_id: externalRef, status, total })
      });
      invalidateAvailabilityCache();
    }
    return res.status(200).send("ok");
  } catch (e) {
    console.error("mp webhook error:", e?.message || e);
    return res.status(200).send("ok");
  }
});

/* ========================
   /bookings  (Front → Sheets)
   ======================== */
app.post("/bookings", async (req, res) => {
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
      pay_status: body.pay_status || "pending"
    };

    // intento normal
    const r1 = await fetch(BOOKINGS_WEBAPP_URL, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
    const t1 = await r1.text();
    let j1; try { j1 = JSON.parse(t1); } catch { j1 = { ok:false, raw:t1 }; }

    if (!r1.ok || j1?.ok === false) {
      // fallback "create" (sin action)
      const fb = { ...payload }; delete fb.action;
      const r2 = await fetch(BOOKINGS_WEBAPP_URL, {
        method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(fb)
      });
      const t2 = await r2.text();
      let j2; try { j2 = JSON.parse(t2); } catch { j2 = { ok:false, raw:t2 }; }
      if (!r2.ok) return res.status(500).json(j2);
      invalidateAvailabilityCache();
      return res.status(200).json(j2);
    }

    invalidateAvailabilityCache();
    return res.status(200).json(j1);
  } catch (e) {
    console.error("bookings error:", e?.message || e);
    return res.status(500).json({ ok:false, error:"forward_failed" });
  }
});

/* ========================
   /availability (consulta ocupación por rango)
   ======================== */
const availabilityCache = new Map(); // key=from:to -> {ts,data}
const AVAIL_TTL_MS = 60_000;
function invalidateAvailabilityCache(){ availabilityCache.clear(); }

app.get("/availability", async (req, res) => {
  try {
    const from = String(req.query.from || "").slice(0,10);
    const to   = String(req.query.to   || "").slice(0,10);
    if (!from || !to) return res.status(400).json({ ok:false, error:"missing_from_to" });

    const key = `${from}:${to}`;
    const now = Date.now();
    const cached = availabilityCache.get(key);
    if (cached && now - cached.ts < AVAIL_TTL_MS) return res.json(cached.data);

    const rows = await fetchRowsFromSheet_();
    const occupied = calcOccupiedBeds_(rows, from, to);
    const out = { ok:true, from, to, occupied };
    availabilityCache.set(key, { ts: now, data: out });
    res.json(out);
  } catch (e) {
    console.error("availability error:", e?.message || e);
    res.status(500).json({ ok:false, error:"availability_failed" });
  }
});

/* ========================
   HOLDs anti-overbooking
   ======================== */
const holdsMem = new Map(); // holdId -> {expiresAt}

app.post("/holds/start", async (req, res) => {
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
      await fetch(BOOKINGS_WEBAPP_URL, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload) });
    }
    holdsMem.set(holdId, { expiresAt });
    invalidateAvailabilityCache();
    res.json({ ok:true, holdId, expiresAt });
  } catch (e) {
    console.error("hold start error:", e?.message || e);
    res.status(500).json({ ok:false, error:"hold_start_failed" });
  }
});

app.post("/holds/release", async (req, res) => {
  try {
    const holdId = req.body?.holdId || "";
    if (!holdId) return res.status(400).json({ ok:false, error:"missing_holdId" });
    if (BOOKINGS_WEBAPP_URL) {
      await fetch(BOOKINGS_WEBAPP_URL, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"upsert_booking", booking_id: holdId, pay_status:"released" }) });
    }
    holdsMem.delete(holdId);
    invalidateAvailabilityCache();
    res.json({ ok:true, holdId });
  } catch (e) {
    console.error("hold release error:", e?.message || e);
    res.status(500).json({ ok:false, error:"hold_release_failed" });
  }
});

app.post("/holds/confirm", async (req, res) => {
  try {
    const holdId = req.body?.holdId || "";
    const newStatus = req.body?.status || "paid";
    if (!holdId) return res.status(400).json({ ok:false, error:"missing_holdId" });
    if (BOOKINGS_WEBAPP_URL) {
      await fetch(BOOKINGS_WEBAPP_URL, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"upsert_booking", booking_id: holdId, pay_status: newStatus }) });
    }
    holdsMem.delete(holdId);
    invalidateAvailabilityCache();
    res.json({ ok:true, holdId, status:newStatus });
  } catch (e) {
    console.error("hold confirm error:", e?.message || e);
    res.status(500).json({ ok:false, error:"hold_confirm_failed" });
  }
});

/* ========================
   Helpers: Sheets / disponibilidad
   ======================== */
async function fetchRowsFromSheet_() {
  if (!BOOKINGS_WEBAPP_URL) return [];
  const r = await fetch(`${BOOKINGS_WEBAPP_URL}?mode=rows`);
  const j = await r.json().catch(()=>({ rows:[] }));
  return Array.isArray(j.rows) ? j.rows : [];
}

function calcOccupiedBeds_(rows, from, to) {
  const start = new Date(from + "T00:00:00");
  const end   = new Date(to   + "T00:00:00");
  const occupied = {}; // roomId -> Set()
  const ACTIVE = new Set(["paid","pending","authorized","in_process","approved","hold","released"]); // released cuenta hasta barrido

  for (const row of rows) {
    const status = String(row.pay_status || "").toLowerCase();
    if (!ACTIVE.has(status)) continue;

    const entrada = row.entrada ? new Date(String(row.entrada) + "T00:00:00") : null;
    const salida  = row.salida  ? new Date(String(row.salida)  + "T00:00:00") : null;
    if (!entrada || !salida) continue;
    if (!(entrada < end && salida > start)) continue; // solape

    let cjson = row.camas_json || row.camas || "";
    try { if (typeof cjson === "string") cjson = cjson ? JSON.parse(cjson) : {}; } catch { cjson = {}; }
    if (cjson && typeof cjson === "object") {
      for (const [roomId, beds] of Object.entries(cjson)) {
        if (!occupied[roomId]) occupied[roomId] = new Set();
        (Array.isArray(beds) ? beds : []).forEach(b => occupied[roomId].add(Number(b)));
      }
    }
  }

  const out = {};
  for (const [roomId, set] of Object.entries(occupied)) out[roomId] = Array.from(set).sort((a,b)=>a-b);
  return out;
}

/* ========================
   Server
   ======================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));

