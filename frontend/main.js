/**
 * main.js
 * Frontend del sistema de reservas - Lapa Casa Hostel
 * Con control dinámico de cuartos por género y cantidad
 */

"use strict";

// === Variables globales ===
const API_BASE = document.querySelector('meta[name="backend-base-url"]')?.getAttribute("content") || "";
const STRIPE_KEY = document.querySelector('meta[name="stripe-publishable-key"]')?.getAttribute("content") || "";

// === Referencias al DOM ===
const roomsCard = document.getElementById("roomsCard");
const checkAvail = document.getElementById("checkAvail");
const continueBtn = document.getElementById("continueBtn");

// === Endpoints API ===
const EP = {
  AVAIL: () => `${API_BASE}/availability`,
  HOLDS_START: () => `${API_BASE}/holds/start`,
  PAY_STRIPE: () => `${API_BASE}/payments/stripe/session`,
  PAY_MP: () => `${API_BASE}/payments/mp/checkout`
};

// === Configuración de habitaciones/camas ===
const ROOMS = {
  1: 12,  // mixta
  3: 12,  // mixta (refuerzo)
  5: 7,   // mixta
  6: 7    // solo mujeres
};

// === Funciones auxiliares ===
function buildOrderBase() {
  const entrada = document.getElementById("dateIn").value;
  const salida = document.getElementById("dateOut").value;
  const hombres = parseInt(document.getElementById("men").value, 10);
  const mujeres = parseInt(document.getElementById("women").value, 10);
  const guests = hombres + mujeres;
  const nights = calcNights(entrada, salida);
  const totalPrice = guests * nights * 55;

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

  function updateRooms() {
    const hombres = parseInt(menInput.value || 0);
    const mujeres = parseInt(womenInput.value || 0);
    const total = hombres + mujeres;

    // Ocultar todo si no hay huéspedes
    if (hombres === 0 && mujeres === 0) {
      document.getElementById("rooms").innerHTML = "";
      roomsCard.style.display = "none";
      return;
    }

    roomsCard.style.display = "block";
    const roomsDiv = document.getElementById("rooms");
    roomsDiv.innerHTML = "";

    // === 1. Habitación 1 (mixta) → SIEMPRE PRIMERO ===
    addRoom(roomsDiv, 1, "Mixta", total);

    // === 2. Habitación 3 (mixta) → SOLO si hay más de 12 camas ===
    if (total > 12) {
      addRoom(roomsDiv, 3, "Mixta", total);
    }

    // === 3. Habitación 5 (mixta) ===
    addRoom(roomsDiv, 5, "Mixta", total);

    // === 4. Habitación 6 (solo mujeres) → solo si hay mujeres ===
    if (mujeres > 0) {
      const room6 = addRoom(roomsDiv, 6, "Solo mujeres", mujeres);
      const warning = document.createElement("div");
      warning.className = "warning";
      warning.textContent = "Este cuarto es exclusivo para mujeres.";
      room6.appendChild(warning);
    }

    // Actualizar disponibilidad
    checkAvailability();
  }

  document.getElementById("menPlus")?.addEventListener("click", () => {
    menInput.value = Math.min(38, parseInt(menInput.value || 0) + 1);
    updateNeeded(); updateRooms();
  });
  document.getElementById("menMinus")?.addEventListener("click", () => {
    menInput.value = Math.max(0, parseInt(menInput.value || 0) - 1);
    updateNeeded(); updateRooms();
  });
  document.getElementById("womenPlus")?.addEventListener("click", () => {
    womenInput.value = Math.min(38, parseInt(womenInput.value || 0) + 1);
    updateNeeded(); updateRooms();
  });
  document.getElementById("womenMinus")?.addEventListener("click", () => {
    womenInput.value = Math.max(0, parseInt(womenInput.value || 0) - 1);
    updateNeeded(); updateRooms();
  });

  updateNeeded();
  updateRooms();
}

function addRoom(container, roomId, type, maxBeds) {
  const roomEl = document.createElement("div");
  roomEl.className = "room";
  roomEl.dataset.room = roomId;
  roomEl.innerHTML = `<h3>Habitación ${roomId} (${type})</h3><div class="beds"></div>`;
  const bedsDiv = roomEl.querySelector(".beds");

  const totalBeds = ROOMS[roomId];
  const bedsToShow = Math.min(totalBeds, maxBeds);

  for (let i = 1; i <= bedsToShow; i++) {
    const bedEl = document.createElement("div");
    bedEl.className = "bed";
    bedEl.dataset.room = roomId;
    bedEl.dataset.bed = i;
    bedEl.textContent = `Cama ${i}`;
    bedsDiv.appendChild(bedEl);
  }

  container.appendChild(roomEl);
  return roomEl;
}

async function checkAvailability() {
  const from = document.getElementById("dateIn").value;
  const to = document.getElementById("dateOut").value;
  if (!from || !to) return;

  try {
    const j = await fetchJSON(EP.AVAIL() + `?from=${from}&to=${to}`);
    if (j.ok) {
      const rooms = document.querySelectorAll(".room");
      rooms.forEach(room => {
        const roomId = room.dataset.room;
        const occupied = j.occupied[roomId] || [];
        room.querySelectorAll(".bed").forEach(bed => {
          const bedId = parseInt(bed.dataset.bed);
          if (occupied.includes(bedId)) {
            bed.classList.add("occupied");
            bed.classList.remove("selected");
          }
        });
      });
    }
  } catch (e) {
    console.error("Error al cargar disponibilidad:", e);
  }
}

// === Botón "Ver disponibilidad" ===
checkAvail?.addEventListener("click", () => {
  const from = document.getElementById("dateIn").value;
  const to = document.getElementById("dateOut").value;
  if (!from || !to) return alert("Seleccioná fechas");

  checkAvailability();
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

// === Botón "Continuar" ===
continueBtn?.addEventListener("click", async () => {
  try {
    const order = buildOrderBase();
    const j = await fetchJSON(EP.HOLDS_START(), {
      method: "POST",
      body: JSON.stringify(order)
    });

    if (j.holdId) {
      document.getElementById("formCard").style.display = "block";
      document.getElementById("payState").textContent = "pendiente";
    } else {
      alert("Error: " + (j.error || "No se creó el hold"));
    }
  } catch (e) {
    alert("Error creando HOLD: " + e.message);
  }
});

// === Inicialización ===
setupGuestControls();
