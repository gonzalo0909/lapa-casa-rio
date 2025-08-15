/******************************
 * Lapa Casa Backend – versión mínima estable (con HOLDs)
 * - Sirve estáticos (/, /book) desde ./public
 * - Healthcheck (/api/health)
 * - Availability stub (/availability, /api/availability)
 * - HOLDs: start/release/confirm (JSON)
 ******************************/
"use strict";

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

// ===== Middlewares
app.use(cors());
app.use(express.json());

// ===== Static: / y /book desde ./public
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR, { index: "index.html", extensions: ["html"] }));
app.get("/book", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "book.html"));
});

// ===== Health
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "lapa-casa-backend", ts: Date.now() });
});

// ===== Availability (stub para que el front funcione)
app.get(["/availability", "/api/availability"], (req, res) => {
  const from = String(req.query.from || "").slice(0, 10);
  const to   = String(req.query.to   || "").slice(0, 10);
  if (!from || !to) return res.status(400).json({ ok:false, error:"missing_from_to" });
  return res.json({ ok:true, from, to, occupied:{} });
});

// ===== HOLDs en memoria (anti-overbooking básico)
const HOLD_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES || 10);
const holdsMem = new Map(); // holdId -> { expiresAt, payload }

// START: crea un HOLD y devuelve expiresAt (lo que espera tu front)
app.post(["/holds/start","/api/holds/start"], (req, res) => {
  try{
    const b = req.body || {};
    const holdId = String(b.holdId || b.bookingId || `HOLD-${Date.now()}`).trim();
    const ttlMin = Number(b.ttlMinutes || HOLD_TTL_MINUTES);
    const expiresAt = Date.now() + ttlMin * 60_000;

    holdsMem.set(holdId, { expiresAt, payload: b });
    return res.json({ ok:true, holdId, expiresAt });
  }catch(e){
    console.error("hold_start_error:", e);
    return res.status(500).json({ ok:false, error:"hold_start_failed" });
  }
});

// RELEASE: libera un HOLD (lo llama el front en beforeunload)
app.post(["/holds/release","/api/holds/release"], (req, res) => {
  try{
    const holdId = String(req.body?.holdId || "").trim();
    if (!holdId) return res.status(400).json({ ok:false, error:"missing_holdId" });
    holdsMem.delete(holdId);
    return res.json({ ok:true, holdId });
  }catch(e){
    console.error("hold_release_error:", e);
    return res.status(500).json({ ok:false, error:"hold_release_failed" });
  }
});

// CONFIRM: marca el HOLD como pagado/pending (tu front lo usa para finalizar)
app.post(["/holds/confirm","/api/holds/confirm"], (req, res) => {
  try{
    const b = req.body || {};
    const holdId    = String(b.holdId || b.booking_id || "").trim();
    const newStatus = String(b.status || b.pay_status || "paid").trim(); // paid|pending
    if (!holdId) return res.status(400).json({ ok:false, error:"missing_holdId" });

    // (Aquí luego conectamos con Sheets/Webhooks real)
    holdsMem.delete(holdId); // ya no se necesita el hold en memoria
    return res.json({ ok:true, holdId, status:newStatus, msg:"confirm_done" });
  }catch(e){
    console.error("hold_confirm_error:", e);
    return res.status(500).json({ ok:false, error:"hold_confirm_failed" });
  }
});

// ===== Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
