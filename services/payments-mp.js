"use strict";
/**
 * services/payments-mp.js — Mercado Pago (SDK v2, CommonJS)
 *
 * Exporta:
 *  - createPreference(order,{baseUrl})
 *  - buildMpWebhookHandler({notifySheets,isDuplicate,log})
 */

const {
  MercadoPagoConfig,
  Preference,
  Payment,
  MerchantOrder,
} = require("mercadopago");

const MP_TOKEN = process.env.MP_ACCESS_TOKEN || "";
const client = MP_TOKEN ? new MercadoPagoConfig({ accessToken: MP_TOKEN }) : null;

function ensure() {
  if (!client) throw new Error("mp_not_configured");
}

/** Crea una preferencia de pago */
async function createPreference(order = {}, { baseUrl = "" } = {}) {
  ensure();
  const booking_id = String(order.booking_id || order.bookingId || `BKG-${Date.now()}`);
  const amountBRL  = Math.max(0, Math.round(order.total || 0));
  const base       = String(baseUrl || "").replace(/\/$/, "");

  const body = {
    items: [{
      title: "Lapa Casa Hostel — Reserva",
      quantity: 1,
      unit_price: amountBRL,
      currency_id: "BRL",
    }],
    metadata: { booking_id },
    external_reference: booking_id,
    back_urls: {
      success: `${base}/pago-exitoso-test?booking_id=${encodeURIComponent(booking_id)}`,
      failure: `${base}/book?mp=failure`,
      pending: `${base}/book?mp=pending`,
    },
    auto_return: "approved",
    notification_url: `${base}/webhooks/mp`,
  };

  const pref = new Preference(client);
  const r = await pref.create({ body });
  const b = r || {};
  return {
    id: b.id,
    init_point: b.init_point || b.sandbox_init_point,
    booking_id,
  };
}

/** Webhook handler para Mercado Pago (payment / merchant_order) */
function buildMpWebhookHandler({ notifySheets, isDuplicate = () => false, log = () => {} } = {}) {
  ensure();
  const payment = new Payment(client);
  const morder  = new MerchantOrder(client);

  return async (req, res) => {
    try {
      const q = req.query || {};
      const b = req.body  || {};
      const type  = String(q.type || b.type || q.topic || b.topic || "").toLowerCase();
      const idRaw = q["data.id"] || b?.data?.id || q.id || b.id || "";

      if (!type || !idRaw) {
        log("mp_webhook_missing", { type, idRaw });
        return res.status(200).json({ ok: true, ignored: true });
      }

      if (type === "payment") {
        const key = `mp:payment:${idRaw}`;
        if (isDuplicate && isDuplicate(key)) return res.status(200).json({ ok: true, dedup: true });

        let p;
        try { p = await payment.get({ id: idRaw }); }
        catch (e) { log("mp_payment_get_error", { idRaw, err: String(e?.message || e) }); }

        const status = String(p?.status || "").toLowerCase();
        const total  = Number(p?.transaction_amount || 0);
        const bid    = String(p?.metadata?.booking_id || p?.external_reference || "");

        if (status === "approved" && bid) {
          await safeNotify(notifySheets, bid, "paid", total, log);
          log("mp_payment_ok", { bid, total });
        } else {
          log("mp_payment_status", { idRaw, status, bid });
        }
        return res.status(200).json({ ok: true });
      }

      if (type === "merchant_order") {
        const key = `mp:mo:${idRaw}`;
        if (isDuplicate && isDuplicate(key)) return res.status(200).json({ ok: true, dedup: true });

        let mo;
        try { mo = await morder.get({ merchantOrderId: idRaw }); }
        catch (e) { log("mp_mo_get_error", { idRaw, err: String(e?.message || e) }); }

        let bid = String(mo?.external_reference || "");
        let approvedSum = 0;

        if (Array.isArray(mo?.payments)) {
          for (const pay of mo.payments) {
            const st = String(pay?.status || "").toLowerCase();
            if (!bid && pay?.metadata?.booking_id) bid = String(pay.metadata.booking_id);
            if (st === "approved") {
              approvedSum += Number(pay.total_paid_amount || pay.transaction_amount || 0);
            }
          }
        }

        if (approvedSum > 0 && bid) {
          await safeNotify(notifySheets, bid, "paid", approvedSum, log);
          log("mp_mo_ok", { bid, approvedSum });
        } else {
          log("mp_mo_status", { idRaw, bid, approvedSum, status: mo?.status || "" });
        }
        return res.status(200).json({ ok: true });
      }

      log("mp_event_skip", { type, idRaw });
      return res.status(200).json({ ok: true, ignored: true });

    } catch (e) {
      log("mp_webhook_error", { msg: String(e?.message || e) });
      return res.status(200).json({ ok: true });
    }
  };
}

/* ===== Utils ===== */
async function safeNotify(fn, bookingId, status, amount, log) {
  try {
    await fn({ action:"payment_update", booking_id: bookingId, total: amount, status });
  } catch (e) {
    log("notify_error", { bookingId, status, amount, err: String(e?.message || e) });
  }
}

module.exports = { createPreference, buildMpWebhookHandler };
