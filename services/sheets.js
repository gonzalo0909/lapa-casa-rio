"use strict";

// Node 18+: fetch global
const GAS_URL = process.env.BOOKINGS_WEBAPP_URL;

async function fetchRowsFromSheet(from, to) {
  if (!GAS_URL) return [];
  const u = new URL(GAS_URL);
  u.searchParams.set("mode","rows");
  const r = await fetch(u.toString(), { method:"GET" });
  if (!r.ok) return [];
  const j = await r.json().catch(()=>({}));
  const rows = Array.isArray(j.rows)? j.rows : [];
  if (!from || !to) return rows;
  const F = new Date(from+"T00:00:00"), T = new Date(to+"T00:00:00");
  return rows.filter(row=>{
    const a=(row.entrada||row.checkin||"").slice(0,10);
    const b=(row.salida ||row.checkout||"").slice(0,10);
    if(!a||!b) return false;
    const A=new Date(a+"T00:00:00"), B=new Date(b+"T00:00:00");
    return (A<T && F<B);
  });
}

function calcOccupiedBeds(rows, holdsMap) {
  const occupied = {};
  const add = (rid, bed)=>{ const k=String(rid); if(!occupied[k]) occupied[k]=new Set(); occupied[k].add(Number(bed)); };
  const PAID = new Set(["paid","approved","processing","authorized","succeeded"]);
  for (const r of rows) {
    const st = String(r.pay_status||r.status||"").toLowerCase();
    if (!PAID.has(st)) continue;
    const camas = safeParse(r.camas_json);
    for (const [rid,beds] of Object.entries(camas||{})) (beds||[]).forEach(b=>add(rid,b));
  }
  for (const [rid,beds] of Object.entries(holdsMap||{})) (beds||[]).forEach(b=>add(rid,b));
  const out={}; for (const [rid,set] of Object.entries(occupied)) out[rid]=Array.from(set).sort((a,b)=>a-b);
  return out;
}

function safeParse(s){ try{ return typeof s==="string"? JSON.parse(s) : (s||{}); }catch{ return {}; } }

async function updatePayment(bookingId, status){
  if (!GAS_URL || !bookingId) return { ok:false };
  const r = await fetch(GAS_URL, {
    method:"POST", headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ action:"payment_update", booking_id:bookingId, pay_status:status })
  });
  const j = await r.json().catch(()=>({}));
  return j;
}

async function upsertBooking(b){
  if (!GAS_URL) return { ok:false, error:"no_GAS_URL" };
  const r = await fetch(GAS_URL, {
    method:"POST", headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ action:"upsert_booking", ...b })
  });
  const j = await r.json().catch(()=>({}));
  return j;
}

module.exports = { fetchRowsFromSheet, calcOccupiedBeds, updatePayment, upsertBooking };
