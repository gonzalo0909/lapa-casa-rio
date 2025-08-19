"use strict";
/**
 * Upserts y lecturas contra Google Sheets (vía services/sheets).
 */
const { fetchRowsFromSheet, notifySheets } = require("./sheets");

function normalize(inObj={}){
  return {
    booking_id: String(inObj.booking_id || inObj.bookingId || `BKG-${Date.now()}`),
    nombre:     inObj.nombre || "",
    email:      inObj.email || "",
    telefono:   inObj.telefono || "",
    entrada:    inObj.entrada || "",
    salida:     inObj.salida  || "",
    hombres:    Number(inObj.hombres || 0),
    mujeres:    Number(inObj.mujeres || 0),
    camas:      inObj.camas || {},
    total:      Number(inObj.total || 0),
    pay_status: inObj.pay_status || "pending",
  };
}

async function upsertBooking(inObj={}){
  const row = normalize(inObj);
  const payload = { action:"upsert_booking", ...row, camas_json: JSON.stringify(row.camas) };
  delete payload.camas;
  const r = await notifySheets(payload);
  if (r && r.ok === false) throw new Error(r.error || "sheets_upsert_failed");
  return row;
}

async function listBookings({ from, to } = {}){
  const rows = await fetchRowsFromSheet();
  if (!from && !to) return rows;
  const a = from ? new Date(from+"T00:00:00Z") : null;
  const b = to   ? new Date(to  +"T00:00:00Z") : null;
  return rows.filter(r=>{
    const d = r.entrada ? new Date(r.entrada+"T00:00:00Z") : null;
    if (!d) return false;
    if (a && d < a) return false;
    if (b && d > b) return false;
    return true;
  });
}

module.exports = { upsertBooking, listBookings };
