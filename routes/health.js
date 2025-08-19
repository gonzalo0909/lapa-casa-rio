"use strict";
const express = require("express");
const router = express.Router();

router.get("/", (_req, res) => {
  res.json({
    ok: true,
    now: new Date().toISOString(),
    commit: process.env.COMMIT_SHA || process.env.COMMIT || "dev",
    env: {
      STRIPE: !!(process.env.STRIPE_SK || process.env.STRIPE_SECRET_KEY),
      MP: !!process.env.MP_ACCESS_TOKEN,
      SHEETS: !!process.env.BOOKINGS_WEBAPP_URL,
    },
  });
});

module.exports = router;
