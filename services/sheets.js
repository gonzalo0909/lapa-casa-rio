// services/sheets.js
"use strict";

/**
 * Sheets bridge (Google Apps Script WebApp)
 * ENV: BOOKINGS_WEBAPP_URL
 */
const BOOKINGS_WEBAPP_URL = process.env.BOOKINGS_WEBAPP_URL || "";
if (!globalThis.fetch) globalThis.fetch = (...a)=>import("node-fetch").then(({default:f})=>f(...a));

async function fetchWithRetry(url, opts={}, attempts=3){
  let lastErr;
  for (let i=0;i<attempts;i++){
    try{
      const r = await fetch(url, opts);
      if (!r.ok) throw new Error(`status_${r.status}`);
      return r;
    }catch(err){
      lastErr = err;
      await new Promise(r=>setTimeout(r, 300*Math.pow(2,i)));
    }
  }
  throw lastErr;
}

async function postToSheets(payload){
  if (!BOOKINGS_WEBAPP_URL) throw new Error("no_webhook_url");
  const r = await fetchWithRetry(BOOKINGS_WEBAPP_URL, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(payload)
  });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { ok:false, raw:text }; }
}

async function fetchRowsFromSheet(){
  const url = `${BOOKINGS_WEBAPP_URL}?mode=rows`;
  const r = await fetchWithRetry(url, { method:"GET" });
  const j = await r.json().catch(()=>({ ok:false, rows:[] }));
  return Array.isArray(j.rows) ? j.rows : [];
}

function calcOccupiedBeds(rows, from, to){
  const start = new Date(from + "T00:00:00");
  const end   = new Date(to   + "T00:00:00");
  const occupied = {};
  const ACTIVE = new Set(["paid","pending","authorized","in_process","approved","hold","released"]);
  for (const row of rows) {
    const status = String(row.pay_status || "").toLowerCase();
    if (!ACTIVE.has(status)) continue;
    const entrada = row.entrada ? new Date(String(row.entrada)+"T00:00:00") : null;
    const salida  = row.salida  ? new Date(String(row.salida )+"T00:00:00") : null;
    if (!entrada || !salida) continue;
    if (!(entrada < end && salida > start)) continue;
    let cjson = row.camas_json || row.camas || "";
    try { if (typeof cjson === "string") cjson = cjson ? JSON.parse(cjson) : {}; } catch { cjson = {}; }
    if (cjson && typeof cjson === "object") {
      for (const [roomId, beds] of Object.entries(cjson)) {
        if (!occupied[roomId]) occupied[roomId] = new Set();
        (Array.isArray(beds) ? beds : []).forEach(b => occupied[roomId].add(Number(b)));
      }
    }
  }
  const out = {};
  for (const [roomId, set] of Object.entries(occupied)) out[roomId] = Array.from(set).sort((a,b)=>a-b);
  return out;
}

module.exports = {
  postToSheets,
  fetchRowsFromSheet,
  calcOccupiedBeds,
  fetchWithRetry
};
