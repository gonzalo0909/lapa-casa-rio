"use strict";

(async function () {
  const $ = (id) => document.getElementById(id);

  const entrada = $("entrada");
  const salida = $("salida");
  const btnCheck = $("btnCheck");
  const availabilityBox = $("availability");
  const availabilityJson = $("availabilityJson");
  const btnHold = $("btnHold");
  const paymentBox = $("payment");
  const btnStripe = $("btnStripe");
  const btnMP = $("btnMP");
  const payHint = $("payHint");
  const resultBox = $("result");
  const resultJson = $("resultJson");

  let lastHold = null;
  let lastOrder = null;

  btnCheck.addEventListener("click", async () => {
    try {
      const from = entrada.value;
      const to = salida.value;
      if (!from || !to) throw new Error("Selecciona entrada y salida");
      const data = await ApiClient.getAvailability(from, to);
      availabilityJson.textContent = JSON.stringify(data, null, 2);
      availabilityBox.hidden = false;
      btnHold.disabled = false;
      resultBox.hidden = true;
      paymentBox.hidden = true;
    } catch (e) {
      alert("Error: " + e.message);
    }
  });

  btnHold.addEventListener("click", async () => {
    try {
      const from = entrada.value;
      const to = salida.value;
      // demo: bloquea cama 2 en room 1
      const camas = { "1": [2] };
      const total = 100; // demo
      const resp = await ApiClient.startHold({ entrada: from, salida: to, camas, total, hombres: 1, mujeres: 0 });
      lastHold = resp.holdId;
      lastOrder = { bookingId: resp.holdId, total, nights: daysBetween(from, to) };
      paymentBox.hidden = false;
      payHint.textContent = `Hold ${resp.holdId} creado. Expira: ${new Date(resp.expiresAt).toLocaleString()}`;
    } catch (e) {
      alert("Error: " + e.message);
    }
  });

  btnStripe.addEventListener("click", async () => {
    try {
      const s = await ApiClient.stripeSession(lastOrder);
      resultBox.hidden = false;
      resultJson.textContent = JSON.stringify(s, null, 2);
      if (s.url) location.href = s.url;
    } catch (e) {
      alert("Stripe: " + e.message);
    }
  });

  btnMP.addEventListener("click", async () => {
    try {
      const p = await ApiClient.mpCheckout(lastOrder);
      resultBox.hidden = false;
      resultJson.textContent = JSON.stringify(p, null, 2);
      if (p.init_point) location.href = p.init_point;
    } catch (e) {
      alert("MP: " + e.message);
    }
  });

  function daysBetween(a, b) {
    const d1 = new Date(a + "T00:00:00");
    const d2 = new Date(b + "T00:00:00");
    return Math.max(1, Math.round((d2 - d1) / 86400000));
    }
})();
