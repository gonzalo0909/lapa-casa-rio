"use strict";

/**
 * routes/ical.js
 * Exporta iCal por habitación y por hostel completo.
 * Eventos = reservas confirmadas (Sheets) + bloqueos externos opcionales.
 */

const express = require("express");
const router = express.Router();
const ics = require("ics");
const { fetchRowsFromSheet } = require("../services/sheets");

// GET /api/ical/room/:roomId
router.get("/room/:roomId", async (req, res) => {
  try {
    const roomId = Number(req.params.roomId);
    if (!roomId) return res.status(400).send("roomId requerido");

    const rows = await fetchRowsFromSheet(); // todo rango
    const events = buildRoomEvents(rows, roomId);

    ics.createEvents(events, (error, value) => {
      if (error) return res.status(500).send("ics_error");
      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="room-${roomId}.ics"`);
      return res.send(value);
    });
  } catch (e) {
    console.error("[iCal room]", e.message);
    return res.status(500).send("internal_error");
  }
});

// GET /api/ical/all
router.get("/all", async (_req, res) => {
  try {
    const rows = await fetchRowsFromSheet();
    const events = buildAllEvents(rows);

    ics.createEvents(events, (error, value) => {
      if (error) return res.status(500).send("ics_error");
      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="lapa-casa-all.ics"`);
      return res.send(value);
    });
  } catch (e) {
    console.error("[iCal all]", e.message);
    return res.status(500).send("internal_error");
  }
});

function buildRoomEvents(rows, roomId) {
  const out = [];
  for (const r of rows) {
    const status = String(r.pay_status || "").toLowerCase();
    if (!["approved", "paid", "confirmed", "succeeded"].includes(status)) continue;

    let camas = {};
    try { camas = r.camas_json ? JSON.parse(r.camas_json) : (r.camas || {}); } catch { camas = r.camas || {}; }
    const beds = (camas[String(roomId)] || camas[roomId] || []).map(Number);
    if (!beds.length) continue;

    out.push(rowToEvent(r, `Room ${roomId} — Beds ${beds.join(",")}`));
  }
  return out;
}

function buildAllEvents(rows) {
  const out = [];
  for (const r of rows) {
    const status = String(r.pay_status || "").toLowerCase();
    if (!["approved", "paid", "confirmed", "succeeded"].includes(status)) continue;

    let camas = {};
    try { camas = r.camas_json ? JSON.parse(r.camas_json) : (r.camas || {}); } catch { camas = r.camas || {}; }
    const label = Object.entries(camas)
      .map(([rid, beds]) => `R${rid}:${(beds||[]).join(",")}`)
      .join(" | ") || "No beds";

    out.push(rowToEvent(r, label));
  }
  return out;
}

function rowToEvent(r, label) {
  const start = dateToArray(r.entrada);
  const end = dateToArray(r.salida);
  return {
    start, end,
    title: `BKG ${r.booking_id || ""}`,
    description: `${r.nombre || ""} • ${label} • ${String(r.source||"local").toUpperCase()}`,
    uid: `bkg-${r.booking_id || ""}@lapacasahostel.com`,
    calName: "Lapa Casa Hostel",
    productId: "LapaCasa/ChannelManager",
    status: "CONFIRMED"
  };
}

function dateToArray(ymd) {
  const [Y,M,D] = String(ymd).split("-").map(n=>Number(n));
  return [Y, M, D]; // all-day
}

module.exports = router;
