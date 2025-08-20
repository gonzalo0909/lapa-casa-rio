// services/holds.js
"use strict";

/**
 * Servicio en memoria para HOLDs/Bookings/Payments.
 * Producción real: reemplazar por DB.
 */
const HOLD_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES || 10);

// Capacidad por cuarto
const ROOMS = { 1:12, 3:12, 5:7, 6:7 };

// Estado en memoria
const state = {
  holds: new Map(),   // holdId -> {entrada,salida,camas,total,expiresAt,status}
  bookings: new Map(),// bookingId -> { ...order, pay_status }
  payments: new Map() // bookingId -> { status:'pending'|'approved'|'paid'|'failed', provider }
};

function clampBeds(camas){
  const out = {};
  for (const id of Object.keys(camas||{})){
    const rid = String(id);
    const cap = ROOMS[rid] || 0;
    const list = Array.from(new Set([...(camas[id]||[]).map(n=>Number(n))]))
      .filter(n=>n>=1 && n<=cap);
    out[rid] = list;
  }
  return out;
}

function overlaps(aStart,aEnd,bStart,bEnd){
  const aS = new Date(aStart+"T00:00:00").getTime();
  const aE = new Date(aEnd  +"T00:00:00").getTime();
  const bS = new Date(bStart+"T00:00:00").getTime();
  const bE = new Date(bEnd  +"T00:00:00").getTime();
  return (aS < bE) && (bS < aE);
}

function startHold(holdId, payload){
  const now = Date.now();
  const ttl = HOLD_TTL_MINUTES*60*1000;
  const rec = {
    id: holdId,
    entrada: String(payload.entrada||""),
    salida : String(payload.salida ||""),
    hombres: Number(payload.hombres||0),
    mujeres: Number(payload.mujeres||0),
    camas  : clampBeds(payload.camas||{}),
    total  : Number(payload.total||0),
    status : "hold",
    expiresAt: now + ttl
  };
  if (!rec.entrada || !rec.salida) throw new Error("missing_dates");
  state.holds.set(holdId, rec);
  return rec;
}

function confirmHold(holdId, status="paid"){
  const rec = state.holds.get(holdId);
  if(!rec) return false;
  rec.status = status;
  rec.expiresAt = Date.now() + 365*24*3600*1000; // “indefinido” (confirmado)
  state.holds.set(holdId, rec);
  state.payments.set(holdId, { status: (status==="paid"?"approved":status), provider:"manual" });
  return true;
}

function releaseHold(holdId){
  state.holds.delete(holdId);
}

function getTtlMinutes(){ return HOLD_TTL_MINUTES; }

function sweepExpired(){
  const now = Date.now();
  const toDelete = [];
  for (const [id,rec] of state.holds){
    if (rec.status==="hold" && rec.expiresAt < now) toDelete.push(id);
  }
  toDelete.forEach(id=>state.holds.delete(id));
  return toDelete;
}

function getOccupiedByRange(from,to){
  const out = { 1:[], 3:[], 5:[], 6:[] };
  for (const rec of state.holds.values()){
    if (rec.status!=="hold" && rec.status!=="paid" && rec.status!=="approved") continue;
    if (overlaps(from,to,rec.entrada,rec.salida)){
      for (const [rid,list] of Object.entries(rec.camas||{})){
        out[rid] = out[rid].concat(list);
      }
    }
  }
  // también bloquear bookings marcados como paid (si existieran camas)
  for (const booking of state.bookings.values()){
    const s = String(booking.pay_status||"");
    if (!/paid|approved/.test(s)) continue;
    if (overlaps(from,to,booking.entrada,booking.salida)){
      const camas = clampBeds(booking.camas||{});
      for (const [rid,list] of Object.entries(camas)){
        out[rid] = out[rid].concat(list);
      }
    }
  }
  // dedupe
  for (const rid of Object.keys(out)){
    out[rid] = Array.from(new Set(out[rid]));
  }
  return out;
}

function upsertBooking(id, booking){
  state.bookings.set(String(id), { ...booking });
}

function setPaymentStatus(bookingId, status, provider){
  state.payments.set(String(bookingId), { status, provider });
  // marcar booking si existe
  const b = state.bookings.get(String(bookingId));
  if (b) state.bookings.set(String(bookingId), { ...b, pay_status: status });
  // si existe hold con mismo id, confírmalo
  const h = state.holds.get(String(bookingId));
  if (h) confirmHold(String(bookingId), status==="approved"?"paid":status);
}

function getPaymentStatus(bookingId){
  const ps = state.payments.get(String(bookingId)) || { status:"pending" };
  return ps;
}

module.exports = {
  startHold,
  confirmHold,
  releaseHold,
  getTtlMinutes,
  sweepExpired,
  getOccupiedByRange,
  upsertBooking,
  setPaymentStatus,
  getPaymentStatus,
};
