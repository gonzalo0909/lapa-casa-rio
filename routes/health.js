"use strict";

const express = require("express");
const router = express.Router();

// GET /api/health
router.get("/", (_req, res) => {
  res.json({ ok: true, service: "lapa-casa-backend" });
});

module.exports = router;
