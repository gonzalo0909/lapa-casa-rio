// routes/health.js
"use strict";
const express = require("express");
const router = express.Router();

router.get("/", (_req,res)=>{
  res.json({ ok:true, service:"health", ts:Date.now() });
});

module.exports = router;
