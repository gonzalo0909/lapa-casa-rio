/**
 * LAPA CASA HOSTEL - MAIN APPLICATION CONTROLLER
 * Orquestador principal que inicializa y coordina todos los módulos
 */

class HostelBookingApp {
  constructor() {
    this.state = null;
    this.managers = {};
    this.validators = {};
    this.ui = {};
    this.utils = {};
    this.initialized = false;
  }

  /**
   * Inicialización principal de la aplicación
   */
  async init() {
    try {
      console.log('🏨 Inicializando Lapa Casa Hostel...');
      
      // 1. Verificar dependencias críticas
      this.checkDependencies();
      
      // 2. Inicializar configuración
      this.initializeConfig();
      
      // 3. Inicializar core modules
      await this.initializeCore();
      
      // 4. Inicializar managers
      this.initializeManagers();
      
      // 5. Inicializar validators
      this.initializeValidators();
      
      // 6. Inicializar UI modules
      this.initializeUI();
      
      // 7. Inicializar utils
      this.initializeUtils();
      
      // 8. Configurar event listeners
      this.setupEventListeners();
      
      // 9. Configurar integrations
      this.setupIntegrations();
      
      // 10. Setup inicial de la UI
      this.setupInitialState();
      
      this.initialized = true;
      console.log('✅ Aplicación inicializada correctamente');
      
    } catch (error) {
      console.error('❌ Error inicializando aplicación:', error);
      this.handleInitializationError(error);
    }
  }

  /**
   * Verificar que todas las dependencias están disponibles
   */
  checkDependencies() {
    const required = [
      'HostelConfig',
      'ErrorHandler', 
      'ApiClient',
      'StateManager',
      'RoomManager',
      'DateValidator',
      'FormValidator',
      'BookingValidator'
    ];

    const missing = required.filter(dep => !window[dep]);
    
    if (missing.length > 0) {
      throw new Error(`Dependencias faltantes: ${missing.join(', ')}`);
    }
  }

  /**
   * Inicializar configuración global
   */
  initializeConfig() {
    if (!window.HOSTEL_CONFIG) {
      throw new Error('HOSTEL_CONFIG no está definido');
    }
    
    // Validar configuración crítica
    const required = ['API_BASE', 'CAPACITY', 'HOLD_TIMEOUT_MINUTES'];
    const missing = required.filter(key => !window.HOSTEL_CONFIG[key]);
    
    if (missing.length > 0) {
      throw new Error(`Configuración incompleta: ${missing.join(', ')}`);
    }
  }

  /**
   * Inicializar módulos core
   */
  async initializeCore() {
    // Error Handler (primero)
    window.ErrorHandler.initialize();
    
    // API Client
    await window.ApiClient.initialize(window.HOSTEL_CONFIG.API_BASE);
    
    console.log('✅ Core modules initialized');
  }

  /**
   * Inicializar managers de negocio
   */
  initializeManagers() {
    // State Manager
    this.managers.state = new window.StateManager();
    this.state = this.managers.state;
    
    // Room Manager
    this.managers.room = new window.RoomManager(
      window.HOSTEL_CONFIG.CAPACITY.ROOMS,
      this.state
    );
    
    console.log('✅ Business managers initialized');
  }

  /**
   * Inicializar validators
   */
  initializeValidators() {
    this.validators.date = new window.DateValidator();
    this.validators.form = new window.FormValidator();
    this.validators.booking = new window.BookingValidator(
      window.HOSTEL_CONFIG.CAPACITY
    );
    
    console.log('✅ Validators initialized');
  }

  /**
   * Inicializar módulos de UI
   */
  initializeUI() {
    this.ui.loading = new window.LoadingManager();
    this.ui.toast = new window.ToastManager();
    this.ui.progress = new window.ProgressManager();
    this.ui.timer = new window.TimerManager();
    this.ui.bedSelection = new window.BedSelectionManager(this.managers.room);
    this.ui.visualFeedback = new window.VisualFeedbackManager();
    
    console.log('✅ UI modules initialized');
  }

  /**
   * Inicializar utilities
   */
  initializeUtils() {
    this.utils.rateLimiter = new window.RateLimiter();
    
    // Dependency Manager ya debe estar inicializado
    if (window.DependencyManager) {
      window.DependencyManager.registerApp(this);
    }
    
    console.log('✅ Utils initialized');
  }

  /**
   * Configurar event listeners principales
   */
  setupEventListeners() {
    // Navigation
    this.setupNavigation();
    
    // Booking flow
    this.setupBookingFlow();
    
    // Admin panel
    this.setupAdminPanel();
    
    // Payment methods
    this.setupPaymentMethods();
    
    // Global events
    this.setupGlobalEvents();
    
    console.log('✅ Event listeners configured');
  }

  /**
   * Configurar navegación entre secciones
   */
  setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const section = link.dataset.section;
        this.showSection(section);
      });
    });
  }

  /**
   * Configurar flujo de reservas
   */
  setupBookingFlow() {
    // Counters de huéspedes
    this.setupGuestCounters();
    
    // Verificar disponibilidad
    const checkAvailBtn = document.getElementById('checkAvail');
    if (checkAvailBtn) {
      checkAvailBtn.addEventListener('click', () => this.checkAvailability());
    }
    
    // Continuar con selección
    const continueBtn = document.getElementById('continueBtn');
    if (continueBtn) {
      continueBtn.addEventListener('click', () => this.proceedToForm());
    }
    
    // Submit final
    const form = document.getElementById('reserva-form');
    if (form) {
      form.addEventListener('submit', (e) => this.submitReservation(e));
    }
  }

  /**
   * Configurar contadores de huéspedes
   */
  setupGuestCounters() {
    // Hombres
    document.getElementById('menMinus')?.addEventListener('click', () => {
      this.adjustGuestCount('men', -1);
    });
    document.getElementById('menPlus')?.addEventListener('click', () => {
      this.adjustGuestCount('men', 1);
    });
    
    // Mujeres
    document.getElementById('womenMinus')?.addEventListener('click', () => {
      this.adjustGuestCount('women', -1);
    });
    document.getElementById('womenPlus')?.addEventListener('click', () => {
      this.adjustGuestCount('women', 1);
    });
  }

  /**
   * Configurar métodos de pago
   */
  setupPaymentMethods() {
    // Mercado Pago
    document.getElementById('payMP')?.addEventListener('click', () => {
      this.processPayment('mercadopago');
    });
    
    // Pix directo
    document.getElementById('payPix')?.addEventListener('click', () => {
      this.processPayment('pix');
    });
    
    // Stripe
    document.getElementById('payStripe')?.addEventListener('click', () => {
      this.processPayment('stripe');
    });
  }

  /**
   * Configurar panel de admin
   */
  setupAdminPanel() {
    document.getElementById('btnHealth')?.addEventListener('click', () => {
      this.runHealthCheck();
    });
    
    document.getElementById('btnHolds')?.addEventListener('click', () => {
      this.listActiveHolds();
    });
    
    document.getElementById('btnBookings')?.addEventListener('click', () => {
      this.searchBookings();
    });
  }

  /**
   * Configurar eventos globales
   */
  setupGlobalEvents() {
    // Cerrar toasts
    document.getElementById('closeError')?.addEventListener('click', () => {
      this.ui.toast.hideError();
    });
    
    document.getElementById('closeSuccess')?.addEventListener('click', () => {
      this.ui.toast.hideSuccess();
    });
    
    // Cleanup antes de cerrar
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
    
    // Handle navigation
    window.addEventListener('hashchange', () => {
      this.handleRouteChange();
    });
  }

  /**
   * Configurar integraciones externas
   */
  setupIntegrations() {
    if (window.ValidationIntegration) {
      window.ValidationIntegration.setup(this.validators, this.ui.visualFeedback);
    }
    
    // Configurar Stripe
    if (window.Stripe && window.HOSTEL_CONFIG.STRIPE_KEY) {
      this.stripe = window.Stripe(window.HOSTEL_CONFIG.STRIPE_KEY);
    }
    
    // Configurar Mercado Pago
    if (window.MercadoPago && window.HOSTEL_CONFIG.MERCADO_PAGO_KEY) {
      this.mp = new window.MercadoPago(window.HOSTEL_CONFIG.MERCADO_PAGO_KEY);
    }
  }

  /**
   * Configurar estado inicial de la UI
   */
  setupInitialState() {
    // Mostrar sección de reservas por defecto
    this.showSection('book');
    
    // Configurar fechas mínimas
    const today = new Date().toISOString().split('T')[0];
    const dateIn = document.getElementById('dateIn');
    const dateOut = document.getElementById('dateOut');
    
    if (dateIn) dateIn.min = today;
    if (dateOut) dateOut.min = today;
    
    // Verificar si hay parámetros URL (ej: ?paid=1)
    this.handleUrlParameters();
  }

  /**
   * Mostrar sección específica
   */
  showSection(sectionName) {
    // Ocultar todas las secciones
    document.querySelectorAll('section[id]').forEach(section => {
      section.classList.add('hidden');
    });
    
    // Mostrar sección solicitada
    const section = document.getElementById(sectionName);
    if (section) {
      section.classList.remove('hidden');
    }
    
    // Actualizar navegación
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.section === sectionName);
    });
  }

  /**
   * Ajustar contador de huéspedes
   */
  adjustGuestCount(type, delta) {
    const input = document.getElementById(type === 'men' ? 'men' : 'women');
    if (!input) return;
    
    const current = parseInt(input.value) || 0;
    const newValue = Math.max(0, Math.min(38, current + delta));
    input.value = newValue;
    
    // Actualizar estado
    this.state.setGuests(
      parseInt(document.getElementById('men').value) || 0,
      parseInt(document.getElementById('women').value) || 0
    );
  }

  /**
   * Verificar disponibilidad
   */
  async checkAvailability() {
    try {
      this.ui.loading.show('Verificando disponibilidad...');
      
      // Validar fechas
      const dateIn = document.getElementById('dateIn').value;
      const dateOut = document.getElementById('dateOut').value;
      
      if (!this.validators.date.validateDateRange(dateIn, dateOut)) {
        throw new Error('Fechas inválidas');
      }
      
      // Validar huéspedes
      const men = parseInt(document.getElementById('men').value) || 0;
      const women = parseInt(document.getElementById('women').value) || 0;
      
      if (!this.validators.booking.validateGuestCount(men + women)) {
        throw new Error('Cantidad de huéspedes inválida');
      }
      
      // Consultar disponibilidad
      const availability = await window.ApiClient.checkAvailability(dateIn, dateOut);
      
      // Actualizar estado
      this.state.setDates(dateIn, dateOut);
      this.state.setGuests(men, women);
      this.state.setAvailability(availability);
      
      // Renderizar habitaciones
      this.managers.room.renderAvailableRooms(availability);
      
      // Mostrar sección de selección
      document.getElementById('roomsCard').classList.remove('hidden');
      
      this.ui.toast.showSuccess('Disponibilidad actualizada');
      
    } catch (error) {
      this.ui.toast.showError(error.message);
    } finally {
      this.ui.loading.hide();
    }
  }

  /**
   * Proceder al formulario
   */
  async proceedToForm() {
    try {
      // Validar selección
      const selection = this.state.getSelectedBeds();
      const needed = this.state.getTotalGuests();
      
      if (!this.validators.booking.validateBedSelection(selection, needed)) {
        throw new Error('Selección de camas inválida');
      }
      
      // Crear HOLD temporal
      const holdData = await this.createTemporaryHold();
      this.state.setHoldId(holdData.holdId);
      
      // Mostrar formulario
      document.getElementById('formCard').classList.remove('hidden');
      
      // Iniciar timer
      this.ui.timer.start(window.HOSTEL_CONFIG.HOLD_TIMEOUT_MINUTES * 60);
      
      this.ui.toast.showSuccess('Camas reservadas temporalmente');
      
    } catch (error) {
      this.ui.toast.showError(error.message);
    }
  }

  /**
   * Crear HOLD temporal
   */
  async createTemporaryHold() {
    const holdData = {
      holdId: 'HOLD-' + Date.now(),
      dates: this.state.getDates(),
      guests: this.state.getGuests(),
      selectedBeds: this.state.getSelectedBeds(),
      total: this.state.getTotalPrice()
    };
    
    return await window.ApiClient.createHold(holdData);
  }

  /**
   * Procesar pago
   */
  async processPayment(method) {
    try {
      this.ui.loading.show(`Procesando pago con ${method}...`);
      
      const paymentData = this.preparePaymentData();
      
      switch (method) {
        case 'mercadopago':
          await this.processMercadoPago(paymentData);
          break;
        case 'stripe':
          await this.processStripe(paymentData);
          break;
        case 'pix':
          await this.processPixDirect(paymentData);
          break;
      }
      
    } catch (error) {
      this.ui.toast.showError(`Error en pago: ${error.message}`);
    } finally {
      this.ui.loading.hide();
    }
  }

  /**
   * Submit final de reserva
   */
  async submitReservation(event) {
    event.preventDefault();
    
    try {
      // Validar formulario
      if (!this.validators.form.validateForm(event.target)) {
        return;
      }
      
      // Verificar pago
      if (!this.state.isPaid()) {
        throw new Error('Debe completar el pago primero');
      }
      
      // Confirmar reserva
      await this.confirmReservation();
      
      this.ui.toast.showSuccess('¡Reserva confirmada exitosamente!');
      
    } catch (error) {
      this.ui.toast.showError(error.message);
    }
  }

  /**
   * Manejo de errores de inicialización
   */
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

  /**
   * Cleanup al cerrar
   */
  cleanup() {
    if (this.state?.getHoldId() && !this.state?.isPaid()) {
      // Enviar beacon para liberar HOLD
      navigator.sendBeacon('/api/holds/release', JSON.stringify({
        holdId: this.state.getHoldId()
      }));
    }
  }

  /**
   * Handle route changes
   */
  handleRouteChange() {
    const hash = window.location.hash.slice(1);
    if (hash) {
      this.showSection(hash.replace('/', ''));
    }
  }

  /**
   * Handle URL parameters
   */
  handleUrlParameters() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('paid') === '1') {
      this.state.setPaid(true);
      document.getElementById('payState').textContent = 'aprobado';
      document.getElementById('submitBtn').disabled = false;
    }
  }

  // Métodos adicionales para implementar según necesidades específicas
  preparar PaymentData() { /* TODO */ }
  processMercadoPago(data) { /* TODO */ }
  processStripe(data) { /* TODO */ }
  processPixDirect(data) { /* TODO */ }
  confirmReservation() { /* TODO */ }
  runHealthCheck() { /* TODO */ }
  listActiveHolds() { /* TODO */ }
  searchBookings() { /* TODO */ }
}

// Inicialización automática cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
  try {
    window.hostelApp = new HostelBookingApp();
    await window.hostelApp.init();
  } catch (error) {
    console.error('Error inicializando aplicación:', error);
  }
});

// Export para testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HostelBookingApp;
}
