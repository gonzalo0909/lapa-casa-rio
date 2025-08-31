"use strict";

console.log("Loading main.js with bunk bed layout");

// Configuración
const ROOMS = { 1: 12, 3: 12, 5: 7, 6: 7 };
const PRICE_PER_NIGHT = 55;
let holdTimer = null;
let holdTimeLeft = 0;

// Referencias DOM
const roomsCard = document.getElementById("roomsCard");
const formCard = document.getElementById("formCard");

// Funciones de utilidad
function showError(message) {
  const errorToast = document.getElementById("errorToast");
  const errorMessage = document.getElementById("errorMessage");
  if (errorToast && errorMessage) {
    errorMessage.textContent = message;
    errorToast.classList.remove("hidden");
    setTimeout(() => errorToast.classList.add("hidden"), 5000);
  }
}

function showSuccess(message) {
  const successToast = document.getElementById("successToast");
  const successMessage = document.getElementById("successMessage");
  if (successToast && successMessage) {
    successMessage.textContent = message;
    successToast.classList.remove("hidden");
    setTimeout(() => successToast.classList.add("hidden"), 5000);
  }
}

function startHoldTimer(minutes = 10) {
  holdTimeLeft = minutes * 60; // Convertir a segundos
  const paymentTimer = document.getElementById("paymentTimer");
  const timerDisplay = document.getElementById("timerDisplay");
  
  if (paymentTimer) {
    paymentTimer.style.display = "block";
  }
  
  holdTimer = setInterval(() => {
    holdTimeLeft--;
    
    if (timerDisplay) {
      const mins = Math.floor(holdTimeLeft / 60);
      const secs = holdTimeLeft % 60;
      timerDisplay.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    if (holdTimeLeft <= 0) {
      clearInterval(holdTimer);
      if (paymentTimer) {
        paymentTimer.style.display = "none";
      }
      showError("Hold expirado. Selecciona nuevamente tus camas.");
    }
  }, 1000);
}

function stopHoldTimer() {
  if (holdTimer) {
    clearInterval(holdTimer);
    holdTimer = null;
  }
  const paymentTimer = document.getElementById("paymentTimer");
  if (paymentTimer) {
    paymentTimer.style.display = "none";
  }
}

// Admin token validation
function validateAdminToken() {
  const admToken = document.getElementById("admToken");
  const tokenError = document.getElementById("tokenError");
  
  if (!admToken || !tokenError) return false;
  
  const token = admToken.value.trim();
  
  // Validación básica
  if (!token) {
    tokenError.textContent = "Token requerido";
    tokenError.classList.remove("hidden");
    return false;
  }
  
  if (token.length < 8) {
    tokenError.textContent = "Token debe tener al menos 8 caracteres";
    tokenError.classList.remove("hidden");
    return false;
  }
  
  tokenError.classList.add("hidden");
  return true;
}

// Función sanitización
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remover < >
    .replace(/javascript:/gi, '') // Remover javascript:
    .replace(/on\w+=/gi, '') // Remover onclick=, onload=, etc
    .replace(/script/gi, '') // Remover script
    .substring(0, 200); // Máximo 200 caracteres
}

function validateAndSanitizeForm() {
  let isValid = true;
  
  // Validar y sanitizar nombre
  const nombre = document.getElementById("nombre");
  const nombreError = document.getElementById("nombreError");
  if (nombre && nombreError) {
    const sanitizedName = sanitizeInput(nombre.value);
    nombre.value = sanitizedName;
    
    if (!sanitizedName || sanitizedName.length < 2) {
      nombreError.textContent = "Nombre debe tener al menos 2 caracteres";
      nombreError.classList.remove("hidden");
      isValid = false;
    } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(sanitizedName)) {
      nombreError.textContent = "Nombre solo puede contener letras y espacios";
      nombreError.classList.remove("hidden");
      isValid = false;
    } else {
      nombreError.classList.add("hidden");
    }
  }
  
  // Validar email
  const email = document.getElementById("email");
  const emailError = document.getElementById("emailError");
  if (email && emailError) {
    const sanitizedEmail = sanitizeInput(email.value).toLowerCase();
    email.value = sanitizedEmail;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!sanitizedEmail || !emailRegex.test(sanitizedEmail)) {
      emailError.textContent = "Email inválido";
      emailError.classList.remove("hidden");
      isValid = false;
    } else {
      emailError.classList.add("hidden");
    }
  }
  
  // Validar teléfono
  const telefono = document.getElementById("telefono");
  const telefonoError = document.getElementById("telefonoError");
  if (telefono && telefonoError) {
    const sanitizedPhone = sanitizeInput(telefono.value);
    telefono.value = sanitizedPhone;
    
    const phoneRegex = /^[0-9+\-\s\(\)]{10,}$/;
    if (!sanitizedPhone || !phoneRegex.test(sanitizedPhone)) {
      telefonoError.textContent = "Teléfono debe tener al menos 10 caracteres válidos";
      telefonoError.classList.remove("hidden");
      isValid = false;
    } else {
      telefonoError.classList.add("hidden");
    }
  }
  
  return isValid;
}

// Función admin segura
async function performAdminAction(action, endpoint, data = null) {
  if (!validateAdminToken()) {
    showError("Token inválido");
    return;
  }
  
  const token = document.getElementById("admToken").value.trim();
  
  try {
    const options = {
      method: data ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Admin-Token': token
      }
    };
    
    if (data) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(`${window.HOSTEL_CONFIG.API_BASE}${endpoint}`, options);
    
    if (response.status === 401 || response.status === 403) {
      showError("Token inválido o sin permisos");
      return null;
    }
    
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
    
  } catch (error) {
    console.error(`Error in ${action}:`, error);
    showError(`Error en ${action}: ${error.message}`);
    return null;
  }
}

// Funciones principales
function calcNights(inDate, outDate) {
  const d1 = new Date(inDate);
  const d2 = new Date(outDate);
  const diff = d2 - d1;
  return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 1;
}

function validateForm() {
  let isValid = true;
  
  // Validar nombre
  const nombre = document.getElementById("nombre");
  const nombreError = document.getElementById("nombreError");
  if (nombre && nombreError) {
    if (!nombre.value || nombre.value.trim().length < 2) {
      nombreError.textContent = "Nombre debe tener al menos 2 caracteres";
      nombreError.classList.remove("hidden");
      isValid = false;
    } else {
      nombreError.classList.add("hidden");
    }
  }
  
  // Validar email
  const email = document.getElementById("email");
  const emailError = document.getElementById("emailError");
  if (email && emailError) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.value || !emailRegex.test(email.value)) {
      emailError.textContent = "Email inválido";
      emailError.classList.remove("hidden");
      isValid = false;
    } else {
      emailError.classList.add("hidden");
    }
  }
  
  // Validar teléfono
  const telefono = document.getElementById("telefono");
  const telefonoError = document.getElementById("telefonoError");
  if (telefono && telefonoError) {
    const phoneRegex = /^[0-9+\-\s\(\)]{10,}$/;
    if (!telefono.value || !phoneRegex.test(telefono.value)) {
      telefonoError.textContent = "Teléfono debe tener al menos 10 caracteres";
      telefonoError.classList.remove("hidden");
      isValid = false;
    } else {
      telefonoError.classList.add("hidden");
    }
  }
  
  return isValid;
}

function updateCalculations() {
  const hombres = parseInt(document.getElementById("men").value || 0, 10);
  const mujeres = parseInt(document.getElementById("women").value || 0, 10);
  const needed = hombres + mujeres;
  
  document.getElementById("needed").textContent = needed;
  
  const entrada = document.getElementById("dateIn").value;
  const salida = document.getElementById("dateOut").value;
  
  if (entrada && salida) {
    const nights = calcNights(entrada, salida);
    const total = needed * nights * PRICE_PER_NIGHT;
    document.getElementById("totalPrice").textContent = total;
    
    // Actualizar progress bar
    const progressFill = document.getElementById("progressFill");
    if (progressFill && needed > 0) {
      const selectedBeds = document.querySelectorAll(".bed.selected").length;
      const percentage = (selectedBeds / needed) * 100;
      progressFill.style.width = `${Math.min(percentage, 100)}%`;
    }
  }
}

function getBedLevel(bedNumber) {
  const mod = bedNumber % 3;
  if (mod === 1) return "Baja";
  if (mod === 2) return "Media";
  return "Alta";
}

function getBedOrderForDisplay(totalBeds) {
  // Para 12 camas: [3,6,9,12, 2,5,8,11, 1,4,7,10]
  // Para 7 camas: [3,6, 2,5, 1,4, 7] (7 va al final)
  const order = [];
  
  if (totalBeds === 12) {
    // 4 literas completas
    for (let level = 3; level >= 1; level--) {
      for (let bunk = 0; bunk < 4; bunk++) {
        const bedNum = bunk * 3 + level;
        order.push(bedNum);
      }
    }
  } else if (totalBeds === 7) {
    // 2 literas completas + 1 cama individual
    for (let level = 3; level >= 1; level--) {
      for (let bunk = 0; bunk < 2; bunk++) {
        const bedNum = bunk * 3 + level;
        order.push(bedNum);
      }
    }
    order.push(7); // Cama individual
  }
  
  return order;
}

function addRoom(container, roomId, type, maxBeds) {
  const roomEl = document.createElement("div");
  roomEl.className = "room";
  roomEl.dataset.room = roomId;
  roomEl.innerHTML = `<h3>Habitación ${roomId} (${type})</h3><div class="beds"></div>`;
  
  const bedsDiv = roomEl.querySelector(".beds");
  const totalBeds = ROOMS[roomId];
  const bedOrder = getBedOrderForDisplay(totalBeds);
  
  // Mostrar TODAS las camas siempre, no solo las necesarias
  bedOrder.forEach(bedNumber => {
    const bedEl = document.createElement("div");
    bedEl.className = "bed";
    bedEl.dataset.room = roomId;
    bedEl.dataset.bed = bedNumber;
    
    const level = getBedLevel(bedNumber);
    bedEl.innerHTML = `
      <div class="bed-number">Cama ${bedNumber}</div>
      <div class="bed-level">(${level})</div>
    `;
    
    bedsDiv.appendChild(bedEl);
  });

  container.appendChild(roomEl);
  return roomEl;
}

function updateRoomDisplay() {
  const hombres = parseInt(document.getElementById("men").value || 0, 10);
  const mujeres = parseInt(document.getElementById("women").value || 0, 10);
  const total = hombres + mujeres;

  if (total === 0) {
    document.getElementById("rooms").innerHTML = "";
    roomsCard.style.display = "none";
    return;
  }

  roomsCard.style.display = "block";
  const roomsDiv = document.getElementById("rooms");
  roomsDiv.innerHTML = "";

  // Lógica de aparición de habitaciones
  
  // Siempre mostrar cuarto 1 y 5 si hay huéspedes
  if (total > 0) {
    addRoom(roomsDiv, 1, "Mixta", total);
    addRoom(roomsDiv, 5, "Mixta", total);
  }
  
  // Cuarto 3 aparece si necesitan más de 12 camas
  if (total > 12) {
    // Insertar cuarto 3 después del cuarto 1
    const room1 = roomsDiv.querySelector('[data-room="1"]');
    const room3 = addRoom(document.createElement('div'), 3, "Mixta", total);
    room1.after(room3.children[0]);
  }
  
  // Cuarto 6 (femenino) aparece si hay mujeres
  if (mujeres > 0) {
    const room6 = addRoom(roomsDiv, 6, "Solo mujeres", total);
    const warning = document.createElement("div");
    warning.className = "warning";
    warning.textContent = "Este cuarto es exclusivo para mujeres.";
    room6.appendChild(warning);
  }
  // Excepción: si hombres > 31 Y no hay mujeres, cuarto 6 para hombres
  else if (hombres > 31) {
    const room6 = addRoom(roomsDiv, 6, "Emergencia (hombres)", total);
    const warning = document.createElement("div");
    warning.className = "warning";
    warning.textContent = "Uso excepcional para capacidad extra de hombres.";
    room6.appendChild(warning);
  }
}

// Event listeners
document.addEventListener("DOMContentLoaded", function() {
  console.log("DOM loaded - setting up bunk bed controls");
  
  // Verificar HTTPS en producción
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    console.warn("Redirigiendo a HTTPS...");
    location.replace(`https:${location.href.substring(location.protocol.length)}`);
    return;
  }
  
  // Configurar fecha mínima = hoy
  const today = new Date().toISOString().split('T')[0];
  const dateInInput = document.getElementById("dateIn");
  const dateOutInput = document.getElementById("dateOut");
  
  if (dateInInput) {
    dateInInput.min = today;
  }
  if (dateOutInput) {
    dateOutInput.min = today;
  }
  
  // Botones hombres
  const menPlus = document.getElementById("menPlus");
  const menMinus = document.getElementById("menMinus");
  const womenPlus = document.getElementById("womenPlus");
  const womenMinus = document.getElementById("womenMinus");

  if (menPlus) {
    menPlus.addEventListener("click", function() {
      console.log("Men plus clicked");
      try {
        const input = document.getElementById("men");
        if (!input) throw new Error("Men input not found");
        const current = parseInt(input.value || 0, 10);
        input.value = Math.min(38, current + 1);
        updateCalculations();
        updateRoomDisplay();
      } catch (error) {
        console.error("Error in men plus:", error);
      }
    });
  } else {
    console.warn("Men plus button not found");
  }

  if (menMinus) {
    menMinus.addEventListener("click", function() {
      console.log("Men minus clicked");
      try {
        const input = document.getElementById("men");
        if (!input) throw new Error("Men input not found");
        const current = parseInt(input.value || 0, 10);
        input.value = Math.max(0, current - 1);
        updateCalculations();
        updateRoomDisplay();
      } catch (error) {
        console.error("Error in men minus:", error);
      }
    });
  } else {
    console.warn("Men minus button not found");
  }

  if (womenPlus) {
    womenPlus.addEventListener("click", function() {
      console.log("Women plus clicked");
      try {
        const input = document.getElementById("women");
        if (!input) throw new Error("Women input not found");
        const current = parseInt(input.value || 0, 10);
        input.value = Math.min(38, current + 1);
        updateCalculations();
        updateRoomDisplay();
      } catch (error) {
        console.error("Error in women plus:", error);
      }
    });
  } else {
    console.warn("Women plus button not found");
  }

  if (womenMinus) {
    womenMinus.addEventListener("click", function() {
      console.log("Women minus clicked");
      try {
        const input = document.getElementById("women");
        if (!input) throw new Error("Women input not found");
        const current = parseInt(input.value || 0, 10);
        input.value = Math.max(0, current - 1);
        updateCalculations();
        updateRoomDisplay();
      } catch (error) {
        console.error("Error in women minus:", error);
      }
    });
  } else {
    console.warn("Women minus button not found");
  }

  // Ver disponibilidad (desactivado por ahora)
  const checkAvail = document.getElementById("checkAvail");
  if (checkAvail) {
    checkAvail.addEventListener("click", function() {
      console.log("Check availability clicked");
      const from = document.getElementById("dateIn").value;
      const to = document.getElementById("dateOut").value;
      if (!from || !to) {
        alert("Seleccioná fechas");
        return;
      }
      
      // Mostrar loading state
      const btnText = checkAvail.querySelector('.btn-text');
      const btnLoading = checkAvail.querySelector('.btn-loading');
      if (btnText && btnLoading) {
        btnText.classList.add('hidden');
        btnLoading.classList.remove('hidden');
        checkAvail.disabled = true;
      }
      
      // Simular delay y restaurar
      setTimeout(() => {
        if (btnText && btnLoading) {
          btnText.classList.remove('hidden');
          btnLoading.classList.add('hidden');
          checkAvail.disabled = false;
        }
      }, 2000);
      
      console.log("Availability check disabled for testing");
    });
  }

  // Selección de camas
  const roomsContainer = document.getElementById("rooms");
  if (roomsContainer) {
    roomsContainer.addEventListener("click", function(e) {
      const bed = e.target.closest('.bed');
      if (!bed || bed.classList.contains("occupied")) {
        return;
      }

      bed.classList.toggle("selected");
      
      const count = document.querySelectorAll(".bed.selected").length;
      document.getElementById("selCount").textContent = count;
      
      const needed = parseInt(document.getElementById("men").value || 0, 10) + 
                    parseInt(document.getElementById("women").value || 0, 10);
      
      // Actualizar progress bar
      const progressFill = document.getElementById("progressFill");
      if (progressFill && needed > 0) {
        const percentage = (count / needed) * 100;
        progressFill.style.width = `${Math.min(percentage, 100)}%`;
      }
      
      const continueBtn = document.getElementById("continueBtn");
      if (continueBtn) {
        continueBtn.disabled = count !== needed;
        // Iniciar timer cuando se completa la selección
        if (count === needed && needed > 0) {
          startHoldTimer(3);
          showSuccess("Camas reservadas temporalmente por 3 minutos");
        } else {
          stopHoldTimer();
        }
      }
    });
  }

  // Configurar validación token admin
  const admToken = document.getElementById("admToken");
  if (admToken) {
    admToken.addEventListener("blur", validateAdminToken);
  }
  
  // Admin buttons con seguridad
  const btnHealth = document.getElementById("btnHealth");
  const btnHolds = document.getElementById("btnHolds");
  const btnBookings = document.getElementById("btnBookings");
  
  if (btnHealth) {
    btnHealth.addEventListener("click", async function() {
      const result = await performAdminAction("health check", "/admin/health");
      if (result) {
        const healthOut = document.getElementById("healthOut");
        if (healthOut) {
          healthOut.textContent = JSON.stringify(result, null, 2);
        }
      }
    });
  }
  
  if (btnHolds) {
    btnHolds.addEventListener("click", async function() {
      const result = await performAdminAction("listar holds", "/admin/holds");
      if (result) {
        const holdsOut = document.getElementById("holdsOut");
        if (holdsOut) {
          holdsOut.innerHTML = `<table><tr><th>ID</th><th>Camas</th><th>Expira</th></tr>` +
            result.map(hold => `<tr><td>${hold.id}</td><td>${hold.beds.join(',')}</td><td>${hold.expires}</td></tr>`).join('') +
            `</table>`;
        }
      }
    });
  }
  
  if (btnBookings) {
    btnBookings.addEventListener("click", async function() {
      const from = document.getElementById("bkFrom")?.value;
      const to = document.getElementById("bkTo")?.value;
      const q = document.getElementById("bkQ")?.value;
      
      const params = new URLSearchParams();
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      if (q) params.append('q', q);
      
      const result = await performAdminAction("buscar reservas", `/admin/bookings?${params}`);
      if (result) {
        const bookingsOut = document.getElementById("bookingsOut");
        if (bookingsOut) {
          bookingsOut.innerHTML = `<table><tr><th>ID</th><th>Nombre</th><th>Email</th><th>Check-in</th><th>Camas</th></tr>` +
            result.map(booking => `<tr><td>${booking.id}</td><td>${booking.nombre}</td><td>${booking.email}</td><td>${booking.dateIn}</td><td>${booking.beds.join(',')}</td></tr>`).join('') +
            `</table>`;
        }
      }
    });
  }

  // Configurar validaciones en tiempo real
  const nombreInput = document.getElementById("nombre");
  const emailInput = document.getElementById("email");
  const telefonoInput = document.getElementById("telefono");
  
  if (nombreInput) {
    nombreInput.addEventListener("blur", validateAndSanitizeForm);
  }
  if (emailInput) {
    emailInput.addEventListener("blur", validateAndSanitizeForm);
  }
  if (telefonoInput) {
    telefonoInput.addEventListener("blur", validateAndSanitizeForm);
  }

  // Configurar cerrar toasts
  const closeError = document.getElementById("closeError");
  const closeSuccess = document.getElementById("closeSuccess");
  
  if (closeError) {
    closeError.addEventListener("click", function() {
      document.getElementById("errorToast").classList.add("hidden");
    });
  }
  
  if (closeSuccess) {
    closeSuccess.addEventListener("click", function() {
      document.getElementById("successToast").classList.add("hidden");
    });
  }

  console.log("All event listeners attached");
  updateCalculations();
  updateRoomDisplay();
});
