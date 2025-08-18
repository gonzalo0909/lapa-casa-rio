"use strict";
/**
 * routes/events.js — expone los eventos desde services/events.js
 */

const express = require("express");
const router = express.Router();
const { getEvents, getCacheInfo } = require("../services/events");

// GET /events → lista de eventos
router.get("/", async (req, res) => {
  try {
    const events = await getEvents();
    res.json({ ok: true, events });
  } catch (err) {
    console.error("Error en /events:", err);
    res.status(500).json({ ok: false, error: "events_failed" });
  }
});

// GET /events/cache → info de caché
router.get("/cache", (req, res) => {
  res.json({ ok: true, cache: getCacheInfo() });
});

module.exports = router;
