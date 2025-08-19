"use strict";
/**
 * /services/sheets.js — robusto/fail-soft
 * - Si la WebApp de Sheets falla o no devuelve JSON válido, devolvemos [] (sin romper disponibilidad).
 * - Agrega logs de diagnóstico con los primeros 200 chars de la respuesta.
 */
const ROWS_URL = String(process.env.BOOKINGS_WEBAPP_URL || "").trim();
const BUFFER_PER_ROOM = Number(process.env.BOOKING_BUFFER_PER_ROOM || 0);

function parseISO(s){ return new Date(String(s).slice(0,10)+"T00:00:00Z"); }
function overlap(aStart,aEnd,bStart,bEnd){ return aStart < bEnd && bStart < aEnd; }

async function fetchRowsFromSheet() {
  if (!ROWS_URL) {
    console.warn("[sheets] BOOKINGS_WEBAPP_URL missing"); // 🔹 mensaje coherente
    return []; // fail-soft
  }

  const url = ROWS_URL + (ROWS_URL.includes("?") ? "&" : "?") + "mode=rows";

  try {
    const res = await fetch(url, { headers:{ "Accept":"application/json" }});
    const text = await res.text(); // leemos texto para poder loguear en errores

    if (!res.ok) {
      console.warn(`[sheets] status ${res.status} — body: ${text.slice(0,200)}`);
      return []; // fail-soft
    }

    let j;
    try { j = JSON.parse(text); }
    catch (e) {
      console.warn("[sheets] JSON parse error — body:", text.slice(0,200));
      return []; // fail-soft
    }

    if (!j || j.ok !== true || !Array.isArray(j.rows)) {
      console.warn("[sheets] shape error — body:", text.slice(0,200));
      return []; // fail-soft
    }

    return j.rows.map(r => ({
      booking_id: String(r.booking_id||""),
      entrada: String(r.entrada||""),
      salida:  String(r.salida||""),
      camas_json: String(r.camas_json||""),
      pay_status: String(r.pay_status||""),
      total: Number(r.total||0)
    }));
  } catch (err) {
    console.warn("[sheets] fetch error:", err?.message || err);
    return []; // fail-soft
  }
}

function calcOccupiedBeds(rows, fromISO, toISO, holdsMap = {}, bufferPerRoom = BUFFER_PER_ROOM) {
  const from = parseISO(fromISO);
  const to   = parseISO(toISO);
  const occupied = { "1": new Set(), "3": new Set(), "5": new Set(), "6": new Set() };

  for (const r of rows) {
    const a = r.entrada ? parseISO(r.entrada) : null;
    const b = r.salida  ? parseISO(r.salida)  : null;
    if (!a || !b || !(a<b)) continue;
    if (!overlap(a,b,from,to)) continue;

    let camas = {};
    try { camas = r.camas_json ? JSON.parse(r.camas_json) : {}; } catch {}
    for (const roomId of Object.keys(camas||{})) {
      (camas[roomId]||[]).forEach(bed => occupied[roomId]?.add(Number(bed)));
    }
  }

  if (bufferPerRoom > 0) {
    for (const roomId of Object.keys(occupied)) {
      let added = 0, bed = 1;
      while (added < bufferPerRoom && bed <= 60) {
        if (!occupied[roomId].has(bed)) { occupied[roomId].add(bed); added++; }
        bed++;
      }
    }
  }

  for (const roomId of Object.keys(holdsMap||{})) {
    const set = holdsMap[roomId];
    if (set && set.forEach) set.forEach(bed => occupied[roomId]?.add(Number(bed)));
  }

  const out = {};
  for (const k of Object.keys(occupied)) out[k] = Array.from(occupied[k]).sort((a,b)=>a-b);
  return out;
}

async function notifySheets(payload) {
  if (!ROWS_URL) {
    console.warn("[sheets] BOOKINGS_WEBAPP_URL missing (notify)");
    return { ok:false, error:"BOOKINGS_WEBAPP_URL_missing" };
  }
  try{
    const res = await fetch(ROWS_URL, {
      method: "POST",
      headers: { "Content-Type":"application/json", "Accept":"application/json" },
      body: JSON.stringify(payload || {})
    });
    const text = await res.text();
    let j = {};
    try { j = JSON.parse(text); } catch { /* noop */ }
    if (!res.ok) console.warn("[sheets] notify status", res.status, "body:", text.slice(0,200));
    return j;
  }catch(e){
    console.warn("[sheets] notify error:", e?.message || e);
    return { ok:false, error:"sheets_notify_error" };
  }
}

module.exports = {
  fetchRowsFromSheet,
  calcOccupiedBeds,
  notifySheets,
  postToSheets: notifySheets,
  getRows: fetchRowsFromSheet,
};
