/*******************************************************
 * Lapa Casa Backend – completo (Pagos + Sheets + HOLDs)
 * Rutas:
 *  - GET  /               (estático desde ./public)
 *  - GET  /book           (sirve public/book.html)
 *  - GET  /api/health
 *  - GET  /availability   (stub)
 *  - POST /bookings       (upsert en Google Sheets)
 *  - POST /payments/mp/preference
 *  - POST /webhooks/mp    (Mercado Pago)
 *  - POST /payments/stripe/session
 *  - POST /webhooks/stripe (Stripe)  [raw body]
 *  - POST /holds/start | /holds/release | /holds/confirm
 *******************************************************/
"use strict";
require("dotenv").config();

const path   = require("path");
const crypto = require("crypto");
const express = require("express");
const cors    = require("cors");

// ======= ENV =======
const BASE_URL            = (process.env.BASE_URL || "").replace(/\/$/, "") || "https://lapacasahostel.com";
const BOOKINGS_WEBAPP_URL = process.env.BOOKINGS_WEBAPP_URL || ""; // GAS Web App URL (https://script.googleusercontent.com/macros/echo?... o /exec)
const MP_ACCESS_TOKEN     = process.env.MP_ACCESS_TOKEN || "";
const MP_WEBHOOK_SECRET   = process.env.MP_WEBHOOK_SECRET || process.env.MERCADO_PAGO_CHECKOUT_API_WEBHOOK_SECRET || "";
const STRIPE_SK           = process.env.STRIPE_SK || process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const HOLD_TTL_MINUTES    = Number(process.env.HOLD_TTL_MINUTES || 10);
const CORS_ALLOW_ORIGINS  = (process.env.CORS_ALLOW_ORIGINS || "").split(",").map(s=>s.trim()).filter(Boolean);

// ======= Libs pagos (solo si hay credenciales) =======
const Stripe = require("stripe");
const stripe = STRIPE_SK ? new Stripe(STRIPE_SK) : null;

const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const mpClient = MP_ACCESS_TOKEN ? new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN }) : null;

// ======= App =======
const app = express();
app.set("trust proxy", 1);

// Stripe webhook necesita RAW antes del parser JSON
app.post(["/webhooks/stripe","/api/webhooks/stripe"], express.raw({ type:"application/json" }), async (req, res) => {
  try {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) return res.status(200).send("ok");
    const sig = req.headers["stripe-signature"];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.warn("stripe invalid sig:", err?.message);
      return res.status(400).send("invalid signature");
    }

    const t = event.type;
    const notifySheets = async (bookingId, status, total) => {
      if (!bookingId || !BOOKINGS_WEBAPP_URL) return;
      await postToSheets({ action:"payment_update", booking_id: bookingId, status, total });
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
          const piObj = await stripe.paymentIntents.retrieve(pi);
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
    console.error("stripe webhook error:", e);
    return res.status(200).send("ok");
  }
});

// Middlewares comunes (después del raw)
const corsOptions = {
  origin: (origin, cb) => {
    if (CORS_ALLOW_ORIGINS.length === 0) return cb(null, true);
    if (!origin) return cb(null, true);
    const ok = CORS_ALLOW_ORIGINS.some(p => matchOrigin(origin, p));
    cb(null, ok ? true : new Error("CORS"));
  },
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());

// ======= Estáticos
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR, { index: "index.html", extensions: ["html"] }));
app.get("/book", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "book.html")));

// ======= Health
app.get(["/","/api/health"], (req, res) => {
  if (req.path === "/") return res.type("text").send("Backend Lapa Casa activo 🚀");
  res.json({ ok:true, service:"lapa-casa-backend", ts: Date.now() });
});

// ======= Availability (stub que evita errores de front)
app.get(["/availability", "/api/availability"], (req, res) => {
  const from = String(req.query.from || "").slice(0, 10);
  const to   = String(req.query.to   || "").slice(0, 10);
  if (!from || !to) return res.status(400).json({ ok:false, error:"missing_from_to" });
  res.json({ ok:true, from, to, occupied:{} });
});

// ======= HOLDs en memoria
const holdsMem = new Map(); // holdId -> { expiresAt, payload }
app.post(["/holds/start","/api/holds/start"], (req, res) => {
  try{
    const b = req.body || {};
    const holdId = String(b.holdId || b.bookingId || `HOLD-${Date.now()}`).trim();
    const ttlMin = Number(b.ttlMinutes || HOLD_TTL_MINUTES);
    const expiresAt = Date.now() + ttlMin * 60_000;
    holdsMem.set(holdId, { expiresAt, payload:b });
    return res.json({ ok:true, holdId, expiresAt });
  }catch(e){
    console.error("hold_start_error:", e);
    return res.status(500).json({ ok:false, error:"hold_start_failed" });
  }
});
app.post(["/holds/release","/api/holds/release"], (req, res) => {
  try{
    const holdId = String(req.body?.holdId || "").trim();
    if (!holdId) return res.status(400).json({ ok:false, error:"missing_holdId" });
    holdsMem.delete(holdId);
    return res.json({ ok:true, holdId });
  }catch(e){
    console.error("hold_release_error:", e);
    return res.status(500).json({ ok:false, error:"hold_release_failed" });
  }
});
app.post(["/holds/confirm","/api/holds/confirm"], async (req, res) => {
  try{
    const b = req.body || {};
    const holdId    = String(b.holdId || b.booking_id || "").trim();
    const newStatus = String(b.status || b.pay_status || "paid").trim(); // paid|pending
    if (!holdId) return res.status(400).json({ ok:false, error:"missing_holdId" });
    // (Aquí podrías notificar a Sheets si querés duplicar la marca)
    holdsMem.delete(holdId);
    return res.json({ ok:true, holdId, status:newStatus, msg:"confirm_done" });
  }catch(e){
    console.error("hold_confirm_error:", e);
    return res.status(500).json({ ok:false, error:"hold_confirm_failed" });
  }
});

// ======= PRE-REGISTRO RESERVA en Google Sheets (GAS Web App)
app.post(["/bookings","/api/bookings"], async (req, res) => {
  try{
    if (!BOOKINGS_WEBAPP_URL) return res.status(500).json({ ok:false, error:"no_webhook_url" });
    const body = req.body || {};
    const booking_id = body.booking_id || body.bookingId || `BKG-${Date.now()}`;

    const payload = {
      action: "upsert_booking",
      booking_id,
      nombre: body.nombre || "",
      email:  body.email  || "",
      telefono: body.telefono || "",
      entrada: body.entrada || "",
      salida:  body.salida  || "",
      hombres: Number(body.hombres || 0),
      mujeres: Number(body.mujeres || 0),
      camas_json: JSON.stringify(body.camas || {}),
      total: Number(body.total || 0),
      pay_status: body.pay_status || "pending"
    };

    const j = await postToSheets(payload);
    return res.status(j?.ok ? 200 : 500).json(j || { ok:false });
  }catch(e){
    console.error("bookings_error:", e);
    return res.status(500).json({ ok:false, error:"forward_failed" });
  }
});

// ======= Mercado Pago: crear preferencia
app.post(["/payments/mp/preference","/api/payments/mp/preference"], async (req, res) => {
  try {
    if (!mpClient) return res.status(500).json({ error: "mp_token_missing" });
    const { title="Reserva Lapa Casa Hostel", unit_price=100, quantity=1, currency_id="BRL", metadata={} } = req.body || {};
    const orderId = (metadata && (metadata.orderId || metadata.bookingId)) || `order-${Date.now()}`;
    const pref = new Preference(mpClient);
    const body = {
      items: [{ title, unit_price: Number(unit_price), quantity: Number(quantity), currency_id }],
      back_urls: { success: `${BASE_URL}/pago-exitoso-test`, failure: `${BASE_URL}/book?cancel=1`, pending: `${BASE_URL}/book?cancel=1` },
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
    console.error("mp create_preference:", err?.message || err);
    res.status(500).json({ error: "mp_preference_failed" });
  }
});

// ======= Webhook Mercado Pago
app.post(["/webhooks/mp","/api/webhooks/mp"], async (req, res) => {
  try {
    const type = req.query.type || req.body?.type;
    const paymentId = req.query["data.id"] || req.body?.data?.id || req.body?.id;
    if (type !== "payment" || !paymentId) return res.status(200).send("ok");

    if (MP_WEBHOOK_SECRET) {
      const ok = verifyMpSignature(req, paymentId, MP_WEBHOOK_SECRET);
      if (!ok) return res.status(401).send("invalid signature");
    }

    if (!mpClient) return res.status(200).send("ok");
    const pay = new Payment(mpClient);
    const payment = await pay.get({ id: paymentId });
    const status = payment?.status;
    const externalRef = payment?.external_reference || "";
    const total = payment?.transaction_amount;

    if (BOOKINGS_WEBAPP_URL && externalRef) {
      await postToSheets({ action:"payment_update", booking_id: externalRef, status, total });
    }
    return res.status(200).send("ok");
  } catch (e) {
    console.error("mp webhook error:", e?.message || e);
    return res.status(200).send("ok");
  }
});

// ======= Stripe: crear Checkout Session
app.post(["/payments/stripe/session","/api/payments/stripe/session"], async (req, res) => {
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
    console.error("stripe create_session:", err?.message || err);
    res.status(500).json({ error: "stripe_session_error" });
  }
});

// ======= Helpers =======
function matchOrigin(origin, pattern){
  try{
    if (pattern==="*") return true;
    if (pattern.startsWith("http://")||pattern.startsWith("https://")) return origin===pattern;
    const u=new URL(origin); const host=u.host;
    return host===pattern || host.endsWith("."+pattern);
  }catch{ return origin===pattern; }
}

async function postToSheets(payload){
  if (!BOOKINGS_WEBAPP_URL) throw new Error("BOOKINGS_WEBAPP_URL not set");
  const r = await fetchWithRetry(BOOKINGS_WEBAPP_URL, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(payload)
  });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { ok:false, raw:text }; }
}

// fetch con reintentos
async function fetchWithRetry(url, opts={}, attempts=3){
  let lastErr;
  for (let i=0;i<attempts;i++){
    try{
      const r = await fetch(url, opts);
      if (!r.ok) throw new Error(`status_${r.status}`);
      return r;
    }catch(err){
      lastErr = err;
      await new Promise(r => setTimeout(r, 400 * Math.pow(2,i)));
    }
  }
  throw lastErr;
}

// Firma Mercado Pago
function verifyMpSignature(req, paymentId, secret) {
  try {
    const sig = req.headers["x-signature"];
    const reqId = req.headers["x-request-id"];
    if (!secret || !sig || !reqId || !paymentId) return false;
    const parts = String(sig).split(",");
    let ts, v1;
    for (const p of parts) {
      const [k,v] = p.split("="); if (!k || !v) continue;
      if (k.trim() === "ts") ts = v.trim();
      if (k.trim() === "v1") v1 = v.trim();
    }
    if (!ts || !v1) return false;
    const manifest = `id:${paymentId};request-id:${reqId};ts:${ts};`;
    const calc = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
    return calc === v1;
  } catch { return false; }
}

// ======= Server =======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
