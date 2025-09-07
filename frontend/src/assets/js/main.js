// Importaciones (simuladas para Vite)
// En un entorno real con Vite, estos serían imports reales.
// Aquí se asume que los scripts se cargan globalmente vía <script> en index.html.

console.log("🏠 Lapa Casa Hostel - Sistema de Reservas v2.0");

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

document.addEventListener("DOMContentLoaded", async function() {
  console.log("📡 Inicializando sistema...");
  try {
    await window.dependencyManager.initializeSequentially();
    setupDateInputs();
    setupGuestControls();
    setupAvailabilityCheck();
    setupNavigation();
    setupFormHandling();
    setupPaymentButtons();
    setupAdminPanel();
    if (window.stateManager) {
      restoreApplicationState();
    }
    console.log("✅ Sistema inicializado");
  } catch (error) {
    console.error("❌ Error inicializando sistema:", error);
    if (window.toastManager) {
      window.toastManager.showError("Error iniciando aplicación");
    }
  }
});

function restoreApplicationState() {
  const currentStep = window.stateManager.getCurrentStep();
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
  const searchCriteria = window.stateManager.getSearchCriteria();
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
      if (window.loadingManager) {
        await window.loadingManager.withLoading(checkBtn, checkAvailability, 'Verificando disponibilidad...');
      } else {
        await checkAvailability();
      }
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
    window.stateManager.setAvailabilityData(availability);
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
  window.stateManager.clearSelectedBeds();
  window.stateManager.clearHold();
  const men = parseInt(elements.men?.value || 0);
  const women = parseInt(elements.women?.value || 0);
  window.roomManager.display(men, women, availability, roomsContainer);
  if (window.bedSelectionManager) {
    window.bedSelectionManager.setupBedSelection(roomsContainer);
  }
}

function handleContinueToForm() {
  const selected = document.querySelectorAll('.bed.selected');
  const needed = parseInt(elements.men?.value || 0) + parseInt(elements.women?.value || 0);
  if (selected.length !== needed) {
    showError('Selecciona exactamente las camas necesarias');
    return;
  }
  const selectedBeds = Array.from(selected).map(bed => ({
    room: bed.dataset.room,
    bed: bed.dataset.bed
  }));
  window.stateManager.setSelectedBeds(selectedBeds);
  window.stateManager.updateStep('form');
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
        window.formValidator.validateField(fieldId);
      });
      field.addEventListener('input', (e) => {
        if (window.stateManager) {
          window.stateManager.setFormData(fieldId, e.target.value);
        }
      });
    }
  });
}

async function handleFormSubmit() {
  if (!window.formValidator.validateAll()) {
    showError('Completa correctamente todos los campos');
    return;
  }
  const payState = document.getElementById('payState')?.textContent;
  if (payState === 'Pendiente') {
    showError('Completa el pago antes de confirmar');
    return;
  }
  try {
    const completeData = window.stateManager?.getCompleteBookingData() || {};
    const bookingData = {
      dateIn: elements.dateIn?.value || completeData.searchCriteria?.dateIn,
      dateOut: elements.dateOut?.value || completeData.searchCriteria?.dateOut,
      guests: {
        men: parseInt(elements.men?.value || 0),
        women: parseInt(elements.women?.value || 0)
      },
      beds: window.stateManager.getSelectedBeds() || completeData.selectedBeds,
      guest: {
        nombre: document.getElementById('nombre')?.value,
        email: document.getElementById('email')?.value,
        telefono: document.getElementById('telefono')?.value
      },
      paymentInfo: window.stateManager.getPaymentInfo() || completeData.paymentInfo
    };
    const booking = await window.apiClient.createBooking(bookingData);
    window.stateManager.setBookingData(booking);
    window.stateManager.updateStep('complete');
    showSuccess('¡Reserva confirmada! Recibirás un email de confirmación.');
    setTimeout(() => {
      window.stateManager.reset();
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
        if (window.loadingManager) {
          await window.loadingManager.withLoading(btn, () => handlePayment(method), `Procesando ${method}...`);
        } else {
          await handlePayment(method);
        }
      });
    }
  });
}

async function handlePayment(method) {
  const total = calculateTotal();
  const stateData = window.stateManager?.getCompleteBookingData() || {};
  const paymentData = {
    amount: total,
    currency: 'BRL',
    beds: window.stateManager.getSelectedBeds() || stateData.selectedBeds,
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
        paymentResult = await window.apiClient.createMercadoPagoPayment(paymentData);
        window.location.href = paymentResult.redirectUrl;
        break;
      case 'stripe':
        paymentResult = await window.apiClient.createStripePayment(paymentData);
        window.location.href = paymentResult.redirectUrl;
        break;
      case 'pix':
        paymentResult = await window.apiClient.createPixPayment(paymentData);
        showPixQR(paymentResult.qrCode, paymentResult.pixKey);
        break;
    }
    if (paymentResult) {
      window.stateManager.setPaymentInfo(paymentResult);
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
  const content = document.createElement('div');
  content.className = 'modal-content';
  const title = document.createElement('h3');
  title.textContent = 'Pago via Pix';
  const qrDiv = document.createElement('div');
  qrDiv.className = 'qr-code';
  qrDiv.textContent = qrCode;
  const pixP = document.createElement('p');
  pixP.textContent = `Chave Pix: ${pixKey}`;
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Fechar';
  closeBtn.onclick = () => modal.remove();
  content.append(title, qrDiv, pixP, closeBtn);
  modal.appendChild(content);
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
        result = await window.apiClient.adminHealth(token);
        document.getElementById('healthOut').textContent = JSON.stringify(result, null, 2);
        break;
      case 'holds':
        result = await window.apiClient.adminHolds(token);
        document.getElementById('holdsOut').innerHTML = formatHolds(result);
        break;
      case 'bookings':
        const filters = {
          from: document.getElementById('bkFrom')?.value,
          to: document.getElementById('bkTo')?.value,
          query: document.getElementById('bkQ')?.value
        };
        result = await window.apiClient.adminBookings(token, filters);
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
  if (window.progressManager) {
    window.progressManager.update();
  }
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
  if (window.toastManager) {
    window.toastManager.showError(message);
  } else {
    alert(`Error: ${message}`);
  }
}

function showSuccess(message) {
  if (window.toastManager) {
    window.toastManager.showSuccess(message);
  } else {
    console.log(`Success: ${message}`);
  }
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

window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    window.timerManager?.cleanup();
    if (window.stateManager) {
      window.stateManager.saveState();
    }
  }
});

window.addEventListener('pagehide', () => {
  window.timerManager?.cleanup();
  if (window.stateManager) {
    window.stateManager.saveState();
  }
});
