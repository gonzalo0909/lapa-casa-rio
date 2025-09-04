class BookingValidator {
  constructor() {
    this.config = {
      maxCapacity: window.HOSTEL_CONFIG?.TOTAL_CAPACITY || 38,
      rooms: window.HOSTEL_CONFIG?.ROOMS || { 1: 12, 3: 12, 5: 7, 6: 7 },
      pricePerNight: window.HOSTEL_CONFIG?.PRICE_PER_NIGHT || 55
    };
    
    this.roomTypes = {
      1: { type: 'mixta', allowedGenders: ['men', 'women'] },
      3: { type: 'mixta', allowedGenders: ['men', 'women'] },
      5: { type: 'mixta', allowedGenders: ['men', 'women'] },
      6: { type: 'femenina', allowedGenders: ['women'] }
    };
    
    this.validationCache = new Map();
  }
  
  validateCapacity(men, women) {
    const total = men + women;
    const errors = [];
    const warnings = [];
    
    if (total === 0) {
      errors.push('Selecciona al menos un huésped');
    }
    
    if (total > this.config.maxCapacity) {
      errors.push(`Máximo ${this.config.maxCapacity} huéspedes`);
    }
    
    if (men < 0 || women < 0) {
      errors.push('Número de huéspedes no puede ser negativo');
    }
    
    const availability = this.checkGroupAvailability(men, women);
    
    if (!availability.canAccommodate) {
      errors.push(availability.reason);
    }
    
    if (men > 0 && women > 0) {
      warnings.push('Grupo mixto: habitación 6 no disponible');
    }
    
    if (total > 24) {
      warnings.push('Grupo grande: verificar disponibilidad real');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      maxCapacity: this.config.maxCapacity,
      availableRooms: availability.availableRooms,
      recommendedRooms: availability.recommendedRooms
    };
  }
  
  checkGroupAvailability(men, women) {
    const total = men + women;
    
    if (men === 0 && women > 0) {
      return {
        canAccommodate: total <= this.config.maxCapacity,
        availableRooms: [1, 3, 5, 6],
        recommendedRooms: this.getRecommendedRoomsForWomen(women),
        reason: total > this.config.maxCapacity ? 'Excede capacidad total' : null
      };
    }
    
    if (men > 0) {
      const mixedCapacity = this.config.rooms[1] + this.config.rooms[3] + this.config.rooms[5];
      
      if (total > mixedCapacity) {
        return {
          canAccommodate: false,
          availableRooms: [1, 3, 5],
          recommendedRooms: [],
          reason: `Grupos con hombres: máximo ${mixedCapacity} personas (sin habitación 6)`
        };
      }
      
      return {
        canAccommodate: true,
        availableRooms: [1, 3, 5],
        recommendedRooms: this.getRecommendedRoomsForMixed(total),
        reason: null
      };
    }
    
    return {
      canAccommodate: false,
      availableRooms: [],
      recommendedRooms: [],
      reason: 'Configuración inválida'
    };
  }
  
  getRecommendedRoomsForWomen(women) {
    const recommended = [];
    
    if (women <= 7) {
      recommended.push(6);
    }
    
    if (women > 7 || recommended.length === 0) {
      recommended.push(1);
      if (women > 12) recommended.push(3);
      if (women > 24) recommended.push(5);
    }
    
    return recommended;
  }
  
  getRecommendedRoomsForMixed(total) {
    const recommended = [];
    
    recommended.push(1);
    
    if (total > 12) recommended.push(3);
    
    if (total > 24) recommended.push(5);
    
    return recommended;
  }
  
  validateBedSelection(selectedBeds, men, women) {
    const total = men + women;
    const errors = [];
    const warnings = [];
    
    if (selectedBeds.length !== total) {
      errors.push(`Selecciona exactamente ${total} camas`);
    }
    
    const bedsByRoom = this.groupBedsByRoom(selectedBeds);
    
    Object.entries(bedsByRoom).forEach(([roomId, beds]) => {
      const roomNum = parseInt(roomId);
      const roomConfig = this.roomTypes[roomNum];
      
      if (!roomConfig) {
        errors.push(`Habitación ${roomId} no existe`);
        return;
      }
      
      if (roomNum === 6) {
        if (men > 0) {
          errors.push('Habitación 6 es exclusiva para mujeres');
        }
        
        if (beds.length > women) {
          errors.push('Más camas seleccionadas que mujeres en habitación 6');
        }
      }
      
      const roomCapacity = this.config.rooms[roomNum];
      if (beds.length > roomCapacity) {
        errors.push(`Habitación ${roomId} excede capacidad (${roomCapacity})`);
      }
    });
    
    if (Object.keys(bedsByRoom).length > 2) {
      warnings.push('Grupo distribuido en muchas habitaciones');
    }
    
    const room6Beds = bedsByRoom['6']?.length || 0;
    if (room6Beds > 0 && men > 0) {
      errors.push('Grupos mixtos no pueden usar habitación 6');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      bedsByRoom,
      totalSelected: selectedBeds.length,
      needsSelection: total - selectedBeds.length
    };
  }
  
  groupBedsByRoom(selectedBeds) {
    const grouped = {};
    
    selectedBeds.forEach(bed => {
      const roomId = bed.room || bed.dataset?.room || bed.getAttribute?.('data-room');
      
      if (roomId) {
        if (!grouped[roomId]) grouped[roomId] = [];
        grouped[roomId].push(bed);
      }
    });
    
    return grouped;
  }
  
  validateCurrentBedSelection() {
    const selectedBeds = Array.from(document.querySelectorAll('.bed.selected'));
    const men = parseInt(document.getElementById('men')?.value || 0);
    const women = parseInt(document.getElementById('women')?.value || 0);
    
    const validation = this.validateBedSelection(selectedBeds, men, women);
    
    this.updateBedSelectionUI(validation);
    
    return validation.valid;
  }
  
  updateBedSelectionUI(validation) {
    const selCount = document.getElementById('selCount');
    if (selCount) {
      selCount.textContent = validation.totalSelected;
    }
    
    const continueBtn = document.getElementById('continueBtn');
    if (continueBtn) {
      continueBtn.disabled = !validation.valid;
      
      if (!validation.valid && validation.errors.length > 0) {
        continueBtn.title = validation.errors[0];
      } else {
        continueBtn.title = '';
      }
    }
    
    if (validation.warnings.length > 0 && window.toastManager) {
      window.toastManager.showWarning(validation.warnings[0]);
    }
  }
  
  canProceedToBooking() {
    const dateValidator = window.dateValidator;
    const formValidator = window.formValidator;
    
    const datesValid = dateValidator?.validateAll() || false;
    
    const men = parseInt(document.getElementById('men')?.value || 0);
    const women = parseInt(document.getElementById('women')?.value || 0);
    const capacityValid = this.validateCapacity(men, women).valid;
    
    const bedSelectionValid = this.validateCurrentBedSelection();
    
    const formCard = document.getElementById('formCard');
    const formValid = formCard?.classList.contains('hidden') || 
                     formValidator?.validateAll() || false;
    
    return datesValid && capacityValid && bedSelectionValid && formValid;
  }
  
  getBookingData() {
    const selectedBeds = Array.from(document.querySelectorAll('.bed.selected'));
    const men = parseInt(document.getElementById('men')?.value || 0);
    const women = parseInt(document.getElementById('women')?.value || 0);
    
    return {
      guests: { men, women, total: men + women },
      beds: selectedBeds.map(bed => ({
        room: bed.dataset.room,
        bed: bed.dataset.bed,
        level: this.getBedLevel(parseInt(bed.dataset.bed))
      })),
      dates: window.dateValidator?.getDateRange() || null,
      pricing: this.calculatePricing(men + women),
      validation: {
        capacity: this.validateCapacity(men, women),
        bedSelection: this.validateBedSelection(selectedBeds, men, women)
      }
    };
  }
  
  getBedLevel(bedNumber) {
    const position = ((bedNumber - 1) % 3) + 1;
    
    switch (position) {
      case 1: return 'Baja';
      case 2: return 'Media';
      case 3: return 'Alta';
      default: return 'Baja';
    }
  }
  
  calculatePricing(totalGuests) {
    const nights = window.dateValidator?.getNights() || 0;
    const basePrice = totalGuests * nights * this.config.pricePerNight;
    
    return {
      guests: totalGuests,
      nights,
      pricePerNight: this.config.pricePerNight,
      subtotal: basePrice,
      total: basePrice
    };
  }
  
  reset() {
    document.querySelectorAll('.bed.selected').forEach(bed => {
      bed.classList.remove('selected');
    });
    
    const selCount = document.getElementById('selCount');
    if (selCount) selCount.textContent = '0';
    
    const continueBtn = document.getElementById('continueBtn');
    if (continueBtn) {
      continueBtn.disabled = true;
      continueBtn.title = '';
    }
    
    this.validationCache.clear();
  }
  
  destroy() {
    this.validationCache.clear();
  }
}

window.bookingValidator = new BookingValidator();
