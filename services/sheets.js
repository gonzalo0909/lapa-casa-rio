"use strict";

// Lee filas desde Google Apps Script (code.gs: doGet mode=rows)
async function fetchRowsFromSheet(from, to){
  const base = process.env.BOOKINGS_WEBAPP_URL;
  if(!base) return [];
  const url = `${base}?mode=rows`;
  const r = await fetch(url, { headers:{ 'Accept':'application/json' } });
  if(!r.ok) return [];
  const j = await r.json().catch(()=> ({}));
  const rows = Array.isArray(j.rows) ? j.rows : [];
  if(!from && !to) return rows;

  const f = from ? new Date(from+'T00:00:00') : null;
  const t = to   ? new Date(to  +'T00:00:00') : null;
  return rows.filter(x=>{
    const din = x.entrada ? new Date(x.entrada+'T00:00:00') : null;
    const dout= x.salida  ? new Date(x.salida +'T00:00:00') : null;
    if(f && dout && dout <= f) return false; // se van antes de empezar rango
    if(t && din && din >= t) return false;   // entran después del rango
    return true;
  });
}

// Calcula camas ocupadas por room id -> [beds]
function calcOccupiedBeds(rows, holdsMap){
  const occ = { 1: new Set(), 3: new Set(), 5: new Set(), 6: new Set() };

  // Confirmadas/pagadas desde Sheets
  for(const r of rows){
    const status = String(r.pay_status || '').toLowerCase();
    if(['approved','paid','confirmed'].includes(status)){
      try{
        const camas = r.camas || JSON.parse(r.camas_json || '{}') || {};
        for(const [roomId, beds] of Object.entries(camas)){
          (beds || []).forEach(b => occ[Number(roomId)]?.add(Number(b)));
        }
      }catch(_){}
    }
  }

  // Holds vigentes (mapa: { roomId: [beds] })
  if(holdsMap){
    for(const [roomId, arr] of Object.entries(holdsMap)){
      (arr || []).forEach(b => occ[Number(roomId)]?.add(Number(b)));
    }
  }

  // Convertir a arrays ordenados
  const out = {};
  for(const k of [1,3,5,6]) out[k] = Array.from(occ[k]||[]).sort((a,b)=>a-b);
  return out;
}

// Busca estado de pago por booking_id
async function getPaymentStatus(bookingId){
  const base = process.env.BOOKINGS_WEBAPP_URL;
  if(!base) return null;
  const url = `${base}?mode=rows`;
  const r = await fetch(url, { headers:{ 'Accept':'application/json' } });
  if(!r.ok) return null;
  const j = await r.json().catch(()=> ({}));
  const rows = Array.isArray(j.rows) ? j.rows : [];
  const hit = rows.find(x => String(x.booking_id||'') === String(bookingId));
  return hit ? String(hit.pay_status || '').toLowerCase() : null;
}

module.exports = { fetchRowsFromSheet, calcOccupiedBeds, getPaymentStatus };
