"use strict";
const express = require("express");
const { getEvents } = require("../services/events");
const router = express.Router();

router.get("/", async (_req, res) => {
  const events = await getEvents();
  res.json({ ok: true, events });
});

module.exports = router;
