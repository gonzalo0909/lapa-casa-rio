"use strict";
/**
 * services/payments-mp.js – Mercado Pago v2
 * Exporta: createPreference(order,{baseUrl}), buildMpWebhookHandler({notifySheets,isDuplicate,log})
 */
const mercadopago = require("mercadopago");
const MP_TOKEN = process.env.MP_ACCESS_TOKEN || "";
if (MP_TOKEN) mercadopago.configure({ access_token: MP_TOKEN });

async function createPreference(order={}, { baseUrl="" } = {}) {
  if (!MP_TOKEN) throw new Error("mp_not_configured");
  const bookingId = String(order.booking_id || order.bookingId || `BKG-${Date.now()}`);
  const amount = Math.max(0, Math.round(order.total||0));
  const base = baseUrl.replace(/\/$/,"");
  const pref = {
    items:[{ title:"Lapa Casa Hostel — Reserva", quantity:1, unit_price:amount, currency_id:"BRL" }],
    metadata:{ booking_id: bookingId },
    back_urls:{ success:`${base}/pago-exitoso-test?booking_id=${encodeURIComponent(bookingId)}`, failure:`${base}/book?mp=failure`, pending:`${base}/book?mp=pending` },
    auto_return:"approved",
    notification_url:`${base}/webhooks/mp`
  };
  const r = await mercadopago.preferences.create(pref);
  const b = r?.body||{};
  return { id:b.id, init_point:b.init_point||b.sandbox_init_point, booking_id:bookingId };
}
function buildMpWebhookHandler({ notifySheets, isDuplicate=()=>false, log=()=>{} } = {}) {
  return async (req,res)=>{
    try{
      const type = req.query?.type || req.body?.type;
      const dataId = req.query?.["data.id"] || req.body?.data?.id;
      if (type!=="payment" || !dataId) return res.json({ ok:true, ignored:true });
      if (isDuplicate && isDuplicate(`mp:${dataId}`)) return res.json({ ok:true, dedup:true });

      const pay = await mercadopago.payment.findById(dataId);
      const p = pay?.body||{}; const status=(p.status||"").toLowerCase(); const total=Number(p.transaction_amount||0);
      const bid = String(p.metadata?.booking_id||"");
      if (status==="approved" && bid) { await notifySheets(bid,"paid",total); log("mp_payment_ok",{bid,total}); }
      else { log("mp_payment_status",{status,bid}); }
      res.json({ ok:true });
    }catch(e){ log("mp_webhook_error",{msg:String(e?.message||e)}); res.status(200).json({ ok:true }); }
  };
}
module.exports = { createPreference, buildMpWebhookHandler };
