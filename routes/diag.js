// routes/diag.js
"use strict";

const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  const envKeys = [
    "BASE_URL",
    "BOOKINGS_WEBAPP_URL",
    "MP_ACCESS_TOKEN",
    "STRIPE_SK",
    "STRIPE_WEBHOOK_SECRET",
    "ADMIN_USER",
    "ADMIN_PASS",
    "CRON_TOKEN",
    "HOLD_TTL_MINUTES",
  ];

  const env = {};
  envKeys.forEach((k) => {
    env[k] = process.env[k] ? true : false;
  });

  res.json({
    ok: true,
    commit: process.env.COMMIT_HASH || "dev",
    now: new Date().toISOString(),
    env,
  });
});

module.exports = router;
