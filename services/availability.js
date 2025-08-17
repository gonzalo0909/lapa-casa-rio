"use strict";
/**
 * /services/availability.js
 * - GET handler para /api/availability
 * - Suma ocupación de Sheets + HOLDs activos (inyectados)
 */

const { getRows } = require("./sheets");

const ROOMS = { "1":12, "3":12, "5":7, "6":7 };

let holdsProvider = null; // inyectable desde index.js
function setHoldsProvider(fn){ holdsProvider = fn; }

function overlaps(aStart, aEnd, bStart, bEnd){
  // rangos [start, end) YYYY-MM-DD
  return aStart < bEnd && bStart < aEnd;
}
function clampBeds(arr = [], cap = 0){
  const s = new Set(arr.filter(Number.isFinite));
  return Array.from(s).filter(n=> n>=1 && n<=cap).sort((a,b)=>a-b);
}
function occupiedFromRows(rows, fromISO, toISO){
  const occ = { "1":[], "3":[], "5":[], "6":[] };
  for (const r of rows){
    const status = String(r.pay_status || "").toLowerCase();
    // consideramos no-libres: paid, authorized, in_process, hold, released(pend.)
    if (!["paid","authorized","in_process","hold"].includes(status)) continue;

    const ent = String(r.entrada||"").slice(0,10);
    const sal = String(r.salida ||"").slice(0,10);
    if (!ent || !sal) continue;
    if (!overlaps(fromISO, toISO, ent, sal)) continue;

    let camas = {};
    try { camas = r.camas_json ? JSON.parse(r.camas_json) : {}; } catch {}
    for (const roomId of Object.keys(ROOMS)){
      const cap = ROOMS[roomId];
      const arr = clampBeds(camas?.[roomId] || [], cap);
      occ[roomId].push(...arr);
    }
  }
  const out = {};
  for (const k of Object.keys(ROOMS)){
    out[k] = Array.from(new Set(occ[k])).sort((a,b)=>a-b);
  }
  return out;
}
function mergeOccupied(a, b){
  const out = {};
  for (const k of Object.keys(ROOMS)){
    out[k] = Array.from(new Set([...(a[k]||[]), ...(b[k]||[])])).sort((x,y)=>x-y);
  }
  return out;
}

async function getAvailability(req,res){
  try{
    const fromISO = String(req.query.from||"").slice(0,10);
    const toISO   = String(req.query.to  ||"").slice(0,10);
    if (!fromISO || !toISO) return res.status(400).json({ ok:false, error:"from/to requeridos" });

    const rows = await getRows();
    const occRows  = occupiedFromRows(rows, fromISO, toISO);
    const occHolds = holdsProvider ? holdsProvider({ fromISO, toISO }) : { "1":[],"3":[],"5":[],"6":[] };
    const occupied = mergeOccupied(occRows, occHolds);

    return res.json({ ok:true, occupied });
  }catch(e){
    console.error("availability error:", e);
    return res.status(500).json({ ok:false, error:"availability_failed" });
  }
}

module.exports = { getAvailability, setHoldsProvider, ROOMS, overlaps };
