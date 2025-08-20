"use strict";

// Simulación de "Sheets": almacenamiento en memoria
const bookings = []; // cada item: { bookingId, entrada, salida, camas:{roomId:[beds]}, ... }

function overlaps(aStart, aEnd, bStart, bEnd){
  // rangos de noches [start, end) sin incluir checkout
  return aStart < bEnd && bStart < aEnd;
}

async function notifySheets(_event){ /* no-op de demo */ }

// Agrega/actualiza una fila de reserva (en memoria)
async function appendBookingRow(b){
  // Si existe por bookingId, reemplaza; si no, inserta
  const idx = bookings.findIndex(x => x.bookingId === b.bookingId);
  if (idx >= 0) bookings[idx] = { ...bookings[idx], ...b };
  else bookings.push({ ...b });
  return { ok: true };
}

// Devuelve mapa de ocupación por habitación en el rango
async function readOccupiedMap(from, to){
  const occ = { 1: [], 3: [], 5: [], 6: [] };
  const seen = { 1: new Set(), 3: new Set(), 5: new Set(), 6: new Set() };

  const aStart = new Date(from + "T00:00:00");
  const aEnd   = new Date(to   + "T00:00:00");

  for (const b of bookings){
    if (!b.entrada || !b.salida || !b.camas) continue;
    const bStart = new Date(b.entrada + "T00:00:00");
    const bEnd   = new Date(b.salida  + "T00:00:00");
    if (!overlaps(aStart, aEnd, bStart, bEnd)) continue;

    for (const [roomId, beds] of Object.entries(b.camas || {})){
      const id = Number(roomId);
      (beds || []).forEach(bed => seen[id]?.add(Number(bed)));
    }
  }

  for (const k of [1,3,5,6]) occ[k] = Array.from(seen[k]).sort((a,b)=>a-b);
  return occ;
}

// (Opcional) Exponer las reservas en memoria (solo para depurar)
function _getAllBookings(){ return bookings.slice(); }

module.exports = {
  notifySheets,
  appendBookingRow,
  readOccupiedMap,
  _getAllBookings,
};
