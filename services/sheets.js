"use strict";
/**
 * Servicios Sheets / Disponibilidad / HOLDs
 * - Reenvía reservas a Google Apps Script (BOOKINGS_WEBAPP_URL)
 * - Calcula disponibilidad con cache
 * - Gestiona HOLDs y barrido por CRON
 */

const express = require("express");
const crypto = require("crypto");

const BOOKINGS_WEBAPP_URL = process.env.BOOKINGS_WEBAPP_URL || "";
const HOLD_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES || 10);
const CRON_TOKEN = process.env.CRON_TOKEN || "";

const router = express.Router();

/* ========= Memorias / caches ========= */
const holdsMem = new Map();                // holdId -> { expiresAt }
const availabilityCache = new Map();       // "from:to" -> { ts, data }
const AVAIL_TTL_MS = 60_000;

/* ========= Utils ========= */
function rateLimit(maxPerMin = 60) {
  const WINDOW = 60_000;
  const store = new Map();
  return (req, res, next) => {
    const ip = req.ip || "unknown";
    const now = Date.now();
    const rec = store.get(ip) || { count: 0, reset: now + WINDOW };
    if (now > rec.reset) { rec.count = 0; rec.reset = now + WINDOW; }
    rec.count++; store.set(ip, rec);
    if (rec.count > maxPerMin) return res.status(429).json({ ok:false, error:"rate_limited" });
    next();
  };
}
function invalidateAvailabilityCache(){ availabilityCache.clear(); }

async function fetchWithRetry(url, opts={}, attempts=3){
  let lastErr;
  for (let i=0;i<attempts;i++){
    try{
      const r = await fetch(url, opts);
      if (!r.ok) throw new Error(`status_${r.status}`);
      return r;
    }catch(err){
      lastErr = err;
      await new Promise(r => setTimeout(r, 300 * Math.pow(2,i)));
    }
  }
  throw lastErr;
}
async function postToSheets(payload){
  if (!BOOKINGS_WEBAPP_URL) throw new Error("BOOKINGS_WEBAPP_URL_missing");
  const r = await fetchWithRetry(BOOKINGS_WEBAPP_URL, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(payload)
  });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { ok:false, raw:text }; }
}
async function fetchRowsFromSheet_() {
  const url = `${BOOKINGS_WEBAPP_URL}?mode=rows`;
  const r = await fetchWithRetry(url, { method:"GET" });
  const j = await r.json().catch(() => ({ ok:false, rows:[] }));
  return Array.isArray(j.rows) ? j.rows : [];
}
function calcOccupiedBeds_(rows, from, to) {
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

/* ========= Rutas ========= */

// Health/diagnóstico básico de Sheets
router.get("/diagnostic", async (_req,res)=>{
  try{
    const rows = await fetchRowsFromSheet_();
    res.json({ ok:true, rows: rows.length });
  }catch(e){
    res.status(500).json({ ok:false, error:String(e?.message||e) });
  }
});

// Crear/actualizar reserva (Upsert)
router.post("/bookings", rateLimit(60), async (req,res)=>{
  try{
    if (!BOOKINGS_WEBAPP_URL) return res.status(500).json({ ok:false, error:"no_webhook_url" });
    const b = req.body || {};
    const booking_id = b.booking_id || b.bookingId || `BKG-${Date.now()}`;

    const payload = {
      action: "upsert_booking",
      booking_id,
      nombre: b.nombre || "",
      email: b.email || "",
      telefono: b.telefono || "",
      entrada: b.entrada || "",
      salida: b.salida || "",
      hombres: Number(b.hombres || 0),
      mujeres: Number(b.mujeres || 0),
      camas_json: JSON.stringify(b.camas || {}),
      total: Number(b.total || 0),
      pay_status: b.pay_status || "pending",
    };

    let j = await postToSheets(payload);
    if (!j?.ok) { // fallback sin action
      const fallback = { ...payload }; delete fallback.action;
      j = await postToSheets(fallback);
    }
    invalidateAvailabilityCache();
    res.status(j?.ok ? 200 : 500).json(j);
  }catch(e){
    res.status(500).json({ ok:false, error:"forward_failed" });
  }
});

// Actualización de pago (desde webhooks externos)
router.post("/bookings/payment_update", rateLimit(120), async (req,res)=>{
  try{
    const { booking_id, bookingId, status, total } = req.body || {};
    const id = booking_id || bookingId || "";
    if (!id) return res.status(400).json({ ok:false, error:"missing_booking_id" });
    const j = await postToSheets({ action:"payment_update", booking_id:id, status, total });
    invalidateAvailabilityCache();
    res.json(j);
  }catch(e){
    res.status(500).json({ ok:false, error:String(e?.message||e) });
  }
});

// Disponibilidad (con cache simple)
router.get("/availability", async (req,res)=>{
  try{
    const from = String(req.query.from || "").slice(0,10);
    const to   = String(req.query.to   || "").slice(0,10);
    if (!from || !to) return res.status(400).json({ ok:false, error:"missing_from_to" });

    const key = `${from}:${to}`; const now = Date.now();
    const cached = availabilityCache.get(key);
    if (cached && now - cached.ts < AVAIL_TTL_MS) return res.json(cached.data);

    const rows = await fetchRowsFromSheet_();
    const occupied = calcOccupiedBeds_(rows, from, to);
    const out = { ok:true, from, to, occupied };
    availabilityCache.set(key, { ts: now, data: out });
    res.json(out);
  }catch(e){
    res.status(500).json({ ok:false, error:"availability_failed" });
  }
});

// HOLD: start
router.post("/holds/start", rateLimit(60), async (req,res)=>{
  try{
    const b = req.body || {};
    const holdId = b.holdId || b.bookingId || `HOLD-${Date.now()}`;
    const ttlMin = Number(b.ttlMinutes || HOLD_TTL_MINUTES);
    const expiresAt = Date.now() + ttlMin * 60_000;

    const payload = {
      action: "upsert_booking",
      booking_id: holdId,
      nombre: b.nombre || "HOLD",
      email: b.email || "",
      telefono: b.telefono || "",
      entrada: b.entrada || "",
      salida: b.salida || "",
      hombres: Number(b.hombres || 0),
      mujeres: Number(b.mujeres || 0),
      camas_json: JSON.stringify(b.camas || {}),
      total: Number(b.total || 0),
      pay_status: "hold"
    };
    await postToSheets(payload);
    holdsMem.set(holdId, { expiresAt });
    invalidateAvailabilityCache();
    res.json({ ok:true, holdId, expiresAt });
  }catch(e){
    res.status(500).json({ ok:false, error:"hold_start_failed" });
  }
});

// HOLD: release
router.post("/holds/release", rateLimit(60), async (req,res)=>{
  try{
    const holdId = req.body?.holdId || "";
    if (!holdId) return res.status(400).json({ ok:false, error:"missing_holdId" });
    await postToSheets({ action:"upsert_booking", booking_id: holdId, pay_status:"released" });
    holdsMem.delete(holdId);
    invalidateAvailabilityCache();
    res.json({ ok:true, holdId });
  }catch(e){
    res.status(500).json({ ok:false, error:"hold_release_failed" });
  }
});

// HOLD: confirm → paid|approved
router.post("/holds/confirm", rateLimit(60), async (req,res)=>{
  try{
    const holdId = req.body?.holdId || "";
    const newStatus = req.body?.status || "paid";
    if (!holdId) return res.status(400).json({ ok:false, error:"missing_holdId" });
    await postToSheets({ action:"upsert_booking", booking_id: holdId, pay_status: newStatus });
    holdsMem.delete(holdId);
    invalidateAvailabilityCache();
    res.json({ ok:true, holdId, status:newStatus });
  }catch(e){
    res.status(500).json({ ok:false, error:"hold_confirm_failed" });
  }
});

// CRON: barrido de HOLDs vencidos
router.get("/crons/holds-sweep", async (req,res)=>{
  try{
    if (!CRON_TOKEN || req.query.token !== CRON_TOKEN) return res.status(403).json({ ok:false, error:"forbidden" });
    const now = Date.now();
    let released = 0;
    for (const [hid, info] of [...holdsMem.entries()]) {
      if (now > (info?.expiresAt || 0)) {
        try { await postToSheets({ action:"upsert_booking", booking_id: hid, pay_status: "released" }); } catch {}
        holdsMem.delete(hid); released++;
      }
    }
    invalidateAvailabilityCache();
    res.json({ ok:true, released });
  }catch(e){
    res.status(500).json({ ok:false, error:String(e?.message||e) });
  }
});

module.exports = router;
