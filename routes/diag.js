"use strict";

const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    ok: true,
    now: new Date().toISOString(),
    commit: process.env.COMMIT_SHA || "dev",
    env: {
      STRIPE: !!process.env.STRIPE_SK,
      MP: !!process.env.MP_ACCESS_TOKEN,
      SHEETS: !!process.env.BOOKINGS_WEBAPP_URL
    }
  });
});

module.exports = router;
