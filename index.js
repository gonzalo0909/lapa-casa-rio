// ✅ Reemplazar COMPLETO este endpoint en index.js
app.post(["/holds/confirm","/api/holds/confirm"], rateLimit(60), async (req, res) => {
  try {
    const b = req.body || {};
    const holdId    = String(b.holdId || "").trim();
    const newStatus = String(b.status  || "paid").trim(); // paid | pending

    if (!holdId) return res.status(400).json({ ok:false, error:"missing_holdId" });

    // Campos opcionales para completar/actualizar la fila en Sheets
    // (si no vienen, el Apps Script mantiene los existentes)
    const payload = {
      action:      "upsert_booking",
      booking_id:  holdId,
      pay_status:  newStatus
    };

    // Solo agregamos los campos que el front envíe
    const passthroughFields = [
      "nombre","email","telefono","entrada","salida",
      "hombres","mujeres","total","camas","camas_json"
    ];
    for (const k of passthroughFields) {
      if (typeof b[k] !== "undefined" && b[k] !== null) {
        // normalizamos camas -> camas_json
        if (k === "camas") {
          payload.camas_json = JSON.stringify(b.camas || {});
        } else {
          payload[k] = b[k];
        }
      }
    }

    // Upsert final: marca paid y escribe datos reales (si vinieron)
    const j = await postToSheets(payload);

    // Limpiamos el HOLD en memoria del backend
    holdsMem.delete(holdId);
    invalidateAvailabilityCache();

    return res.status(j?.ok ? 200 : 500).json({
      ok: !!j?.ok,
      holdId,
      status: newStatus,
      msg: j?.message || "confirm_done"
    });
  } catch (e) {
    logPush("hold_confirm_error", { msg: e?.message || String(e) });
    return res.status(500).json({ ok:false, error:"hold_confirm_failed" });
  }
});
