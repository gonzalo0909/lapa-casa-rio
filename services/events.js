"use strict";
/**
 * /services/events.js — lee feeds externos con cache
 */
const fetch = require("node-fetch");
const ENABLE_EVENTS    = String(process.env.ENABLE_EVENTS || "").trim() === "1";
const EVENTS_TTL_HOURS = Number(process.env.EVENTS_TTL_HOURS || 24);
const EVENTS_FEEDS     = (process.env.EVENTS_FEEDS || "").split(",").map(s=>s.trim()).filter(Boolean);

let cache = { ts: 0, events: [] };

async function getEvents() {
  const now = Date.now(), ttl = EVENTS_TTL_HOURS * 3600 * 1000;
  if (cache.ts && now - cache.ts < ttl) return cache.events;

  let events = [];
  if (ENABLE_EVENTS && EVENTS_FEEDS.length) {
    for (const url of EVENTS_FEEDS) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const txt = await res.text();
          events.push({ source: url, raw: txt.slice(0, 500) });
        }
      } catch (err) {
        console.error("event_feed_error", url, err.message);
      }
    }
  }
  cache = { ts: now, events };
  return events;
}

module.exports = { getEvents };
