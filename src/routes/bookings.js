"use strict";
const express = require("express");
const router = express.Router();

router.post("/", (req, res) => {
  res.json({ ok: true, booking: req.body || {} });
});

module.exports = router;
