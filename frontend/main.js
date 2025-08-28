/**
 * main.js
 * Frontend del sistema de reservas
 */

"use strict";

// === Variables globales ===
const API_BASE = document.querySelector('meta[name="backend-base-url"]')?.getAttribute("content") || "";
const STRIPE_KEY = document.querySelector('meta[name="stripe-publishable-key"]')?.getAttribute("content") || "";

// === Referencias al DOM ===
const bookSection = document.getElementById("book");
const formCard = document.getElementById("formCard");
const roomsCard = document.getElementById("roomsCard");
const checkAvail = document.getElementById("checkAvail");
const continueBtn = document.getElementById("continueBtn");
const submitBtn = document.getElementById("submitBtn");
const payStripe = document.getElementById("payStripe");
const payMP = document.getElementById("payMP");
const payPix = document.getElementById("payPix");

// === Endpoints API ===
const EP = {
  PING: () => `${API_BASE}/ping`,
  AVAIL: () => `${API_BASE}/availability`,
  HOLDS_START: () => `${API_BASE}/holds/start`,
  HOLDS_CONFIRM: () => `${API_BASE}/holds/confirm`,
  HOLDS_RELEASE: () => `${API_BASE}/holds/release`,
  PAY_STRIPE: () => `${API_BASE}/payments/stripe/session`,
  PAY_MP: () => `${API_BASE}/payments/mp/checkout`
  // PAY_STATUS eliminado: endpoint inexistente
};

// === Funciones auxiliares ===
function calcNights(inDate, outDate) {
  const d1 = new Date(inDate);
  const d2 = new Date(outDate);
  const diff = d2 - d1;
  return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 1;
}

function buildOrderBase() {
  const entrada = document.getElementById("dateIn").value;
  const salida = document.getElementById("dateOut").value;
  const hombres = parseInt(document.getElementById("men").value, 10);
  const mujeres = parseInt(document.getElementById("women").value, 10);
  const guests = hombres + mujeres;
  const nights = calcNights(entrada, salida);

  // capturar camas seleccionadas
  const camas = {};
  document.querySelectorAll(".bed.selected").forEach((el) => {
    const roomEl = el.closest(".room");
    const roomId = roomEl?.dataset.room;
    if (roomId) {
      if (!camas[roomId]) camas[roomId] = [];
      camas[roomId].push(el.dataset.bed);
    }
  });

  return {
    entrada,
    salida,
    hombres,
    mujeres,
    nights,
    total: guests * nights * 55, // R$55 por persona/noche
    bookingId: `BOOK_${Date.now()}`,
    camas
  };
}

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  return await res.json();
}

// === Botón "Ver disponibilidad" ===
checkAvail?.addEventListener("click", async () => {
  const from = document.getElementById("dateIn").value;
  const to = document.getElementById("dateOut").value;
  if (!from || !to) return alert("Seleccioná fechas");

  try {
    const j = await fetchJSON(EP.AVAIL() + `?from=${from}&to=${to}`);
    if (j.ok) {
      roomsCard.style.display = "block";
      // Simulación básica de camas (placeholder hasta que el backend devuelva)
      document.getElementById("rooms").innerHTML = `
        <div class="room" data-room="1">
          <h3>Habitación 1</h3>
          <div class="bed" data-bed="1">Cama 1</div>
        </div>
      `;
    }
  } catch (e) {
    alert("Error: " + e.message);
  }
});

// === Selección de camas ===
document.getElementById("rooms")?.addEventListener("click", (e) => {
  if (e.target.classList.contains("bed")) {
    e.target.classList.toggle("selected");
    const count = document.querySelectorAll(".bed.selected").length;
    document.getElementById("selCount").textContent = count;
    document.getElementById("needed").textContent =
      parseInt(document.getElementById("men").value, 10) +
      parseInt(document.getElementById("women").value, 10);
    continueBtn.disabled = count === 0;
  }
});

// === Botón "Continuar" ===
continueBtn?.addEventListener("click", async () => {
  try {
    const order = buildOrderBase();
    const j = await fetchJSON(EP.HOLDS_START(), {
      method: "POST",
      body: JSON.stringify(order)
    });
    if (j.holdId) {
      formCard.style.display = "block";
    } else {
      alert("Error: " + (j.error || "No se creó el hold"));
    }
  } catch (e) {
    alert("Error creando HOLD: " + e.message);
  }
});

// === Botón "Pagar con MP" ===
payMP?.addEventListener("click", async () => {
  try {
    const order = buildOrderBase();
    const j = await fetchJSON(EP.PAY_MP(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order })
    });
    if (j.init_point) {
      window.location.href = j.init_point;
    } else {
      alert("Error: " + (j.error || "No se generó el checkout"));
    }
  } catch (e) {
    alert("Error MP: " + (e.message || e));
  }
});

// === Botón "Ir a Checkout" (Stripe) ===
payStripe?.addEventListener("click", async () => {
  if (!STRIPE_KEY) return alert("Stripe no configurado");
  try {
    const order = buildOrderBase();
    const j = await fetchJSON(EP.PAY_STRIPE(), {
      method: "POST",
      body: JSON.stringify({ order })
    });
    if (j.id) {
      const stripe = Stripe(STRIPE_KEY);
      stripe.redirectToCheckout({ sessionId: j.id });
    } else {
      alert("Error: " + (j.error || "No se creó la sesión"));
    }
  } catch (e) {
    alert("Error Stripe: " + (e.message || e));
  }
});

// === Botón "Pix (QR)" ===
payPix?.addEventListener("click", () => {
  alert("Funcionalidad de Pix QR en desarrollo");
});

// === Formulario de reserva ===
document.getElementById("reserva-form")?.addEventListener("submit", (e) => {
  e.preventDefault();
  alert("Reserva confirmada");
});
