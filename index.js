
"use strict";
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Middlewares =====
app.use(helmet());
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== Static (front-end) =====
app.use(express.static(path.join(__dirname, "public")));

// ===== Routes =====
app.use("/api/payments", require("./routes/payments"));   // Stripe + MP
app.use("/api/webhooks", require("./routes/webhooks"));   // Webhooks
app.use("/api/diag", require("./routes/diag"));           // Diagnóstico
app.use("/api/bookings", require("./routes/bookings"));   // Reservas
app.use("/api/events", require("./routes/events"));       // Eventos
app.use("/api/holds", require("./routes/holds"));         // Holds (anti-overbooking)
app.use("/admin", require("./routes/admin"));             // Panel admin

// ===== Fallback =====
app.use((req, res) => {
  res.status(404).json({ ok: false, error: "not_found" });
});

// ===== Server =====
app.listen(PORT, () => {
  console.log(`✅ Lapa Casa backend online en puerto ${PORT}`);
});
