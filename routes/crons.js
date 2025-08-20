// routes/crons.js
"use strict";
const express = require("express");
const router = express.Router();
const holds = require("../services/holds");

const CRON_TOKEN = process.env.CRON_TOKEN || "";

router.post("/holds-sweep", (req,res)=>{
  const token = req.headers["x-cron-token"] || req.query.token || "";
  if (CRON_TOKEN && token !== CRON_TOKEN) return res.status(401).json({ ok:false, error:"unauthorized" });
  const swept = holds.sweepExpired();
  res.json({ ok:true, swept });
});

module.exports = router;
