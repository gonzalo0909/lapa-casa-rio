class RoomManager {
  constructor() {
    this.ROOMS = { 1: 12, 3: 12, 5: 7, 6: 7 };
    this.PRICE_PER_NIGHT = 55;
    
    // Configuración específica de habitaciones
    this.ROOM_CONFIG = {
      1: { type: 'mixta', allowedGenders: ['men', 'women'], priority: 1 },
      3: { type: 'mixta', allowedGenders: ['men', 'women'], priority: 2 },
      5: { type: 'mixta', allowedGenders: ['men', 'women'], priority: 3 },
      6: { type: 'femenina', allowedGenders: ['women'], priority: 4 }
    };
  }
  
  // Lógica corregida para habitación 6 - SOLO FEMENINA
  getRoom6Availability(men, women) {
    const total = men + women;
    
    // Habitación 6 es EXCLUSIVAMENTE femenina
    if (women > 0 && men === 0) {
      return {
        available: true,
        type: 'Solo mujeres',
        description: 'Habitación exclusiva femenina (7 camas)',
        allowedGenders: ['women']
      };
    }
    
    // Si hay hombres, no está disponible
    if (men > 0) {
      return {
        available: false,
        type: 'No disponible',
        description: 'Habitación exclusiva femenina',
        reason: 'men_not_allowed'
      };
    }
    
    // Si no hay mujeres, no se muestra
    return {
      available: false,
      type: 'No disponible',
      description: 'Habitación exclusiva femenina',
      reason: 'no_women'
    };
  }
  
  getAvailableRooms(men, women, availabilityData) {
    const total = men + women;
    const rooms = [];
    
    if (total === 0) return [];
    
    // ORDEN CORRECTO DE APARICIÓN
    
    // 1. Habitación 1 - SIEMPRE primero si está disponible
    if (this.isRoomAvailable(1, availabilityData)) {
      rooms.push({
        id: 1,
        type: 'Mixta',
        beds: this.ROOMS[1],
        available: availabilityData.room1 || this.ROOMS[1],
        priority: 1,
        description: 'Habitación principal mixta (12 camas)',
        allowedGenders: ['men', 'women']
      });
    }
    
    // 2. Habitación 3 - Aparece automáticamente si necesitas más de 12
    if (total > 12 && this.isRoomAvailable(3, availabilityData)) {
      rooms.push({
        id: 3,
        type: 'Mixta',
        beds: this.ROOMS[3],
        available: availabilityData.room3 || this.ROOMS[3],
        priority: 2,
        description: 'Capacidad adicional mixta (12 camas)',
        allowedGenders: ['men', 'women']
      });
    }
    
    // 3. Habitación 5 - Solo si necesitas más de 24 (1+3)
    if (total > 24 && this.isRoomAvailable(5, availabilityData)) {
      rooms.push({
        id: 5,
        type: 'Mixta',
        beds: this.ROOMS[5],
        available: availabilityData.room5 || this.ROOMS[5],
        priority: 3,
        description: 'Habitación alternativa (7 camas)',
        allowedGenders: ['men', 'women']
      });
    }
    
    // 4. Habitación 6 - Regla especial: Solo mujeres O mixta para grupos grandes
    const room6Rule = this.getRoom6Availability(men, women);
    if (room6Rule.available && this.isRoomAvailable(6, availabilityData)) {
      rooms.push({
        id: 6,
        type: room6Rule.type,
        beds: this.ROOMS[6],
        available: availabilityData.room6 || this.ROOMS[6],
        priority: 4,
        description: room6Rule.description,
        allowedGenders: room6Rule.allowedGenders,
        warning: room6Rule.isException 
          ? 'Habitación abierta como mixta por capacidad' 
          : 'Habitación exclusiva para mujeres',
        isException: room6Rule.isException
      });
    }
    
    return rooms.sort((a, b) => a.priority - b.priority);
  }
  
  isRoomAvailable(roomId, availabilityData) {
    if (!availabilityData) return true;
    const available = availabilityData[`room${roomId}`];
    return available && available > 0;
  }
  
  validateBedSelection(selectedBeds, men, women) {
    const validation = {
      valid: true,
      errors: [],
      warnings: []
    };
    
    const total = men + women;
    
    // Validar cantidad
    if (selectedBeds.length !== total) {
      validation.valid = false;
      validation.errors.push(`Selecciona exactamente ${total} camas`);
    }
    
    // Validar género por habitación
    const bedsByRoom = this.groupBedsByRoom(selectedBeds);
    
    Object.keys(bedsByRoom).forEach(roomId => {
      const roomBeds = bedsByRoom[roomId];
      const roomConfig = this.ROOM_CONFIG[roomId];
      
      if (roomId === '6') {
        // Habitación 6: solo mujeres
        if (men > 0 && roomBeds.length > 0) {
          validation.valid = false;
          validation.errors.push('Habitación 6 es exclusiva para mujeres');
        }
        
        if (roomBeds.length > women) {
          validation.valid = false;
          validation.errors.push('Más camas seleccionadas que mujeres en habitación 6');
        }
      }
    });
    
    // Advertencias útiles
    if (men > 0 && women > 0) {
      validation.warnings.push('Grupo mixto: consideren habitaciones 1, 3 o 5');
    }
    
    return validation;
  }
  
  groupBedsByRoom(selectedBeds) {
    const grouped = {};
    selectedBeds.forEach(bed => {
      const roomId = bed.room || bed.dataset?.room;
      if (!grouped[roomId]) grouped[roomId] = [];
      grouped[roomId].push(bed);
    });
    return grouped;
  }
  
  display(men, women, availabilityData, container) {
    if (!container) return;
    
    container.innerHTML = '';
    
    if (men + women === 0) {
      container.innerHTML = '<div class="empty-state">Selecciona huéspedes para ver habitaciones</div>';
      return;
    }
    
    const availableRooms = this.getAvailableRooms(men, women, availabilityData);
    
    if (availableRooms.length === 0) {
      container.innerHTML = '<div class="empty-state">No hay habitaciones disponibles para esta combinación</div>';
      return;
    }
    
    // Mostrar información de la búsqueda
    const searchInfo = document.createElement('div');
    searchInfo.className = 'search-info';
    searchInfo.innerHTML = `
      <p><strong>Búsqueda:</strong> ${men} hombres, ${women} mujeres = ${men + women} personas</p>
      ${men > 0 && women > 0 ? '<p class="warning-text">Grupo mixto: habitación 6 no disponible</p>' : ''}
      ${men > 0 && women === 0 ? '<p class="info-text">Solo hombres: habitaciones mixtas disponibles</p>' : ''}
      ${men === 0 && women > 0 ? '<p class="info-text">Solo mujeres: todas las habitaciones disponibles</p>' : ''}
    `;
    container.appendChild(searchInfo);
    
    availableRooms.forEach(room => {
      this.createRoomElement(room, container, availabilityData);
    });
    
    // Marcar que se verificó disponibilidad
    container.dataset.availabilityChecked = 'true';
  }
  
  createRoomElement(room, container, availabilityData) {
    const roomEl = document.createElement('div');
    roomEl.className = 'room';
    roomEl.dataset.room = room.id;
    
    // Clase especial para habitación femenina
    if (room.id === 6) {
      roomEl.classList.add('room-female-only');
    }
    
    roomEl.innerHTML = `
      <div class="room-header">
        <h3>Habitación ${room.id}</h3>
        <span class="room-type">${room.type}</span>
      </div>
      <div class="room-description">${room.description}</div>
      ${room.warning ? `<div class="room-warning">${room.warning}</div>` : ''}
      <div class="beds-container"></div>
      <div class="room-info">Disponibles: ${room.available}/${room.beds}</div>
    `;
    
    const bedsContainer = roomEl.querySelector('.beds-container');
    this.createBeds(room, bedsContainer, availabilityData);
    
    container.appendChild(roomEl);
  }
  
  createBeds(room, container, availabilityData) {
    const occupiedBeds = availabilityData?.occupiedBeds?.[`room${room.id}`] || [];
    
    for (let bedNum = 1; bedNum <= room.beds; bedNum++) {
      const bedEl = document.createElement('div');
      bedEl.className = 'bed';
      bedEl.dataset.room = room.id;
      bedEl.dataset.bed = bedNum;
      
      if (occupiedBeds.includes(bedNum)) {
        bedEl.classList.add('occupied');
      }
      
      // Usar cálculo corregido de nivel de cama
      const level = this.getBedLevelCorrected(bedNum);
      
      bedEl.innerHTML = `
        <div class="bed-number">${bedNum}</div>
        <div class="bed-level">${level}</div>
        ${occupiedBeds.includes(bedNum) ? '<div class="bed-status">Ocupada</div>' : ''}
      `;
      
      container.appendChild(bedEl);
    }
  }
  
  // CÁLCULO CORREGIDO de nivel de cama
  getBedLevelCorrected(bedNumber) {
    // Las camas se organizan en literas de 3 niveles
    // Cama 1,4,7,10... = Baja
    // Cama 2,5,8,11... = Media  
    // Cama 3,6,9,12... = Alta
    
    const position = ((bedNumber - 1) % 3) + 1;
    
    switch (position) {
      case 1: return 'Baja';
      case 2: return 'Media'; 
      case 3: return 'Alta';
      default: return 'Baja';
    }
  }
  
  // Métodos de utilidad
  getRoomCapacity(roomId) {
    return this.ROOMS[roomId] || 0;
  }
  
  getTotalCapacity() {
    return Object.values(this.ROOMS).reduce((sum, beds) => sum + beds, 0);
  }
  
  getRoomType(roomId) {
    return this.ROOM_CONFIG[roomId]?.type || 'mixta';
  }
  
  canAccommodateGroup(men, women) {
    const total = men + women;
    
    if (total > this.getTotalCapacity()) {
      return { 
        possible: false, 
        reason: 'Excede capacidad total del hostel' 
      };
    }
    
    // Si hay solo mujeres, pueden usar cualquier habitación
    if (men === 0 && women > 0) {
      return { possible: true, rooms: [1, 3, 5, 6] };
    }
    
    // Si hay hombres, no pueden usar habitación 6
    if (men > 0) {
      const availableCapacity = this.ROOMS[1] + this.ROOMS[3] + this.ROOMS[5]; // 31 camas
      if (total > availableCapacity) {
        return { 
          possible: false, 
          reason: 'Grupos con hombres no pueden usar habitación 6. Capacidad máxima: 31' 
        };
      }
      return { possible: true, rooms: [1, 3, 5] };
    }
    
    return { possible: true, rooms: [1, 3, 5, 6] };
  }
}

window.roomManager = new RoomManager();
