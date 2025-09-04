"use strict";

console.log("🏠 Lapa Casa Hostel - Sistema de Reservas v2.0");

// Estado global
let currentBookingData = null;
let selectedBeds = [];

// Elementos DOM principales
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

// Inicialización principal
document.addEventListener("DOMContentLoaded", function() {
  console.log("📡 Inicializando sistema...");
  
  setupDateInputs();
  setupGuestControls();
  setupAvailabilityCheck();
  setupNavigation();
  setupFormHandling();
  setupPaymentButtons();
  setupAdminPanel();
  
  console.log("✅ Sistema inicializado");
});

// Configurar inputs de fecha
function setupDateInputs() {
  const today = new Date().toISOString().split("T")[0];
  
  if (elements.dateIn) {
    elements.dateIn.min = today;
    elements.dateIn.addEventListener('change', updateCalculations);
  }
  
  if (elements.dateOut) {
    elements.dateOut.min = today;
    elements.dateOut.addEventListener('change', updateCalculations);
  }
}

// Configurar controles de huéspedes
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
      });
    }
    
    if (minusBtn && input) {
      minusBtn.addEventListener('click', () => {
        const current = parseInt(input.value || 0);
        input.value = Math.max(0, current - 1);
        updateCalculations();
      });
    }
    
    if (input) {
      input.addEventListener('change', updateCalculations);
    }
  });
}

// Configurar verificación de disponibilidad
function setupAvailabilityCheck() {
  const checkBtn = document.getElementById("checkAvail");
  
  if (checkBtn) {
    checkBtn.addEventListener('click', async () => {
      await window.loadingManager?.withLoading(checkBtn, async () => {
        await checkAvailability();
      }) || checkAvailability();
    });
  }
}

// Verificar disponibilidad
async function checkAvailability() {
  const dateIn = elements.dateIn?.value;
  const dateOut = elements.dateOut?.value;
  const men = parseInt(elements.men?.value || 0);
  const women = parseInt(elements.women?.value || 0);
  
  // Validaciones
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
  
  // Rate limiting
  if (!window.rateLimiter?.canRequest('availability')) {
    showError('Demasiadas consultas. Espera un momento.');
    return;
  }
  
  try {
    // Llamada real al backend
    const availability = await window.apiClient.checkAvailability({
      dateIn,
      dateOut,
      guests: { men, women }
    });
    
    // Mostrar habitaciones disponibles
    displayRooms(availability);
    
    // Actualizar UI
    elements.roomsCard?.classList.remove('hidden');
    showSuccess(`Disponibilidad verificada - ${availability.totalAvailable} camas disponibles`);
    
  } catch (error) {
    console.error('Error verificando disponibilidad:', error);
    showError(`Error: ${error.message}`);
  }
}

// Mostrar habitaciones
function displayRooms(availability) {
  const roomsContainer = document.getElementById("rooms");
  if (!roomsContainer) return;
  
  roomsContainer.innerHTML = "";
  selectedBeds = [];
  
  const men = parseInt(elements.men?.value || 0);
  const women = parseInt(elements.women?.value || 0);
  
  // Usar room manager para mostrar habitaciones
  if (window.roomManager) {
    window.roomManager.display(men, women, availability, roomsContainer);
  }
  
  // Setup selección de camas
  setupBedSelection();
}

// Configurar selección de camas
function setupBedSelection() {
  const roomsDiv = document.getElementById('rooms');
  if (!roomsDiv) return;
  
  roomsDiv.addEventListener('click', (e) => {
    const bed = e.target.closest('.bed');
    if (!bed || bed.classList.contains('occupied')) return;
    
    // Toggle selección
    bed.classList.toggle('selected');
    
    // Actualizar contadores
    const selected = document.querySelectorAll('.bed.selected');
    const men = parseInt(elements.men?.value || 0);
    const women = parseInt(elements.women?.value || 0);
    const needed = men + women;
    
    if (elements.selCount) elements.selCount.textContent = selected.length;
    if (elements.needed) elements.needed.textContent = needed;
    
    // Control del botón continuar
    const continueBtn = document.getElementById('continueBtn');
    if (continueBtn) {
      continueBtn.disabled = selected.length !== needed;
      
      if (selected.length === needed && needed > 0) {
        // Iniciar hold timer
        window.timerManager?.startHold(3);
        showSuccess('Camas reservadas temporalmente por 3 minutos');
      }
    }
    
    // Actualizar progreso
    window.progressManager?.update();
  });
  
  // Botón continuar
  const continueBtn = document.getElementById('continueBtn');
  if (continueBtn) {
    continueBtn.addEventListener('click', () => {
      const selected = document.querySelectorAll('.bed.selected');
      const needed = parseInt(elements.men?.value || 0) + parseInt(elements.women?.value || 0);
      
      if (selected.length !== needed) {
        showError('Selecciona exactamente las camas necesarias');
        return;
      }
      
      // Guardar selección
      selectedBeds = Array.from(selected).map(bed => ({
        room: bed.dataset.room,
        bed: bed.dataset.bed
      }));
      
      // Ir a formulario
      elements.roomsCard?.classList.add('hidden');
      elements.formCard?.classList.remove('hidden');
      
      showSuccess('Procede a completar tus datos');
    });
  }
}

// Configurar navegación
function setupNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      
      const section = link.dataset.section;
      
      // Ocultar todas las secciones
      document.getElementById('book')?.classList.add('hidden');
      document.getElementById('admin')?.classList.add('hidden');
      
      // Mostrar sección seleccionada
      document.getElementById(section)?.classList.remove('hidden');
      
      // Actualizar estados de navegación
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });
}

// Configurar manejo de formularios
function setupFormHandling() {
  const form = document.getElementById('reserva-form');
  
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleFormSubmit();
    });
  }
  
  // Validación en tiempo real
  ['nombre', 'email', 'telefono'].forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.addEventListener('blur', () => {
        window.formValidator?.validateField(fieldId);
      });
    }
  });
}

// Manejar envío de formulario
async function handleFormSubmit() {
  // Validar formulario
  if (!window.formValidator?.validateAll()) {
    showError('Completa correctamente todos los campos');
    return;
  }
  
  // Verificar pago
  const payState = document.getElementById('payState')?.textContent;
  if (payState === 'Pendiente') {
    showError('Completa el pago antes de confirmar');
    return;
  }
  
  try {
    // Crear reserva
    const bookingData = {
      dateIn: elements.dateIn?.value,
      dateOut: elements.dateOut?.value,
      guests: {
        men: parseInt(elements.men?.value || 0),
        women: parseInt(elements.women?.value || 0)
      },
      beds: selectedBeds,
      guest: {
        nombre: document.getElementById('nombre')?.value,
        email: document.getElementById('email')?.value,
        telefono: document.getElementById('telefono')?.value
      },
      paymentInfo: currentBookingData?.paymentInfo
    };
    
    // Enviar al backend
    const booking = await window.apiClient.createBooking(bookingData);
    
    showSuccess('¡Reserva confirmada! Recibirás un email de confirmación.');
    
    // Reset después de 3 segundos
    setTimeout(() => {
      window.location.reload();
    }, 3000);
    
  } catch (error) {
    console.error('Error creando reserva:', error);
    showError(`Error: ${error.message}`);
  }
}

// Configurar botones de pago
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
        await window.loadingManager?.withLoading(btn, async () => {
          await handlePayment(method);
        }) || handlePayment(method);
      });
    }
  });
}

// Manejar pagos
async function handlePayment(method) {
  const total = calculateTotal();
  
  const paymentData = {
    amount: total,
    currency: 'BRL',
    beds: selectedBeds,
    guest: {
      nombre: document.getElementById('nombre')?.value,
      email: document.getElementById('email')?.value,
      telefono: document.getElementById('telefono')?.value
    },
    dates: {
      checkIn: elements.dateIn?.value,
      checkOut: elements.dateOut?.value
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
    
    // Actualizar estado
    if (paymentResult) {
      currentBookingData = { paymentInfo: paymentResult };
      updatePaymentStatus('Pagado');
    }
    
  } catch (error) {
    console.error('Error procesando pago:', error);
    showError(`Error en pago: ${error.message}`);
  }
}

// Mostrar QR de Pix
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

// Configurar panel de administración
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

// Manejar acciones de admin
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

// Funciones de utilidad
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
  
  window.progressManager?.update();
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
  window.toastManager?.showError(message) || alert(`Error: ${message}`);
}

function showSuccess(message) {
  window.toastManager?.showSuccess(message) || console.log(`Success: ${message}`);
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

// Cleanup al salir
window.addEventListener('beforeunload', () => {
  window.timerManager?.cleanup();
});

console.log("✅ Main.js cargado");
