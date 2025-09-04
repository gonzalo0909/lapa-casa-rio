class RoomManager {
  constructor() {
    this.ROOMS = { 1: 12, 3: 12, 5: 7, 6: 7 };
    this.PRICE_PER_NIGHT = 55;
  }
  
  getRoom6Availability(men, women) {
    const total = men + women;
    
    if (total > 31) {
      return {
        available: true,
        type: 'Mixta',
        description: 'Habitación mixta para grupos grandes (+31)',
        allowedGenders: ['men', 'women']
      };
    }
    
    if (women > 0) {
      return {
        available: true,
        type: 'Solo mujeres',
        description: 'Habitación exclusiva femenina',
        allowedGenders: ['women']
      };
    }
    
    return {
      available: false,
      type: 'No disponible',
      description: 'Habitación exclusiva femenina'
    };
  }
  
  getAvailableRooms(men, women, availabilityData) {
    const total = men + women;
    const rooms = [];
    
    if (total === 0) return [];
    
    // ORDEN DINÁMICO SEGÚN CAPACIDAD NECESARIA
    
    // 1. Habitación 1 - SIEMPRE primero
    if (this.isRoomAvailable(1, availabilityData)) {
      rooms.push({
        id: 1,
        type: 'Mixta',
        beds: this.ROOMS[1],
        available: availabilityData.room1 || this.ROOMS[1],
        priority: 1,
        description: 'Habitación principal mixta (12 camas)'
      });
    }
    
    // 2. Habitación 3 - APARECE AUTOMÁTICAMENTE después del 1
    if (total > 12 && this.isRoomAvailable(3, availabilityData)) {
      rooms.push({
        id: 3,
        type: 'Mixta',
        beds: this.ROOMS[3],
        available: availabilityData.room3 || this.ROOMS[3],
        priority: 2,
        description: 'Capacidad adicional mixta (12 camas)'
      });
    }
    
    // 3. Habitación 5 - Aparece cuando necesitas más de 24 (1+3)
    if (total > 24 && this.isRoomAvailable(5, availabilityData)) {
      rooms.push({
        id: 5,
        type: 'Mixta',
        beds: this.ROOMS[5],
        available: availabilityData.room5 || this.ROOMS[5],
        priority: 3,
        description: 'Habitación alternativa (7 camas)'
      });
    }
    
    // 4. Habitación 6 - Solo cuando necesitas más de 31 o hay mujeres
    const room6Rule = this.getRoom6Availability(men, women);
    if (room6Rule.available && this.isRoomAvailable(6, availabilityData)) {
      // Prioridad alta si es por necesidad de capacidad (>31)
      const priority = total > 31 ? 4 : 5;
      
      rooms.push({
        id: 6,
        type: room6Rule.type,
        beds: this.ROOMS[6],
        available: availabilityData.room6 || this.ROOMS[6],
        priority: priority,
        description: room6Rule.description
      });
    }
    
    return rooms.sort((a, b) => a.priority - b.priority);
  }
  
  isRoomAvailable(roomId, availabilityData) {
    if (!availabilityData) return true;
    const available = availabilityData[`room${roomId}`];
    return available && available > 0;
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
      container.innerHTML = '<div class="empty-state">No hay habitaciones disponibles</div>';
      return;
    }
    
    availableRooms.forEach(room => {
      this.createRoomElement(room, container, availabilityData);
    });
  }
  
  createRoomElement(room, container, availabilityData) {
    const roomEl = document.createElement('div');
    roomEl.className = 'room';
    roomEl.dataset.room = room.id;
    
    roomEl.innerHTML = `
      <div class="room-header">
        <h3>Habitación ${room.id}</h3>
        <span class="room-type">${room.type}</span>
      </div>
      <div class="room-description">${room.description}</div>
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
}

window.roomManager = new RoomManager();
