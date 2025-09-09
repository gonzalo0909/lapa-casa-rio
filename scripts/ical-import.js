"use strict";

/**
 * scripts/ical-import.js
 * Importa iCal de OTAs y genera bloqueos externos (en Redis como shadow holds).
 * Ejecutar cada 15 min (Render Cron).
 */

const ical = require("node-ical");
const { createClient } = require("redis");

const REDIS_URL = process.env.REDIS_URL;
const SOURCES = (process.env.OTA_ICAL_URLS || "").split(",").map(s => s.trim()).filter(Boolean); // ej: "https://...airbnb.ics,https://...booking.ics"
const PREFIX = "external:"; // clave: external:UID

async function main() {
  if (!REDIS_URL) throw new Error("REDIS_URL not set");
  if (!SOURCES.length) {
    console.log("No OTA_ICAL_URLS configured, skipping");
    return;
  }
  const redis = createClient({ url: REDIS_URL });
  redis.on("error", (e) => console.error("Redis error:", e));
  await redis.connect();

  const seen = new Set();
  for (const url of SOURCES) {
    try {
      const data = await ical.async.fromURL(url);
      for (const k of Object.keys(data)) {
        const ev = data[k];
        if (!ev || ev.type !== "VEVENT") continue;
        const uid = String(ev.uid || ev.uidGenerator || `${ev.summary}-${ev.start?.toISOString()}`).trim();
        if (!uid) continue;
        seen.add(`${PREFIX}${uid}`);

        const inYMD = toYMD(ev.start);
        const outYMD = toYMD(ev.end);
        const payload = {
          uid,
          entrada: inYMD,
          salida: outYMD,
          source: "ota_ical",
          summary: String(ev.summary || "").slice(0, 140)
        };
        await redis.set(`${PREFIX}${uid}`, JSON.stringify(payload), { EX: 60 * 60 * 24 * 60 }); // 60 días
      }
    } catch (e) {
      console.error("[ICAL IMPORT]", url, e.message);
    }
  }

  // Limpieza ligera: borra entradas externas que ya no aparezcan en fuentes (ciclo corto)
  try {
    const keys = await redis.keys(`${PREFIX}*`);
    for (const k of keys) {
      if (!seen.has(k)) {
        // No borrar inmediatamente: marcar "stale" por 24h
        const val = await redis.get(k);
        if (!val) continue;
        const obj = JSON.parse(val);
        obj.stale = true;
        await redis.set(k, JSON.stringify(obj), { EX: 60 * 60 * 24 });
      }
    }
  } catch (e) {
    console.error("[ICAL CLEANUP]", e.message);
  }

  await redis.disconnect();
}

function toYMD(dt) {
  if (!dt) return "";
  const d = new Date(dt);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { main };
