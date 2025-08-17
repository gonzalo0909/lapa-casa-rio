"use strict";
/**
 * services/sheets.js – puente con Google Apps Script Web App
 * Exporta: fetchRowsFromSheet, postToSheets, calcOccupiedBeds
 */
const BOOKINGS_URL = (process.env.BOOKINGS_WEBHOOK_URL || "").trim();
if (!BOOKINGS_URL) console.warn("⚠️ Falta BOOKING(S)_WEBHOOK_URL");

async function fetchRowsFromSheet() {
  if (!BOOKINGS_URL) return [];
  const u = new URL(BOOKINGS_URL); u.searchParams.set("mode","rows");
  const res = await fetch(u, { headers:{ "Accept":"application/json" }});
  if (!res.ok) throw new Error(`sheet_fetch_failed:${res.status}`);
  const j = await res.json(); return Array.isArray(j.rows) ? j.rows : [];
}
async function postToSheets(payload={}) {
  if (!BOOKINGS_URL) throw new Error("bookings_url_missing");
  const res = await fetch(BOOKINGS_URL, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
  const j = await res.json().catch(()=>({ ok:false, error:"json_parse_error" }));
  if (!res.ok || j.ok === false) throw new Error(`sheet_post_failed:${j.error||res.status}`);
  return j;
}
/** rows → ocupación por día/quarto: { 'YYYY-MM-DD': { '1':[5,6], '3':[2] } } */
function calcOccupiedBeds(rows, from, to) {
  const map = Object.create(null);
  const fromT = toMid(from), toT = toMid(to);
  for (const r of rows) {
    const ci = toMid(r.entrada), co = toMid(r.salida); if (!ci || !co) continue;
    for (let t = Math.max(ci, fromT); t < Math.min(co, toT); t += 86400000) {
      const day = iso(new Date(t)); const camas = parse(r.camas_json);
      (map[day] ||= {});
      for (const [room, beds] of Object.entries(camas||{})) {
        const dst = (map[day][room] ||= []);
        (Array.isArray(beds)?beds:[]).forEach(b=>{ const n=+b; if(Number.isFinite(n)&&!dst.includes(n)) dst.push(n); });
      }
    }
  }
  for (const d of Object.keys(map)) for (const r of Object.keys(map[d])) map[d][r].sort((a,b)=>a-b);
  return map;
}
const parse = s=>{ try{ return typeof s==="string"? JSON.parse(s): (s||{});}catch{ return {} } };
const toMid = s=>{ if(!s)return 0; const d=new Date(String(s)+"T00:00:00"); if(isNaN(d))return 0; d.setHours(0,0,0,0); return d.getTime(); };
const iso = d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
module.exports = { fetchRowsFromSheet, postToSheets, calcOccupiedBeds };
