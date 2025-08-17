"use strict";
/**
 * services/payments-mp.js — Mercado Pago (funciones, compat ampliada)
 *
 * Exporta:
 *  - createPreference(order,{baseUrl})
 *  - buildMpWebhookHandler({notifySheets,isDuplicate,log})
 *
 * Soporta webhooks:
 *  - ?type=payment&data.id=PAYMENT_ID
 *  - ?topic=merchant_order&id=MO_ID
 *  - (equivalentes vía body)
 *
 * Reglas:
 *  - Aprobado ⇒ notifySheets(booking_id,"paid",monto)
 *  - merchant_order: usa external_reference (booking_id) o metadata.booking_id de pagos
 *  - Siempre responde 200 (even on error) para evitar tormenta de reintentos
 */

const mercadopago = require("mercadopago");

const MP_TOKEN = process.env.MP_ACCESS_TOKEN || "";
if (MP_TOKEN) mercadopago.configure({ access_token: MP_TOKEN });

/**
 * Crea una preferencia de pago.
 * @param {Object} order  { booking_id, total }
 * @param {Object} ctx    { baseUrl }
 * @returns {Object}      { id, init_point, booking_id }
 */
async function createPreference(order = {}, { baseUrl = "" } = {}) {
  if (!MP_TOKEN) throw new Error("mp_not_configured");

  const booking_id = String(order.booking_id || order.bookingId || `BKG-${Date.now()}`);
  const amountBRL  = Math.max(0, Math.round(order.total || 0));
  const base       = String(baseUrl || "").replace(/\/$/, "");

  const pref = {
    items: [{
      title: "Lapa Casa Hostel — Reserva",
      quantity: 1,
      unit_price: amountBRL,
      currency_id: "BRL"
    }],
    metadata: { booking_id },
    external_reference: booking_id,                // ← útil para merchant_order
    back_urls: {
      success: `${base}/pago-exitoso-test?booking_id=${encodeURIComponent(booking_id)}`,
      failure: `${base}/book?mp=failure`,
      pending: `${base}/book?mp=pending`
    },
    auto_return: "approved",
    notification_url: `${base}/webhooks/mp`
  };

  const r = await mercadopago.preferences.create(pref);
  const b = r?.body || {};
  return { id: b.id, init_point: b.init_point || b.sandbox_init_point, booking_id };
}

/**
 * Webhook handler para Mercado Pago.
 * Acepta tanto "payment" como "merchant_order".
 */
function buildMpWebhookHandler({ notifySheets, isDuplicate = () => false, log = () => {} } = {}) {
  if (!MP_TOKEN) throw new Error("mp_not_configured");

  return async (req, res) => {
    try {
      // Normalización de parámetros (query/body)
      const q = req.query || {};
      const b = req.body  || {};
      const type  = String(q.type || b.type || q.topic || b.topic || "").toLowerCase();
      const idRaw = q["data.id"] || b?.data?.id || q.id || b.id || "";

      if (!type) { log("mp_webhook_missing_type"); return res.status(200).json({ ok: true, ignored: true }); }
      if (!idRaw) { log("mp_webhook_missing_id",{ type }); return res.status(200).json({ ok: true, ignored: true }); }

      if (/^payment$/.test(type)) {
        const key = `mp:payment:${idRaw}`;
        if (isDuplicate && isDuplicate(key)) return res.status(200).json({ ok: true, dedup: true });

        const pay = await mercadopago.payment.findById(idRaw).catch(e => {
          log("mp_payment_find_error", { id: idRaw, err: String(e?.message || e) });
          return null;
        });

        const p = pay?.body || {};
        const status = String(p.status || "").toLowerCase();
        const total  = Number(p.transaction_amount || 0);
        const bid    = String(p.metadata?.booking_id || p.external_reference || "");

        if (status === "approved" && bid) {
          await safeNotify(notifySheets, bid, "paid", total, log);
          log("mp_payment_ok", { bid, total });
        } else {
          log("mp_payment_status", { status, bid, id: idRaw });
        }
        return res.status(200).json({ ok: true });
      }

      if (/^merchant_order$/.test(type)) {
        const key = `mp:mo:${idRaw}`;
        if (isDuplicate && isDuplicate(key)) return res.status(200).json({ ok: true, dedup: true });

        const moRes = await mercadopago.merchant_orders.findById(idRaw).catch(e => {
          log("mp_mo_find_error", { id: idRaw, err: String(e?.message || e) });
          return null;
        });

        const mo = moRes?.body || {};
        // Preferir external_reference como booking_id; sino, mirar payments[n].metadata.booking_id
        let bid = String(mo.external_reference || "");
        let approvedSum = 0;

        if (Array.isArray(mo.payments)) {
          for (const p of mo.payments) {
            const st = String(p.status || "").toLowerCase();
            if (!bid && p?.metadata?.booking_id) bid = String(p.metadata.booking_id);
            if (st === "approved") approvedSum += Number(p.total_paid_amount || p.transaction_amount || 0);
          }
        }

        if (approvedSum > 0 && bid) {
          await safeNotify(notifySheets, bid, "paid", approvedSum, log);
          log("mp_mo_ok", { bid, approvedSum });
        } else {
          log("mp_mo_status", { id: idRaw, bid, approvedSum, status: mo.status || "" });
        }
        return res.status(200).json({ ok: true });
      }

      // Otros tipos que no manejamos explícitamente
      log("mp_event_skip", { type, id: idRaw });
      return res.status(200).json({ ok: true, ignored: true });

    } catch (e) {
      // MP suele reintentar agresivo; devolver 200 evita loop
      log("mp_webhook_error", { msg: String(e?.message || e) });
      return res.status(200).json({ ok: true });
    }
  };
}

/* ========== Utils ========== */
async function safeNotify(fn, bookingId, status, amount, log) {
  try {
    await fn(bookingId, status, amount);
  } catch (e) {
    log("notify_error", { bookingId, status, amount, err: String(e?.message || e) });
  }
}

module.exports = { createPreference, buildMpWebhookHandler };
