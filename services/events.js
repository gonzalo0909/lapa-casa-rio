"use strict";

/**
 * /services/events.js
 * Agregador de eventos con cache y feeds externos
 */

const fetch = require("node-fetch");

const ENABLE_EVENTS     = String(process.env.ENABLE_EVENTS || "").trim() === "1";
const EVENTS_TTL_HOURS  = Number(process.env.EVENTS_TTL_HOURS || 24);
const EVENTS_FEEDS      = (process.env.EVENTS_FEEDS || "").split(",").map(s=>s.trim()).filter(Boolean);

let cache = { ts: 0, events: [] };

async function getEvents() {
  const now = Date.now();
  const ttl = EVENTS_TTL_HOURS * 3600 * 1000;
  if (cache.ts && now - cache.ts < ttl) return cache.events;

  let events = [];
  if (ENABLE_EVENTS && EVENTS_FEEDS.length) {
    try {
      for (const url of EVENTS_FEEDS) {
        const r = await fetch(url);
        if (!r.ok) continue;
        const txt = await r.text();
        events.push({ title: url, start: new Date(), venue: "feed" }); 
        // TODO: parser real según formato (RSS/ICS/JSON)
      }
    } catch (err) {
      console.error("Error cargando feeds", err);
    }
  }
  cache = { ts: now, events };
  return events;
}

module.exports = { getEvents };
