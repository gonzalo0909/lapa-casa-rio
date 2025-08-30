"use strict";

// === Configuración ===
const CONFIG = window.HOSTEL_CONFIG || {
  API_BASE: 'https://api.lapacasahostel.com/api',
  PRICE_PER_NIGHT: 55,
  TOTAL_CAPACITY: 38,
  ROOMS: { 1: 12, 3: 12, 5: 7, 6: 7 }
};

// Cargar Stripe key dinámicamente del backend
let STRIPE_KEY = null;

// === Validación inicial ===
if (!CONFIG.API_BASE) {
  console.error("FATAL: Falta configuración API_BASE");
  alert("No se puede conectar al sistema de reservas.");
}

// === Referencias DOM ===
const elements = {
  roomsCard: document.getElementById("roomsCard"),
  formCard: document.getElementById("formCard"),
  checkAvail: document.getElementById("checkAvail"),
  continueBtn: document.getElementById("continueBtn"),
  payStripe: document.getElementById("payStripe"),
  payMP: document.getElementById("payMP"),
  payPix: document.getElementById("payPix"),
  dateIn: document.getElementById("dateIn"),
  dateOut: document.getElementById("dateOut"),
  men: document.getElementById("men"),
  women: document.getElementById("women"),
  needed: document.getElementById("needed"),
  selCount: document.getElementById("selCount"),
  totalPrice: document.getElementById("totalPrice"),
  rooms: document.getElementById("rooms"),
  payState: document.getElementById("payState"),
  submitBtn: document.getElementById("submitBtn")
};

// === Estado global ===
const state = {
  currentHoldId: null,
  selectedBeds: new Set(),
  isLoading: false
};

// === Endpoints API ===
const EP = {
  AVAIL: () => `${CONFIG.API_BASE}/availability`,
  HOLDS_START: () => `${CONFIG.API_BASE}/holds/start`,
  PAY_STRIPE: () => `${CONFIG.API_BASE}/payments/stripe/session`,
  PAY_MP: () => `${CONFIG.API_BASE}/payments/mp/checkout`,
  CONFIG: () => `${CONFIG.API_BASE}/config`
};

// === Utilidades ===
function showError(message) {
  console.error(message);
  alert(message); // Mantenemos alert original por ahora
}

function showSuccess(message) {
  console.log(message);
  // Futura implementación: toast success
}

function setLoading(element, isLoading) {
  if (!element) return;
  element.disabled = isLoading;
  if (isLoading) {
    element.dataset.originalText = element.textContent;
    element.textContent = "Cargando...";
  } else {
    element.textContent = element.dataset.originalText || element.textContent.replace("Cargando...", "");
  }
}

function validateDates(dateIn, dateOut) {
  if (!dateIn || !dateOut) {
    return "Seleccioná fechas de entrada y salida";
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const checkIn = new Date(dateIn);
  const checkOut = new Date(dateOut);
  
  if (checkIn < today) {
    return "La fecha de entrada no puede ser anterior a hoy";
  }
  
  if (checkOut <= checkIn) {
    return "La fecha de salida debe ser posterior a la entrada";
  }
  
  return null;
}

function validateGuests(men, women) {
  const total = men + women;
  
  if (total <= 0) {
    return "Seleccioná al menos un huésped";
  }
  
  if (total > CONFIG.TOTAL_CAPACITY) {
    return `Máximo ${CONFIG.TOTAL_CAPACITY} huéspedes`;
  }
  
  return null;
}

function calcNights(inDate, outDate) {
  const d1 = new Date(inDate);
  const d2 = new Date(outDate);
  const diff = d2 - d1;
  return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 1;
}

async function fetchJSON(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (err) {
    console.error("Fetch error:", err);
    throw new Error(`Error de conexión: ${err.message}`);
  }
}

// === Cargar configuración del backend ===
async function loadBackendConfig() {
  try {
    const config = await fetchJSON(EP.CONFIG());
    if (config.stripe_publishable_key) {
      STRIPE_KEY = config.stripe_publishable_key;
    }
  } catch (err) {
    console.warn("No se pudo cargar configuración del backend:", err.message);
  }
}

// === Construcción de orden ===
function buildOrderBase() {
  const entrada = elements.dateIn.value;
  const salida = elements.dateOut.value;
  const hombres = parseInt(elements.men.value || 0, 10);
  const mujeres = parseInt(elements.women.value || 0, 10);
  const guests = hombres + mujeres;
  const nights = calcNights(entrada, salida);
  const totalPrice = guests * nights * CONFIG.PRICE_PER_NIGHT;

  // Validaciones
  const dateError = validateDates(entrada, salida);
  if (dateError) {
    showError(dateError);
    return null;
  }

  const guestError = validateGuests(hombres, mujeres);
  if (guestError) {
    showError(guestError);
    return null;
  }

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

// === Control de huéspedes ===
function updateCalculations() {
  const hombres = parseInt(elements.men.value || 0, 10);
  const mujeres = parseInt(elements.women.value || 0, 10);
  const needed = hombres + mujeres;
  
  if (elements.needed) elements.needed.textContent = needed;
  
  const selectedBeds = document.querySelectorAll(".bed.selected").length;
  
  if (elements.continueBtn) {
    elements.continueBtn.disabled = needed > 0 && selectedBeds !== needed;
  }
  
  // Calcular precio
  const entrada = elements.dateIn.value;
  const salida = elements.dateOut.value;
  if (entrada && salida) {
    const nights = calcNights(entrada, salida);
    const total = needed * nights * CONFIG.PRICE_PER_NIGHT;
    if (elements.totalPrice) elements.totalPrice.textContent = total;
  }
}

function updateRoomDisplay() {
  const hombres = parseInt(elements.men.value || 0, 10);
  const mujeres = parseInt(elements.women.value || 0, 10);
  const total = hombres + mujeres;

  // Validar límites
  if (total > CONFIG.TOTAL_CAPACITY) {
    const excess = total - CONFIG.TOTAL_CAPACITY;
    if (hombres >= mujeres) {
      elements.men.value = Math.max(0, hombres - excess);
    } else {
      elements.women.value = Math.max(0, mujeres - excess);
    }
    showError(`Máximo ${CONFIG.TOTAL_CAPACITY} huéspedes total`);
    return updateRoomDisplay(); // Recalcular
  }

  if (total === 0) {
    elements.rooms.innerHTML = "";
    elements.roomsCard.style.display = "none";
    return;
  }

  elements.roomsCard.style.display = "block";
  elements.rooms.innerHTML = "";
  state.selectedBeds.clear();

  // Mostrar habitaciones según lógica original
  addRoom(1, "Mixta", total);
  if (total > 12) addRoom(3, "Mixta", total);
  addRoom(5, "Mixta", total);
  
  if (mujeres > 0) {
    const room6 = addRoom(6, "Solo mujeres", mujeres);
    const warning = document.createElement("div");
    warning.className = "warning";
    warning.textContent = "Este cuarto es exclusivo para mujeres.";
    room6.appendChild(warning);
  }

  checkAvailability();
}

function addRoom(roomId, type, maxBeds) {
  const roomEl = document.createElement("div");
  roomEl.className = "room";
  roomEl.dataset.room = roomId;
  roomEl.innerHTML = `<h3>Habitación ${roomId} (${type})</h3><div class="beds"></div>`;
  
  const bedsDiv = roomEl.querySelector(".beds");
  const totalBeds = CONFIG.ROOMS[roomId];
  const bedsToShow = Math.min(totalBeds, maxBeds);

  for (let i = 1; i <= bedsToShow; i++) {
    const bedEl = document.createElement("div");
    bedEl.className = "bed";
    bedEl.dataset.room = String(roomId);
    bedEl.dataset.bed = String(i);
    bedEl.textContent = `Cama ${i}`;
    bedsDiv.appendChild(bedEl);
  }

  elements.rooms.appendChild(roomEl);
  return roomEl;
}

// === Verificación de disponibilidad ===
async function checkAvailability() {
  const from = elements.dateIn.value;
  const to = elements.dateOut.value;
  
  if (!from || !to) return;

  try {
    const response = await fetchJSON(`${EP.AVAIL()}?from=${from}&to=${to}`);
    
    if (response.ok && response.occupied) {
      updateBedAvailability(response.occupied);
    } else {
      console.warn("Respuesta de disponibilidad inválida:", response);
    }
  } catch (err) {
    console.error("Error verificando disponibilidad:", err);
    showError("No se pudo verificar disponibilidad. Intentá de nuevo.");
  }
}

function updateBedAvailability(occupiedBeds) {
  const rooms = document.querySelectorAll(".room");
  
  rooms.forEach(room => {
    const roomId = room.dataset.room;
    const occupied = occupiedBeds[roomId] || [];
    
    room.querySelectorAll(".bed").forEach(bed => {
      const bedId = parseInt(bed.dataset.bed, 10);
      
      if (occupied.includes(bedId)) {
        bed.classList.add("occupied");
        bed.classList.remove("selected");
        state.selectedBeds.delete(`${roomId}-${bedId}`);
      } else {
        bed.classList.remove("occupied");
      }
    });
  });
  
  updateSelectionCount();
}

function updateSelectionCount() {
  const count = document.querySelectorAll(".bed.selected").length;
  if (elements.selCount) elements.selCount.textContent = count;
  
  const needed = parseInt(elements.men.value || 0, 10) + parseInt(elements.women.value || 0, 10);
  if (elements.continueBtn) {
    elements.continueBtn.disabled = needed > 0 && count !== needed;
  }
}

// === Event Listeners ===
function setupGuestControls() {
  // Botones incremento/decremento
  document.getElementById("menPlus")?.addEventListener("click", () => {
    const current = parseInt(elements.men.value || 0, 10);
    elements.men.value = Math.min(CONFIG.TOTAL_CAPACITY, current + 1);
    updateCalculations();
    updateRoomDisplay();
  });

  document.getElementById("menMinus")?.addEventListener("click", () => {
    const current = parseInt(elements.men.value || 0, 10);
    elements.men.value = Math.max(0, current - 1);
    updateCalculations();
    updateRoomDisplay();
  });

  document.getElementById("womenPlus")?.addEventListener("click", () => {
    const current = parseInt(elements.women.value || 0, 10);
    elements.women.value = Math.min(CONFIG.TOTAL_CAPACITY, current + 1);
    updateCalculations();
    updateRoomDisplay();
  });

  document.getElementById("womenMinus")?.addEventListener("click", () => {
    const current = parseInt(elements.women.value || 0, 10);
    elements.women.value = Math.max(0, current - 1);
    updateCalculations();
    updateRoomDisplay();
  });

  // Input directo
  elements.men?.addEventListener("input", () => {
    updateCalculations();
    updateRoomDisplay();
  });

  elements.women?.addEventListener("input", () => {
    updateCalculations();
    updateRoomDisplay();
  });

  // Inicializar
  updateCalculations();
  updateRoomDisplay();
}

// === Verificar disponibilidad ===
elements.checkAvail?.addEventListener("click", async () => {
  const from = elements.dateIn.value;
  const to = elements.dateOut.value;
  
  const dateError = validateDates(from, to);
  if (dateError) {
    showError(dateError);
    return;
  }

  setLoading(elements.checkAvail, true);
  
  try {
    await checkAvailability();
  } finally {
    setLoading(elements.checkAvail, false);
  }
});

// === Selección de camas ===
elements.rooms?.addEventListener("click", (e) => {
  const bed = e.target;
  
  if (!bed.classList.contains("bed") || bed.classList.contains("occupied")) {
    return;
  }

  const roomId = bed.dataset.room;
  const bedId = bed.dataset.bed;
  const bedKey = `${roomId}-${bedId}`;

  if (bed.classList.contains("selected")) {
    bed.classList.remove("selected");
    state.selectedBeds.delete(bedKey);
  } else {
    bed.classList.add("selected");
    state.selectedBeds.add(bedKey);
  }

  updateSelectionCount();
});

// === Continuar a formulario ===
elements.continueBtn?.addEventListener("click", async () => {
  const order = buildOrderBase();
  if (!order) return;

  if (Object.keys(order.camas).length === 0) {
    showError("Seleccioná al menos una cama.");
    return;
  }

  setLoading(elements.continueBtn, true);

  try {
    const response = await fetchJSON(EP.HOLDS_START(), {
      method: "POST",
      body: JSON.stringify(order)
    });

    if (!response.ok || !response.holdId) {
      showError("Error: " + (response.error || "No se pudo reservar temporalmente"));
      return;
    }

    state.currentHoldId = response.holdId;
    elements.formCard.style.display = "block";
    elements.payState.textContent = "pendiente";
    
    // Scroll al formulario
    elements.formCard.scrollIntoView({ behavior: 'smooth' });

  } catch (err) {
    console.error("Error creando hold:", err);
    showError("No se pudo conectar al servidor. Verificá tu conexión.");
  } finally {
    setLoading(elements.continueBtn, false);
  }
});

// === Pagos ===
elements.payMP?.addEventListener("click", async () => {
  const order = buildOrderBase();
  if (!order) return;

  setLoading(elements.payMP, true);

  try {
    const response = await fetchJSON(EP.PAY_MP(), {
      method: "POST",
      body: JSON.stringify({ order })
    });

    if (response.init_point) {
      window.location.href = response.init_point;
    } else {
      showError("Error: " + (response.error || "No se generó el checkout de MP"));
    }
  } catch (err) {
    showError("Error Mercado Pago: " + err.message);
  } finally {
    setLoading(elements.payMP, false);
  }
});

elements.payStripe?.addEventListener("click", async () => {
  if (!STRIPE_KEY) {
    showError("Stripe no está disponible en este momento.");
    return;
  }

  const order = buildOrderBase();
  if (!order) return;

  setLoading(elements.payStripe, true);

  try {
    const response = await fetchJSON(EP.PAY_STRIPE(), {
      method: "POST",
      body: JSON.stringify({ order })
    });

    if (response.id) {
      const stripe = Stripe(STRIPE_KEY);
      await stripe.redirectToCheckout({ sessionId: response.id });
    } else {
      showError("Error: " + (response.error || "No se creó la sesión de Stripe"));
    }
  } catch (err) {
    showError("Error Stripe: " + err.message);
  } finally {
    setLoading(elements.payStripe, false);
  }
});

elements.payPix?.addEventListener("click", () => {
  showError("Funcionalidad Pix QR en desarrollo");
});

// === Validación formulario ===
function validateForm() {
  const form = document.getElementById("reserva-form");
  if (!form) return false;

  const nombre = form.querySelector('input[name="nombre"]').value.trim();
  const email = form.querySelector('input[name="email"]').value.trim();
  const telefono = form.querySelector('input[name="telefono"]').value.trim();

  if (nombre.length < 2) {
    showError("El nombre debe tener al menos 2 caracteres");
    return false;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError("Email inválido");
    return false;
  }

  if (!/^[\d+\-\s\(\)]{10,}$/.test(telefono)) {
    showError("Teléfono inválido");
    return false;
  }

  return true;
}

// === Submit formulario ===
document.getElementById("reserva-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  if (!validateForm()) return;
  
  if (elements.payState.textContent !== "pagado") {
    showError("Completá el pago antes de confirmar la reserva");
    return;
  }

  setLoading(elements.submitBtn, true);

  try {
    // Lógica de confirmación aquí
    showSuccess("Reserva confirmada exitosamente");
  } catch (err) {
    showError("Error confirmando reserva: " + err.message);
  } finally {
    setLoading(elements.submitBtn, false);
  }
});

// === Navegación simple ===
function setupNavigation() {
  const bookSection = document.getElementById("book");
  const adminSection = document.getElementById("admin");
  
  function showSection(sectionName) {
    if (sectionName === "book") {
      bookSection.style.display = "block";
      adminSection.style.display = "none";
    } else if (sectionName === "admin") {
      bookSection.style.display = "none";
      adminSection.style.display = "block";
    }
  }

  // Hash navigation
  function handleHashChange() {
    const hash = window.location.hash.slice(1);
    if (hash === "/admin") {
      showSection("admin");
    } else {
      showSection("book");
    }
  }

  window.addEventListener("hashchange", handleHashChange);
  handleHashChange(); // Initial load
}

// === Admin functions ===
function setupAdminPanel() {
  const btnHealth = document.getElementById("btnHealth");
  const btnHolds = document.getElementById("btnHolds");
  const btnBookings = document.getElementById("btnBookings");
  const admToken = document.getElementById("admToken");

  function getAuthHeaders() {
    const token = admToken?.value.trim();
    return token ? { "Authorization": `Bearer ${token}` } : {};
  }

  btnHealth?.addEventListener("click", async () => {
    setLoading(btnHealth, true);
    try {
      const response = await fetchJSON(`${CONFIG.API_BASE}/health`, {
        headers: getAuthHeaders()
      });
      document.getElementById("healthOut").textContent = JSON.stringify(response, null, 2);
    } catch (err) {
      document.getElementById("healthOut").textContent = "Error: " + err.message;
    } finally {
      setLoading(btnHealth, false);
    }
  });

  btnHolds?.addEventListener("click", async () => {
    setLoading(btnHolds, true);
    try {
      const response = await fetchJSON(`${CONFIG.API_BASE}/holds`, {
        headers: getAuthHeaders()
      });
      document.getElementById("holdsOut").innerHTML = formatHoldsTable(response.holds || []);
    } catch (err) {
      document.getElementById("holdsOut").textContent = "Error: " + err.message;
    } finally {
      setLoading(btnHolds, false);
    }
  });

  btnBookings?.addEventListener("click", async () => {
    const from = document.getElementById("bkFrom").value;
    const to = document.getElementById("bkTo").value;
    const q = document.getElementById("bkQ").value;
    
    const params = new URLSearchParams();
    if (from) params.append("from", from);
    if (to) params.append("to", to);
    if (q) params.append("q", q);

    setLoading(btnBookings, true);
    try {
      const response = await fetchJSON(`${CONFIG.API_BASE}/bookings?${params}`, {
        headers: getAuthHeaders()
      });
      document.getElementById("bookingsOut").innerHTML = formatBookingsTable(response.rows || []);
    } catch (err) {
      document.getElementById("bookingsOut").textContent = "Error: " + err.message;
    } finally {
      setLoading(btnBookings, false);
    }
  });
}

function formatHoldsTable(holds) {
  if (!holds.length) return "<p>No hay holds activos</p>";
  
  let html = "<table><tr><th>Hold ID</th><th>Entrada</th><th>Salida</th><th>Huéspedes</th><th>Total</th><th>Estado</th></tr>";
  holds.forEach(hold => {
    html += `<tr>
      <td>${hold.holdId}</td>
      <td>${hold.entrada}</td>
      <td>${hold.salida}</td>
      <td>${hold.hombres + hold.mujeres}</td>
      <td>R$ ${hold.total}</td>
      <td>${hold.status}</td>
    </tr>`;
  });
  html += "</table>";
  return html;
}

function formatBookingsTable(bookings) {
  if (!bookings.length) return "<p>No se encontraron reservas</p>";
  
  let html = "<table><tr><th>ID</th><th>Nombre</th><th>Entrada</th><th>Salida</th><th>Huéspedes</th><th>Estado</th></tr>";
  bookings.forEach(booking => {
    html += `<tr>
      <td>${booking.booking_id}</td>
      <td>${booking.nombre || 'N/A'}</td>
      <td>${booking.entrada}</td>
      <td>${booking.salida}</td>
      <td>${(booking.hombres || 0) + (booking.mujeres || 0)}</td>
      <td>${booking.pay_status}</td>
    </tr>`;
  });
  html += "</table>";
  return html;
}

// === Inicialización ===
async function init() {
  await loadBackendConfig();
  setupGuestControls();
  setupNavigation();
  setupAdminPanel();
  
  // Configurar fechas mínimas
  const today = new Date().toISOString().split('T')[0];
  elements.dateIn.min = today;
  elements.dateOut.min = today;
  
  // Auto-update fecha mínima salida cuando cambia entrada
  elements.dateIn?.addEventListener("change", () => {
    if (elements.dateIn.value) {
      elements.dateOut.min = elements.dateIn.value;
      updateCalculations();
    }
  });

  elements.dateOut?.addEventListener("change", updateCalculations);
}

// Inicializar cuando el DOM esté listo
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
