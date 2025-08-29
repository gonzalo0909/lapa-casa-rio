/**
 * main.js
 * Frontend del sistema de reservas - Lapa Casa Hostel
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

// === Configuración de habitaciones/camas ===
const ROOMS = {
  1: 12,
  3: 12,
  5: 7,
  6: 7
};

// === Funciones auxiliares ===
function buildOrderBase() {
  const entrada = document.getElementById("dateIn").value;
  const salida = document.getElementById("dateOut").value;
  const hombres = parseInt(document.getElementById("men").value, 10);
  const mujeres = parseInt(document.getElementById("women").value, 10);
  const guests = hombres + mujeres;
  const nights = calcNights(entrada, salida);
  const totalPrice = guests * nights * 55; // R$55 por persona/noche

  // Capturar camas seleccionadas
  const camas = {};
  document.querySelectorAll(".bed.selected").forEach(el => {
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
    total: totalPrice,
    bookingId: `BOOK_${Date.now()}`,
    camas
  };
}

function calcNights(inDate, outDate) {
  const d1 = new Date(inDate);
  const d2 = new Date(outDate);
  const diff = d2 - d1;
  return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 1;
}

async function fetchJSON(url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options
    });
    return await res.json();
  } catch (err) {
    throw new Error(`Error de red: ${err.message}`);
  }
}

// === Control de huéspedes (hombres/mujeres) ===
function setupGuestControls() {
  const menInput = document.getElementById("men");
  const womenInput = document.getElementById("women");

  function updateNeeded() {
    const needed = (parseInt(menInput.value || 0) + parseInt(womenInput.value || 0));
    document.getElementById("needed").textContent = needed;
    continueBtn.disabled = needed > 0 && document.querySelectorAll(".bed.selected").length !== needed;
  }

  document.getElementById("menPlus")?.addEventListener("click", () => {
    menInput.value = Math.min(38, parseInt(menInput.value || 0) + 1);
    updateNeeded();
  });

  document.getElementById("menMinus")?.addEventListener("click", () => {
    menInput.value = Math.max(0, parseInt(menInput.value || 0) - 1);
    updateNeeded();
  });

  document.getElementById("womenPlus")?.addEventListener("click", () => {
    womenInput.value = Math.min(38, parseInt(womenInput.value || 0) + 1);
    updateNeeded();
  });

  document.getElementById("womenMinus")?.addEventListener("click", () => {
    womenInput.value = Math.max(0, parseInt(womenInput.value || 0) - 1);
    updateNeeded();
  });

  updateNeeded();
}

// === Render de habitaciones/camas ===
function renderRooms(occupied = {}) {
  const roomsDiv = document.getElementById("rooms");
  roomsDiv.innerHTML = "";

  Object.entries(ROOMS).forEach(([roomId, totalBeds]) => {
    const roomEl = document.createElement("div");
    roomEl.className = "room";
    roomEl.dataset.room = roomId;
    roomEl.innerHTML = `<h3>Habitación ${roomId}</h3><div class="beds"></div>`;
    const bedsDiv = roomEl.querySelector(".beds");

    for (let i = 1; i <= totalBeds; i++) {
      const bedEl = document.createElement("div");
      bedEl.className = "bed";
      bedEl.dataset.room = roomId;
      bedEl.dataset.bed = i;
      bedEl.textContent = `Cama ${i}`;

      if (occupied[roomId] && occupied[roomId].includes(i)) {
        bedEl.classList.add("occupied");
      }

      bedsDiv.appendChild(bedEl);
    }

    roomsDiv.appendChild(roomEl);
  });
}

// === Botón "Ver disponibilidad" ===
checkAvail?.addEventListener("click", async () => {
  const from = document.getElementById("dateIn").value;
  const to = document.getElementById("dateOut").value;
  const msgEl = document.getElementById("checkMsg");

  if (!from || !to) {
    msgEl.textContent = "Seleccioná fechas de entrada y salida.";
    msgEl.className = "err";
    msgEl.style.display = "block";
    return;
  }

  if (from >= to) {
    msgEl.textContent = "La fecha de salida debe ser posterior a la de entrada.";
    msgEl.className = "err";
    msgEl.style.display = "block";
    return;
  }

  msgEl.textContent = "Cargando disponibilidad...";
  msgEl.className = "muted";
  msgEl.style.display = "block";

  try {
    const j = await fetchJSON(EP.AVAIL() + `?from=${from}&to=${to}`);
    if (j.ok) {
      roomsCard.style.display = "block";
      msgEl.style.display = "none";
      renderRooms(j.occupied || {});
    } else {
      msgEl.textContent = j.message || "No hay disponibilidad.";
      msgEl.className = "warning";
      msgEl.style.display = "block";
    }
  } catch (e) {
    msgEl.textContent = "No se pudo conectar con el servidor.";
    msgEl.className = "err";
    console.error("Error al obtener disponibilidad:", e);
  }
});

// === Selección de camas ===
document.getElementById("rooms")?.addEventListener("click", (e) => {
  if (e.target.classList.contains("bed") && !e.target.classList.contains("occupied")) {
    e.target.classList.toggle("selected");
    const count = document.querySelectorAll(".bed.selected").length;
    document.getElementById("selCount").textContent = count;

    const needed = parseInt(document.getElementById("men").value || 0) + parseInt(document.getElementById("women").value || 0);
    continueBtn.disabled = count !== needed;
  }
});

// === Botón "Continuar" → Crear HOLD ===
continueBtn?.addEventListener("click", async () => {
  try {
    const order = buildOrderBase();
    const j = await fetchJSON(EP.HOLDS_START(), {
      method: "POST",
      body: JSON.stringify(order)
    });

    if (j.holdId) {
      formCard.style.display = "block";
      document.getElementById("payState").textContent = "pendiente";
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
  if (!STRIPE_KEY) {
    alert("Stripe no está configurado correctamente.");
    return;
  }
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
  alert("Funcionalidad Pix QR en desarrollo");
});

// === Formulario de reserva ===
document.getElementById("reserva-form")?.addEventListener("submit", (e) => {
  e.preventDefault();
  alert("Reserva confirmada. Gracias por elegir Lapa Casa Hostel.");
});

// === Inicialización ===
setupGuestControls();
