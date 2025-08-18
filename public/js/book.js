"use strict";
/**
 * /public/js/book.js — Front de reservas Lapa Casa
 */
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("bookingForm");
  const btnStripe = document.getElementById("payStripe");
  const btnMP     = document.getElementById("payMP");

  async function api(path, data={}) {
    const res = await fetch(`/api/${path}`, {
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
      camas   : {}, // se completará con selección UI
    };

    try {
      // 1. Crear reserva provisional (HOLD)
      const hold = await api("bookings", { action:"hold", ...data });
      if (!hold.ok) return alert("⚠️ Error creando reserva: " + hold.error);

      const booking_id = hold.booking_id;
      const total = hold.total;

      // 2. Redirigir a pago
      if (payMethod === "stripe") {
        const r = await api("payments/stripe", { booking_id, total });
        if (r?.url) window.location.href = r.url;
      }
      else if (payMethod === "mp") {
        const r = await api("payments/mp", { booking_id, total });
        if (r?.url) window.location.href = r.url;
      }

    } catch (err) {
      console.error(err);
      alert("❌ Error conectando con servidor");
    }
  }

  if (form) {
    form.addEventListener("submit", e => {
      e.preventDefault();
      alert("👉 Elige método de pago abajo (Stripe o MP).");
    });
  }
  if (btnStripe) btnStripe.addEventListener("click", ()=> startBooking("stripe"));
  if (btnMP)     btnMP.addEventListener("click", ()=> startBooking("mp"));
});
