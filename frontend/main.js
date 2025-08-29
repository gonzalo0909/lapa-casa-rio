"use strict";

// === Variables globales ===
const API_BASE = (document.querySelector('meta[name="backend-base-url"]')?.getAttribute("content") || "").trim();
const STRIPE_KEY = (document.querySelector('meta[name="stripe-publishable-key"]')?.getAttribute("content") || "").trim();

if (!API_BASE) {
  console.error("FATAL: Falta backend-base-url en meta tag");
  alert("No se puede conectar al sistema de reservas.");
}

// === Referencias al DOM ===
const roomsCard = document.getElementById("roomsCard");
const formCard = document.getElementById("formCard");
const checkAvail = document.getElementById("checkAvail");
const continueBtn = document.getElementById("continueBtn");
const payStripe = document.getElementById("payStripe");
const payMP = document.getElementById("payMP");
const payPix = document.getElementById("payPix");

// === Endpoints API ===
const EP = {
  AVAIL: () => `${API_BASE}/availability`,
  HOLDS_START: () => `${API_BASE}/holds/start`,
  PAY_STRIPE: () => `${API_BASE}/payments/stripe/session`,
  PAY_MP: () => `${API_BASE}/payments/mp/checkout`
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
  const hombres = parseInt(document.getElementById("men").value || 0, 10);
  const mujeres = parseInt(document.getElementById("women").value || 0, 10);
  const guests = hombres + mujeres;
  const nights = calcNights(entrada, salida);
  const totalPrice = guests * nights * 55;

  if (!entrada || !salida) return null;

  const camas = {};
  document.querySelectorAll(".bed.selected").forEach(el => {
    const roomEl = el.closest(".room");
    const roomId = roomEl?.dataset.room;
    if (roomId) {
      if (!camas[roomId]) camas[roomId] = [];
      camas[roomId].push(parseInt(el.dataset.bed));
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

// === Control de huéspedes ===
function setupGuestControls() {
  const menInput = document.getElementById("men");
  const womenInput = document.getElementById("women");

  function updateNeeded() {
    const needed = (parseInt(menInput.value || 0) + parseInt(womenInput.value || 0));
    document.getElementById("needed").textContent = needed;
    const selectedBeds = document.querySelectorAll(".bed.selected").length;
    continueBtn.disabled = needed > 0 && selectedBeds !== needed;
  }

  function updateRooms() {
    const hombres = parseInt(menInput.value || 0);
    const mujeres = parseInt(womenInput.value || 0);
    const total = hombres + mujeres;

    if (hombres === 0 && mujeres === 0) {
      document.getElementById("rooms").innerHTML = "";
      roomsCard.style.display = "none";
      return;
    }

    roomsCard.style.display = "block";
    const roomsDiv = document.getElementById("rooms");
    roomsDiv.innerHTML = "";

    addRoom(roomsDiv, 1, "Mixta", total);
    if (total > 12) addRoom(roomsDiv, 3, "Mixta", total);
    addRoom(roomsDiv, 5, "Mixta", total);
    if (mujeres > 0) {
      const room6 = addRoom(roomsDiv, 6, "Solo mujeres", mujeres);
      const warning = document.createElement("div");
      warning.className = "warning";
      warning.textContent = "Este cuarto es exclusivo para mujeres.";
      room6.appendChild(warning);
    }

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

checkAvail?.addEventListener("click", () => {
  const from = document.getElementById("dateIn").value;
  const to = document.getElementById("dateOut").value;
  if (!from || !to) return alert("Seleccioná fechas");
  checkAvailability();
});

document.getElementById("rooms")?.addEventListener("click", (e) => {
  if (e.target.classList.contains("bed") && !e.target.classList.contains("occupied")) {
    e.target.classList.toggle("selected");
    const count = document.querySelectorAll(".bed.selected").length;
    document.getElementById("selCount").textContent = count;
    const needed = parseInt(document.getElementById("men").value || 0) + parseInt(document.getElementById("women").value || 0);
    continueBtn.disabled = count !== needed;
  }
});

continueBtn?.addEventListener("click", async () => {
  const order = buildOrderBase();
  if (!order) {
    alert("Fechas no válidas");
    return;
  }
  if (Object.keys(order.camas).length === 0) {
    alert("Seleccioná al menos una cama.");
    return;
  }

  try {
    const j = await fetchJSON(EP.HOLDS_START(), {
      method: "POST",
      body: JSON.stringify(order)
    });

    if (!j.ok || !j.holdId) {
      alert("Error: " + (j.error || "No se creó el hold"));
      return;
    }

    formCard.style.display = "block";
    document.getElementById("payState").textContent = "pendiente";
  } catch (e) {
    console.error("Error al crear HOLD:", e);
    alert("No se pudo conectar al servidor. Revisa tu conexión.");
  }
});

payMP?.addEventListener("click", async () => {
  try {
    const order = buildOrderBase();
    const j = await fetchJSON(EP.PAY_MP(), {
      method: "POST",
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

payPix?.addEventListener("click", () => {
  alert("Funcionalidad Pix QR en desarrollo");
});

setupGuestControls();
