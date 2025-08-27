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
  PAY_MP: () => `${API_BASE}/payments/mp/checkout`,
  PAY_STATUS: () => `${API_BASE}/bookings/status`
};

// === Funciones auxiliares ===
function buildOrderBase() {
  return {
    entrada: document.getElementById("dateIn").value,
    salida: document.getElementById("dateOut").value,
    hombres: parseInt(document.getElementById("men").value, 10),
    mujeres: parseInt(document.getElementById("women").value, 10),
    total: 110,
    nights: 1,
    bookingId: `BOOK_${Date.now()}`
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
      // Simulación básica de camas
      document.getElementById("rooms").innerHTML = `
        <div class="room">
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
    document.getElementById("needed").textContent = parseInt(document.getElementById("men").value, 10) + parseInt(document.getElementById("women").value, 10);
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
