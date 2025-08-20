"use strict";
const express = require("express");
const router = express.Router();

router.post("/login", (req, res) => {
  // Placeholder: implementar autenticación real con ADMIN_USER/ADMIN_PASS si querés
  res.json({ ok: true, login: "placeholder" });
});

router.post("/logout", (_req, res) => {
  res.json({ ok: true, logout: true });
});

module.exports = router;
