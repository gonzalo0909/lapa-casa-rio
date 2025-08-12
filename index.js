"use strict";
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const Stripe = require("stripe");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");

/* ========================
   ENV / CONFIG
   ======================== */
const BASE_URL = process.env.BASE_URL || "https://lapa-casa-backend.onrender.com";
const BOOKINGS_WEBAPP_URL = process.env.BOOKINGS_WEBAPP_URL || ""; // GAS WebApp URL
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET || process.env.MERCADO_PAGO_CHECKOUT_API_WEBHOOK_SECRET || "";
const STRIPE_SK = process.env.STRIPE_SK || process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";         // legado (sigue funcionando)
const ADMIN_USER = process.env.ADMIN_USER || "admin";      // NUEVO
const ADMIN_PASS = process.env.ADMIN_PASS || ADMIN_TOKEN;  // NUEVO (si no pones, usa ADMIN_TOKEN)
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || ADMIN_TOKEN || "change-me"; // NUEVO
const ADMIN_SESSION_TTL_HOURS = Number(process.env.ADMIN_SESSION_TTL_HOURS || 12);
const CRON_TOKEN = process.env.CRON_TOKEN || "";
const HOLD_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES || 10);

const CORS_ALLOW_ORIGINS = (process.env.CORS_ALLOW_ORIGINS || "").split(",").map(s=>s.trim()).filter(Boolean);

// Buffers anti-overbooking
const DEFAULT_ROOM_BUFFER = Number(process.env.BOOKING_BUFFER_PER_ROOM || 0);
const ROOM_BUFFER_1 = Number(process.env.ROOM_BUFFER_1 || DEFAULT_ROOM_BUFFER);
const ROOM_BUFFER_3 = Number(process.env.ROOM_BUFFER_3 || DEFAULT_ROOM_BUFFER);
const ROOM_BUFFER_5 = Number(process.env.ROOM_BUFFER_5 || DEFAULT_ROOM_BUFFER);
const ROOM_BUFFER_6 = Number(process.env.ROOM_BUFFER_6 || DEFAULT_ROOM_BUFFER);

// iCal IMPORT (opcional)
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

// Logs + dedupe
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
app.post(["/payments/stripe/session","/api/payments/stripe/session"], rateLimit(30), async (req, res) => {
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
});

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
app.post(["/payments/mp/preference","/api/payments/mp/preference"], rateLimit(30), async (req, res) => {
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
});

/* ========================
   Webhook Mercado Pago (firma + dedupe)
   ======================== */
function verifyMpSignature(req, paymentId) {
  try {
    const sig = req.headers["x-signature"];
    const reqId = req.headers["x-request-id"];
    if (!MP_WEBHOOK_SECRET || !sig || !reqId || !paymentId) return false;
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
app.post(["/bookings","/api/bookings"], rateLimit(60), async (req, res) => {
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
});

/* ========================
   Availability (cache TTL)
   ======================== */
const availabilityCache = new Map(); // key = from:to -> {ts,data}
const AVAIL_TTL_MS = 60_000;

app.get(["/availability","/api/availability"], async (req, res) => {
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
});

/* ========================
   HOLDs anti-overbooking
   ======================== */
const holdsMem = new Map(); // holdId -> {expiresAt}

app.post(["/holds/start","/api/holds/start"], rateLimit(60), async (req, res) => {
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
});

app.post(["/holds/release","/api/holds/release"], rateLimit(60), async (req, res) => {
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
});

app.post(["/holds/confirm","/api/holds/confirm"], rateLimit(60), async (req, res) => {
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
});

/* ========================
   Admin con login/sesión (cookie)
   ======================== */
// Cookies: parseo simple
function parseCookies(req){
  const h = req.headers.cookie || "";
  const out = {};
  h.split(";").forEach(p=>{
    const i=p.indexOf("="); if(i>0){ const k=p.slice(0,i).trim(); const v=decodeURIComponent(p.slice(i+1).trim()); out[k]=v;}
  });
  return out;
}
function sign(v){ return crypto.createHmac("sha256", ADMIN_SESSION_SECRET).update(v).digest("hex"); }
function createAdminToken(user, ttlHours){
  const exp = Date.now() + (ttlHours||ADMIN_SESSION_TTL_HOURS)*3600*1000;
  const payload = JSON.stringify({ u:user, exp });
  const b64 = Buffer.from(payload,"utf8").toString("base64url");
  const sig = sign(b64);
  return `${b64}.${sig}`;
}
function readAdminToken(token){
  try{
    const [b64, sig] = String(token||"").split(".");
    if (!b64 || !sig) return null;
    if (sign(b64) !== sig) return null;
    const p = JSON.parse(Buffer.from(b64,"base64url").toString("utf8"));
    if (!p.exp || p.exp < Date.now()) return null;
    return p;
  }catch{ return null; }
}
function isAdminAuthed(req){
  const bearer = (req.headers.authorization || "").split(" ")[1] || req.query.token || "";
  if (ADMIN_TOKEN && bearer === ADMIN_TOKEN) return true;
  const tok = parseCookies(req)["adm_sess"];
  const p = readAdminToken(tok);
  return !!p;
}
function setAdminCookie(res, token, maxAgeMs){
  const parts = [`adm_sess=${token}`, "Path=/", "HttpOnly", "SameSite=Lax", "Secure"];
  if (maxAgeMs) parts.push(`Max-Age=${Math.floor(maxAgeMs/1000)}`);
  res.setHeader("Set-Cookie", parts.join("; "));
}

app.post(["/api/admin/login","/admin/login"], async (req, res) => {
  try{
    const { user, pass, remember } = req.body || {};
    if (!user || !pass) return res.status(400).json({ ok:false, error:"missing_credentials" });
    if (user !== ADMIN_USER || pass !== ADMIN_PASS) return res.status(401).json({ ok:false, error:"invalid_credentials" });
    const ttlH = remember ? 24*14 : ADMIN_SESSION_TTL_HOURS; // 14 días si recuerda
    const tok = createAdminToken(user, ttlH);
    setAdminCookie(res, tok, ttlH*3600*1000);
    return res.json({ ok:true });
  }catch(e){
    return res.status(500).json({ ok:false, error:"login_failed" });
  }
});

app.post(["/api/admin/logout","/admin/logout"], (_req, res) => {
  res.setHeader("Set-Cookie", "adm_sess=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0");
  res.json({ ok:true });
});

app.post(["/api/admin/update-booking","/admin/update-booking"], async (req, res) => {
  try{
    if (!isAdminAuthed(req)) return res.status(401).json({ ok:false, error:"unauthorized" });
    const { booking_id, pay_status, total, nombre, email, telefono, entrada, salida, hombres, mujeres, camas_json } = req.body || {};
    if (!booking_id) return res.status(400).json({ ok:false, error:"missing_booking_id" });

    const payload = { action:"upsert_booking", booking_id };
    if (pay_status != null) payload.pay_status = String(pay_status);
    if (total != null) payload.total = Number(total||0);
    if (nombre != null) payload.nombre = String(nombre||"");
    if (email != null) payload.email = String(email||"");
    if (telefono != null) payload.telefono = String(telefono||"");
    if (entrada != null) payload.entrada = String(entrada||"");
    if (salida != null) payload.salida = String(salida||"");
    if (hombres != null) payload.hombres = Number(hombres||0);
    if (mujeres != null) payload.mujeres = Number(mujeres||0);
    if (camas_json != null) payload.camas_json = String(camas_json||"");

    const j = await postToSheets(payload);
    invalidateAvailabilityCache();
    return res.status(j?.ok ? 200 : 500).json(j);
  }catch(e){
    return res.status(500).json({ ok:false, error:"update_failed" });
  }
});

/* ========================
   Admin UI (HTML)
   ======================== */
app.get(["/admin","/api/admin"], async (req, res) => {
  const authed = isAdminAuthed(req);

  if (!authed) {
    const html = `<!doctype html><meta charset="utf-8">
    <title>Login · Lapa Admin</title>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>
      body{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;background:#f6f8fa;margin:0;display:grid;place-items:center;height:100vh;color:#111}
      .card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;min-width:320px;box-shadow:0 6px 20px rgba(0,0,0,.06)}
      h1{margin:0 0 10px;font-size:18px}
      label{font-size:13px;color:#6b7280;display:block;margin:10px 0 6px}
      input{width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px}
      button{margin-top:12px;width:100%;padding:10px;border:0;border-radius:10px;background:#111;color:#fff;font-weight:700;cursor:pointer}
      .muted{color:#6b7280;font-size:12px;margin-top:8px}
    </style>
    <div class="card">
      <h1>Entrar al Admin</h1>
      <label>Usuario</label>
      <input id="u" placeholder="admin" />
      <label>Clave</label>
      <input id="p" type="password" placeholder="••••••••" />
      <label class="muted"><input id="r" type="checkbox" /> Recordarme</label>
      <button id="b">Entrar</button>
      <div id="m" class="muted"></div>
    </div>
    <script>
      document.getElementById('b').onclick = async () => {
        const user = document.getElementById('u').value.trim();
        const pass = document.getElementById('p').value;
        const remember = document.getElementById('r').checked;
        const r = await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user,pass,remember})});
        if(!r.ok){ document.getElementById('m').textContent='Error de login'; return; }
        location.href='/admin';
      };
    </script>`;
    return res.type("html").send(html);
  }

  let rows = [];
  try { rows = await fetchRowsFromSheet_(); } catch {}
  const lastLogs = [...logs].reverse().slice(0, 50);

  const html = `<!doctype html><meta charset="utf-8">
  <title>Lapa Admin</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    body{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;padding:18px;color:#111}
    h1{margin:0 0 8px;font-size:20px}
    .grid{display:grid;gap:12px}
    .cols{grid-template-columns:repeat(2,minmax(260px,1fr))}
    .card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px}
    label{display:block;font-size:12px;color:#6b7280;margin:6px 0 4px}
    input,select{width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:8px}
    button{padding:8px 12px;border:0;border-radius:10px;background:#111;color:#fff;font-weight:700;cursor:pointer}
    .row{display:flex;gap:8px;align-items:end;flex-wrap:wrap}
    pre{white-space:pre-wrap;background:#f6f8fa;border-radius:8px;padding:8px;font-size:12px}
    .muted{color:#6b7280;font-size:12px}
    .right{display:flex;gap:8px;justify-content:flex-end}
  </style>
  <h1>Panel Admin</h1>
  <div class="row right">
    <a href="/admin/rows.csv" class="muted">Descargar CSV</a>
    <button id="logout">Salir</button>
  </div>

  <div class="grid cols">
    <div class="card">
      <h3>Actualizar reserva</h3>
      <label>Booking ID</label><input id="b_id" placeholder="BKG-..." />
      <label>Estatus pago</label>
      <select id="b_status">
        <option value="">(sin cambiar)</option>
        <option>paid</option>
        <option>pending</option>
        <option>authorized</option>
        <option>in_process</option>
        <option>refunded</option>
        <option>failed</option>
        <option>hold</option>
        <option>released</option>
        <option>canceled</option>
      </select>
      <label>Total (BRL)</label><input id="b_total" type="number" min="0" step="1" />
      <div class="row"><button id="b_save">Guardar</button><span id="b_msg" class="muted"></span></div>
    </div>

    <div class="card">
      <h3>HOLDs</h3>
      <label>Booking/HOLD ID</label><input id="h_id" placeholder="HOLD-..." />
      <div class="row">
        <button id="h_release">Liberar HOLD</button>
        <button id="h_confirm">Confirmar (paid)</button>
        <button id="h_pending">Confirmar (pending)</button>
        <span id="h_msg" class="muted"></span>
      </div>
    </div>

    <div class="card">
      <h3>Últimas reservas (sample)</h3>
      <pre class="muted">${escapeHTML(JSON.stringify(rows.slice(-10),null,2))}</pre>
    </div>

    <div class="card">
      <h3>Logs recientes</h3>
      <pre>${escapeHTML(JSON.stringify(lastLogs,null,2))}</pre>
    </div>
  </div>

  <script>
    const $ = s => document.querySelector(s);
    $('#logout').onclick = async ()=>{ await fetch('/api/admin/logout',{method:'POST'}); location.href='/admin'; };
    $('#b_save').onclick = async ()=>{
      const booking_id = $('#b_id').value.trim();
      const pay_status = $('#b_status').value;
      const total = $('#b_total').value ? Number($('#b_total').value) : undefined;
      if(!booking_id){ $('#b_msg').textContent='Poné booking_id'; return; }
      const r = await fetch('/api/admin/update-booking',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({booking_id,pay_status,total})});
      $('#b_msg').textContent = r.ok ? '✓ guardado' : '✗ error';
      setTimeout(()=>$('#b_msg').textContent='',1500);
    };
    $('#h_release').onclick = async ()=>{
      const holdId = $('#h_id').value.trim(); if(!holdId){ $('#h_msg').textContent='Poné HOLD id'; return; }
      const r = await fetch('/api/holds/release',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({holdId})});
      $('#h_msg').textContent = r.ok ? '✓ liberado' : '✗ error';
      setTimeout(()=>$('#h_msg').textContent='',1500);
    };
    $('#h_confirm').onclick = async ()=>{
      const holdId = $('#h_id').value.trim(); if(!holdId){ $('#h_msg').textContent='Poné HOLD id'; return; }
      const r = await fetch('/api/holds/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({holdId,status:'paid'})});
      $('#h_msg').textContent = r.ok ? '✓ confirmado' : '✗ error';
      setTimeout(()=>$('#h_msg').textContent='',1500);
    };
    $('#h_pending').onclick = async ()=>{
      const holdId = $('#h_id').value.trim(); if(!holdId){ $('#h_msg').textContent='Poné HOLD id'; return; }
      const r = await fetch('/api/holds/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({holdId,status:'pending'})});
      $('#h_msg').textContent = r.ok ? '✓ confirmado' : '✗ error';
      setTimeout(()=>$('#h_msg').textContent='',1500);
    };
  </script>`;
  return res.type("html").send(html);
});

app.get(["/admin/rows.csv","/api/admin/rows.csv"], async (req, res) => {
  if (!isAdminAuthed(req)) return res.status(401).send("Unauthorized");
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
   iCal EXPORT + IMPORT (opcional)
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
      const camas = Array.from({length:cap}, (_,i)=>i+1);

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
  const occupied = {};
  const ACTIVE = new Set(["paid","pending","authorized","in_process","approved","hold","released"]);

  for (const row of rows) {
    const status = String(row.pay_status || "").toLowerCase();
    if (!ACTIVE.has(status)) continue;

    const entrada = row.entrada ? new Date(String(row.entrada) + "T00:00:00") : null;
    const salida  = row.salida  ? new Date(String(row.salida)  + "T00:00:00") : null;
    if (!entrada || !salida) continue;
    if (!(entrada < end && salida > start)) continue;

    let cjson = row.camas_json || row.camas || "";
    try { if (typeof cjson === "string") cjson = cjson ? JSON.parse(cjson) : {}; } catch { cjson = {}; }
    if (cjson && typeof cjson === "object") {
      for (const [roomId, beds] of Object.entries(cjson)) {
        if (!occupied[roomId]) occupied[roomId] = new Set();
        (Array.isArray(beds) ? beds : []).forEach((b) => occupied[roomId].add(Number(b)));
      }
    }
  }

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
  const counts = {};
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

/* ========================
   Server
   ======================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
