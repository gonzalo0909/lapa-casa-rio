import { stateManager } from './business/state-manager.js';
import { apiClient } from './core/api-client.js';
import { formValidator } from './business/form-validator.js';
import { dateValidator } from './business/date-validator.js';
import { bookingValidator } from './business/booking-validator.js';
import { validationIntegration } from './business/validation-integration.js';
import { roomManager } from './business/room-manager.js';
import { bedSelectionManager } from './ui/bed-selection-manager.js';
import { progressManager } from './ui/progress-manager.js';
import { loadingManager } from './ui/loading-manager.js';
import { timerManager } from './ui/timer-manager.js';
import { toastManager } from './ui/toast-manager.js';
import { visualFeedbackManager } from './ui/visual-feedback-manager.js';

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
    if (stateManager && validationIntegration) {
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
  if (!stateManager) return;
  
  const dateIn = elements.dateIn?.value;
  const dateOut = elements.dateOut?.value;
  const men = parseInt(elements.men?.value || 0);
  const women = parseInt(elements.women?.value || 0);
  
  if (dateIn && dateOut && (men > 0 || women > 0)) {
    stateManager.setSearchCriteria(dateIn, dateOut, men, women);
  }
}

function setupAvailabilityCheck() {
  const checkBtn = document.getElementById("checkAvail");
  if (checkBtn) {
    checkBtn.addEventListener('click', async () => {
      await loadingManager?.withLoading(checkBtn, async () => {
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
  
  if (stateManager?.isAvailabilityDataValid()) {
    const cachedData = stateManager.getAvailabilityData();
    const savedCriteria = stateManager.getSearchCriteria();
    
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
    
    const availability = await apiClient.checkAvailability({
      dateIn, dateOut, guests: { men, women }
    });
    
    stateManager.setAvailabilityData(availability);
    
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
  
  stateManager.clearSelectedBeds();
  stateManager.clearHold();
  
  selectedBeds = [];
  
  const men = parseInt(elements.men?.value || 0);
  const women = parseInt(elements.women?.value || 0);
  
  roomManager.display(men, women, availability, roomsContainer);
  
  if (bedSelectionManager) {
    bedSelectionManager.setupBedSelection(roomsContainer);
  }
}

function setupBedSelectionWithState() {
  if (bedSelectionManager) {
    const roomsContainer = document.getElementById('rooms');
    bedSelectionManager.setupBedSelection(roomsContainer);
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
  
  stateManager.setSelectedBeds(selectedBeds);
  stateManager.updateStep('form');
  
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
        formValidator.validateField(fieldId);
      });
      
      field.addEventListener('input', (e) => {
        if (stateManager) {
          stateManager.setFormData(fieldId, e.target.value);
        }
      });
    }
  });
}

async function handleFormSubmit() {
  if (!formValidator.validateAll()) {
    showError('Completa correctamente todos los campos');
    return;
  }
  
  const payState = document.getElementById('payState')?.textContent;
  if (payState === 'Pendiente') {
    showError('Completa el pago antes de confirmar');
    return;
  }
  
  try {
    const completeData = stateManager?.getCompleteBookingData() || {};
    
    const bookingData = {
      dateIn: elements.dateIn?.value || completeData.searchCriteria?.dateIn,
      dateOut: elements.dateOut?.value || completeData.searchCriteria?.dateOut,
      guests: {
        men: parseInt(elements.men?.value || 0),
        women: parseInt(elements.women?.value || 0)
      },
      beds: selectedBeds.length > 0 ? selectedBeds : completeData.selectedBeds,
      guest: {
        nombre: document.getElementById('nombre')?.value,
        email: document.getElementById('email')?.value,
        telefono: document.getElementById('telefono')?.value
      },
      paymentInfo: currentBookingData?.paymentInfo || completeData.paymentInfo
    };
    
    const booking = await apiClient.createBooking(bookingData);
    
    stateManager.setBookingData(booking);
    stateManager.updateStep('complete');
    
    showSuccess('¡Reserva confirmada! Recibirás un email de confirmación.');
    
    setTimeout(() => {
      stateManager.reset();
      window.location.reload();
    }, 3000);
    
  } catch (error) {
    console.error('Error creando reserva:', error);
    showError(`Error: ${error.message}`);
  }
}

function setupPaymentButtons() {
  const buttons = [
    { id: 'payMP', method: 'mercadopago' },
    { id: 'payStripe', method: 'stripe' },
    { id: 'payPix', method: 'pix' }
  ];
  
  buttons.forEach(({ id, method }) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', async () => {
        await loadingManager?.withLoading(btn, async () => {
          await handlePayment(method);
        }, `Procesando ${method}...`) || handlePayment(method);
      });
    }
  });
}

async function handlePayment(method) {
  const total = calculateTotal();
  
  const stateData = stateManager?.getCompleteBookingData() || {};
  
  const paymentData = {
    amount: total,
    currency: 'BRL',
    beds: selectedBeds.length > 0 ? selectedBeds : stateData.selectedBeds,
    guest: {
      nombre: document.getElementById('nombre')?.value,
      email: document.getElementById('email')?.value,
      telefono: document.getElementById('telefono')?.value
    },
    dates: {
      checkIn: elements.dateIn?.value || stateData.searchCriteria?.dateIn,
      checkOut: elements.dateOut?.value || stateData.searchCriteria?.dateOut
    }
  };
  
  try {
    let paymentResult;
    
    switch (method) {
      case 'mercadopago':
        paymentResult = await apiClient.createMercadoPagoPayment(paymentData);
        window.location.href = paymentResult.redirectUrl;
        break;
        
      case 'stripe':
        paymentResult = await apiClient.createStripePayment(paymentData);
        window.location.href = paymentResult.redirectUrl;
        break;
        
      case 'pix':
        paymentResult = await apiClient.createPixPayment(paymentData);
        showPixQR(paymentResult.qrCode, paymentResult.pixKey);
        break;
    }
    
    if (paymentResult) {
      currentBookingData = { paymentInfo: paymentResult };
      stateManager.setPaymentInfo(paymentResult);
      updatePaymentStatus('Pagado');
    }
    
  } catch (error) {
    console.error('Error procesando pago:', error);
    showError(`Error en pago: ${error.message}`);
  }
}

function showPixQR(qrCode, pixKey) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Pago via Pix</h3>
      <div class="qr-code">${qrCode}</div>
      <p>Chave Pix: ${pixKey}</p>
      <button onclick="this.closest('.modal').remove()">Fechar</button>
    </div>
  `;
  document.body.appendChild(modal);
}

function setupAdminPanel() {
  const buttons = [
    { id: 'btnHealth', action: 'health' },
    { id: 'btnHolds', action: 'holds' },
    { id: 'btnBookings', action: 'bookings' }
  ];
  
  buttons.forEach(({ id, action }) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', async () => {
        await handleAdminAction(action);
      });
    }
  });
}

async function handleAdminAction(action) {
  const token = document.getElementById('admToken')?.value;
  
  if (!token) {
    showError('Ingresa el token de admin');
    return;
  }
  
  try {
    let result;
    
    switch (action) {
      case 'health':
        result = await apiClient.adminHealth(token);
        document.getElementById('healthOut').textContent = JSON.stringify(result, null, 2);
        break;
        
      case 'holds':
        result = await apiClient.adminHolds(token);
        document.getElementById('holdsOut').innerHTML = formatHolds(result);
        break;
        
      case 'bookings':
        const filters = {
          from: document.getElementById('bkFrom')?.value,
          to: document.getElementById('bkTo')?.value,
          query: document.getElementById('bkQ')?.value
        };
        result = await apiClient.adminBookings(token, filters);
        document.getElementById('bookingsOut').innerHTML = formatBookings(result);
        break;
    }
    
  } catch (error) {
    console.error('Error en admin:', error);
    showError(`Error: ${error.message}`);
  }
}

function updateCalculations() {
  const men = parseInt(elements.men?.value || 0);
  const women = parseInt(elements.women?.value || 0);
  const total = men + women;
  
  if (elements.needed) elements.needed.textContent = total;
  
  const dateIn = elements.dateIn?.value;
  const dateOut = elements.dateOut?.value;
  
  if (dateIn && dateOut) {
    const nights = Math.max(1, Math.ceil((new Date(dateOut) - new Date(dateIn)) / (1000 * 60 * 60 * 24)));
    const totalPrice = total * nights * (window.HOSTEL_CONFIG?.PRICE_PER_NIGHT || 55);
    
    if (elements.totalPrice) elements.totalPrice.textContent = totalPrice;
    if (elements.nightsCount) elements.nightsCount.textContent = nights;
  }
  
  progressManager?.update();
}

function calculateTotal() {
  const men = parseInt(elements.men?.value || 0);
  const women = parseInt(elements.women?.value || 0);
  const dateIn = elements.dateIn?.value;
  const dateOut = elements.dateOut?.value;
  
  if (!dateIn || !dateOut) return 0;
  
  const nights = Math.max(1, Math.ceil((new Date(dateOut) - new Date(dateIn)) / (1000 * 60 * 60 * 24)));
  return (men + women) * nights * (window.HOSTEL_CONFIG?.PRICE_PER_NIGHT || 55);
}

function updatePaymentStatus(status) {
  const payState = document.getElementById('payState');
  const submitBtn = document.getElementById('submitBtn');
  
  if (payState) {
    payState.textContent = status;
    payState.className = status === 'Pagado' ? 'status-paid' : 'status-pending';
  }
  
  if (submitBtn) {
    submitBtn.disabled = status !== 'Pagado';
  }
}

function showError(message) {
  toastManager?.showError(message) || alert(`Error: ${message}`);
}

function showSuccess(message) {
  toastManager?.showSuccess(message) || console.log(`Success: ${message}`);
}

function formatHolds(holds) {
  return holds.map(hold => `
    <div class="hold-item">
      <strong>${hold.id}</strong> - ${hold.beds.length} camas
      <br>Expira: ${new Date(hold.expires).toLocaleString()}
    </div>
  `).join('');
}

function formatBookings(bookings) {
  return bookings.map(booking => `
    <div class="booking-item">
      <strong>${booking.id}</strong> - ${booking.guest.nombre}
      <br>${booking.guest.email} - ${booking.beds.length} camas
      <br>Fechas: ${booking.checkIn} a ${booking.checkOut}
    </div>
  `).join('');
}

window.addEventListener('beforeunload', () => {
  timerManager?.cleanup();
  if (stateManager) {
    stateManager.saveState();
  }
});
