"use strict";

console.log("🏠 Lapa Casa Hostel - Sistema de Reservas v2.0");

let currentBookingData = null;
let selectedBeds = [];

const elements = {
  roomsCard: document.getElementById("roomsCard"),
  formCard: document.getElementById("formCard"),
  dateIn: document.getElementById("dateIn"),
  dateOut: document.getElementById("dateOut"),
  men: document.getElementById("men"),
  women: document.getElementById("women"),
  totalPrice: document.getElementById("totalPrice"),
  nightsCount: document.getElementById("nightsCount"),
  selCount: document.getElementById("selCount"),
  needed: document.getElementById("needed")
};

document.addEventListener("DOMContentLoaded", function() {
  console.log("📡 Inicializando sistema...");
  
  setupDateInputs();
  setupGuestControls();
  setupAvailabilityCheck();
  setupNavigation();
  setupFormHandling();
  setupPaymentButtons();
  setupAdminPanel();
  
  setupStateIntegration();
  
  console.log("✅ Sistema inicializado");
});

function setupStateIntegration() {
  const waitForIntegration = () => {
    if (window.stateManager && window.stateIntegration) {
      setTimeout(() => {
        restoreApplicationState();
      }, 500);
    } else {
      setTimeout(waitForIntegration, 100);
    }
  };
  waitForIntegration();
}

function restoreApplicationState() {
  const stateManager = window.stateManager;
  const currentStep = stateManager.getCurrentStep();
  
  switch (currentStep) {
    case 'rooms':
    case 'beds':
      if (elements.roomsCard) elements.roomsCard.classList.remove('hidden');
      break;
    case 'form':
    case 'payment':
      if (elements.roomsCard) elements.roomsCard.classList.add('hidden');
      if (elements.formCard) elements.formCard.classList.remove('hidden');
      break;
  }
  
  const searchCriteria = stateManager.getSearchCriteria();
  if (searchCriteria?.dateIn) {
    updateCalculations();
  }
}

function setupDateInputs() {
  const today = new Date().toISOString().split("T")[0];
  if (elements.dateIn) {
    elements.dateIn.min = today;
    elements.dateIn.addEventListener('change', () => {
      updateCalculations();
      saveSearchCriteria();
    });
  }
  if (elements.dateOut) {
    elements.dateOut.min = today;
    elements.dateOut.addEventListener('change', () => {
      updateCalculations();
      saveSearchCriteria();
    });
  }
}

function setupGuestControls() {
  const controls = [
    { plus: 'menPlus', minus: 'menMinus', input: 'men' },
    { plus: 'womenPlus', minus: 'womenMinus', input: 'women' }
  ];
  
  controls.forEach(control => {
    const plusBtn = document.getElementById(control.plus);
    const minusBtn = document.getElementById(control.minus);
    const input = document.getElementById(control.input);
    
    if (plusBtn && input) {
      plusBtn.addEventListener('click', () => {
        const current = parseInt(input.value || 0);
        input.value = Math.min(38, current + 1);
        updateCalculations();
        saveSearchCriteria();
      });
    }
    
    if (minusBtn && input) {
      minusBtn.addEventListener('click', () => {
        const current = parseInt(input.value || 0);
        input.value = Math.max(0, current - 1);
        updateCalculations();
        saveSearchCriteria();
      });
    }
    
    if (input) {
      input.addEventListener('change', () => {
        updateCalculations();
        saveSearchCriteria();
      });
    }
  });
}

function saveSearchCriteria() {
  if (!window.stateManager) return;
  
  const dateIn = elements.dateIn?.value;
  const dateOut = elements.dateOut?.value;
  const men = parseInt(elements.men?.value || 0);
  const women = parseInt(elements.women?.value || 0);
  
  if (dateIn && dateOut && (men > 0 || women > 0)) {
    window.stateManager.setSearchCriteria(dateIn, dateOut, men, women);
  }
}

function setupAvailabilityCheck() {
  const checkBtn = document.getElementById("checkAvail");
  if (checkBtn) {
    checkBtn.addEventListener('click', async () => {
      await window.loadingManager?.withLoading(checkBtn, async () => {
        await checkAvailability();
      }, 'Verificando disponibilidad...') || checkAvailability();
    });
  }
}

async function checkAvailability() {
  const dateIn = elements.dateIn?.value;
  const dateOut = elements.dateOut?.value;
  const men = parseInt(elements.men?.value || 0);
  const women = parseInt(elements.women?.value || 0);
  
  if (!dateIn || !dateOut) {
    showError('Selecciona fechas de entrada y salida');
    return;
  }
  
  if (men + women === 0) {
    showError('Selecciona al menos un huésped');
    return;
  }
  
  if (new Date(dateOut) <= new Date(dateIn)) {
    showError('La fecha de salida debe ser posterior a la entrada');
    return;
  }
  
  if (window.stateManager?.isAvailabilityDataValid()) {
    const cachedData = window.stateManager.getAvailabilityData();
    const savedCriteria = window.stateManager.getSearchCriteria();
    
    if (savedCriteria && 
        savedCriteria.dateIn === dateIn && 
        savedCriteria.dateOut === dateOut &&
        savedCriteria.men === men && 
        savedCriteria.women === women) {
      
      displayRooms(cachedData);
      elements.roomsCard?.classList.remove('hidden');
      showSuccess('Disponibilidad cargada desde caché');
      return;
    }
  }
  
  try {
    saveSearchCriteria();
    
    const availability = await window.apiClient.checkAvailability({
      dateIn, dateOut, guests: { men, women }
    });
    
    if (window.stateManager) {
      window.stateManager.setAvailabilityData(availability);
    }
    
    displayRooms(availability);
    elements.roomsCard?.classList.remove('hidden');
    showSuccess(`Disponibilidad verificada - ${availability.totalAvailable} camas disponibles`);
    
  } catch (error) {
    console.error('Error verificando disponibilidad:', error);
    showError(`Error: ${error.message}`);
  }
}

function displayRooms(availability) {
  const roomsContainer = document.getElementById("rooms");
  if (!roomsContainer) return;
  
  roomsContainer.innerHTML = "";
  
  if (window.stateManager) {
    window.stateManager.clearSelectedBeds();
    window.stateManager.clearHold();
  }
  
  selectedBeds = [];
  
  const men = parseInt(elements.men?.value || 0);
  const women = parseInt(elements.women?.value || 0);
  
  if (window.roomManager) {
    window.roomManager.display(men, women, availability, roomsContainer);
  }
  
  setupBedSelectionWithState();
}

function setupBedSelectionWithState() {
  if (window.bedSelectionManager) {
    const roomsContainer = document.getElementById('rooms');
    window.bedSelectionManager.setupBedSelection(roomsContainer);
  } else {
    setupBedSelectionOriginal();
  }
}

function setupBedSelectionOriginal() {
  const roomsDiv = document.getElementById('rooms');
  if (!roomsDiv) return;
  
  roomsDiv.addEventListener('click', (e) => {
    const bed = e.target.closest('.bed');
    if (!bed || bed.classList.contains('occupied')) return;
    
    bed.classList.toggle('selected');
    
    const selected = document.querySelectorAll('.bed.selected');
    const men = parseInt(elements.men?.value || 0);
    const women = parseInt(elements.women?.value || 0);
    const needed = men + women;
    
    if (elements.selCount) elements.selCount.textContent = selected.length;
    if (elements.needed) elements.needed.textContent = needed;
    
    const continueBtn = document.getElementById('continueBtn');
    if (continueBtn) {
      continueBtn.disabled = selected.length !== needed;
      
      if (selected.length === needed && needed > 0) {
        if (window.stateManager && window.timerManager) {
          const beds = Array.from(selected).map(bed => ({
            room: bed.dataset.room,
            bed: bed.dataset.bed
          }));
          
          window.stateManager.setSelectedBeds(beds);
          window.timerManager.startHold(3);
        }
        
        showSuccess('Camas reservadas temporalmente por 3 minutos');
      }
    }
    
    window.progressManager?.update();
  });
  
  const continueBtn = document.getElementById('continueBtn');
  if (continueBtn) {
    continueBtn.addEventListener('click', handleContinueToForm);
  }
}

function handleContinueToForm() {
  const selected = document.querySelectorAll('.bed.selected');
  const needed = parseInt(elements.men?.value || 0) + parseInt(elements.women?.value || 0);
  
  if (selected.length !== needed) {
    showError('Selecciona exactamente las camas necesarias');
    return;
  }
  
  selectedBeds = Array.from(selected).map(bed => ({
    room: bed.dataset.room,
    bed: bed.dataset.bed
  }));
  
  if (window.stateManager) {
    window.stateManager.setSelectedBeds(selectedBeds);
    window.stateManager.updateStep('form');
  }
  
  elements.roomsCard?.classList.add('hidden');
  elements.formCard?.classList.remove('hidden');
  
  showSuccess('Procede a completar tus datos');
}

function setupNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.dataset.section;
      document.getElementById('book')?.classList.add('hidden');
      document.getElementById('admin')?.classList.add('hidden');
      document.getElementById(section)?.classList.remove('hidden');
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });
}

function setupFormHandling() {
  const form = document.getElementById('reserva-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleFormSubmit();
    });
  }
  
  ['nombre', 'email', 'telefono'].forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.addEventListener('blur', () => {
        window.formValidator?.validateField(fieldId);
      });
      
