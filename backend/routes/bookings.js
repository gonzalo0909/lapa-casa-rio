"use strict";
const express = require("express");
const router = express.Router();
const sheets = require("../services/sheets");

// Crear / upsert reserva manual
router.post("/", async (req, res) => {
  try {
    const b = req.body || {};
    const r = await sheets.upsertBooking({
      booking_id: b.bookingId || b.booking_id || `BKG-${Date.now()}`,
      nombre: b.nombre || "", email: b.email || "", telefono: b.telefono || "",
      entrada: b.entrada, salida: b.salida,
      hombres: b.hombres||0, mujeres: b.mujeres||0,
      camas_json: JSON.stringify(b.camas||{}),
      total: b.total||0, pay_status: b.pay_status||"pending"
    });
    res.json({ ok:true, ...r });
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e) });
  }
});

// Estado (fallback; lo real viene por webhooks)
router.get("/status", async (_req, res) => res.json({ ok:true, status:"pending" }));

// Listar/filtrar reservas (admin)
router.get("/", async (req, res) => {
  try {
    const { from="", to="", q="" } = req.query;
    const rows = await sheets.fetchRowsFromSheet(from.slice(0,10), to.slice(0,10));
    const qq = String(q).toLowerCase();
    const filtered = rows.filter(r => !qq || JSON.stringify(r).toLowerCase().includes(qq));
    res.json({ ok:true, count: filtered.length, rows: filtered });
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e) });
  }
});

// Export CSV
router.get("/export.csv", async (req, res) => {
  try {
    const { from="", to="" } = req.query;
    const rows = await sheets.fetchRowsFromSheet(from.slice(0,10), to.slice(0,10));
    if (!rows.length) return res.type("text/csv").send("");
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(",")]
      .concat(rows.map(r => headers.map(h => `"${String(r[h]??"").replace(/"/g,'""')}"`).join(",")))
      .join("\n");
    res.setHeader("Content-Disposition", "attachment; filename=bookings.csv");
    res.type("text/csv").send(csv);
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e) });
  }
});

module.exports = router;
