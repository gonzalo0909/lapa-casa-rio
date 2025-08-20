"use strict";
const express = require("express");
const router = express.Router();

router.post("/login", (req, res) => {
  res.json({ ok: true, login: "placeholder" });
});

router.post("/logout", (req, res) => {
  res.json({ ok: true, logout: true });
});

module.exports = router;
