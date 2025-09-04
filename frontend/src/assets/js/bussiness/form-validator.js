class FormValidator {
  constructor() {
    this.fields = {
      nombre: {
        validators: [
          { fn: v => v?.trim().length >= 2, msg: 'Mínimo 2 caracteres' },
          { fn: v => v?.trim().length <= 100, msg: 'Máximo 100 caracteres' },
          { fn: v => /^[a-zA-ZáéíóúÁÉÍÓÚñÑàèìòùÀÈÌÒÙâêîôûÂÊÎÔÛãõÃÕçÇ\s]+$/.test(v?.trim() || ''), msg: 'Solo letras y espacios' },
          { fn: v => this.hasMinWords(v?.trim() || '', 2), msg: 'Nombre y apellido requeridos' }
        ],
        sanitizer: v => this.sanitizeName(v)
      },
      
      email: {
        validators: [
          { fn: v => v?.trim().length > 0, msg: 'Email requerido' },
          { fn: v => this.isValidEmail(v?.trim() || ''), msg: 'Email inválido' },
          { fn: v => v?.trim().length <= 254, msg: 'Email muy largo' },
          { fn: v => !this.isDisposableEmail(v?.trim() || ''), msg: 'Email desechable no permitido' }
        ],
        sanitizer: v => this.sanitizeEmail(v)
      },
      
      telefono: {
        validators: [
          { fn: v => v?.trim().length > 0, msg: 'Teléfono requerido' },
          { fn: v => this.isValidBrazilianPhone(v?.trim() || ''), msg: 'Formato: (11) 99999-9999' },
          { fn: v => this.hasValidAreaCode(v?.trim() || ''), msg: 'Código de área inválido' }
        ],
        sanitizer: v => this.sanitizeBrazilianPhone(v)
      }
    };
    
    this.cache = new Map();
    this.disposableEmailDomains = new Set([
      '10minutemail.com', 'guerrillamail.com', 'mailinator.com',
      'tempmail.org', 'throwaway.email', 'temp-mail.org'
    ]);
    
    this.brazilianAreaCodes = new Set([
      '11', '12', '13', '14', '15', '16', '17', '18', '19',
      '21', '22', '24', '27', '28', '31', '32', '33', '34', '35', '37', '38',
      '41', '42', '43', '44', '45', '46', '47', '48', '49',
      '51', '53', '54', '55', '61', '62', '63', '64', '65', '66', '67', '68', '69',
      '71', '73', '74', '75', '77', '79', '81', '82', '83', '84', '85', '86', '87', '88', '89',
      '91', '92', '93', '94', '95', '96', '97', '98', '99'
    ]);
  }
  
  // VALIDADORES BRASILEÑOS
  isValidBrazilianPhone(phone) {
    if (!phone) return false;
    const numbers = phone.replace(/\D/g, '');
    
    if (numbers.length === 13 && numbers.startsWith('55')) {
      const areaCode = numbers.substring(2, 4);
      const number = numbers.substring(4);
      return this.brazilianAreaCodes.has(areaCode) && this.isValidMobileNumber(number);
    }
    
    if (numbers.length === 11) {
      const areaCode = numbers.substring(0, 2);
      const number = numbers.substring(2);
      return this.brazilianAreaCodes.has(areaCode) && this.isValidMobileNumber(number);
    }
    
    if (numbers.length === 10) {
      const areaCode = numbers.substring(0, 2);
      const number = numbers.substring(2);
      return this.brazilianAreaCodes.has(areaCode) && this.isValidLandlineNumber(number);
    }
    
    return false;
  }
  
  isValidMobileNumber(number) {
    return number.length === 9 && number.startsWith('9');
  }
  
  isValidLandlineNumber(number) {
    return number.length === 8 && /^[2-5]/.test(number);
  }
  
  hasValidAreaCode(phone) {
    const numbers = phone.replace(/\D/g, '');
    let areaCode;
    
    if (numbers.length === 13 && numbers.startsWith('55')) {
      areaCode = numbers.substring(2, 4);
    } else if (numbers.length >= 10) {
      areaCode = numbers.substring(0, 2);
    }
    
    return areaCode && this.brazilianAreaCodes.has(areaCode);
  }
  
  sanitizeBrazilianPhone(phone) {
    if (!phone) return '';
    
    let numbers = phone.replace(/\D/g, '');
    
    if (numbers.length === 13 && numbers.startsWith('55')) {
      return `+55 (${numbers.substring(2, 4)}) ${numbers.substring(4, 9)}-${numbers.substring(9)}`;
    } else if (numbers.length === 11) {
      return `(${numbers.substring(0, 2)}) ${numbers.substring(2, 7)}-${numbers.substring(7)}`;
    } else if (numbers.length === 10) {
      return `(${numbers.substring(0, 2)}) ${numbers.substring(2, 6)}-${numbers.substring(6)}`;
    }
    
    return numbers.substring(0, 13);
  }
  
  // VALIDADORES EMAIL
  isValidEmail(email) {
    if (!email) return false;
    
    const emailRegex = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/;
    
    if (!emailRegex.test(email)) return false;
    
    const [localPart, domain] = email.split('@');
    
    return localPart.length <= 64 && 
           domain.length <= 253 && 
           !email.includes('..');
  }
  
  isDisposableEmail(email) {
    const domain = email.split('@')[1]?.toLowerCase();
    return this.disposableEmailDomains.has(domain);
  }
  
  sanitizeEmail(email) {
    return email?.trim().toLowerCase().substring(0, 254) || '';
  }
  
  // VALIDADORES NOMBRE
  hasMinWords(name, minWords) {
    if (!name) return false;
    const words = name.trim().split(/\s+/).filter(word => word.length > 0);
    return words.length >= minWords;
  }
  
  sanitizeName(name) {
    if (!name) return '';
    
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .map(word => this.capitalizeWord(word))
      .join(' ')
      .substring(0, 100);
  }
  
  capitalizeWord(word) {
    if (!word) return '';
    
    const prepositions = ['de', 'da', 'do', 'das', 'dos', 'e', 'y'];
    
    if (prepositions.includes(word.toLowerCase())) {
      return word.toLowerCase();
    }
    
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }
  
  // MÉTODOS PRINCIPALES
  validateField(fieldId) {
    const input = document.getElementById(fieldId);
    const errorDiv = document.getElementById(`${fieldId}Error`);
    const fieldConfig = this.fields[fieldId];
    
    if (!input || !fieldConfig) return true;
    
    const cacheKey = `${fieldId}:${input.value}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      this.showValidationResult(cached, errorDiv, input);
      return cached.valid;
    }
    
    const sanitized = fieldConfig.sanitizer(input.value);
    
    if (input.value !== sanitized) {
      input.value = sanitized;
    }
    
    const errors = [];
    for (const validator of fieldConfig.validators) {
      if (!validator.fn(sanitized)) {
        errors.push(validator.msg);
        break;
      }
    }
    
    const result = { valid: errors.length === 0, errors };
    
    this.cache.set(cacheKey, result);
    
    if (this.cache.size > 50) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.showValidationResult(result, errorDiv, input);
    return result.valid;
  }
  
  showValidationResult(validation, errorDiv, input) {
    if (validation.valid) {
      if (errorDiv) errorDiv.classList.add('hidden');
      if (input) input.classList.remove('invalid');
    } else {
      if (errorDiv) {
        errorDiv.textContent = validation.errors[0];
        errorDiv.classList.remove('hidden');
      }
      if (input) input.classList.add('invalid');
    }
  }
  
  validateAll() {
    const fieldIds = Object.keys(this.fields);
    return fieldIds.every(fieldId => this.validateField(fieldId));
  }
  
  setupAutoValidation() {
    Object.keys(this.fields).forEach(fieldId => {
      const input = document.getElementById(fieldId);
      if (!input) return;
      
      input.addEventListener('blur', () => {
        this.validateField(fieldId);
      });
      
      let inputTimeout;
      input.addEventListener('input', (e) => {
        clearTimeout(inputTimeout);
        inputTimeout = setTimeout(() => {
          this.filterInput(fieldId, e);
        }, 200);
      });
      
      if (fieldId === 'telefono') {
        this.setupPhoneFormatting(input);
      }
    });
  }
  
  setupPhoneFormatting(input) {
    input.placeholder = '(11) 99999-9999';
    
    input.addEventListener('input', () => {
      const sanitized = this.sanitizeBrazilianPhone(input.value);
      if (sanitized !== input.value) {
        const cursorPos = input.selectionStart;
        input.value = sanitized;
        input.setSelectionRange(cursorPos, cursorPos);
      }
    });
  }
  
  filterInput(fieldId, event) {
    const input = event.target;
    let value = input.value;
    
    switch (fieldId) {
      case 'nombre':
        value = value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑàèìòùÀÈÌÒÙâêîôûÂÊÎÔÛãõÃÕçÇ\s]/g, '');
        break;
      case 'telefono':
        value = value.replace(/[^0-9+\-\s\(\)]/g, '');
        break;
    }
    
    if (value !== input.value) {
      const cursorPos = input.selectionStart;
      input.value = value;
      input.setSelectionRange(cursorPos - 1, cursorPos - 1);
    }
  }
  
  getData() {
    const data = {};
    Object.keys(this.fields).forEach(fieldId => {
      const input = document.getElementById(fieldId);
      if (input?.value) {
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
    
    this.cache.clear();
  }
  
  destroy() {
    this.cache.clear();
  }
}

window.formValidator = new FormValidator();

document.addEventListener('DOMContentLoaded', () => {
  window.formValidator.setupAutoValidation();
});
