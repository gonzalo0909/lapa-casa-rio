/******************************
 * Lapa Casa Backend – versión limpia
 ******************************/

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// === RUTA TEST ===
app.get("/", (req, res) => {
  res.json({ ok: true, message: "Backend activo" });
});

// === CONFIRMAR HOLD ===
app.post(["/holds/confirm", "/api/holds/confirm"], async (req, res) => {
  try {
    const { booking_id, nombre, email, telefono, entrada, salida, hombres, mujeres, camas, total, pay_status } = req.body;

    if (!booking_id) {
      return res.status(400).json({ ok: false, error: "booking_id requerido" });
    }

    // Ejemplo: enviar a Google Sheets (puedes conectar aquí tu lógica)
    console.log("Reserva confirmada:", { booking_id, nombre, entrada, salida, total, pay_status });

    res.json({ ok: true, message: "Reserva confirmada y enviada a Sheets", booking_id });
  } catch (err) {
    console.error("Error confirmando hold:", err);
    res.status(500).json({ ok: false, error: "Error interno" });
  }
});

// === PUERTO ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
