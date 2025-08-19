"use strict";
/**
 * /public/js/book.js — demo opcional; usa endpoints actuales
 */
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("bookingForm");
  const btnStripe = document.getElementById("payStripe");
  const btnMP     = document.getElementById("payMP");

  async function api(url, data={}) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  }

  async function startBooking(payMethod) {
    const data = {
      entrada : form.entrada.value,
      salida  : form.salida.value,
      nombre  : form.nombre.value,
      email   : form.email.value,
      telefono: form.telefono.value,
      hombres : Number(form.hombres.value||0),
      mujeres : Number(form.mujeres.value||0),
      camas   : {}, // tu UI debería llenar esto
    };

    try {
      const hold = await fetch("/holds/start", {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ ...data, holdId:`BKG-${Date.now()}`, total: 1 }) // total real debe venir de UI
      }).then(r=>r.json());

      if (!hold.ok) return alert("⚠️ Error creando HOLD: " + (hold.error||""));

      const booking_id = hold.holdId;

      if (payMethod === "stripe") {
        const r = await api("/payments/stripe/session", { order:{ booking_id } });
        if (r?.url) window.location.href = r.url;
      } else if (payMethod === "mp") {
        const r = await api("/payments/mp/preference", { order:{ booking_id } });
        if (r?.init_point) window.location.href = r.init_point;
      }
    } catch (err) {
      console.error(err);
      alert("❌ Error conectando con servidor");
    }
  }

  if (form) {
    form.addEventListener("submit", e => {
      e.preventDefault();
      alert("👉 Elegí método de pago abajo (Stripe o MP).");
    });
  }
  if (btnStripe) btnStripe.addEventListener("click", ()=> startBooking("stripe"));
  if (btnMP)     btnMP.addEventListener("click", ()=> startBooking("mp"));
});
