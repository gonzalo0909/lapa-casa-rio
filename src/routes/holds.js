"use strict";
const express = require("express");
const router = express.Router();

router.post("/", (req, res) => {
  res.json({ ok: true, hold: req.body || {} });
});

module.exports = router;
