"use strict";

/* Index delgado: configura middlewares, estáticos y monta rutas. */
require("dotenv").config();

const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");

const app = express();
app.set("trust proxy", 1);

/* ===== Seguridad / CORS / Sesión */
app.use(helmet({ crossOriginResourcePolicy: false }));

const allowList = String(process.env.CORS_ALLOW_ORIGINS || "")
  .split(",").map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (!allowList.length) return cb(null, true);
    return cb(null, allowList.includes(origin) ? true : false);
  },
  credentials: true,
  methods: ["GET","POST","OPTIONS"],
  allowedHeaders: ["Content-Type","Stripe-Signature"]
}));

const session = require("./middleware/session");
app.use(session);

/* ===== Webhooks (Stripe necesita body RAW) */
app.use("/webhooks/mp", express.json({ limit: "2mb", type: "*/*" })); // solo MP JSON
app.use("/webhooks", require("./routes/webhooks"));

/* ===== Parsers generales (después de /webhooks para no romper Stripe) */
app.use(express.json({ limit: "2mb" }));

/* ===== Estáticos */
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

/* ===== Rutas API */
app.use("/api/health", require("./routes/health"));
app.use("/api/availability", require("./routes/availability"));
app.use("/availability", require("./routes/availability"));           // alias
app.use("/api/events", require("./routes/events"));

app.use("/api/holds", require("./routes/holds"));
app.use("/holds", require("./routes/holds"));                          // alias

app.use("/api/bookings", require("./routes/bookings"));

/* ===== Pagos (endpoints usados por el front) */
const { createCheckoutSession } = require("./services/payments-stripe");
const { createPreference } = require("./services/payments-mp");

const BASE_URL = (process.env.BASE_URL || "").replace(/\/+$/,"") || "http://localhost:3000";

app.post("/payments/stripe/session", async (req, res) => {
  try {
    const order = Object(req.body?.order || req.body || {});
    if (!("total" in order)) return res.status(400).json({ ok:false, error:"missing_total" });
    const out = await createCheckoutSession(order, { baseUrl: BASE_URL });
    res.json({ ok:true, ...out });
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e.message||e) });
  }
});

app.post("/payments/mp/preference", async (req, res) => {
  try {
    const order = Object(req.body?.order || req.body || {});
    if (!("total" in order)) return res.status(400).json({ ok:false, error:"missing_total" });
    const out = await createPreference(order, { baseUrl: BASE_URL });
    res.json({ ok:true, ...out });
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e.message||e) });
  }
});

/* ===== Cron holds sweep (para GAS) */
const { sweepExpired } = require("./services/holds");
app.get("/api/crons/holds-sweep", (req, res) => {
  const tok = String(req.query?.token || "");
  const CRON_TOKEN = String(process.env.CRON_TOKEN || "").trim();
  if (!CRON_TOKEN || tok !== CRON_TOKEN) return res.status(401).json({ ok:false, error:"unauthorized" });
  res.json({ ok:true, ...sweepExpired() });
});

/* ===== Admin (login/logout por sesión) */
app.use("/admin", require("./routes/admin"));

/* ===== 404 SPA-ish (GET sin extensión → index.html de /public) */
app.use((req, res, next) => {
  if (req.method !== "GET" || path.extname(req.path)) return next();
  const file = path.join(__dirname, "public", req.path, "index.html");
  res.sendFile(file, err => err ? res.status(404).send("Not found") : undefined);
});

/* ===== Start */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[lapa-casa] up :${PORT}`));

module.exports = app;
