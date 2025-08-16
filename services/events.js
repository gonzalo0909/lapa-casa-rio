"use strict";

/**
 * Eventos reales con cache.
 * ENV:
 *  - ENABLE_EVENTS=1 → activa fuentes reales (si no, usa fallback)
 *  - EVENTS_TTL_HOURS=24 → TTL cache (horas)
 *  - EVENTS_FEEDS="https://foo.ics, https://bar.rss, https://baz.json" (opcional)
 */

const ENABLE_EVENTS = String(process.env.ENABLE_EVENTS || "").trim() === "1";
const EVENTS_TTL_HOURS = Number(process.env.EVENTS_TTL_HOURS || 24);
const EVENTS_FEEDS = (process.env.EVENTS_FEEDS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const TTL_MS = Math.max(1, EVENTS_TTL_HOURS) * 60 * 60 * 1000;
let cache = { ts: 0, data: [] };

function toISODateOnly(yyyymmdd) {
  const s = String(yyyymmdd || "");
  if (s.length < 8) return null;
  const y = s.slice(0, 4), m = s.slice(4, 6), d = s.slice(6, 8);
  const iso = `${y}-${m}-${d}T00:00:00Z`;
  const dt = new Date(iso);
  return isNaN(dt.getTime()) ? null : iso;
}
function toISOAny(s) {
  if (!s) return null;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString();
  const dateOnly = s.replace(/\D/g, "");
  if (dateOnly.length === 8) return toISODateOnly(dateOnly);
  return null;
}
function textAfterColon(line) {
  const i = line.indexOf(":");
  return i >= 0 ? line.slice(i + 1) : "";
}
function unescapeCDATA(t) {
  return String(t || "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
}
function normalize(ev) {
  return {
    title: String(ev.title || "Evento").slice(0, 140),
    start: toISOAny(ev.start) || new Date().toISOString(),
    venue: String(ev.venue || ev.location || "").slice(0, 140),
    source: String(ev.source || "")
  };
}

// ---- Parsers
function parseICS(text, source) {
  const lines = String(text || "").split(/\r?\n/);
  const out = [];
  let inEv = false, summary = "", dtStart = "", location = "";
  for (const raw of lines) {
    const line = raw.trim();
    if (line === "BEGIN:VEVENT") { inEv = true; summary = ""; dtStart = ""; location = ""; continue; }
    if (line === "END:VEVENT") {
      const startISO =
        (dtStart.includes("T") ? toISOAny(dtStart.replace("Z","")) : null) ||
        toISODateOnly(dtStart.replace(/\D/g, ""));
      if (startISO) out.push(normalize({ title: summary || "Evento", start: startISO, venue: location, source }));
      inEv = false; continue;
    }
    if (!inEv) continue;
    if (line.startsWith("SUMMARY")) summary = textAfterColon(line);
    else if (line.startsWith("DTSTART")) dtStart = textAfterColon(line);
    else if (line.startsWith("LOCATION")) location = textAfterColon(line);
  }
  return out;
}

function parseRSSorAtom(text, source) {
  const xml = String(text || "");
  const items = [];

  // RSS <item>
  const rssItemRe = /<item\b[\s\S]*?<\/item>/gi;
  const rssTitleRe = /<title\b[^>]*>([\s\S]*?)<\/title>/i;
  const rssDateRe = /<pubDate\b[^>]*>([\s\S]*?)<\/pubDate>|<dc:date\b[^>]*>([\s\S]*?)<\/dc:date>/i;
  const rssVenueRe = /<category\b[^>]*>([\s\S]*?)<\/category>|<author\b[^>]*>([\s\S]*?)<\/author>/i;

  let m;
  while ((m = rssItemRe.exec(xml))) {
    const block = m[0];
    const title = unescapeCDATA((block.match(rssTitleRe) || [,""])[1]);
    const dateRaw = (block.match(rssDateRe) || [,"",""])[1] || (block.match(rssDateRe) || [,"",""])[2] || "";
    const venue = unescapeCDATA((block.match(rssVenueRe) || [,""])[1] || "");
    const start = toISOAny(dateRaw) || new Date().toISOString();
    items.push(normalize({ title, start, venue, source }));
  }

  // Atom <entry>
  const entryRe = /<entry\b[\s\S]*?<\/entry>/gi;
  const entryTitleRe = /<title\b[^>]*>([\s\S]*?)<\/title>/i;
  const entryDateRe = /<updated\b[^>]*>([\s\S]*?)<\/updated>|<published\b[^>]*>([\s\S]*?)<\/published>/i;
  const entryVenueRe = /<category\b[^>]*label="([^"]+)"/i;

  while ((m = entryRe.exec(xml))) {
    const block = m[0];
    const title = unescapeCDATA((block.match(entryTitleRe) || [,""])[1]);
    const dateRaw = (block.match(entryDateRe) || [,"",""])[1] || (block.match(entryDateRe) || [,"",""])[2] || "";
    const venue = ((block.match(entryVenueRe) || [,""])[1] || "").trim();
    const start = toISOAny(dateRaw) || new Date().toISOString();
    items.push(normalize({ title, start, venue, source }));
  }

  return items;
}

function parseJSON(text, source) {
  try {
    const j = JSON.parse(String(text || "null"));
    const arr = Array.isArray(j) ? j : Array.isArray(j?.events) ? j.events : [];
    return arr.map(e => normalize({ ...e, source }));
  } catch { return []; }
}

async function fetchOne(url) {
  try {
    const res = await fetch(url, { method: "GET" });
    const text = await res.text();
    if (/BEGIN:VCALENDAR/.test(text) || /\.ics(\?|$)/i.test(url)) return parseICS(text, url);
    if (/<rss\b|<feed\b/i.test(text) || /\.xml(\?|$)/i.test(url)) return parseRSSorAtom(text, url);
    if (/^\s*[\[{]/.test(text)) return parseJSON(text, url);
    return [];
  } catch { return []; }
}

async function loadAll() {
  let out = [];
  if (ENABLE_EVENTS && EVENTS_FEEDS.length) {
    for (const u of EVENTS_FEEDS) {
      const items = await fetchOne(u);
      out = out.concat(items);
    }
  }
  if (!out.length) {
    // Fallback mínimo
    out = [
      { title: "Roda de Samba da Lapa", start: new Date().toISOString(), venue: "Arcos da Lapa", source: "fallback" },
      { title: "Feira de Lavradio", start: new Date(Date.now() + 86400000).toISOString(), venue: "Rua do Lavradio", source: "fallback" },
      { title: "Jazz na Praça", start: new Date(Date.now() + 2*86400000).toISOString(), venue: "Santa Teresa", source: "fallback" }
    ].map(normalize);
  }
  out.sort((a,b)=> new Date(a.start) - new Date(b.start));
  return out.slice(0, 60);
}

async function handler(_req, res) {
  try {
    const now = Date.now();
    if (now - cache.ts > TTL_MS) {
      cache.data = await loadAll();
      cache.ts = now;
    }
    res.json({ ok: true, events: cache.data });
  } catch {
    res.json({ ok: true, events: [] });
  }
}

module.exports = handler;
