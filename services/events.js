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
const fetch = require("node-fetch");

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
function parseJSON(txt, source) {
  let j;
  try { j = JSON.parse(txt); } catch { return []; }
  let arr = [];
  if (Array.isArray(j)) arr = j;
  else if (Array.isArray(j?.events)) arr = j.events;
  else return [];

  return arr.map(e => ({
    title: str(e.title || e.name),
    start: toISO(e.start || e.startDate || e.date || e.when),
    end:   toISO(e.end || e.endDate),
    location: str(e.location || e.venue || e.place),
    url: str(e.url || e.link),
    source
  })).filter(v => v.title && v.start);
}

function parseRSS(xml, source) {
  const items = xml.split(/<\/item>/i).map(x => x + "</item>").filter(x => /<item>/i.test(x));
  const get = (s, tag) => {
    const m = s.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
    return m ? unescapeXml(m[1]).trim() : "";
  };
  const isoDate = (s) => {
    const d = new Date(s || ""); if (!isNaN(d)) return d.toISOString().slice(0,19);
    return toISO(s);
  };
  return items.map(it => ({
    title: get(it, "title"),
    start: isoDate(get(it, "pubDate") || get(it, "updated") || get(it, "dc:date")),
    end:   "",
    location: "",
    url: get(it, "link"),
    source
  })).filter(v => v.title && v.start);
}

function parseICS(ics, source) {
  // unfold líneas
  const lines = ics.replace(/\r/g,"").split("\n").reduce((acc, line) => {
    if (/^[ \t]/.test(line) && acc.length) acc[acc.length-1] += line.replace(/^[ \t]+/, "");
    else acc.push(line);
    return acc;
  }, []);
  const evs = [];
  let cur = null;
  for (const ln of lines) {
    if (/^BEGIN:VEVENT\b/i.test(ln)) { cur = {}; continue; }
    if (/^END:VEVENT\b/i.test(ln))   { if (cur && (cur.SUMMARY||cur.UID)) evs.push(cur); cur = null; continue; }
    if (!cur) continue;
    const m = ln.match(/^([A-Z-]+)(?:;[^:]*)?:(.*)$/i);
    if (!m) continue;
    const key = m[1].toUpperCase(), val = m[2];
    cur[key] = val;
  }
  return evs.map(e => ({
    title: str(e.SUMMARY),
    start: parseIcsDate(e.DTSTART),
    end:   parseIcsDate(e.DTEND),
    location: str(e.LOCATION),
    url: str(e.URL || e["X-ALT-DESC"] || ""),
    source
  })).filter(v => v.title && v.start);
}

function parseIcsDate(s) {
  if (!s) return "";
  // formatos: 20250821, 20250821T190000Z, 20250821T190000
  const m = String(s).trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?Z?)?$/);
  if (!m) return "";
  const [_, Y, M, D, h="00", m2="00", s2="00"] = m;
  const iso = `${Y}-${M}-${D}T${h}:${m2}:${s2}`;
  return iso;
}

/* ========== Utils ========== */
function normalize(arr) {
  return (arr||[]).map(e => ({
    title: str(e.title),
    start: toISO(e.start),
    end:   toISO(e.end),
    location: str(e.location),
    url: str(e.url),
    source: e.source || ""
  })).filter(e => e.title && e.start);
}
function dedup(arr) {
  const seen = new Set(), out = [];
  for (const e of arr) {
    const k = `${e.title}|${e.start}`;
    if (seen.has(k)) continue;
    seen.add(k); out.push(e);
  }
  return out;
}
function str(v){ return v == null ? "" : String(v).trim(); }
function toISO(v) {
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(v))) return String(v).slice(0,19);
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return `${v}T00:00:00`;
  const d = new Date(v); if (!isNaN(d)) return d.toISOString().slice(0,19);
  return "";
}
function toTime(iso){ if(!iso) return 0; const d=new Date(iso); return isNaN(d)?0:d.getTime(); }
function unescapeXml(s){ return String(s).replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&"); }
function fallbackEvents() {
  // 5 eventos de ejemplo (se reemplazan cuando ENABLE_EVENTS=1 + feeds)
  const today = new Date(); const toISODate = (d)=>d.toISOString().slice(0,10);
  const addDays = (n)=>{ const d=new Date(today.getTime()+n*86400000); return `${toISODate(d)}T20:00:00`; };
  return [
    { title:"Samba Lapa — Roda ao vivo", start:addDays(1),  location:"Lapa", url:"", source:"fallback" },
    { title:"Forró no Centro",          start:addDays(2),  location:"Centro", url:"", source:"fallback" },
    { title:"Feira de Arte Santa Teresa",start:addDays(3), location:"Santa Teresa", url:"", source:"fallback" },
    { title:"Jazz no Porto",            start:addDays(4),  location:"Porto Maravilha", url:"", source:"fallback" },
    { title:"Rock na Praia",            start:addDays(5),  location:"Copacabana", url:"", source:"fallback" }
  ];
}
