/******************************
 * Lapa Casa Backend – estáticos + /book + confirm
 ******************************/
"use strict";

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// ====== STATIC: sirve / y archivos en ./public
// - /            -> public/index.html
// - /book        -> public/book.html (ruta directa)
// - otros estáticos (css/js/img) desde public/
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR, { index: "index.html", extensions: ["html"] }));

// Ruta explícita para /book (evita "Cannot GET /book/")
app.get("/book", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "book.html"));
});

// Healthcheck simple
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "lapa-casa-backend", ts: Date.now() });
});

// ====== CONFIRMAR HOLD (stub funcional)
// Más adelante lo conectamos a Sheets/Webhooks; por ahora confirma sin error.
app.post(["/holds/confirm", "/api/holds/confirm"], async (req, res) => {
  try {
    const b = req.body || {};
    const holdId    = String(b.holdId || b.booking_id || "").trim();
    const newStatus = String(b.status || b.pay_status || "paid").trim(); // paid | pending

    if (!holdId) return res.status(400).json({ ok:false, error:"missing_holdId" });

    // Log mínimo para verificar que llega
    console.log("HOLD confirm:", { holdId, newStatus });

    // Respuesta OK
    return res.json({ ok: true, holdId, status: newStatus, msg: "confirm_done" });
  } catch (e) {
    console.error("hold_confirm_error:", e);
    return res.status(500).json({ ok:false, error:"hold_confirm_failed" });
  }
});

// ====== SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
