// ====== AVAILABILITY (stub válido para el front)
app.get(["/availability", "/api/availability"], (req, res) => {
  const from = String(req.query.from || "").slice(0, 10);
  const to   = String(req.query.to   || "").slice(0, 10);
  if (!from || !to) {
    return res.status(400).json({ ok:false, error:"missing_from_to" });
  }
  // Respuesta mínima válida: sin camas ocupadas
  return res.json({
    ok: true,
    from,
    to,
    occupied: {} // { "1":[1,2], "3":[...], ... } si luego lo conectamos a Sheets
  });
});
