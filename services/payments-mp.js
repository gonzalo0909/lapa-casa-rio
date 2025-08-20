"use strict";

/**
 * Mercado Pago: crea preferencias y maneja webhooks.
 * SDK oficial: mercadopago
 */

const mercadopago = require("mercadopago");
const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const FRONTEND_URL = process.env.FRONTEND_URL || "/book/";

if (ACCESS_TOKEN) {
  mercadopago.configure({ access_token: ACCESS_TOKEN });
}

async function createPreference(order, { baseUrl } = {}) {
  if (!ACCESS_TOKEN) throw new Error("MP_ACCESS_TOKEN not set");

  const success = `${FRONTEND_URL}?paid=1`;
  const failure = `${FRONTEND_URL}?mp=failure`;
  const pending = `${FRONTEND_URL}?mp=pending`;

  const preference = {
    items: [
      {
        title: "Reserva Lapa Casa Hostel",
        quantity: 1,
        currency_id: "BRL",
        unit_price: Number(order.total || 0),
      },
    ],
    back_urls: {
      success,
      failure,
      pending,
    },
    auto_return: "approved",
    metadata: {
      bookingId: order.booking_id || order.bookingId || "",
    },
    external_reference: order.booking_id || order.bookingId || "",
    statement_descriptor: "LAPA CASA HOSTEL",
  };

  const resp = await mercadopago.preferences.create(preference);
  const pref = resp?.body || {};
  // init_point (prod) / sandbox_init_point (sandbox)
  return { id: pref.id, init_point: pref.init_point || pref.sandbox_init_point };
}

/**
 * Webhook de Mercado Pago.
 * Nota: MP envía notificaciones con `type`/`action`/`data.id`.
 * Cuando sea `type=payment`, consultamos el pago y si está `approved` marcamos como pagado.
 */
function buildMpWebhookHandler({ notifySheets, isDuplicate, log = () => {} }) {
  return async function mpWebhook(req, res) {
    try {
      const body = req.body || {};
      const dedupeKey =
        body.id || body.data?.id || body["data.id"] || body.action || JSON.stringify(body).slice(0, 128);
      if (isDuplicate && dedupeKey && isDuplicate(`mp:${dedupeKey}`)) {
        return res.json({ ok: true, duplicate: true });
      }

      // Caso 1: notificación directa con status
      if (body.type === "payment" && body.data?.id) {
        const paymentId = body.data.id;
        const p = await mercadopago.payment.findById(paymentId);
        const pay = p?.response || p?.body || {};
        const status = (pay.status || "").toLowerCase();
        const bookingId =
          pay.metadata?.bookingId ||
          pay.external_reference ||
          pay.order?.type ||
          pay.id;

        if (status === "approved") {
          await notifySheets({
            kind: "paid",
            provider: "mp",
            bookingId,
            holdId: bookingId,
            email: pay.payer?.email || "",
            total: Number(pay.transaction_amount || 0),
            paymentId: String(paymentId),
          });
          log("✓ MP approved", bookingId);
        }
        return res.json({ ok: true, handled: true });
      }

      // Caso 2: fallback (algunas integraciones envían query param `id`/`topic`)
      const topic = body.topic || body.type || req.query.topic;
      const id = body.data?.id || req.query.id || req.query["data.id"];
      if ((topic === "payment" || topic === "merchant_order") && id) {
        try {
          const p = await mercadopago.payment.findById(id);
          const pay = p?.response || p?.body || {};
          const status = (pay.status || "").toLowerCase();
          const bookingId =
            pay.metadata?.bookingId || pay.external_reference || pay.id;

          if (status === "approved") {
            await notifySheets({
              kind: "paid",
              provider: "mp",
              bookingId,
              holdId: bookingId,
              email: pay.payer?.email || "",
              total: Number(pay.transaction_amount || 0),
              paymentId: String(id),
            });
            log("✓ MP approved (fallback)", bookingId);
          }
        } catch (e) {
          log("MP findById error:", e.message || e);
        }
        return res.json({ ok: true, handled: true });
      }

      // Nada reconocido: OK 200 para evitar reintentos infinitos
      return res.json({ ok: true, ignored: true });
    } catch (e) {
      log("mp webhook error:", e);
      return res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  };
}

module.exports = {
  createPreference,
  buildMpWebhookHandler,
};
