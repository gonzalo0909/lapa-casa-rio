"use strict";

/**
 * routes/bookings.js
 * Listado de reservas desde Google Sheets
 * Incluye filtros por fecha/texto, logs y errores claros
 */

const express = require("express");
const router = express.Router();
const { fetchRowsFromSheet } = require("../services/sheets");

// GET /api/bookings?from=YYYY-MM-DD&to=YYYY-MM-DD&q=texto
router.get("/", async (req, res) => {
  try {
    const { from, to, q } = req.query;
    const raw = await fetchRowsFromSheet(from, to);

    const rows = (Array.isArray(raw) ? raw : []).map((r) => ({
      booking_id: r.booking_id || null,
      entrada: r.entrada || null,
      salida: r.salida || null,
      hombres: parseInt(r.hombres || 0, 10),
      mujeres: parseInt(r.mujeres || 0, 10),
      pay_status: (r.pay_status || "pending").toLowerCase(),
      source: r.source || null,
      created_at: r.created_at || null,
      total: r.total || 0
    }));

    const query = String(q || "").trim().toLowerCase();
    const filtered = query
      ? rows.filter((r) =>
          Object.values(r).some((v) => String(v).toLowerCase().includes(query))
        )
      : rows;

    return res.json({ ok: true, count: filtered.length, rows: filtered });
  } catch (err) {
    console.error("[Bookings] error:", err.message);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

module.exports = router;
