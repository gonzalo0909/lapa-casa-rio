// Agregador de eventos (Eventbrite + ICS) con caché en memoria
const crypto = require("crypto");
const fetch_ = global.fetch;

let cache = { key: "", ts: 0, data: [], ttlHours: 24 };

const { EVENTBRITE_TOKEN = "" } = process.env;
// acepta ambos nombres de env
const ICS_LIST = (process.env.EVENTS_ICS_URLS || process.env.EVENTS_FEEDS || "").split(",").map(s=>s.trim()).filter(Boolean);

function toISO(x) { const d = new Date(x); return isNaN(d) ? null : d.toISOString(); }
function hash(s) { return crypto.createHash("sha1").update(String(s)).digest("hex").slice(0, 12); }
function keyFor(from, to, limit) { return [from.toISOString().slice(0,10), to.toISOString().slice(0,10), limit].join("|"); }
function withinTTL(ts, ttlHours) { return (Date.now() - ts) < ttlHours * 3600 * 1000; }
function getCacheInfo() { return { items: cache.data.length, age_s: Math.floor((Date.now() - cache.ts) / 1000), ttl_h: cache.ttlHours }; }

async function getEvents({ from = new Date(), to = new Date(Date.now()+30*864e5), limit = 50, refresh = false, ttlHours = 24 } = {}) {
  const k = keyFor(from, to, limit);
  if (!refresh && cache.key === k && withinTTL(cache.ts, cache.ttlHours)) return cache.data.slice(0, limit);
  const list = [];
  if (EVENTBRITE_TOKEN) {
    try { list.push(...await fromEventbrite({ from, to, limit })); }
    catch (e) { console.warn("[events] Eventbrite:", e.message); }
  }
  for (const url of ICS_LIST) {
    try {
      const ics = await (await fetch_(url)).text();
      const evs = parseICS(ics).map(e => normalize({
        title: e.title || "Evento", start: e.start, end: e.end || e.start,
        url: e.url || url, venue: e.venue || "", source: "ics",
        price: "", district: "", category: "general"
      }));
      list.push(...evs);
    } catch (e) { console.warn("[events] ICS falló", url, e.message); }
  }
  const dedup = deduplicate(list)
    .filter(e => new Date(e.start) <= to && new Date(e.end || e.start) >= from)
    .sort((a,b) => new Date(a.start) - new Date(b.start))
    .slice(0, limit);
  cache = { key: k, ts: Date.now(), data: dedup, ttlHours };
  return dedup;
}

async function fromEventbrite({ from, to, limit }) {
  const qs = new URLSearchParams({
    "location.address": "Rio de Janeiro",
    "expand": "venue",
    "start_date.range_start": new Date(from.getTime() - 3 * 3600e3).toISOString(),
    "start_date.range_end":   new Date(to.getTime() + 3 * 3600e3).toISOString(),
    "page": "1", "sort_by": "date",
  });
  const r = await fetch_(`https://eventbriteapi.com/v3/events/search/?${qs}`, {
    headers: { Authorization: `Bearer ${EVENTBRITE_TOKEN}` }
  });
  if (!r.ok) throw new Error(`Eventbrite ${r.status}`);
  const j = await r.json();
  return (j.events || []).slice(0, limit).map(ev => normalize({
    title: ev.name?.text || "Evento",
    start: ev.start?.utc || ev.start?.local,
    end:   ev.end?.utc || ev.end?.local || ev.start?.utc,
    url:   ev.url,
    venue: ev.venue?.name || "",
    source: "eventbrite",
    price:  ev.is_free ? "Gratis" : "",
    district: ev.venue?.address?.city || "Rio de Janeiro",
    category: ev.category_id || "general",
  }));
}

function normalize(e) {
  return {
    id: e.id || hash(`${e.source}|${e.url || ""}|${e.title}|${e.start}`),
    title: (e.title || "Evento").trim(),
    start: toISO(e.start), end: toISO(e.end || e.start),
    venue: e.venue || "", district: e.district || "",
    url: e.url || "", category: e.category || "general",
    price: e.price || "", source: e.source || "unknown",
  };
}
function deduplicate(list) {
  const seen = new Set(); const out = [];
  for (const e of list) {
    const key = `${(e.title||"").toLowerCase()}|${(e.start||"").slice(0,10)}|${e.venue}|${e.url}`;
    if (seen.has(key)) continue; seen.add(key); out.push(e);
  }
  return out;
}
// ICS parser (simple)
function parseICS(icsText) {
  const icsToIso = (v) => {
    if (!v) return null;
    if (/^\d{8}$/.test(v)) return `${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}T00:00:00Z`;
    if (/^\d{8}T\d{6}Z$/.test(v)) {
      const y=v.slice(0,4),m=v.slice(4,6),d=v.slice(6,8),hh=v.slice(9,11),mm=v.slice(11,13),ss=v.slice(13,15);
      return `${y}-${m}-${d}T${hh}:${mm}:${ss}Z`;
    }
    const dt = new Date(v); return isNaN(dt) ? null : dt.toISOString();
  };
  const lines = (icsText || "").replace(/\r/g, "").split("\n");
  const unfold = [];
  for (let i=0;i<lines.length;i++) { const L=lines[i]; if (L.startsWith(" ")||L.startsWith("\t")) unfold[unfold.length-1]+=L.slice(1); else unfold.push(L); }
  const out=[]; let cur=null; const commit=()=>{ if(cur) out.push(cur); cur=null; };
  for (const L of unfold) {
    if (L==="BEGIN:VEVENT") cur={};
    else if (L==="END:VEVENT") commit();
    else if (cur) {
      const [k,...rest]=L.split(":"); const v=rest.join(":"); const key=k.toUpperCase();
      if (key.startsWith("DTSTART")) cur.start=icsToIso(v);
      else if (key.startsWith("DTEND")) cur.end=icsToIso(v);
      else if (key==="SUMMARY") cur.title=v;
      else if (key==="UID") cur.uid=v;
      else if (key==="URL") cur.url=v;
      else if (key==="LOCATION") cur.venue=v;
    }
  }
  return out.filter(e => e.start);
}

module.exports = { getEvents, getCacheInfo };
