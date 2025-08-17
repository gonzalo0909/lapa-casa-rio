"use strict";
/**
 * services/sheets.js — Puente con Google Apps Script (Web App)
 *
 * Acepta AMBOS nombres de ENV para evitar errores de configuración:
 *   - BOOKINGS_WEBHOOK_URL   (preferida)
 *   - BOOKINGS_WEBAPP_URL    (fallback)
 *
 * Exporta:
 *   - fetchRowsFromSheet()    → GET ?mode=rows
 *   - postToSheets(payload)   → POST (create/upsert/payment_update)
 *   - notifySheets(id,st,amt) → helper para webhooks (Stripe/MP)
 *   - calcOccupiedBeds(rows, from, to) → mapa de camas ocupadas por día
 */

const WEBAPP_URL =
  (process.env.BOOKINGS_WEBHOOK_URL || process.env.BOOKINGS_WEBAPP_URL || "").trim();

if (!WEBAPP_URL) {
  console.warn("⚠️ Falta env BOOKINGS_WEBHOOK_URL (o fallback BOOKINGS_WEBAPP_URL)");
} else {
  console.log("ℹ️ GAS WebApp OK (sheets):", redactUrl(WEBAPP_URL));
}

// ===== fetch (Node ≥18) con fallback a node-fetch para entornos viejos =====
const _fetch = global.fetch
  ? global.fetch.bind(global)
  : (...args) => import("node-fetch").then(({ default: f }) => f(...args));

async function fetchWithTimeout(url, opt = {}, ms = 10000) {
  const ctrl = ("AbortController" in global) ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), ms) : null;
  try {
    return await _fetch(url, { ...opt, signal: ctrl?.signal });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ===== HTTP helpers =====
function assertUrl() {
  if (!WEBAPP_URL) throw new Error("bookings_webapp_url_missing");
}

async function httpJson(url, opt = {}) {
  const headers = {
    "Accept": "application/json",
    ...(opt.body ? { "Content-Type": "application/json" } : {}),
    ...(opt.headers || {}),
  };
  const res = await fetchWithTimeout(url, { method: opt.method || "GET", headers, body: opt.body ? JSON.stringify(opt.body) : undefined });

  const text = await res.text(); // leemos siempre el cuerpo
  let json;
  try { json = text ? JSON.parse(text) : {}; }
  catch { throw new Error(`json_parse_error:${res.status}`); }

  // Si el GAS devolvió ok:false o HTTP !ok, arrojamos error claro
  if (!res.ok || json?.ok === false) {
    const msg = json?.error || `sheet_http_${res.status}`;
    throw new Error(`sheet_error:${msg}`);
  }
  return json;
}

// ===== API pública =====
async function fetchRowsFromSheet() {
  assertUrl();
  const u = new URL(WEBAPP_URL);
  u.searchParams.set("mode", "rows");
  const j = await httpJson(u.toString());
  return Array.isArray(j.rows) ? j.rows : [];
}

async function postToSheets(payload = {}) {
  assertUrl();
  return await httpJson(WEBAPP_URL, { method: "POST", body: payload });
}

async function notifySheets(bookingId, status = "paid", totalBRL) {
  assertUrl();
  if (!bookingId) throw new Error("booking_id_required");
  const body = {
    action: "payment_update",
    booking_id: bookingId,
    status,
  };
  if (typeof totalBRL === "number" && Number.isFinite(totalBRL)) {
    body.total = Math.round(totalBRL);
  }
  return await postToSheets(body);
}

/**
 * Calcula camas ocupadas por día en [from, to) (to exclusivo).
 * rows: [{ entrada, salida, camas_json }]
 * Devuelve: { "YYYY-MM-DD": { "1":[1,2], "3":[5], ... } }
 */
function calcOccupiedBeds(rows, from, to) {
  const F = toMidnight(from);
  const T = toMidnight(to);
  const out = Object.create(null);

  for (const r of rows || []) {
    const ci = toMidnight(r?.entrada);
    const co = toMidnight(r?.salida);
    if (!ci || !co) continue;

    const camas = parseCamas(r?.camas_json);
    for (let t = Math.max(ci, F); t < Math.min(co, T); t += 86400000) {
      const day = iso(new Date(t));
      (out[day] ||= {});
      for (const [roomId, beds] of Object.entries(camas)) {
        const dst = (out[day][roomId] ||= []);
        for (const b of Array.isArray(beds) ? beds : []) {
          const n = Number(b);
          if (Number.isFinite(n) && !dst.includes(n)) dst.push(n);
        }
      }
    }
  }

  // ordenar numéricamente las camas por cuarto
  for (const d of Object.keys(out)) {
    for (const r of Object.keys(out[d])) out[d][r].sort((a, b) => a - b);
  }
  return out;
}

// ===== Utils =====
function parseCamas(s) {
  try {
    return s ? (typeof s === "string" ? JSON.parse(s) : s) : {};
  } catch {
    return {};
  }
}
function toMidnight(s) {
  if (!s) return 0;
  const d = new Date(String(s) + "T00:00:00");
  if (isNaN(d)) return 0;
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function iso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function redactUrl(u) {
  // oculta query/ids largos para logs
  try {
    const { origin, pathname } = new URL(u);
    return origin + pathname;
  } catch {
    return u.slice(0, 60) + (u.length > 60 ? "…" : "");
  }
}

module.exports = {
  fetchRowsFromSheet,
  postToSheets,
  notifySheets,
  calcOccupiedBeds,
};
