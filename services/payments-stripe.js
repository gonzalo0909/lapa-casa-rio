// services/payments-stripe.js
"use strict";

/**
 * Stripe: create checkout session + webhook verify/dispatch
 * ENV: STRIPE_SK, STRIPE_WEBHOOK_SECRET
 */
const Stripe = require("stripe");

function getStripe(){
  const key = process.env.STRIPE_SK || process.env.STRIPE_SECRET_KEY || "";
  return key ? new Stripe(key) : null;
}

async function createCheckoutSession(order, { baseUrl }){
  const stripe = getStripe();
  if (!stripe) throw new Error("stripe_not_configured");
  const amountBRL = Math.max(100, Math.round((order.total || 0) * 100)); // min R$1,00
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    currency: "brl",
    line_items: [{
      price_data: { currency:"brl", product_data:{ name:"Reserva Lapa Casa Hostel" }, unit_amount: amountBRL },
      quantity: 1
    }],
    client_reference_id: order.bookingId || null,
    metadata: { bookingId: order.bookingId || "", email: order.email || "", nights: String(order.nights || 1) },
    success_url: `${baseUrl}/book?paid=1`,
    cancel_url: `${baseUrl}/book?cancel=1`,
  });
  return { id: session.id };
}

function buildStripeWebhookHandler({ notifySheets, isDuplicate, log }){
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
  return async function handler(req, res){
    try{
      if (!stripe || !secret) return res.status(200).send("ok");
      const sig = req.headers["stripe-signature"];
      let event;
      try { event = stripe.webhooks.constructEvent(req.body, sig, secret); }
      catch(err){ log("stripe_error",{ where:"invalid_signature", msg: err?.message||String(err) }); return res.status(400).send("invalid signature"); }
      if (isDuplicate(`stripe:${event.id}`)) return res.status(200).send("dup");

      const notify = async (bookingId, status, totalCents)=> {
        if (!bookingId) return;
        await notifySheets(bookingId, status, (totalCents||0)/100);
      };

      switch (event.type) {
        case "checkout.session.completed": {
          const s = event.data.object;
          await notify(s.client_reference_id || s.metadata?.bookingId || "", "approved", s.amount_total);
          break;
        }
        case "checkout.session.expired":
        case "checkout.session.async_payment_failed": {
          const s = event.data.object;
          await notify(s.client_reference_id || s.metadata?.bookingId || "", "rejected", s.amount_total);
          break;
        }
        case "charge.refunded":
        case "charge.refund.updated": {
          const c = event.data.object;
          let bookingId = "";
          const pi = c.payment_intent;
          if (pi) { try { const piObj = await stripe.paymentIntents.retrieve(pi); bookingId = piObj?.metadata?.bookingId || ""; } catch {} }
          await notify(bookingId, "refunded", c.amount);
          break;
        }
        case "payment_intent.payment_failed": {
          const pi = event.data.object;
          await notify(pi?.metadata?.bookingId || "", "rejected", pi.amount);
          break;
        }
      }
      res.status(200).send("ok");
    }catch(e){
      log("stripe_error",{ where:"handler", msg:e?.message||String(e) });
      res.status(200).send("ok");
    }
  };
}

module.exports = {
  getStripe,
  createCheckoutSession,
  buildStripeWebhookHandler
};
