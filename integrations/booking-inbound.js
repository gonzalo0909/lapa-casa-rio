// Inbound Email → Google Sheets (GAS) con idempotencia
module.exports = function registerInbound(app) {
  const { INBOUND_TOKEN = "", SHEETS_APP_URL = "" } = process.env;

  const recent = new Set();
  const queue = [];
  const remember = (id) => {
    recent.add(id);
    queue.push(id);
    if (queue.length > 500) recent.delete(queue.shift());
  };

  app.post("/webhooks/inbound-email", async (req, res) => {
    try {
      if (!INBOUND_TOKEN || req.query.token !== INBOUND_TOKEN) {
        return res.status(401).json({ ok: false, error: "Token inválido" });
      }
      const payload = normalizeInbound(req);
      const booking = toBooking(payload);

      if (!booking.booking_id) throw new Error("No se pudo generar booking_id");
      if (recent.has(booking.booking_id)) return res.json({ ok: true, deduped: true, booking_id: booking.booking_id });

      if (SHEETS_APP_URL) {
        const url = `${SHEETS_APP_URL}?action=upsert_booking`;
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(booking),
        });
        if (!r.ok) throw new Error(`Sheets ${r.status}`);
        const j = await r.json().catch(() => ({}));
        if (j && j.ok === false) throw new Error(j.error || "Sheets error");
      }
      remember(booking.booking_id);
      return res.json({ ok: true, booking_id: booking.booking_id });
    } catch (err) {
      return res.status(500).json({ ok: false, error: String(err) });
    }
  });
};

function normalizeInbound(req) {
  const b = req.body || {};
  const from = b.from || b.sender || "";
  const to = b.to || "";
  const subject = b.subject || "";
  const text = b.text || b.plain || (b.email && String(b.email)) || "";
  const html = b.html || "";
  return { from, to, subject, text, html, raw: b };
}

function toBooking(p) {
  const now = new Date();
  const name = (p.from || "").split("<")[0].trim() || "Huésped";
  const emailMatch = (p.from || "").match(/<([^>]+)>/);
  const email = emailMatch ? emailMatch[1] : "";

  const dates = extractDates(p.text || p.html || "");
  const entrada = dates[0] || isoDate(now);
  const salida = dates[1] || isoDate(new Date(now.getTime() + 864e5));
  const hombres = extractNumber((p.text || ""), /(hombres|men):?\s*(\d+)/i);
  const mujeres = extractNumber((p.text || ""), /(mujeres|women):?\s*(\d+)/i);

  const baseId = `${(p.subject || "").trim()}|${email}|${entrada}|${salida}`.toLowerCase();
  const booking_id = sha1(baseId).slice(0, 12);

  return {
    booking_id,
    nombre: name || "Huésped",
    email: email || "",
    telefono: "",
    entrada, salida,
    hombres: typeof hombres === "number" ? String(hombres) : "0",
    mujeres: typeof mujeres === "number" ? String(mujeres) : "0",
    camas_json: "[]",
    total: "0",
    pay_status: "pending",
    created_at: new Date().toISOString(),
  };
}

function extractDates(text) {
  if (!text) return [];
  const out = [];
  const m1 = text.match(/(\d{2})\/(\d{2})\/(\d{4})/g);
  if (m1) for (const t of m1) { const [d,m,y]=t.split("/"); out.push(`${y}-${m}-${d}`); }
  const m2 = text.match(/(\d{4})-(\d{2})-(\d{2})/g);
  if (m2) out.push(...m2);
  return out.slice(0, 2).map(s => s.length > 10 ? s.slice(0,10) : s);
}
function extractNumber(text, re) {
  const m = text.match(re);
  if (!m) return null;
  const n = parseInt(m[2] || m[1], 10);
  return isNaN(n) ? null : n;
}
function sha1(s) { return require("crypto").createHash("sha1").update(String(s)).digest("hex"); }
function isoDate(d) { return new Date(d).toISOString().slice(0, 10); }
