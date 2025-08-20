"use strict";
const express = require("express");
const router = express.Router();
const { sweepExpired } = require("../services/holds");

router.get("/holds-sweep", (req, res) => {
  const token = req.query.token || req.headers["x-cron-token"];
  const expected = process.env.CRON_TOKEN;
  if (expected && token !== expected) return res.status(403).json({ ok: false, error: "forbidden" });
  sweepExpired();
  res.json({ ok: true, action: "holds-sweep" });
});

module.exports = router;
