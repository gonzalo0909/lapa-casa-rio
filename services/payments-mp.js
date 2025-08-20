"use strict";

/**
 * Mercado Pago service (compatible v1 y v2 del SDK).
 * - createPreference(order)
 * - buildMpWebhookHandler({ notifySheets, isDuplicate, log })
 *
 * Requiere:
 *   MP_ACCESS_TOKEN
 *   FRONTEND_URL (fallback "/book/")
 */

const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const FRONTEND_URL = process.env.FRONTEND_URL || "/book/";

if (!ACCESS_TOKEN) {
  throw new Error("MP_ACCESS_TOKEN not set");
}

let sdkMode = "v2"; // "v1" (legacy configure) o "v2" (MercadoPagoConfig/Preference/Payment)
let mp = null;
let Preference = null;
let Payment = null;
let mpClient = null;

try {
  mp = require("mercadopago");
  // v1 tenía mercadopago.configure
  if (typeof mp.configure === "function") {
    sdkMode = "v1";
    mp.configure({ access_token: ACCESS_TOKEN });
  } else if (mp.MercadoPagoConfig) {
    // v2 clases
    const { MercadoPagoConfig, Preference: PrefCls, Payment: PayCls } = mp;
    mpClient = new MercadoPagoConfig({ accessToken: ACCESS_TOKEN });
    Preference = new PrefCls(mpClient);
    Payment = new PayCls(mpClient);
    sdkMode = "v2";
  } else {
    // algunos empaquetados CJS exportan en default
    const C = mp.default || mp;
    if (C && C.MercadoPagoConfig) {
      const { MercadoPagoConfig, Preference: PrefCls, Payment: PayCls } = C;
      mpClient = new MercadoPagoConfig({ accessToken: ACCESS_TOKEN });
      Preference = new PrefCls(mpClient);
      Payment = new PayCls(mpClient);
      sdkMode = "v2";
    } else {
      throw new Error("Unsupported mercadopago SDK export shape");
    }
  }
} catch (e) {
  throw new Error("Failed to load mercadopago SDK: " + (e.message || e));
}

function normalizePrefResponse(resp) {
  // v2 suele devolver el objeto directo; v1 usa { body }
  const r = resp?.body || resp?.response || resp;
  return {
    id: r?.id || null,
    init_point: r?.init_point || r?.sandbox_init_point || null,
  };
}

function normalizePaymentResponse(resp) {
  const r = resp?.body || resp?.response || resp;
  return r || {};
}

async function createPreference(order, { baseUrl } = {}) {
  const success = `${FRONTEND_URL}?paid=1`;
  const failure = `${FRONTEND_URL}?mp=failure`;
  const pending = `${FRONTEND_URL}?mp=pending`;

  const preferenceBody = {
    items: [
      {
        title: "Reserva Lapa Casa Hostel",
        quantity: 1,
        currency_id: "BRL",
        unit_price: Number(order.total || 0),
      },
    ],
    back_urls: { success, failure, pending },
    auto_return: "approved",
    metadata: {
      bookingId: order.booking_id || order.bookingId || "",
    },
    external_reference: order.booking_id || order.bookingId || "",
    statement_descriptor: "LAPA CASA HOSTEL",
  };

  let resp;
  if (sdkMode === "v1") {
    resp = await mp.preferences.create(preferenceBody);
  } else {
    resp = await Preference.create({ body: preferenceBody });
  }
  const pref = normalizePrefResponse(resp);
  if (!pref.id || !pref.init_point) {
    throw new Error("preference_create_failed");
  }
  return { id: pref.id, init_point: pref.init_point };
}

/**
 * Webhook handler de MP:
 * - Si llega type=payment y data.id => consultamos el pago y si está approved notificamos a Sheets.
 * - Acepta también query params topic/id como fallback.
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

      const getPaymentById = async (pid) => {
        if (sdkMode === "v1") {
          const r = await mp.payment.findById(pid);
          return normalizePaymentResponse(r);
        } else {
          const r = await Payment.get({ id: pid });
          return normalizePaymentResponse(r);
        }
      };

      // Notificación estándar
      if (body.type === "payment" && body.data?.id) {
        const paymentId = body.data.id;
        const pay = await getPaymentById(paymentId);
        const status = (pay.status || "").toLowerCase();
        const bookingId = pay.metadata?.bookingId || pay.external_reference || String(pay.id || paymentId);
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

      // Fallback con query
      const topic = body.topic || body.type || req.query.topic;
      const qid = body.data?.id || req.query.id || req.query["data.id"];
      if ((topic === "payment" || topic === "merchant_order") && qid) {
        try {
          const pay = await getPaymentById(qid);
          const status = (pay.status || "").toLowerCase();
          const bookingId = pay.metadata?.bookingId || pay.external_reference || String(pay.id || qid);
          if (status === "approved") {
            await notifySheets({
              kind: "paid",
              provider: "mp",
              bookingId,
              holdId: bookingId,
              email: pay.payer?.email || "",
              total: Number(pay.transaction_amount || 0),
              paymentId: String(qid),
            });
            log("✓ MP approved (fallback)", bookingId);
          }
        } catch (e) {
          log("MP get error:", e.message || e);
        }
        return res.json({ ok: true, handled: true });
      }

      // Nada reconocible → 200 OK para evitar reintentos agresivos
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
