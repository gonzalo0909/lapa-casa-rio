class HostelBookingApp {
  constructor() {
    this.managers = {};
    this.validators = {};
    this.ui = {};
    this.initialized = false;
  }

  async init() {
    try {
      console.log('🏨 Inicializando Lapa Casa Hostel...');
      
      await this.waitForDependencies();
      this.assignExistingInstances();
      this.setupEventListeners();
      this.setupInitialState();
      
      this.initialized = true;
      console.log('✅ Aplicación inicializada correctamente');
      
    } catch (error) {
      console.error('❌ Error inicializando aplicación:', error);
      this.handleInitializationError(error);
    }
  }

  async waitForDependencies() {
    const requiredModules = [
      'stateManager', 'roomManager', 'dateValidator', 
      'formValidator', 'bookingValidator', 'loadingManager',
      'toastManager', 'timerManager', 'bedSelectionManager'
    ];

    for (const module of requiredModules) {
      let attempts = 0;
      while (!window[module] && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      if (!window[module]) {
        throw new Error(`Módulo ${module} no se cargó correctamente`);
      }
    }
  }

  assignExistingInstances() {
    this.managers.state = window.stateManager;
    this.managers.room = window.roomManager;
    
    this.validators.date = window.dateValidator;
    this.validators.form = window.formValidator;
    this.validators.booking = window.bookingValidator;
    
    this.ui.loading = window.loadingManager;
    this.ui.toast = window.toastManager;
    this.ui.timer = window.timerManager;
    this.ui.bedSelection = window.bedSelectionManager;
  }

  setupEventListeners() {
    this.setupGuestCounters();
    
    const checkAvailBtn = document.getElementById('checkAvail');
    if (checkAvailBtn) {
      checkAvailBtn.addEventListener('click', () => {
        this.ui.loading.withLoading(checkAvailBtn, () => this.checkAvailability(), 'Verificando...');
      });
    }
    
    const continueBtn = document.getElementById('continueBtn');
    if (continueBtn) {
      continueBtn.addEventListener('click', () => {
        this.ui.loading.withLoading(continueBtn, () => this.proceedToForm(), 'Procesando...');
      });
    }
    
    const form = document.getElementById('reserva-form');
    if (form) {
      form.addEventListener('submit', (e) => this.submitReservation(e));
    }

    this.setupPaymentMethods();
  }

  setupGuestCounters() {
    const menMinus = document.getElementById('menMinus');
    const menPlus = document.getElementById('menPlus');
    
    if (menMinus) menMinus.addEventListener('click', () => this.adjustGuestCount('men', -1));
    if (menPlus) menPlus.addEventListener('click', () => this.adjustGuestCount('men', 1));
    
    const womenMinus = document.getElementById('womenMinus');
    const womenPlus = document.getElementById('womenPlus');
    
    if (womenMinus) womenMinus.addEventListener('click', () => this.adjustGuestCount('women', -1));
    if (womenPlus) womenPlus.addEventListener('click', () => this.adjustGuestCount('women', 1));
  }

  setupPaymentMethods() {
    const payMP = document.getElementById('payMP');
    const payPix = document.getElementById('payPix');
    const payStripe = document.getElementById('payStripe');
    
    if (payMP) payMP.addEventListener('click', () => this.processPayment('mercadopago'));
    if (payPix) payPix.addEventListener('click', () => this.processPayment('pix'));
    if (payStripe) payStripe.addEventListener('click', () => this.processPayment('stripe'));
  }

  adjustGuestCount(type, delta) {
    const input = document.getElementById(type);
    if (!input) return;
    
    const current = parseInt(input.value) || 0;
    const newValue = Math.max(0, Math.min(38, current + delta));
    input.value = newValue;
    
    this.updateGuestTotal();
    this.updateCheckAvailButton();
    
    if (window.validationIntegration) {
      window.validationIntegration.validateGuests();
    }
  }

  updateGuestTotal() {
    const men = parseInt(document.getElementById('men')?.value || 0);
    const women = parseInt(document.getElementById('women')?.value || 0);
    const total = men + women;
    
    const totalEl = document.getElementById('guestTotal');
    if (totalEl) totalEl.textContent = total;
    
    return total;
  }

  updateCheckAvailButton() {
    const men = parseInt(document.getElementById('men')?.value || 0);
    const women = parseInt(document.getElementById('women')?.value || 0);
    const dateIn = document.getElementById('dateIn')?.value;
    const dateOut = document.getElementById('dateOut')?.value;
    
    const checkAvailBtn = document.getElementById('checkAvail');
    if (checkAvailBtn) {
      const hasGuests = (men + women) > 0;
      const hasDates = dateIn && dateOut;
      checkAvailBtn.disabled = !hasGuests || !hasDates;
    }
  }

  async checkAvailability() {
    try {
      if (!window.validationIntegration?.validateBeforeAvailabilityCheck()) {
        throw new Error('Datos inválidos');
      }

      const dateIn = document.getElementById('dateIn').value;
      const dateOut = document.getElementById('dateOut').value;
      const men = parseInt(document.getElementById('men').value) || 0;
      const women = parseInt(document.getElementById('women').value) || 0;

      this.managers.state.setSearchCriteria(dateIn, dateOut, men, women);

      const availability = await window.apiClient.checkAvailability({
        dateIn,
        dateOut,
        guests: { men, women }
      });
      
      this.managers.state.setAvailabilityData(availability);

      const roomsContainer = document.getElementById('rooms');
      this.managers.room.display(men, women, availability, roomsContainer);
      this.ui.bedSelection.setupBedSelection(roomsContainer);

      document.getElementById('roomsCard')?.classList.remove('hidden');
      this.ui.toast.showSuccess('Disponibilidad verificada');

    } catch (error) {
      this.ui.toast.showError(error.message);
    }
  }

  async proceedToForm() {
    try {
      if (!window.validationIntegration?.validateBeforeContinue()) {
        throw new Error('Selección incompleta');
      }

      const selectedBeds = this.managers.state.getSelectedBeds();
      const guestInfo = this.managers.state.getSearchCriteria();

      const holdResponse = await window.apiClient.createHold({
        beds: selectedBeds,
        guestInfo: guestInfo,
        expiresIn: window.HOSTEL_CONFIG.HOLD_TIMEOUT_MINUTES * 60
      });

      this.managers.state.setHoldId(holdResponse.holdId);

      document.getElementById('formCard')?.classList.remove('hidden');
      window.timerManager?.startHold(window.HOSTEL_CONFIG.HOLD_TIMEOUT_MINUTES);
      
      this.ui.toast.showSuccess('Camas reservadas temporalmente');

    } catch (error) {
      this.ui.toast.showError(error.message);
    }
  }

  async processPayment(method) {
    try {
      if (!window.paymentIntegration) {
        throw new Error('Sistema de pagos no disponible');
      }

      const formValid = this.validators.form.validateAll();
      if (!formValid) {
        throw new Error('Completa todos los datos del formulario');
      }

      switch (method) {
        case 'mercadopago':
          await window.paymentIntegration.processMercadoPago();
          break;
        case 'stripe':
          await window.paymentIntegration.processStripe();
          break;
        case 'pix':
          await window.paymentIntegration.processPixDirect();
          break;
        default:
          throw new Error('Método de pago no válido');
      }
      
    } catch (error) {
      this.ui.toast.showError(error.message);
    }
  }

  async submitReservation(event) {
    event.preventDefault();
    
    try {
      if (!window.validationIntegration?.validateCompleteBooking()) {
        throw new Error('Faltan datos requeridos');
      }

      const paymentInfo = this.managers.state.getPaymentInfo();
      if (!paymentInfo || paymentInfo.status !== 'completed') {
        throw new Error('Debe completar el pago primero');
      }

      this.ui.loading.showGlobal('Confirmando reserva...');
      
      const bookingData = {
        holdId: this.managers.state.getHoldId(),
        paymentId: paymentInfo.transactionId,
        paymentMethod: paymentInfo.method,
        customerData: this.validators.form.getData(),
        searchCriteria: this.managers.state.getSearchCriteria(),
        selectedBeds: this.managers.state.getSelectedBeds()
      };

      const confirmation = await window.apiClient.createBooking(bookingData);
      
      this.managers.state.setBookingData(confirmation);
      this.ui.toast.showSuccess('¡Reserva confirmada exitosamente!');
      
      setTimeout(() => {
        this.showConfirmationDetails(confirmation);
      }, 2000);

    } catch (error) {
      this.ui.toast.showError(error.message);
    } finally {
      this.ui.loading.hideGlobal();
    }
  }

  showConfirmationDetails(confirmation) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h3>Reserva Confirmada</h3>
        <p><strong>Código:</strong> ${confirmation.confirmationCode}</p>
        <p><strong>ID:</strong> ${confirmation.bookingId}</p>
        <p><strong>Estado:</strong> ${confirmation.status}</p>
        <div style="margin-top: 20px;">
          <button class="btn btn-primary" onclick="window.print()">Imprimir</button>
          <button class="btn btn-secondary" onclick="this.closest('.modal').remove(); window.hostelApp.resetBookingFlow();">Nueva Reserva</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  resetBookingFlow() {
    document.getElementById('reserva-form')?.reset();
    document.getElementById('roomsCard')?.classList.add('hidden');
    document.getElementById('formCard')?.classList.add('hidden');
    
    document.getElementById('men').value = '0';
    document.getElementById('women').value = '0';
    document.getElementById('dateIn').value = '';
    document.getElementById('dateOut').value = '';
    
    this.updateGuestTotal();
    this.updateCheckAvailButton();
    
    this.ui.bedSelection?.clearSelection();
    this.managers.state?.reset();
    this.ui.timer?.clearAll();
    
    const payStateEl = document.getElementById('payState');
    if (payStateEl) {
      payStateEl.textContent = 'Pendiente';
      payStateEl.className = 'status-value pending';
    }
    
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
    }
  }

  setupInitialState() {
    const today = new Date().toISOString().split('T')[0];
    const dateIn = document.getElementById('dateIn');
    const dateOut = document.getElementById('dateOut');
    
    if (dateIn) dateIn.min = today;
    if (dateOut) dateOut.min = today;
    
    const menInput = document.getElementById('men');
    const womenInput = document.getElementById('women');
    
    if (menInput) menInput.value = '0';
    if (womenInput) womenInput.value = '0';
    
    this.updateGuestTotal();
    this.updateCheckAvailButton();
    
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment_status') === 'success') {
      const paymentId = params.get('payment_id');
      const method = params.get('method');
      
      if (paymentId && method && window.paymentIntegration) {
        window.paymentIntegration.handlePaymentSuccess(method, paymentId);
      }
    }
  }

  handleInitializationError(error) {
    const fallbackHTML = `
      <div style="text-align: center; padding: 40px; color: #e74c3c;">
        <h2>Error de Sistema</h2>
        <p>No se pudo inicializar la aplicación.</p>
        <p><small>${error.message}</small></p>
        <button onclick="location.reload()">Recargar página</button>
      </div>
    `;
    document.body.innerHTML = fallbackHTML;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await new Promise(resolve => setTimeout(resolve, 500));
    window.hostelApp = new HostelBookingApp();
    await window.hostelApp.init();
  } catch (error) {
    console.error('Error inicializando aplicación:', error);
  }
});
