class FormValidator {
  constructor() {
    this.fields = {
      nombre: {
        validators: [
          { fn: v => v && v.trim().length >= 2, msg: 'Mínimo 2 caracteres' },
          { fn: v => v && v.trim().length <= 100, msg: 'Máximo 100 caracteres' },
          { fn: v => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(v.trim()), msg: 'Solo letras y espacios' }
        ],
        sanitizer: v => v.trim().replace(/\s+/g, ' ').substring(0, 100)
      },
      
      email: {
        validators: [
          { fn: v => v && v.trim().length > 0, msg: 'Email requerido' },
          { fn: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()), msg: 'Email inválido' },
          { fn: v => v.trim().length <= 254, msg: 'Email muy largo' }
        ],
        sanitizer: v => v.trim().toLowerCase().substring(0, 254)
      },
      
      telefono: {
        validators: [
          { fn: v => v && v.trim().length > 0, msg: 'Teléfono requerido' },
          { fn: v => /^[0-9+\-\s\(\)]{8,}$/.test(v.trim()), msg: 'Mínimo 8 caracteres válidos' },
          { fn: v => v.trim().length <= 20, msg: 'Teléfono muy largo' }
        ],
        sanitizer: v => v.trim().replace(/[^0-9+\-\s\(\)]/g, '').substring(0, 20)
      }
    };
  }
  
  validateField(fieldId) {
    const input = document.getElementById(fieldId);
    const errorDiv = document.getElementById(`${fieldId}Error`);
    const fieldConfig = this.fields[fieldId];
    
    if (!input || !fieldConfig) return true;
    
    // Sanitize input
    const sanitized = fieldConfig.sanitizer(input.value);
    input.value = sanitized;
    
    // Validate
    const errors = [];
    for (const validator of fieldConfig.validators) {
      if (!validator.fn(sanitized)) {
        errors.push(validator.msg);
        break;
      }
    }
    
    // Show result
    if (errorDiv) {
      if (errors.length > 0) {
        errorDiv.textContent = errors[0];
        errorDiv.classList.remove('hidden');
        input.classList.add('invalid');
      } else {
        errorDiv.classList.add('hidden');
        input.classList.remove('invalid');
      }
    }
    
    return errors.length === 0;
  }
  
  validateAll() {
    const fieldIds = Object.keys(this.fields);
    let allValid = true;
    
    fieldIds.forEach(fieldId => {
      const isValid = this.validateField(fieldId);
      if (!isValid) allValid = false;
    });
    
    return allValid;
  }
  
  setupAutoValidation() {
    Object.keys(this.fields).forEach(fieldId => {
      const input = document.getElementById(fieldId);
      if (!input) return;
      
      // Validate on blur
      input.addEventListener('blur', () => {
        this.validateField(fieldId);
      });
      
      // Real-time input filtering
      input.addEventListener('input', (e) => {
        this.filterInput(fieldId, e);
      });
    });
  }
  
  filterInput(fieldId, event) {
    const input = event.target;
    let value = input.value;
    
    // Apply real-time filters
    switch (fieldId) {
      case 'nombre':
        value = value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
        break;
      case 'telefono':
        value = value.replace(/[^0-9+\-\s\(\)]/g, '');
        break;
    }
    
    if (value !== input.value) {
      input.value = value;
    }
    
    // Clear errors while typing
    const errorDiv = document.getElementById(`${fieldId}Error`);
    if (errorDiv && !errorDiv.classList.contains('hidden') && value.length > 2) {
      setTimeout(() => {
        errorDiv.classList.add('hidden');
        input.classList.remove('invalid');
      }, 1000);
    }
  }
  
  getData() {
    const data = {};
    Object.keys(this.fields).forEach(fieldId => {
      const input = document.getElementById(fieldId);
      if (input) {
        data[fieldId] = this.fields[fieldId].sanitizer(input.value);
      }
    });
    return data;
  }
  
  clear() {
    Object.keys(this.fields).forEach(fieldId => {
      const input = document.getElementById(fieldId);
      const errorDiv = document.getElementById(`${fieldId}Error`);
      
      if (input) {
        input.value = '';
        input.classList.remove('invalid');
      }
      
      if (errorDiv) {
        errorDiv.classList.add('hidden');
      }
    });
  }
}

window.formValidator = new FormValidator();

// Auto-setup
document.addEventListener('DOMContentLoaded', () => {
  window.formValidator.setupAutoValidation();
});
