"use strict";

const express = require("express");
const router = express.Router();

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "1234";

router.post("/login", (req, res) => {
  const { user, pass } = req.body || {};
  if ((user||"").trim() === ADMIN_USER && (pass||"") === ADMIN_PASS) {
    req.session = { logged: true, ts: Date.now() };
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false, error: "invalid_credentials" });
});

router.post("/logout", (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

module.exports = router;
