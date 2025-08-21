// FILE: backend/routes/payments.js
"use strict";

const express = require("express");
const { MercadoPagoConfig, Preference } = require("mercadopago");

const router = express.Router();

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

// Ruta de prueba de pago
router.post("/mp", async (req, res) => {
  try {
    const { total } = req.body;
    if (!total) return res.status(400).json({ error: "missing_total" });

    const preference = await new Preference(client).create({
      body: {
        items: [
          { title: "Reserva Lapa Casa Hostel", quantity: 1, currency_id: "BRL", unit_price: Number(total) }
        ],
        back_urls: {
          success: `${process.env.FRONTEND_URL}/success`,
          failure: `${process.env.FRONTEND_URL}/failure`,
          pending: `${process.env.FRONTEND_URL}/pending`
        },
        auto_return: "approved"
      }
    });

    res.json({ id: preference.id, init_point: preference.init_point });
  } catch (err) {
    console.error("MP error:", err);
    res.status(500).json({ error: "mp_error" });
  }
});

module.exports = router;
