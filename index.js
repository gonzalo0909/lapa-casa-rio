"use strict";

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---- Rutas estáticas (web y reservas)
app.use("/", express.static(path.join(__dirname, "public")));
app.use("/book", express.static(path.join(__dirname, "public/book")));

// ---- Servicios
app.use("/webhooks/mp", require("./services/webhook_mp"));
app.use("/webhooks/stripe", require("./services/webhook_stripe"));
app.use("/services/events", require("./services/events"));

// ---- Salud
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "lapa-casa-backend", ts: Date.now() });
});

// ---- Arranque
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("✅ Backend escuchando en puerto " + PORT);
});
