class ValidationIntegration {
  constructor() {
    this.validators = new Map();
    this.validationResults = new Map();
    this.eventListeners = new Map();
    this.initialized = false;
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }
  
  async init() {
    await this.waitForValidators();
    this.registerValidators();
    this.setupGlobalValidation();
    this.setupRealTimeValidation();
    this.initialized = true;
  }
  
  async waitForValidators() {
    const required = ['formValidator', 'dateValidator', 'bookingValidator'];
    
    for (const validator of required) {
      let attempts = 0;
      while (!window[validator] && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      if (!window[validator]) {
        window[validator] = this.createFallbackValidator(validator);
      }
    }
  }
  
  createFallbackValidator(type) {
    const fallback = {
      validateField: () => true,
      validateAll: () => true,
      getData: () => ({}),
      clear: () => {},
      destroy: () => {}
    };
    
    if (type === 'dateValidator') {
      fallback.getNights = () => 0;
      fallback.getTotalPrice = () => 0;
      fallback.getDateRange = () => null;
    }
    
    if (type === 'bookingValidator') {
      fallback.validateCapacity = () => ({ valid: true, errors: [], warnings: [] });
      fallback.validateCurrentBedSelection = () => true;
      fallback.canProceedToBooking = () => false;
    }
    
    return fallback;
  }
  
  registerValidators() {
    this.validators.set('form', window.formValidator);
    this.validators.set('date', window.dateValidator);
    this.validators.set('booking', window.bookingValidator);
  }
  
  setupGlobalValidation() {
    const checkAvailBtn = document.getElementById('checkAvail');
    if (checkAvailBtn) {
      const clickHandler = (e) => {
        if (!this.validateBeforeAvailabilityCheck()) {
          e.preventDefault();
          e.stopPropagation();
        }
      };
      checkAvailBtn.addEventListener('click', clickHandler);
      this.eventListeners.set('checkAvail-click', { element: checkAvailBtn, event: 'click', handler: clickHandler });
    }
    
    const continueBtn = document.getElementById('continueBtn');
    if (continueBtn) {
      const clickHandler = (e) => {
        if (!this.validateBeforeContinue()) {
          e.preventDefault();
          e.stopPropagation();
        }
      };
      continueBtn.addEventListener('click', clickHandler);
      this.eventListeners.set('continueBtn-click', { element: continueBtn, event: 'click', handler: clickHandler });
    }
    
    const form = document.getElementById('reserva-form');
    if (form) {
      const submitHandler = (e) => {
        if (!this.validateCompleteBooking()) {
          e.preventDefault();
          e.stopPropagation();
        }
      };
      form.addEventListener('submit', submitHandler);
      this.eventListeners.set('form-submit', { element: form, event: 'submit', handler: submitHandler });
    }
  }
  
  setupRealTimeValidation() {
    ['dateIn', 'dateOut'].forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field) {
        const changeHandler = () => {
          this.validateDates();
          this.updateCalculationsDisplay();
        };
        field.addEventListener('change', changeHandler);
        this.eventListeners.set(`${fieldId}-change`, { element: field, event: 'change', handler: changeHandler });
      }
    });
    
    ['men', 'women'].forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field) {
        const changeHandler = () => {
          this.validateGuests();
          this.updateCalculationsDisplay();
        };
        field.addEventListener('change', changeHandler);
        this.eventListeners.set(`${fieldId}-change`, { element: field, event: 'change', handler: changeHandler });
      }
    });
    
    ['nombre', 'email', 'telefono'].forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field) {
        const blurHandler = () => this.validateForm();
        field.addEventListener('blur', blurHandler);
        this.eventListeners.set(`${fieldId}-blur`, { element: field, event: 'blur', handler: blurHandler });
      }
    });
    
    const bedsHandler = (e) => {
      if (e.target.closest('.bed')) {
        setTimeout(() => this.validateBedSelection(), 100);
      }
    };
    document.addEventListener('click', bedsHandler);
    this.eventListeners.set('beds-click', { element: document, event: 'click', handler: bedsHandler });
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
    const datesValid = this.validateDates();
    const guestsValid = this.validateGuests();
    
    if (!datesValid || !guestsValid) {
      const issues = [];
      if (!datesValid) issues.push('fechas');
      if (!guestsValid) issues.push('huéspedes');
      
      this.showValidationError(`Corrige: ${issues.join(', ')}`);
      return false;
    }
    
    return true;
  }
  
  validateBeforeContinue() {
    const hasRooms = document.getElementById('rooms')?.children.length > 0;
    const bedSelectionValid = this.validateBedSelection();
    const canProceed = this.validators.get('booking')?.canProceedToBooking() || false;
    
    if (!hasRooms || !bedSelectionValid || !canProceed) {
      const issues = [];
      if (!hasRooms) issues.push('disponibilidad');
      if (!bedSelectionValid) issues.push('selección de camas');
      if (!canProceed) issues.push('cantidad correcta');
      
      this.showValidationError(`Antes de continuar: ${issues.join(', ')}`);
      return false;
    }
    
    return true;
  }
  
  validateCompleteBooking() {
    const formValid = this.validateForm();
    const paymentValid = this.validatePayment();
    const consistencyValid = this.validateBookingConsistency();
    
    if (!formValid || !paymentValid || !consistencyValid) {
      const issues = [];
      if (!formValid) issues.push('datos personales');
      if (!paymentValid) issues.push('pago');
      if (!consistencyValid) issues.push('consistencia');
      
      this.showValidationError(`Completa: ${issues.join(', ')}`);
      return false;
    }
    
    return true;
  }
  
  validatePayment() {
    const payState = document.getElementById('payState')?.textContent;
    const stateManagerPayment = window.stateManager?.getPaymentInfo();
    
    return (payState && payState.toLowerCase() !== 'pendiente') || 
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
        return false;
      }
    }
    
    return datesValid && bookingValid;
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
  
  destroy() {
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners.clear();
    this.validators.clear();
    this.validationResults.clear();
  }
}

window.validationIntegration = new ValidationIntegration();
