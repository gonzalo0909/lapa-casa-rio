// services/payments-mp.js
"use strict";
const holds = require("./holds");
const { notifyPaymentUpdate } = require("./sheets");

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";
const BASE_URL = (process.env.BASE_URL || "").replace(/\/+$/,"");
const MP_PREF_URL = "https://api.mercadopago.com/checkout/preferences";

async function createPreference(order, { baseUrl }){
  const booking_id = String(order.booking_id || order.bookingId || `BKG-${Date.now()}`);
  const total = Number(order.total||0);
  const success = `${baseUrl}/pago-exitoso-test`;
  const notification_url = (process.env.BOOKINGS_WEBHOOK_URL_MP || `${BASE_URL}/webhooks/mp`);

  if(!MP_ACCESS_TOKEN){
    // dev fallback
    return { id:"fake_pref", init_point: success };
  }

  const body = {
    items: [{
      title: "Reserva Lapa Casa Hostel",
      currency_id: "BRL",
      quantity: 1,
      unit_price: Math.max(1, total)
    }],
    back_urls: {
      success,
      pending: success,
      failure: `${baseUrl}/book/`
    },
    auto_return: "approved",
    external_reference: booking_id,
    metadata: { bookingId: booking_id },
    notification_url
  };

  const r = await fetch(MP_PREF_URL, {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization": `Bearer ${MP_ACCESS_TOKEN}`
    },
    body: JSON.stringify(body)
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.message || "mp_pref_error");
  return { id: j.id, init_point: j.init_point || j.sandbox_init_point || success };
}

function buildMpWebhookHandler({ notifySheets, isDuplicate, log }){
  return async function mpWebhook(req,res){
    try{
      const evt = Object(req.body||{});
      const id = evt.id || evt["data.id"] || evt.data?.id || evt["resource"] || "";
      // Caso feliz: metadata.bookingId llega directo en algunos flujos
      const bookingId = evt?.data?.metadata?.bookingId || evt?.metadata?.bookingId || evt?.external_reference || "";

      if (bookingId){
        if (isDuplicate(`mp:${bookingId}:${evt.action||evt.type||"evt"}`)) return res.json({ received:true, duplicate:true });
        holds.setPaymentStatus(bookingId, "approved", "mp");
        await notifyPaymentUpdate({ provider:"mp", bookingId, status:"approved", raw:{ id, action:evt.action||evt.type } });
        log("mp_paid", bookingId);
        return res.json({ received:true });
      }

      // Si no vino bookingId, igual respondemos 200 para no reintentar infinito
      log("mp_evt_no_booking", evt);
      return res.json({ received:true, missing_booking:true });
    }catch(e){
      log("mp_webhook_error", e.message||e);
      res.status(200).json({ received:true, error:String(e.message||e) }); // 200 para evitar reintentos agresivos
    }
  };
}

module.exports = {
  createPreference,
  buildMpWebhookHandler,
};
