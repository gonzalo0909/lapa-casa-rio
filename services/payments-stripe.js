// services/payments-stripe.js
"use strict";
const Stripe = require("stripe");
const holds = require("./holds");
const { notifyPaymentUpdate } = require("./sheets");

const STRIPE_SK = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SK || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

const stripe = STRIPE_SK ? new Stripe(STRIPE_SK) : null;

async function createCheckoutSession(order, { baseUrl }){
  if (!stripe) {
    // fallback dev
    return { id:"fake_session", url:`${baseUrl}/pago-exitoso-test` };
  }
  const bookingId = String(order.bookingId || `BKG-${Date.now()}`);
  const success_url = `${baseUrl}/pago-exitoso-test`;
  const cancel_url  = `${baseUrl}/book/`;
  const total = Number(order.total||0);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url,
    cancel_url,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "brl",
        product_data: { name: "Reserva Lapa Casa Hostel" },
        unit_amount: Math.max(1, Math.round(total*100)),
      }
    }],
    metadata: {
      bookingId,
      email: String(order.email||"")
    }
  });

  return { id: session.id, url: session.url };
}

function buildStripeWebhookHandler({ notifySheets, isDuplicate, log }){
  return async function stripeWebhook(req,res){
    try{
      if(!stripe || !STRIPE_WEBHOOK_SECRET){
        log("skipping verification (no secret)");
        const evt = JSON.parse(req.body?.toString?.() || "{}");
        await handleStripeEvent(evt, { notifySheets, log });
        return res.json({ received:true, unverified:true });
      }
      const sig = req.headers["stripe-signature"];
      const event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
      if (isDuplicate(event.id)) return res.json({ received:true, duplicate:true });
      await handleStripeEvent(event, { notifySheets, log });
      res.json({ received:true });
    }catch(e){
      log("webhook_error", e.message || e);
      res.status(400).send(`Webhook Error: ${String(e.message||e)}`);
    }
  };
}

async function handleStripeEvent(event, { notifySheets, log }){
  switch(event.type){
    case "checkout.session.completed":{
      const s = event.data.object;
      const bookingId = s.metadata?.bookingId || s.client_reference_id || "";
      if (bookingId){
        holds.setPaymentStatus(bookingId, "approved", "stripe");
        await notifyPaymentUpdate({ provider:"stripe", bookingId, status:"approved", raw:{id:s.id} });
        log("paid", bookingId);
      }
      break;
    }
    default:
      // ignore
      break;
  }
}

module.exports = {
  createCheckoutSession,
  buildStripeWebhookHandler,
};
