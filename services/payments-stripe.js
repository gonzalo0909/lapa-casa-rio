"use strict";
/**
 * services/payments-stripe.js — funciones (NO Router)
 * Exporta: createCheckoutSession(order,{baseUrl}), buildStripeWebhookHandler({notifySheets,isDuplicate,log})
 */
const Stripe = require("stripe");
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const stripe = STRIPE_KEY ? new Stripe(STRIPE_KEY) : null;
const ensure = ()=>{ if(!stripe) throw new Error("stripe_not_configured"); };

async function createCheckoutSession(order={}, { baseUrl="" } = {}) {
  ensure();
  const booking_id = String(order.booking_id || order.bookingId || `BKG-${Date.now()}`);
  const amountCents = Math.max(0, Math.round((order.total || 0) * 100));
  const base = String(baseUrl || "").replace(/\/$/,"");
  const session = await stripe.checkout.sessions.create({
    mode:"payment",
    currency:"brl",
    payment_method_types:["card"],
    line_items:[{ quantity:1, price_data:{ currency:"brl", unit_amount:amountCents, product_data:{ name:"Lapa Casa Hostel — Reserva" }}}],
    success_url:`${base}/pago-exitoso-test?booking_id=${encodeURIComponent(booking_id)}`,
    cancel_url: `${base}/book?cancel=1`,
    metadata:{ booking_id }
  });
  return { id:session.id, url:session.url, booking_id };
}

function buildStripeWebhookHandler({ notifySheets, isDuplicate = ()=>false, log = ()=>{} } = {}) {
  ensure();
  return async (req, res) => {
    try {
      const payload = Buffer.isBuffer(req.body) ? req.body
                    : (req.rawBody ? req.rawBody
                    : Buffer.from(typeof req.body === "string" ? req.body : JSON.stringify(req.body || {})));
      const sig = req.headers["stripe-signature"];
      const event = stripe.webhooks.constructEvent(payload, sig, STRIPE_WEBHOOK_SECRET);

      if (isDuplicate && isDuplicate(`stripe:${event.id}`)) return res.json({ ok:true, dedup:true });

      if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
        const s = event.data.object;
        const bid = s?.metadata?.booking_id || s?.client_reference_id || "";
        const amt = (s?.amount_total || 0) / 100;
        if (bid) await notifySheets({ action:"payment_update", booking_id: bid, total: amt, status:"paid" });
        log("stripe_checkout_ok", { type:event.type, bid, amt });
      } else if (event.type === "payment_intent.succeeded") {
        const pi = event.data.object;
        const bid = pi?.metadata?.booking_id || "";
        const amt = (pi?.amount_received || pi?.amount || 0) / 100;
        if (bid) await notifySheets({ action:"payment_update", booking_id: bid, total: amt, status:"paid" });
        log("stripe_pi_ok", { bid, amt });
      } else {
        log("stripe_event_skip", { type: event.type });
      }

      res.json({ ok:true });
    } catch (e) {
      log("stripe_webhook_error", { msg:String(e?.message||e) });
      res.status(400).json({ ok:false, error:"stripe_webhook_invalid" });
    }
  };
}

module.exports = { createCheckoutSession, buildStripeWebhookHandler };
