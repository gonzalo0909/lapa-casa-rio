/**
 * routes/bookings.js
 * Ruta pública para listar reservas (usado en modo debug o admin)
 * Datos provienen de Google Sheets
 */

"use strict";

const express = require("express");
const router = express.Router();

const { fetchRowsFromSheet } = require("../services/sheets");

/**
 * GET /api/bookings?from=YYYY-MM-DD&to=YYYY-MM-DD&q=texto
 * Devuelve lista de reservas filtradas
 */
router.get("/", (req, res) => {
  try {
    const { from, to, q } = req.query;

    // No requiere fechas, puede traer todo
    const rows = fetchRowsFromSheet(from, to).map(row => ({
      booking_id: row.booking_id || null,
      entrada: row.entrada || null,
      salida: row.salida || null,
      hombres: parseInt(row.hombres || 0, 10),
      mujeres: parseInt(row.mujeres || 0, 10),
      pay_status: row.pay_status || "pending",
      source: row.source || null,
      created_at: row.created_at || null
    }));

    // Filtro opcional por texto
    const filtered = q
      ? rows.filter(row =>
          Object.values(row).some(val =>
            String(val).toLowerCase().includes(q.toLowerCase())
          )
        )
      : rows;

    res.json({
      ok: true,
      count: filtered.length,
      rows: filtered
    });
  } catch (err) {
    console.error("[Bookings] Error al obtener reservas:", err.message);
    res.status(500).json({
      ok: false,
      error: "internal_error",
      message: "No se pudieron cargar las reservas"
    });
  }
});

module.exports = router;
