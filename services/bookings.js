"use strict";

const crypto = require("crypto");

const {
BOOKINGS_WEBAPP_URL = "",
} = process.env;

// Helpers internos (no dependen de sheets.js)
async function postGAS(payload) {
if (!BOOKINGS_WEBAPP_URL) {
return { ok: false, data: { error: "no_webhook_url" } };
}
const r = await fetch(BOOKINGS_WEBAPP_URL, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(payload),
});
const text = await r.text();
let data;
try { data = JSON.parse(text); } catch { data = { raw: text }; }
return { ok: r.ok, data };
}

function toBookingId(seed) {
const s = String(seed || Date.now());
return "BKG-" + crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);
}

function toISODate(d) {
if (!d) return "";
const dt = new Date(String(d));
if (isNaN(dt)) return "";
return dt.toISOString().slice(0, 10);
}

function normalizeCamas(camas) {
if (!camas) return {};
if (typeof camas === "string") {
try { const j = JSON.parse(camas); return (j && typeof j === "object") ? j : {}; }
catch { return {}; }
}
if (typeof camas === "object" && !Array.isArray(camas)) return camas;
return {};
}

function sanitizeNumber(n, def = 0) {
const x = Number(n);
return Number.isFinite(x) && x >= 0 ? x : def;
}

function buildPayload(input) {
const inObj = input || {};
const booking_id = inObj.booking_id || inObj.bookingId || toBookingId(${inObj.email || ""}|${inObj.entrada || ""}|${inObj.salida || ""}|${Date.now()});

const entrada = toISODate(inObj.entrada);
const salida = toISODate(inObj.salida);

const hombres = sanitizeNumber(inObj.hombres, 0);
const mujeres = sanitizeNumber(inObj.mujeres, 0);

const camas = normalizeCamas(inObj.camas || inObj.camas_json || {});
const camas_json = JSON.stringify(camas);

const total = sanitizeNumber(inObj.total, 0);
const pay_status = String(inObj.pay_status || "pending").toLowerCase();

const nowIso = new Date().toISOString();

return {
action: "upsert_booking",
booking_id,
nombre: String(inObj.nombre || "").trim() || "Huésped",
email: String(inObj.email || "").trim(),
telefono: String(inObj.telefono || "").trim(),
entrada,
salida,
hombres,
mujeres,
camas_json,
total,
pay_status,
created_at: inObj.created_at || nowIso,
// campos extras “opcionales” pasan directo si existen
notes: inObj.notes || "",
channel: inObj.channel || "direct",
source: inObj.source || "web",
};
}

async function upsertBooking(input) {
const payload = buildPayload(input);

// validaciones básicas
if (!payload.entrada || !payload.salida) {
return { ok: false, error: "invalid_dates", payload };
}
if (payload.salida <= payload.entrada) {
return { ok: false, error: "checkout_before_checkin", payload };
}

// 1) intento principal con action=upsert_booking
const r1 = await postGAS(payload);
if (r1.ok && r1.data && r1.data.ok !== false) {
return { ok: true, booking_id: payload.booking_id, response: r1.data };
}

// 2) fallback (algunos GAS esperan payload “plano” sin action)
const fb = { ...payload };
delete fb.action;
const r2 = await postGAS(fb);
if (r2.ok && r2.data && r2.data.ok !== false) {
return { ok: true, booking_id: payload.booking_id, response: r2.data, fallback: true };
}

return { ok: false, error: (r2.data && (r2.data.error || r2.data.raw)) || "upsert_failed", response: r2.data };
}

// (Opcional) helper para transformar una selección de camas desde el front
// { "1":[1,2], "3":[4,5] } -> valida y ordena
function normalizeFrontSelection(sel) {
const out = {};
const obj = normalizeCamas(sel);
for (const [roomId, beds] of Object.entries(obj)) {
const arr = Array.isArray(beds) ? beds : [];
const clean = Array.from(new Set(arr.map(n => Number(n)).filter(n => Number.isInteger(n) && n > 0))).sort((a,b)=>a-b);
if (clean.length) out[String(roomId)] = clean;
}
return out;
}

module.exports = {
upsertBooking,
buildPayload,
normalizeFrontSelection,
}
