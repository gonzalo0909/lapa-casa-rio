// services/payments-mp.js
"use strict";

/**
 * Mercado Pago: preference + webhook verify/dispatch
 * ENV: MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET
 */
const crypto = require("crypto");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");

function getMpClient(){
  const token = process.env.MP_ACCESS_TOKEN || "";
  return token ? new MercadoPagoConfig({ accessToken: token }) : null;
}

async function createPreference({ title="Reserva Lapa Casa Hostel", unit_price=100, quantity=1, currency_id="BRL", metadata={} }, { baseUrl }){
  const client = getMpClient();
  if (!client) throw new Error("mp_token_missing");
  const orderId = (metadata && (metadata.orderId || metadata.bookingId)) || `order-${Date.now()}`;
  const pref = new Preference(client);
  const body = {
    items: [{ title, unit_price: Number(unit_price), quantity: Number(quantity), currency_id }],
    back_urls: {
      success: `${baseUrl}/pago-exitoso-test`,
      failure: `${baseUrl}/book?cancel=1`,
      pending: `${baseUrl}/book?cancel=1`
    },
    auto_return: "approved",
    metadata,
    external_reference: orderId,
    notification_url: `${baseUrl}/webhooks/mp`,
  };
  const result = await pref.create({ body });
  return {
    preferenceId: result.id || result.body?.id,
    init_point: result.init_point || result.body?.init_point
  };
}

function verifyMpSignature(req, paymentId){
  try{
    const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET || process.env.MERCADO_PAGO_CHECKOUT_API_WEBHOOK_SECRET || "";
    const sig = req.headers["x-signature"];
    const reqId = req.headers["x-request-id"];
    if (!MP_WEBHOOK_SECRET || !sig || !reqId || !paymentId) return false;
    const parts = String(sig).split(",");
    let ts, v1;
    for (const p of parts) {
      const [k,v] = p.split("="); if (!k || !v) continue;
      if (k.trim()==="ts") ts=v.trim();
      if (k.trim()==="v1") v1=v.trim();
    }
    if (!ts || !v1) return false;
    const manifest = `id:${paymentId};request-id:${reqId};ts:${ts};`;
    const calc = crypto.createHmac("sha256", MP_WEBHOOK_SECRET).update(manifest).digest("hex");
    return calc === v1;
  }catch{ return false; }
}

function buildMpWebhookHandler({ notifySheets, isDuplicate, log }){
  const client = getMpClient();
  return async function handler(req,res){
    try{
      const type = req.query.type || req.body?.type;
      const paymentId = req.query["data.id"] || req.body?.data?.id || req.body?.id;
      if (type !== "payment" || !paymentId) { log("mp_event_ignored",{ type, paymentId }); return res.status(200).send("ok"); }

      if (process.env.MP_WEBHOOK_SECRET) {
        const ok = verifyMpSignature(req, paymentId);
        if (!ok) { log("mp_signature_fail",{ paymentId }); return res.status(401).send("invalid signature"); }
      }
      if (isDuplicate(`mp:${paymentId}`)) return res.status(200).send("dup");
      if (!client) return res.status(200).send("ok");

      const pay = new Payment(client);
      const payment = await pay.get({ id: paymentId });
      const status = payment?.status;
      const externalRef = payment?.external_reference || "";
      const total = payment?.transaction_amount;

      log("mp_event",{ paymentId, status, externalRef, total });
      if (externalRef) await notifySheets(externalRef, status, total);
      res.status(200).send("ok");
    }catch(e){
      log("mp_error",{ where:"webhook", msg:e?.message||String(e) });
      res.status(200).send("ok");
    }
  };
}

module.exports = {
  getMpClient,
  createPreference,
  verifyMpSignature,
  buildMpWebhookHandler
};
