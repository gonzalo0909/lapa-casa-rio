class DateValidator {
    constructor() {
        this.today = new Date();
        this.today.setHours(0, 0, 0, 0);
        this.config = {
            maxAdvanceBookingDays: 365,
            minStayNights: 1,
            maxStayNights: 30,
            pricePerNight: window.HOSTEL_CONFIG?.PRICE_PER_NIGHT || 55
        };
        this.cache = new Map();
        this.cacheExpiry = new Map();
        this.cacheTTL = 300000;
        this.maxCacheSize = 50;
        this.startCacheCleanup();
    }

    startCacheCleanup() {
        setInterval(() => {
            this.cleanExpiredCache();
        }, 60000);
    }

    cleanExpiredCache() {
        const now = Date.now();
        this.cacheExpiry.forEach((expiry, key) => {
            if (now > expiry) {
                this.cache.delete(key);
                this.cacheExpiry.delete(key);
            }
        });
    }

    validateField(fieldId) {
        const input = document.getElementById(fieldId);
        const errorDiv = document.getElementById(`${fieldId}Error`);
        if (!input || !errorDiv) return true;

        const cacheKey = `${fieldId}:${input.value}`;
        const now = Date.now();

        if (this.cache.has(cacheKey) && this.cacheExpiry.get(cacheKey) > now) {
            const cached = this.cache.get(cacheKey);
            this.showValidationResult(cached, errorDiv, input);
            return cached.valid;
        }

        let validation;
        if (fieldId === 'dateIn') {
            validation = this.validateCheckIn(input.value);
        } else if (fieldId === 'dateOut') {
            const dateInValue = document.getElementById('dateIn')?.value;
            validation = this.validateCheckOut(input.value, dateInValue);
        } else {
            return true;
        }

        this.cache.set(cacheKey, validation);
        this.cacheExpiry.set(cacheKey, now + this.cacheTTL);

        if (this.cache.size > this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
            this.cacheExpiry.delete(firstKey);
        }

        this.showValidationResult(validation, errorDiv, input);
        return validation.valid;
    }

    validateCheckIn(dateString) {
        if (!dateString) {
            return { valid: false, errors: ['Fecha de check-in requerida'] };
        }
        const checkIn = new Date(dateString + 'T12:00:00');
        const errors = [];
        if (isNaN(checkIn.getTime())) {
            errors.push('Fecha inválida');
        }
        const todayUTC = new Date(this.today);
        todayUTC.setHours(12, 0, 0, 0);
        if (checkIn < todayUTC) {
            errors.push('Check-in no puede ser en el pasado');
        }
        const maxDate = new Date(todayUTC);
        maxDate.setDate(maxDate.getDate() + this.config.maxAdvanceBookingDays);
        if (checkIn > maxDate) {
            errors.push(`Máximo ${this.config.maxAdvanceBookingDays} días de anticipación`);
        }
        return {
            valid: errors.length === 0,
            errors,
            date: checkIn
        };
    }

    validateCheckOut(checkOutString, checkInString) {
        const errors = [];
        if (!checkOutString) {
            return { valid: false, errors: ['Fecha de check-out requerida'] };
        }
        if (!checkInString) {
            return { valid: false, errors: ['Primero selecciona check-in'] };
        }
        const checkIn = new Date(checkInString + 'T12:00:00');
        const checkOut = new Date(checkOutString + 'T11:00:00');
        if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
            errors.push('Fechas inválidas');
        }
        if (checkOut <= checkIn) {
            errors.push('Check-out debe ser después de check-in');
        }
        const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
        if (nights < this.config.minStayNights) {
            errors.push(`Mínimo ${this.config.minStayNights} noche(s)`);
        }
        if (nights > this.config.maxStayNights) {
            errors.push(`Máximo ${this.config.maxStayNights} noches`);
        }
        return {
            valid: errors.length === 0,
            errors,
            nights: Math.max(0, nights),
            checkIn,
            checkOut
        };
    }

    validateAll() {
        const dateInValid = this.validateField('dateIn');
        const dateOutValid = this.validateField('dateOut');
        return dateInValid && dateOutValid;
    }

    showValidationResult(validation, errorDiv, input) {
        if (validation.valid) {
            errorDiv.classList.add('hidden');
            input.classList.remove('invalid');
        } else {
            errorDiv.textContent = validation.errors[0];
            errorDiv.classList.remove('hidden');
            input.classList.add('invalid');
        }
    }

    setupAutoValidation() {
        const dateIn = document.getElementById('dateIn');
        const dateOut = document.getElementById('dateOut');

        if (dateIn) {
            dateIn.min = this.today.toISOString().split('T')[0];
            dateIn.addEventListener('change', () => {
                this.validateField('dateIn');
                // Si no hay fecha de salida, establecerla automáticamente al día siguiente
                if (dateIn.value && !dateOut.value) {
                    const nextDay = new Date(dateIn.value + 'T12:00:00');
                    nextDay.setDate(nextDay.getDate() + 1);
                    dateOut.value = nextDay.toISOString().split('T')[0];
                    // Validar la nueva fecha de salida
                    this.validateField('dateOut');
                }
                this.updateCalculations();
            });
        }

        if (dateOut) {
            const tomorrow = new Date(this.today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            dateOut.min = tomorrow.toISOString().split('T')[0];
            dateOut.addEventListener('change', () => {
                this.validateField('dateOut');
                this.updateCalculations();
            });
        }
    }

    updateCalculations() {
        const dateIn = document.getElementById('dateIn')?.value;
        const dateOut = document.getElementById('dateOut')?.value;
        if (!dateIn || !dateOut) return;
        const validation = this.validateCheckOut(dateOut, dateIn);
        if (validation.valid) {
            const nights = validation.nights;
            const nightsEl = document.getElementById('nightsCount');
            if (nightsEl) nightsEl.textContent = nights;
            this.updateTotalPrice(nights);
            if (typeof updateCalculations === 'function') {
                updateCalculations();
            }
        }
    }

    updateTotalPrice(nights) {
        const men = parseInt(document.getElementById('men')?.value || 0);
        const women = parseInt(document.getElementById('women')?.value || 0);
        const totalGuests = men + women;
        if (totalGuests > 0 && nights > 0) {
            const totalPrice = totalGuests * nights * this.config.pricePerNight;
            const priceEl = document.getElementById('totalPrice');
            if (priceEl) priceEl.textContent = totalPrice;
            return totalPrice;
        }
        return 0;
    }

    getNights() {
        const dateIn = document.getElementById('dateIn')?.value;
        const dateOut = document.getElementById('dateOut')?.value;
        if (!dateIn || !dateOut) return 0;
        const validation = this.validateCheckOut(dateOut, dateIn);
        return validation.valid ? validation.nights : 0;
    }

    getTotalPrice() {
        const nights = this.getNights();
        const men = parseInt(document.getElementById('men')?.value || 0);
        const women = parseInt(document.getElementById('women')?.value || 0);
        const totalGuests = men + women;
        return totalGuests * nights * this.config.pricePerNight;
    }

    getDateRange() {
        const dateIn = document.getElementById('dateIn')?.value;
        const dateOut = document.getElementById('dateOut')?.value;
        if (!dateIn || !dateOut) return null;
        return {
            checkIn: dateIn,
            checkOut: dateOut,
            nights: this.getNights(),
            totalPrice: this.getTotalPrice()
        };
    }

    isHighSeason(date) {
        const month = new Date(date).getMonth() + 1;
        const highSeasonMonths = [12, 1, 2, 3, 7];
        return highSeasonMonths.includes(month);
    }

    areDatesAvailable(checkIn, checkOut) {
        return true;
    }

    clear() {
        const fields = ['dateIn', 'dateOut'];
        fields.forEach(fieldId => {
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
        this.cacheExpiry.clear();
        const nightsEl = document.getElementById('nightsCount');
        const priceEl = document.getElementById('totalPrice');
        if (nightsEl) nightsEl.textContent = '0';
        if (priceEl) priceEl.textContent = '0';
    }

    destroy() {
        this.cache.clear();
        this.cacheExpiry.clear();
    }
}

window.dateValidator = new DateValidator();
document.addEventListener('DOMContentLoaded', () => {
    window.dateValidator.setupAutoValidation();
});
