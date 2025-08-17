"use strict";
/**
 * services/events.js — agregador con caché
 * ENV:
 *   ENABLE_EVENTS=1
 *   EVENTS_TTL_HOURS=24
 *   EVENTS_FEEDS="ics:https://...,rss:https://...,json:https://..."
 *
 * Exporta:
 *   - getEvents()        → Promise<Event[]>
 *   - eventsHandler(req,res) → Express handler: GET /api/events
 *
 * Formato Event:
 *   { title, start, end, location, url, source }
 */

// ✅ compat Node18+ (fetch nativo) + fallback node-fetch v3 ESM
const fetch = global.fetch
  ? global.fetch.bind(global)
  : (...a) => import("node-fetch").then(m => m.default(...a));

const ENABLE_EVENTS    = String(process.env.ENABLE_EVENTS || "").trim() === "1";
const EVENTS_TTL_HOURS = Number(process.env.EVENTS_TTL_HOURS || 24);
const EVENTS_FEEDS     = (process.env.EVENTS_FEEDS || "")
  .split(",").map(s => s.trim()).filter(Boolean);

const cache = { ts: 0, events: [] };
const TTL = Math.max(1, EVENTS_TTL_HOURS) * 3600 * 1000;

/* ========== API pública ========== */
async function getEvents() {
  const now = Date.now();
  if (cache.ts && (now - cache.ts) < TTL) return cache.events;

  let events = [];
  if (ENABLE_EVENTS && EVENTS_FEEDS.length) {
    const results = await Promise.allSettled(EVENTS_FEEDS.map(loadFeedSafe));
    for (const r of results) if (r.status === "fulfilled" && Array.isArray(r.value)) events = events.concat(r.value);
  } else {
    events = fallbackEvents();
  }

  // normaliza + ordena + dedup
  events = normalize(events).sort((a,b)=> (toTime(a.start) - toTime(b.start)));
  events = dedup(events);
  cache.ts = now; cache.events = events;
  return events;
}

async function eventsHandler(_req, res) {
  try { const events = await getEvents(); res.json({ ok:true, events, cachedAt: cache.ts }); }
  catch (e) { res.status(500).json({ ok:false, error: String(e.message || e) }); }
}

module.exports = { getEvents, eventsHandler };

/* ========== Loaders ========== */
async function loadFeedSafe(spec) {
  try {
    const { type, url } = parseSpec(spec);
    if (!url) return [];
    const text = await httpText(url);

    if (type === "ics")  return parseICS(text, url);
    if (type === "rss")  return parseRSS(text, url);
    if (type === "json") return parseJSON(text, url);

    // autodetect
    if (/BEGIN:VCALENDAR/i.test(text)) return parseICS(text, url);
    if (/<rss[\s>]/i.test(text) || /<feed[\s>]/i.test(text)) return parseRSS(text, url);
    return parseJSON(text, url);
  } catch { return []; }
}

function parseSpec(s) {
  const m = s.match(/^([a-z]+):(.+)$/i);
  if (m) return { type: m[1].toLowerCase(), url: m[2] };
  return { type: "auto", url: s };
}

async function httpText(url) {
  const res = await fetch(url, { headers: { "Accept": "*/*" }});
  if (!res.ok) throw new Error(`fetch_failed:${res.status}`);
  return await res.text();
}

/* ========== Parsers ========== */
// (… resto igual sin cambios …)
