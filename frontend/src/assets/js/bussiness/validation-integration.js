class ValidationIntegration {
  constructor() {
    this.validators = new Map();
    this.validationResults = new Map();
    this.realTimeEnabled = true;
    this.validationQueue = [];
    this.processingQueue = false;
    
    this.initializeValidators();
    this.setupGlobalValidation();
    this.setupRealTimeValidation();
  }
  
  initializeValidators() {
    this.registerValidator('form', window.formValidator);
    this.registerValidator('date', window.dateValidator);
    this.registerValidator('booking', window.bookingValidator);
    
    console.log('Validation Integration initialized with validators:', 
      Array.from(this.validators.keys()));
  }
  
  registerValidator(name, validator) {
    if (validator) {
      this.validators.set(name, validator);
      this.validationResults.set(name, { valid: false, lastCheck: null });
    }
  }
  
  setupGlobalValidation() {
    // Validación cuando se presiona el botón de verificar disponibilidad
    const checkAvailBtn = document.getElementById('checkAvail');
    if (checkAvailBtn) {
      checkAvailBtn.addEventListener('click', (e) => {
        if (!this.validateBeforeAvailabilityCheck()) {
          e.preventDefault();
          e.stopPropagation();
        }
      });
    }
    
    // Validación cuando se continúa al formulario
    const continueBtn = document.getElementById('continueBtn');
    if (continueBtn) {
      continueBtn.addEventListener('click', (e) => {
        if (!this.validateBeforeContinue()) {
          e.preventDefault();
          e.stopPropagation();
        }
      });
    }
    
    // Validación final antes de enviar reserva
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
      const form = document.getElementById('reserva-form');
      if (form) {
        form.addEventListener('submit', (e) => {
          if (!this.validateCompleteBooking()) {
            e.preventDefault();
            e.stopPropagation();
          }
        });
      }
    }
  }
  
  setupRealTimeValidation() {
    // Validación en tiempo real de fechas
    ['dateIn', 'dateOut'].forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field) {
        field.addEventListener('change', () => {
          this.queueValidation('dates', () => this.validateDates());
        });
      }
    });
    
    // Validación en tiempo real de huéspedes
    ['men', 'women'].forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field) {
        field.addEventListener('input', () => {
          this.queueValidation('guests', () => this.validateGuests());
        });
        
        field.addEventListener('change', () => {
          this.queueValidation('guests', () => this.validateGuests());
        });
      }
    });
    
    // Validación en tiempo real de formulario
    ['nombre', 'email', 'telefono'].forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field) {
        field.addEventListener('blur', () => {
          this.queueValidation('form', () => this.validateForm());
        });
        
        field.addEventListener('input', () => {
          this.queueValidation('form', () => this.validateFormField(fieldId), 500);
        });
      }
    });
    
    // Validación de selección de camas
    document.addEventListener('click', (e) => {
      if (e.target.closest('.bed')) {
        setTimeout(() => {
          this.queueValidation('beds', () => this.validateBedSelection());
        }, 100);
      }
    });
  }
  
  // SISTEMA DE COLA PARA VALIDACIONES
  queueValidation(type, validationFn, delay = 150) {
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
        const waitTime = Math.max(0, nextTimestamp - now);
        
        if (waitTime > 0) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    this.processingQueue = false;
  }
  
  // VALIDACIONES ESPECÍFICAS
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
      men,
      women,
      total: men + women,
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
  
  // VALIDACIONES DE FLUJO COMPLETO
  validateBeforeAvailabilityCheck() {
    const results = [];
    
    const datesValid = this.validateDates();
    results.push({ step: 'fechas', valid: datesValid });
    
    const guestsValid = this.validateGuests();
    results.push({ step: 'huéspedes', valid: guestsValid });
    
    const allValid = results.every(r => r.valid);
    
    if (!allValid) {
      const invalidSteps = results.filter(r => !r.valid).map(r => r.step);
      this.showValidationError(`Corrige los errores en: ${invalidSteps.join(', ')}`);
    }
    
    return allValid;
  }
  
  validateBeforeContinue() {
    const results = [];
    
    const roomsDiv = document.getElementById('rooms');
    const hasRooms = roomsDiv?.children.length > 0;
    results.push({ step: 'disponibilidad', valid: hasRooms });
    
    const bedSelectionValid = this.validateBedSelection();
    results.push({ step: 'selección de camas', valid: bedSelectionValid });
    
    const bookingValidator = this.validators.get('booking');
    const canProceed = bookingValidator?.canProceedToBooking() || false;
    results.push({ step: 'cantidad correcta', valid: canProceed });
    
    const allValid = results.every(r => r.valid);
    
    if (!allValid) {
      const invalidSteps = results.filter(r => !r.valid).map(r => r.step);
      this.showValidationError(`Antes de continuar: ${invalidSteps.join(', ')}`);
    }
    
    return allValid;
  }
  
  validateCompleteBooking() {
    const results = [];
    
    const formValid = this.validateForm();
    results.push({ step: 'datos personales', valid: formValid });
    
    const paymentValid = this.validatePayment();
    results.push({ step: 'pago', valid: paymentValid });
    
    const consistencyValid = this.validateBookingConsistency();
    results.push({ step: 'consistencia', valid: consistencyValid });
    
    const allValid = results.every(r => r.valid);
    
    if (!allValid) {
      const invalidSteps = results.filter(r => !r.valid).map(r => r.step);
      this.showValidationError(`Completa antes de confirmar: ${invalidSteps.join(', ')}`);
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
  
  // MÉTODOS DE UTILIDAD
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
  
  // API PÚBLICA
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
      case 'availability':
        return status.dates?.valid && status.guests?.valid;
      
      case 'beds':
        return status.dates?.valid && status.guests?.valid;
      
      case 'form':
        return status.bedSelection?.valid;
      
      case 'payment':
        return status.form?.valid;
      
      case 'booking':
        return status.form?.valid && this.validatePayment();
      
      default:
        return false;
    }
  }
  
  forceValidateAll() {
    console.log('Forcing complete validation...');
    
    return Promise.all([
      this.validateDates(),
      this.validateGuests(),
      this.validateForm(),
      this.validateBedSelection()
    ]).then(results => {
      const allValid = results.every(r => r);
      console.log('Force validation results:', { results, allValid });
      return allValid;
    });
  }
  
  // DEBUGGING
  debugValidation() {
    console.log('=== VALIDATION DEBUG ===');
    console.log('Available validators:', Array.from(this.validators.keys()));
    console.log('Validation results:', this.getValidationStatus());
    console.log('Queue status:', {
      queueLength: this.validationQueue.length,
      processing: this.processingQueue,
      queue: this.validationQueue
    });
    
    console.log('\n=== CURRENT STATE ===');
    console.log('Ready for availability:', this.isReadyForStep('availability'));
    console.log('Ready for beds:', this.isReadyForStep('beds'));
    console.log('Ready for form:', this.isReadyForStep('form'));
    console.log('Ready for payment:', this.isReadyForStep('payment'));
    console.log('Ready for booking:', this.isReadyForStep('booking'));
  }
  
  destroy() {
    this.validationQueue = [];
    this.processingQueue = false;
    this.validators.clear();
    this.validationResults.clear();
    
    console.log('ValidationIntegration destroyed');
  }
}

window.validationIntegration = new ValidationIntegration();

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (window.validationIntegration) {
      window.validationIntegration.initializeValidators();
      console.log('Validation integration ready');
    }
  }, 500);
});
