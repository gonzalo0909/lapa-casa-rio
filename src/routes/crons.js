"use strict";
const express = require("express");
const router = express.Router();

router.get("/holds-sweep", (req, res) => {
  res.json({ ok: true, cron: "holds-sweep done" });
});

module.exports = router;
