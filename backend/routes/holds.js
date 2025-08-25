"use strict";
const express = require("express");
const router = express.Router();

/** Mock store en memoria (reemplazar por DB) */
const _holds = new Map(); // holdId -> { holdId, entrada, salida, camas, status }

function nowPlus(minutes) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

/* ===== PUBLIC: crear HOLD ===== */
router.post("/start", (req, res) => {
  try {
    const body = req.body || {};
    const holdId = body.holdId || `HOLD-${Date.now()}`;
    const item = {
      holdId,
      entrada: body.entrada,
      salida: body.salida,
      camas: body.camas || {},
      status: "hold",
      expiresAt: nowPlus(10),
    };
    _holds.set(holdId, item);
    return res.json({ ok: true, holdId, expiresAt: item.expiresAt });
  } catch (e) {
    return res.status(400).json({ ok: false, error: "bad_request" });
  }
});

/* ===== ADMIN: listar holds ===== */
async function list(_req, res) {
  const holds = Array.from(_holds.values());
  return res.json({ ok: true, holds });
}

/* ===== ADMIN: confirmar hold (marca paid/confirmed) ===== */
async function confirm(req, res) {
  const { holdId, status = "paid" } = req.body || {};
  const it = _holds.get(holdId);
  if (!it) return res.status(404).json({ ok: false, error: "not_found" });
  it.status = status;
  _holds.set(holdId, it);
  return res.json({ ok: true, holdId, status: it.status });
}

/* ===== ADMIN: liberar hold ===== */
async function release(req, res) {
  const { holdId } = req.body || {};
  const it = _holds.get(holdId);
  if (!it) return res.status(404).json({ ok: false, error: "not_found" });
  _holds.delete(holdId);
  return res.json({ ok: true, holdId, released: true });
}

module.exports = {
  router,
  list,
  confirm,
  release,
};
