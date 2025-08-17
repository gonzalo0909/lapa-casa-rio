"use strict";
const { ROOMS, overlaps } = require("./availability");
const { upsertPaid } = require("./sheets");

const TTL_MIN = Number(process.env.HOLD_TTL_MINUTES || 10);
const CRON_TOKEN = process.env.CRON_TOKEN || "";
const holds = new Map(); // holdId -> { entrada, salida, camas:{roomId:[beds]}, expiresAt, ...payload }

function now() { return Date.now(); }
function ttl() { return now() + TTL_MIN * 60 * 1000; }

function normalizeCamas(camas = {}) {
  const out = {};
  for (const k of ["1", "3", "5", "6"]) {
    const cap = ROOMS[Number(k)];
    const arr = Array.isArray(camas[k]) ? camas[k] : [];
    const clean = arr.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n >= 1 && n <= cap);
    out[k] = Array.from(new Set(clean)).sort((a, b) => a - b);
  }
  return out;
}

function occupiedFromHoldsRange(fromISO, toISO) {
  const occ = { "1": [], "3": [], "5": [], "6": [] };
  for (const h of holds.values()) {
    if (h.expiresAt <= now()) continue;
    if (!overlaps(fromISO, toISO, h.entrada, h.salida)) continue;
    const camas = h.camas || {};
    for (const k of ["1", "3", "5", "6"]) occ[k].push(...(camas[k] || []));
  }
  for (const k of Object.keys(occ)) {
    occ[k] = Array.from(new Set(occ[k])).sort((a, b) => a - b);
  }
  return occ;
}

function collides(entrada, salida, camas) {
  // verificar colisión contra otros holds vigentes
  for (const [_, h] of holds) {
    if (h.expiresAt <= now()) continue;
    if (!overlaps(entrada, salida, h.entrada, h.salida)) continue;
    for (const k of ["1", "3", "5", "6"]) {
      const set = new Set(h.camas[k] || []);
      for (const bed of camas[k] || []) {
        if (set.has(bed)) return true;
      }
    }
  }
  return false;
}

async function start(req, res) {
  try {
    const { holdId, entrada, salida, camas = {}, nombre = "", email = "", telefono = "", hombres = 0, mujeres = 0, total = 0 } = req.body || {};
    if (!holdId || !entrada || !salida) return res.status(400).json({ ok: false, error: "faltan_campos" });

    const norm = normalizeCamas(camas);
    if (collides(entrada, salida, norm)) return res.status(409).json({ ok: false, error: "collision" });

    holds.set(holdId, {
      holdId, entrada, salida,
      camas: norm,
      nombre, email, telefono, hombres, mujeres, total,
      expiresAt: ttl(),
    });
    return res.json({ ok: true, holdId, expiresAt: holds.get(holdId).expiresAt });
  } catch (e) {
    console.error("holds.start", e);
    res.status(500).json({ ok: false, error: "hold_start_failed" });
  }
}

async function release(req, res) {
  try {
    const { holdId } = req.body || {};
    if (!holdId) return res.status(400).json({ ok: false, error: "holdId_requerido" });
    holds.delete(holdId);
    return res.json({ ok: true });
  } catch (e) {
    console.error("holds.release", e);
    res.status(500).json({ ok: false, error: "hold_release_failed" });
  }
}

async function confirm(req, res) {
  try {
    const { holdId, status = "paid" } = req.body || {};
    if (!holdId) return res.status(400).json({ ok: false, error: "holdId_requerido" });
    const h = holds.get(holdId);
    if (!h) return res.status(404).json({ ok: false, error: "hold_not_found" });

    if (String(status).toLowerCase() === "paid") {
      await upsertPaid({
        booking_id: holdId,
        nombre: h.nombre, email: h.email, telefono: h.telefono,
        entrada: h.entrada, salida: h.salida,
        hombres: h.hombres, mujeres: h.mujeres,
        camas: h.camas, total: h.total,
      });
    }
    holds.delete(holdId);
    return res.json({ ok: true });
  } catch (e) {
    console.error("holds.confirm", e);
    res.status(500).json({ ok: false, error: "hold_confirm_failed" });
  }
}

async function sweep(req, res) {
  try {
    const token = String(req.query.token || "");
    if (!CRON_TOKEN || token !== CRON_TOKEN) return res.status(401).json({ ok: false, error: "unauthorized" });
    const ts = now();
    let removed = 0;
    for (const [id, h] of holds) {
      if (h.expiresAt <= ts) { holds.delete(id); removed++; }
    }
    return res.json({ ok: true, removed, ts });
  } catch (e) {
    console.error("holds.sweep", e);
    res.status(500).json({ ok: false, error: "holds_sweep_failed" });
  }
}

function provideOccupied({ fromISO, toISO }) {
  return occupiedFromHoldsRange(fromISO, toISO);
}

module.exports = { start, release, confirm, sweep, provideOccupied };
