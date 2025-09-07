class ValidationIntegration {
  constructor() {
    this.validators = new Map();
    this.validationResults = new Map();
    this.realTimeEnabled = true;
    this.validationQueue = [];
    this.processingQueue = false;
    this.maxQueueSize = 10;
    this.eventListeners = new Map();
    this.initializeValidators();
    this.setupGlobalValidation();
    this.setupRealTimeValidation();
  }
  initializeValidators() {
    this.registerValidator('form', window.formValidator);
    this.registerValidator('date', window.dateValidator);
    this.registerValidator('booking', window.bookingValidator);
  }
  registerValidator(name, validator) {
    if (validator) {
      this.validators.set(name, validator);
      this.validationResults.set(name, { valid: false, lastCheck: null });
    }
  }
  setupGlobalValidation() {
    this.addEventListenerWithCleanup('checkAvail', 'click', (e) => {
      if (!this.validateBeforeAvailabilityCheck()) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
    this.addEventListenerWithCleanup('continueBtn', 'click', (e) => {
      if (!this.validateBeforeContinue()) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
    const form = document.getElementById('reserva-form');
    if (form) {
      const submitHandler = (e) => {
        if (!this.validateCompleteBooking()) {
          e.preventDefault();
          e.stopPropagation();
        }
      };
      form.addEventListener('submit', submitHandler);
      this.eventListeners.set('reserva-form-submit', { element: form, event: 'submit', handler: submitHandler });
    }
  }
  addEventListenerWithCleanup(elementId, event, handler) {
    const element = document.getElementById(elementId);
    if (element) {
      element.addEventListener(event, handler);
      this.eventListeners.set(`${elementId}-${event}`, { element, event, handler });
    }
  }
  setupRealTimeValidation() {
    ['dateIn', 'dateOut'].forEach(fieldId => {
      const changeHandler = () => this.queueValidation('dates', () => this.validateDates());
      this.addEventListenerWithCleanup(fieldId, 'change', changeHandler);
    });
    ['men', 'women'].forEach(fieldId => {
      const inputHandler = () => this.queueValidation('guests', () => this.validateGuests());
      const changeHandler = () => this.queueValidation('guests', () => this.validateGuests());
      this.addEventListenerWithCleanup(fieldId, 'input', inputHandler);
      this.addEventListenerWithCleanup(fieldId, 'change', changeHandler);
    });
    ['nombre', 'email', 'telefono'].forEach(fieldId => {
      const blurHandler = () => this.queueValidation('form', () => this.validateForm());
      const inputHandler = () => this.queueValidation('form', () => this.validateFormField(fieldId), 500);
      this.addEventListenerWithCleanup(fieldId, 'blur', blurHandler);
      this.addEventListenerWithCleanup(fieldId, 'input', inputHandler);
    });
    const bedClickHandler = (e) => {
      if (e.target.closest('.bed')) {
        setTimeout(() => {
          this.queueValidation('beds', () => this.validateBedSelection());
        }, 100);
      }
    };
    document.addEventListener('click', bedClickHandler);
    this.eventListeners.set('document-bed-click', { element: document, event: 'click', handler: bedClickHandler });
  }
  queueValidation(type, validationFn, delay = 150) {
    if (this.validationQueue.length >= this.maxQueueSize) {
      this.validationQueue.shift();
    }
    this.validationQueue = this.validationQueue.filter(item => item.type !== type);
    this.validationQueue.push({
      type,
      fn: validationFn,
      timestamp: Date.now() + delay
    });
    if (!this.processingQueue) {
      this.processValidationQueue();
    }
  }
  async processValidationQueue() {
    this.processingQueue = true;
    while (this.validationQueue.length > 0) {
      const now = Date.now();
      const readyItems = this.validationQueue.filter(item => item.timestamp <= now);
      if (readyItems.length > 0) {
        const byType = new Map();
        readyItems.forEach(item => {
          if (!byType.has(item.type) || item.timestamp > byType.get(item.type).timestamp) {
            byType.set(item.type, item);
          }
        });
        for (const item of byType.values()) {
          try {
            await item.fn();
          } catch (error) {
            console.error(`Error en validación ${item.type}:`, error);
          }
          this.validationQueue = this.validationQueue.filter(q => q !== item);
        }
      } else {
        const nextTimestamp = Math.min(...this.validationQueue.map(item => item.timestamp));
        const waitTime = Math.max(0, Math.min(nextTimestamp - now, 1000));
        if (waitTime > 0) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    this.processingQueue = false;
  }
  validateDates() {
    const dateValidator = this.validators.get('date');
    if (!dateValidator) return false;
    const dateInValid = dateValidator.validateField('dateIn');
    const dateOutValid = dateValidator.validateField('dateOut');
    const result = dateInValid && dateOutValid;
    this.updateValidationResult('dates', result, {
      dateIn: dateInValid,
      dateOut: dateOutValid,
      nights: dateValidator.getNights(),
      totalPrice: dateValidator.getTotalPrice()
    });
    this.updateCalculationsDisplay();
    return result;
  }
  validateGuests() {
    const men = parseInt(document.getElementById('men')?.value || 0);
    const women = parseInt(document.getElementById('women')?.value || 0);
    const bookingValidator = this.validators.get('booking');
    if (!bookingValidator) return false;
    const validation = bookingValidator.validateCapacity(men, women);
    this.updateValidationResult('guests', validation.valid, {
      men, women, total: men + women,
      maxCapacity: validation.maxCapacity,
      availableRooms: validation.availableRooms,
      errors: validation.errors,
      warnings: validation.warnings
    });
    return validation.valid;
  }
  validateForm() {
    const formValidator = this.validators.get('form');
    if (!formValidator) return false;
    const result = formValidator.validateAll();
    this.updateValidationResult('form', result, {
      completedFields: this.getCompletedFormFields(),
      data: formValidator.getData()
    });
    return result;
  }
  validateFormField(fieldId) {
    const formValidator = this.validators.get('form');
    if (!formValidator) return false;
    return formValidator.validateField(fieldId);
  }
  validateBedSelection() {
    const bookingValidator = this.validators.get('booking');
    if (!bookingValidator) return false;
    const isValid = bookingValidator.validateCurrentBedSelection();
    const selectedBeds = Array.from(document.querySelectorAll('.bed.selected'));
    this.updateValidationResult('bedSelection', isValid, {
      selectedCount: selectedBeds.length,
      selectedBeds: selectedBeds.map(bed => ({
        room: bed.dataset.room,
        bed: bed.dataset.bed
      })),
      canProceed: bookingValidator.canProceedToBooking()
    });
    return isValid;
  }
  validateBeforeAvailabilityCheck() {
    const results = [
      { step: 'fechas', valid: this.validateDates() },
      { step: 'huéspedes', valid: this.validateGuests() }
    ];
    const allValid = results.every(r => r.valid);
    if (!allValid) {
      const invalidSteps = results.filter(r => !r.valid).map(r => r.step);
      this.showValidationError(`Corrige: ${invalidSteps.join(', ')}`);
    }
    return allValid;
  }
  validateBeforeContinue() {
    const results = [
      { step: 'disponibilidad', valid: document.getElementById('rooms')?.children.length > 0 },
      { step: 'selección de camas', valid: this.validateBedSelection() },
      { step: 'cantidad correcta', valid: window.bookingValidator?.canProceedToBooking() || false }
    ];
    const allValid = results.every(r => r.valid);
    if (!allValid) {
      const invalidSteps = results.filter(r => !r.valid).map(r => r.step);
      this.showValidationError(`Antes de continuar: ${invalidSteps.join(', ')}`);
    }
    return allValid;
  }
  validateCompleteBooking() {
    const results = [
      { step: 'datos personales', valid: this.validateForm() },
      { step: 'pago', valid: this.validatePayment() },
      { step: 'consistencia', valid: this.validateBookingConsistency() }
    ];
    const allValid = results.every(r => r.valid);
    if (!allValid) {
      const invalidSteps = results.filter(r => !r.valid).map(r => r.step);
      this.showValidationError(`Completa: ${invalidSteps.join(', ')}`);
    }
    return allValid;
  }
  validatePayment() {
    const payState = document.getElementById('payState')?.textContent;
    const stateManagerPayment = window.stateManager?.getPaymentInfo();
    return (payState && payState !== 'Pendiente') || 
           (stateManagerPayment?.status === 'completed');
  }
  validateBookingConsistency() {
    const dateValidator = this.validators.get('date');
    const bookingValidator = this.validators.get('booking');
    if (!dateValidator || !bookingValidator) return false;
    const datesValid = dateValidator.validateAll();
    const bookingValid = bookingValidator.canProceedToBooking();
    const stateData = window.stateManager?.getCompleteBookingData();
    if (stateData) {
      const currentGuests = this.getCurrentGuestCount();
      const stateGuests = (stateData.searchCriteria?.men || 0) + (stateData.searchCriteria?.women || 0);
      if (currentGuests !== stateGuests) {
        console.warn('Inconsistencia en número de huéspedes');
        return false;
      }
    }
    return datesValid && bookingValid;
  }
  updateValidationResult(type, valid, data) {
    this.validationResults.set(type, {
      valid,
      lastCheck: Date.now(),
      data
    });
    document.dispatchEvent(new CustomEvent('validationUpdate', {
      detail: { type, valid, data }
    }));
  }
  updateCalculationsDisplay() {
    const dateValidator = this.validators.get('date');
    if (!dateValidator) return;
    const nights = dateValidator.getNights();
    const totalPrice = dateValidator.getTotalPrice();
    const men = parseInt(document.getElementById('men')?.value || 0);
    const women = parseInt(document.getElementById('women')?.value || 0);
    const nightsEl = document.getElementById('nightsCount');
    const priceEl = document.getElementById('totalPrice');
    const neededEl = document.getElementById('needed');
    if (nightsEl) nightsEl.textContent = nights;
    if (priceEl) priceEl.textContent = totalPrice;
    if (neededEl) neededEl.textContent = men + women;
  }
  getCompletedFormFields() {
    const fields = ['nombre', 'email', 'telefono'];
    return fields.filter(fieldId => {
      const field = document.getElementById(fieldId);
      return field?.value?.trim().length > 0;
    });
  }
  getCurrentGuestCount() {
    const men = parseInt(document.getElementById('men')?.value || 0);
    const women = parseInt(document.getElementById('women')?.value || 0);
    return men + women;
  }
  showValidationError(message) {
    if (window.toastManager) {
      window.toastManager.showError(message);
    } else {
      alert(message);
    }
  }
  getValidationStatus() {
    const status = {};
    this.validationResults.forEach((result, type) => {
      status[type] = {
        valid: result.valid,
        lastCheck: result.lastCheck,
        age: result.lastCheck ? Date.now() - result.lastCheck : null
      };
    });
    return status;
  }
  isReadyForStep(step) {
    const status = this.getValidationStatus();
    switch (step) {
      case 'availability': return status.dates?.valid && status.guests?.valid;
      case 'beds': return status.dates?.valid && status.guests?.valid;
      case 'form': return status.bedSelection?.valid;
      case 'payment': return status.form?.valid;
      case 'booking': return status.form?.valid && this.validatePayment();
      default: return false;
    }
  }
  forceValidateAll() {
    return Promise.all([
      this.validateDates(),
      this.validateGuests(),
      this.validateForm(),
      this.validateBedSelection()
    ]).then(results => results.every(r => r));
  }
  debugValidation() {
    console.log('=== VALIDATION DEBUG ===', this.getValidationStatus());
  }
  destroy() {
    this.validationQueue = [];
    this.processingQueue = false;
    this.validators.clear();
    this.validationResults.clear();
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners.clear();
  }
}
window.validationIntegration = new ValidationIntegration();
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (window.validationIntegration) {
      window.validationIntegration.initializeValidators();
    }
  }, 500);
});
