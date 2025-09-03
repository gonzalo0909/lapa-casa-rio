class DateValidator {
  constructor() {
    this.today = new Date();
    this.maxAdvanceBookingDays = 365;
    this.minStayNights = 1;
    this.maxStayNights = 30;
  }
  
  validateField(fieldId) {
    const input = document.getElementById(fieldId);
    const errorDiv = document.getElementById(`${fieldId}Error`);
    
    if (!input || !errorDiv) return true;
    
    let validation;
    
    if (fieldId === 'dateIn') {
      validation = this.validateCheckIn(input.value);
    } else if (fieldId === 'dateOut') {
      const dateInValue = document.getElementById('dateIn')?.value;
      validation = this.validateCheckOut(input.value, dateInValue);
    }
    
    this.showValidationResult(validation, errorDiv);
    return validation.valid;
  }
  
  validateCheckIn(dateString) {
    if (!dateString) {
      return { valid: false, errors: ['Fecha de check-in requerida'] };
    }
    
    const checkIn = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const errors = [];
    
    if (checkIn < today) {
      errors.push('Check-in no puede ser en el pasado');
    }
    
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + this.maxAdvanceBookingDays);
    
    if (checkIn > maxDate) {
      errors.push(`Check-in no puede ser más de ${this.maxAdvanceBookingDays} días en el futuro`);
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  validateCheckOut(checkOutString, checkInString) {
    const errors = [];
    
    if (!checkOutString) {
      return { valid: false, errors: ['Fecha de check-out requerida'] };
    }
    
    if (!checkInString) {
      return { valid: false, errors: ['Primero selecciona check-in'] };
    }
    
    const checkIn = new Date(checkInString);
    const checkOut = new Date(checkOutString);
    
    if (checkOut <= checkIn) {
      errors.push('Check-out debe ser después de check-in');
    }
    
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    
    if (nights < this.minStayNights) {
      errors.push(`Mínimo ${this.minStayNights} noche(s)`);
    }
    
    if (nights > this.maxStayNights) {
      errors.push(`Máximo ${this.maxStayNights} noches`);
    }
    
    return { 
      valid: errors.length === 0, 
      errors,
      nights 
    };
  }
  
  validateAll() {
    const dateInValid = this.validateField('dateIn');
    const dateOutValid = this.validateField('dateOut');
    
    return dateInValid && dateOutValid;
  }
  
  showValidationResult(validation, errorDiv) {
    if (validation.valid) {
      errorDiv.classList.add('hidden');
    } else {
      errorDiv.textContent = validation.errors[0];
      errorDiv.classList.remove('hidden');
    }
  }
  
  setupAutoValidation() {
    const dateIn = document.getElementById('dateIn');
    const dateOut = document.getElementById('dateOut');
    
    if (dateIn) {
      dateIn.addEventListener('change', () => {
        this.validateField('dateIn');
        
        // Auto-set checkout to next day if empty
        if (dateIn.value && !dateOut.value) {
          const nextDay = new Date(dateIn.value);
          nextDay.setDate(nextDay.getDate() + 1);
          dateOut.value = nextDay.toISOString().split('T')[0];
          this.validateField('dateOut');
        }
      });
    }
    
    if (dateOut) {
      dateOut.addEventListener('change', () => {
        this.validateField('dateOut');
      });
    }
  }
  
  getNights() {
    const dateIn = document.getElementById('dateIn')?.value;
    const dateOut = document.getElementById('dateOut')?.value;
    
    if (!dateIn || !dateOut) return 0;
    
    const validation = this.validateCheckOut(dateOut, dateIn);
    return validation.nights || 0;
  }
}

window.dateValidator = new DateValidator();

// Auto-setup when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.dateValidator.setupAutoValidation();
});
