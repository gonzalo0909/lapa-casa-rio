"use strict";
/**
 * services/sheets.js — puente con Google Apps Script (Web App)
 * Exporta: fetchRowsFromSheet, postToSheets, calcOccupiedBeds, notifySheets
 */
const BOOKINGS_URL = (process.env.BOOKINGS_WEBHOOK_URL || "").trim();
if (!BOOKINGS_URL) console.warn("⚠️ Falta env BOOKINGS_WEBHOOK_URL");

const _fetch = global.fetch
  ? global.fetch.bind(global)
  : (...args) => import("node-fetch").then(({default: f}) => f(...args));

async function fetchWithTimeout(url, opt={}, ms=10000){
  const ctrl = new AbortController();
  const id = setTimeout(()=>ctrl.abort(), ms);
  try {
    return await _fetch(url, { ...opt, signal: ctrl.signal });
  } finally { clearTimeout(id); }
}

function assertUrl(){ if (!BOOKINGS_URL) throw new Error("bookings_url_missing"); }

async function httpJson(url, opt = {}) {
  const res = await fetchWithTimeout(url, {
    method: opt.method || "GET",
    headers: { "Accept": "application/json", ...(opt.headers || {}) },
    body: opt.body ? JSON.stringify(opt.body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; }
  catch { throw new Error(`json_parse_error:${res.status}`); }
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.error ? `sheet_error:${json.error}` : `sheet_http_${res.status}`);
  }
  return json;
}

async function fetchRowsFromSheet() {
  assertUrl();
  const u = new URL(BOOKINGS_URL);
  u.searchParams.set("mode","rows");
  const j = await httpJson(u.toString());
  return Array.isArray(j.rows) ? j.rows : [];
}

async function postToSheets(payload = {}) {
  assertUrl();
  const j = await httpJson(BOOKINGS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
  });
  return j;
}

async function notifySheets(bookingId, status = "paid", totalBRL) {
  assertUrl();
  if (!bookingId) throw new Error("booking_id_required");
  const body = { action: "payment_update", booking_id: bookingId, status };
  if (typeof totalBRL === "number") body.total = Math.round(totalBRL);
  return await postToSheets(body);
}

function calcOccupiedBeds(rows, from, to) {
  const F = toMid(from), T = toMid(to);
  const out = Object.create(null);
  for (const r of rows) {
    const ci = toMid(r.entrada), co = toMid(r.salida);
    if (!ci || !co) continue;
    for (let t = Math.max(ci, F); t < Math.min(co, T); t += 86400000) {
      const day = iso(new Date(t));
      const camas = parseCamas(r.camas_json);
      (out[day] ||= {});
      for (const [room, beds] of Object.entries(camas)) {
        const dst = (out[day][room] ||= []);
        for (const b of Array.isArray(beds) ? beds : []) {
          const n = Number(b);
          if (Number.isFinite(n) && !dst.includes(n)) dst.push(n);
        }
      }
    }
  }
  for (const d of Object.keys(out)) for (const r of Object.keys(out[d])) out[d][r].sort((a,b)=>a-b);
  return out;
}

function parseCamas(s){ try { return s ? (typeof s==="string" ? JSON.parse(s) : s) : {}; } catch { return {}; } }
function toMid(s){ if(!s) return 0; const d=new Date(String(s)+"T00:00:00"); if(isNaN(d)) return 0; d.setHours(0,0,0,0); return d.getTime(); }
function iso(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }

module.exports = { fetchRowsFromSheet, postToSheets, calcOccupiedBeds, notifySheets };
