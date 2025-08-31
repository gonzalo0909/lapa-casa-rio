"use strict";

console.log("Loading main.js with bunk bed layout");

// Configuración
const ROOMS = { 1: 12, 3: 12, 5: 7, 6: 7 };
const PRICE_PER_NIGHT = 55;

// Referencias DOM
const roomsCard = document.getElementById("roomsCard");
const formCard = document.getElementById("formCard");

// Funciones principales
function calcNights(inDate, outDate) {
  const d1 = new Date(inDate);
  const d2 = new Date(outDate);
  const diff = d2 - d1;
  return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 1;
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
  
  // Excepción: si hombres > 31, cuarto 6 puede usarse para hombres
  if (hombres > 31 && mujeres === 0) {
    const room6 = addRoom(roomsDiv, 6, "Emergencia (hombres)", total);
    const warning = document.createElement("div");
    warning.className = "warning";
    warning.textContent = "Uso excepcional para capacidad extra.";
    room6.appendChild(warning);
  }
}

// Event listeners
document.addEventListener("DOMContentLoaded", function() {
  console.log("DOM loaded - setting up bunk bed controls");
  
  // Botones hombres
  const menPlus = document.getElementById("menPlus");
  const menMinus = document.getElementById("menMinus");
  const womenPlus = document.getElementById("womenPlus");
  const womenMinus = document.getElementById("womenMinus");

  if (menPlus) {
    menPlus.addEventListener("click", function() {
      console.log("Men plus clicked");
      const input = document.getElementById("men");
      const current = parseInt(input.value || 0, 10);
      input.value = Math.min(38, current + 1);
      updateCalculations();
      updateRoomDisplay();
    });
  }

  if (menMinus) {
    menMinus.addEventListener("click", function() {
      console.log("Men minus clicked");
      const input = document.getElementById("men");
      const current = parseInt(input.value || 0, 10);
      input.value = Math.max(0, current - 1);
      updateCalculations();
      updateRoomDisplay();
    });
  }

  if (womenPlus) {
    womenPlus.addEventListener("click", function() {
      console.log("Women plus clicked");
      const input = document.getElementById("women");
      const current = parseInt(input.value || 0, 10);
      input.value = Math.min(38, current + 1);
      updateCalculations();
      updateRoomDisplay();
    });
  }

  if (womenMinus) {
    womenMinus.addEventListener("click", function() {
      console.log("Women minus clicked");
      const input = document.getElementById("women");
      const current = parseInt(input.value || 0, 10);
      input.value = Math.max(0, current - 1);
      updateCalculations();
      updateRoomDisplay();
    });
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
      
      const continueBtn = document.getElementById("continueBtn");
      if (continueBtn) {
        continueBtn.disabled = count !== needed;
      }
    });
  }

  console.log("All event listeners attached");
  updateCalculations();
  updateRoomDisplay();
});
