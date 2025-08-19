"use strict";

const express = require("express");
const router = express.Router();
const { sweepExpired } = require("../services/holds");

const CRON_TOKEN = (process.env.CRON_TOKEN || "").trim();

// GET /crons/holds-sweep?token=...
router.get("/holds-sweep", (req,res)=>{
  const tok = String(req.query?.token||"");
  if (!CRON_TOKEN || tok !== CRON_TOKEN) return res.status(401).json({ ok:false, error:"unauthorized" });
  const out = sweepExpired();
  res.json({ ok:true, ...out });
});

module.exports = router;
