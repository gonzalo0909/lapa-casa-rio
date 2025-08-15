/******************************
 * Lapa Casa Backend – versión mínima estable
 * - Sirve estáticos (/, /book)
 * - Healthcheck (/api/health)
 * - Availability stub (/availability, /api/availability)
 * - Confirm hold (/holds/confirm, /api/holds/confirm)
 ******************************/
"use strict";

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

// ===== Middlewares
app.use(cors());
app.use(express.json());

// ===== Static: /  y /book  desde ./public
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

// ===== Confirm hold (stub funcional)
app.post(["/holds/confirm", "/api/holds/confirm"], (req, res) => {
  try {
    const b = req.body || {};
    const holdId    = String(b.holdId || b.booking_id || "").trim();
    const newStatus = String(b.status || b.pay_status || "paid").trim(); // paid|pending
    if (!holdId) return res.status(400).json({ ok:false, error:"missing_holdId" });
    console.log("HOLD confirm:", { holdId, newStatus });
    return res.json({ ok:true, holdId, status:newStatus, msg:"confirm_done" });
  } catch (e) {
    console.error("hold_confirm_error:", e);
    return res.status(500).json({ ok:false, error:"hold_confirm_failed" });
  }
});

// ===== Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
