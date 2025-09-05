class RoomManager {
  constructor() {
    this.ROOMS = { 1: 12, 3: 12, 5: 7, 6: 7 };
    this.PRICE_PER_NIGHT = 55;
    this.CAPACITY_THRESHOLD = 31;
    
    this.ROOM_CONFIG = {
      1: { type: 'mixta', allowedGenders: ['men', 'women'], priority: 1 },
      3: { type: 'mixta', allowedGenders: ['men', 'women'], priority: 2 },
      5: { type: 'mixta', allowedGenders: ['men', 'women'], priority: 3 },
      6: { type: 'femenina', allowedGenders: ['women'], priority: 4 }
    };
  }
  
  getRoom6Availability(men, women) {
    const total = men + women;
    
    if (total > this.CAPACITY_THRESHOLD) {
      return {
        available: true,
        type: 'Mixta (por capacidad)',
        description: 'Habitación abierta como mixta para grupos grandes (7 camas)',
        allowedGenders: ['men', 'women'],
        isException: true
      };
    }
    
    if (women > 0 && men === 0) {
      return {
        available: true,
        type: 'Solo mujeres',
        description: 'Habitación exclusiva femenina (7 camas)',
        allowedGenders: ['women'],
        isException: false
      };
    }
    
    if (men > 0) {
      return {
        available: false,
        type: 'No disponible',
        description: 'Habitación exclusiva femenina (usar habitaciones 1, 3, 5)',
        reason: 'men_not_allowed',
        isException: false
      };
    }
    
    return {
      available: false,
      type: 'No disponible',
      description: 'Habitación exclusiva femenina',
      reason: 'no_women',
      isException: false
    };
  }
  
  getAvailableRooms(men, women, availabilityData) {
    const total = men + women;
    const rooms = [];
    
    if (total === 0) return [];
    
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
    
    if (this.isRoomAvailable(5, availabilityData)) {
      rooms.push({
        id: 5,
        type: 'Mixta',
        beds: this.ROOMS[5],
        available: availabilityData.room5 || this.ROOMS[5],
        priority: 3,
        description: 'Capacidad adicional mixta (7 camas)',
        allowedGenders: ['men', 'women']
      });
    }
    
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
    
    if (selectedBeds.length !== total) {
      validation.valid = false;
      validation.errors.push(`Selecciona exactamente ${total} camas`);
    }
    
    const bedsByRoom = this.groupBedsByRoom(selectedBeds);
    
    Object.keys(bedsByRoom).forEach(roomId => {
      const roomBeds = bedsByRoom[roomId];
      
      if (roomId === '6') {
        if (men > 0 && roomBeds.length > 0 && total <= this.CAPACITY_THRESHOLD) {
          validation.valid = false;
          validation.errors.push('Habitación 6 es exclusiva para mujeres (grupos ≤31 personas)');
        }
        
        if (total <= this.CAPACITY_THRESHOLD && roomBeds.length > women) {
          validation.valid = false;
          validation.errors.push('Más camas seleccionadas que mujeres en habitación 6');
        }
        
        if (total > this.CAPACITY_THRESHOLD && roomBeds.length > 0) {
          validation.warnings.push('Habitación 6 abierta como mixta por capacidad del grupo');
        }
      }
    });
    
    if (men > 0 && women > 0 && total <= this.CAPACITY_THRESHOLD) {
      validation.warnings.push('Grupo mixto: habitación 6 no disponible (usar 1, 3, 5)');
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
    
    const total = men + women;
    let statusMessage = '';
    if (men > 0 && women > 0) {
      if (total <= this.CAPACITY_THRESHOLD) {
        statusMessage = '<p class="warning-text">Grupo mixto: habitación 6 no disponible</p>';
      } else {
        statusMessage = '<p class="info-text">Grupo grande: habitación 6 abierta como mixta</p>';
      }
    } else if (men > 0 && women === 0) {
      statusMessage = '<p class="info-text">Solo hombres: habitaciones mixtas disponibles</p>';
    } else if (men === 0 && women > 0) {
      statusMessage = '<p class="info-text">Solo mujeres: todas las habitaciones disponibles</p>';
    }
    
    const searchInfo = document.createElement('div');
    searchInfo.className = 'search-info';
    searchInfo.innerHTML = `
      <p><strong>Búsqueda:</strong> ${men} hombres, ${women} mujeres = ${total} personas</p>
      ${statusMessage}
    `;
    container.appendChild(searchInfo);
    
    availableRooms.forEach(room => {
      this.createRoomElement(room, container, availabilityData);
    });
    
    container.dataset.availabilityChecked = 'true';
  }
  
  createRoomElement(room, container, availabilityData) {
    const roomEl = document.createElement('div');
    roomEl.className = 'room';
    roomEl.dataset.room = room.id;
    
    if (room.id === 6) {
      roomEl.classList.add(room.isException ? 'room-mixed-exception' : 'room-female-only');
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
      
      const level = this.getBedLevelCorrected(bedNum);
      
      bedEl.innerHTML = `
        <div class="bed-number">${bedNum}</div>
        <div class="bed-level">${level}</div>
        ${occupiedBeds.includes(bedNum) ? '<div class="bed-status">Ocupada</div>' : ''}
      `;
      
      container.appendChild(bedEl);
    }
  }
  
  getBedLevelCorrected(bedNumber) {
    const position = ((bedNumber - 1) % 3) + 1;
    
    switch (position) {
      case 1: return 'Baja';
      case 2: return 'Media'; 
      case 3: return 'Alta';
      default: return 'Baja';
    }
  }
  
  canAccommodateGroup(men, women) {
    const total = men + women;
    
    if (total > this.getTotalCapacity()) {
      return { 
        possible: false, 
        reason: 'Excede capacidad total del hostel (38 personas)' 
      };
    }
    
    if (men === 0 && women > 0) {
      return { possible: true, rooms: [1, 3, 5, 6] };
    }
    
    if (men > 0) {
      if (total <= this.CAPACITY_THRESHOLD) {
        const mixedCapacity = this.ROOMS[1] + this.ROOMS[3] + this.ROOMS[5];
        
        if (total > mixedCapacity) {
          return { 
            possible: false, 
            reason: `Grupos mixtos ≤31 personas: máximo ${mixedCapacity} (sin habitación 6)` 
          };
        }
        
        return { possible: true, rooms: [1, 3, 5] };
      }
      
      return { possible: true, rooms: [1, 3, 5, 6] };
    }
    
    return
