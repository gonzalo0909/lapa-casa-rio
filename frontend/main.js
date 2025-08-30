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

// Helpers rápidos al DOM
const dateIn = document.getElementById("dateIn");
const dateOut = document.getElementById("dateOut");
const men = document.getElementById("men");
const women = document.getElementById("women");
const neededEl = document.getElementById("needed");
const selCountEl = document.getElementById("selCount");

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

// === Utilidades ===
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

function buildOrderBase() {
  const entrada = dateIn.value;
  const salida = dateOut.value;
  const hombres = parseInt(men.value || 0, 10);
  const mujeres = parseInt(women.value || 0, 10);
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
      camas[roomId].push(parseInt(el.dataset.bed, 10));
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

// === Lógica solicitada ===

// 1) Fechas -> 2) huéspedes -> 3) Ver disponibilidad -> render de cuartos
function setupGuestControls() {
  function updateNeeded() {
    const needed = (parseInt(men.value || 0) + parseInt(women.value || 0));
    neededEl.textContent = needed;
    const selectedBeds = document.querySelectorAll(".bed.selected").length;
    continueBtn.disabled = needed > 0 && selectedBeds !== needed;
  }

  document.getElementById("menPlus")?.addEventListener("click", () => {
    men.value = Math.min(38, parseInt(men.value || 0) + 1);
    updateNeeded();
  });
  document.getElementById("menMinus")?.addEventListener("click", () => {
    men.value = Math.max(0, parseInt(men.value || 0) - 1);
    updateNeeded();
  });
  document.getElementById("womenPlus")?.addEventListener("click", () => {
    women.value = Math.min(38, parseInt(women.value || 0) + 1);
    updateNeeded();
  });
  document.getElementById("womenMinus")?.addEventListener("click", () => {
    women.value = Math.max(0, parseInt(women.value || 0) - 1);
    updateNeeded();
  });

  // Al iniciar no mostramos cuartos
  roomsCard.style.display = "none";
  updateNeeded();
}

// Cuartos a mostrar: hombres -> 1 y 5; overflow (>12) -> 3; mujeres>0 -> 6
function decideRooms(hombres, mujeres) {
  const total = hombres + mujeres;
  const rooms = [];
  if (hombres > 0) { rooms.push(1, 5); }
  if (total > 12) { rooms.push(3); }
  if (mujeres > 0) { rooms.push(6); }
  return [...new Set(rooms)];
}

// Render de cuartos con todas las camas; ocupadas/hold deshabilitadas
function renderRooms(occupied, hombres, mujeres) {
  const roomsDiv = document.getElementById("rooms");
  roomsDiv.innerHTML = "";
  const toShow = decideRooms(hombres, mujeres);

  toShow.forEach(roomId => {
    const box = document.createElement("div");
    box.className = "room";
    box.dataset.room = roomId;
    const titulo = (roomId === 6) ? "Solo mujeres" : "Mixta";
    box.innerHTML = `<h3>Habitación ${roomId} (${titulo})</h3><div class="beds"></div>`;
    const bedsDiv = box.querySelector(".beds");

    const totalBeds = ROOMS[roomId] || 0;
    const taken = new Set((occupied?.[String(roomId)] || []).map(Number));

    for (let i = 1; i <= totalBeds; i++) {
      const bedEl = document.createElement("div");
      bedEl.className = "bed";
      bedEl.dataset.room = roomId;
      bedEl.dataset.bed = i;
      bedEl.textContent = `Cama ${i}`;
      if (taken.has(i)) {
        bedEl.classList.add("occupied", "disabled");
      }
      bedsDiv.appendChild(bedEl);
    }

    if (roomId === 6) {
      const warning = document.createElement("div");
      warning.className = "warning";
      warning.style.display = "block";
      warning.textContent = "Este cuarto es exclusivo para mujeres.";
      box.appendChild(warning);
    }

    roomsDiv.appendChild(box);
  });

  roomsCard.style.display = toShow.length ? "block" : "none";
}

// Consultar disponibilidad solo al hacer clic en "Ver disponibilidad" y recién ahí mostrar cuartos
checkAvail?.addEventListener("click", async () => {
  const from = dateIn.value;
  const to = dateOut.value;
  if (!from || !to) return alert("Seleccioná fechas");

  const hombres = parseInt(men.value || 0, 10);
  const mujeres = parseInt(women.value || 0, 10);
  const need = hombres + mujeres;
  if (need <= 0) return alert("Seleccioná la cantidad de huéspedes");

  try {
    const j = await fetchJSON(EP.AVAIL() + `?from=${from}&to=${to}`);
    if (!j.ok) return alert("No se pudo cargar disponibilidad");
    renderRooms(j.occupied || {}, hombres, mujeres);
    selCountEl.textContent = 0;
    neededEl.textContent = need;
    continueBtn.disabled = true;
  } catch (e) {
    console.error("Error al cargar disponibilidad:", e);
    alert("Error al consultar disponibilidad");
  }
});

// Click en camas: impedir ocupadas/disabled, validar conteo vs needed
document.getElementById("rooms")?.addEventListener("click", (e) => {
  const el = e.target;
  if (!el.classList.contains("bed")) return;
  if (el.classList.contains("occupied") || el.classList.contains("disabled")) return;

  el.classList.toggle("selected");
  const count = document.querySelectorAll(".bed.selected").length;
  selCountEl.textContent = count;

  const needed = (parseInt(men.value || 0) + parseInt(women.value || 0));
  continueBtn.disabled = count !== needed;
});

// === Flujo de hold y pagos ===
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

// Inicializar controles
setupGuestControls();
