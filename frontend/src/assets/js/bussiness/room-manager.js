class RoomManager {
  constructor() {
    this.ROOMS = { 1: 12, 3: 12, 5: 7, 6: 7 };
    this.PRICE_PER_NIGHT = 55;
  }
  
  // Reglas de Habitación 6 - CORREGIDAS
  getRoom6Availability(men, women) {
    const total = men + women;
    
    // EXCEPCIÓN: Si más de 31 huéspedes total → Mixto
    if (total > 31) {
      return {
        available: true,
        type: 'Mixta',
        description: 'Habitación mixta para grupos grandes (+31)',
        allowedGenders: ['men', 'women']
      };
    }
    
    // REGLA NORMAL: Solo mujeres (≤31 huéspedes)
    if (women > 0) {
      return {
        available: true,
        type: 'Solo mujeres',
        description: 'Habitación exclusiva femenina',
        allowedGenders: ['women']
      };
    }
    
    // Si solo hay hombres (y ≤31 total) → No disponible
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
    
    // Habitación 1 - Siempre disponible
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
    
    // Habitación 5 - Siempre disponible
    if (this.isRoomAvailable(5, availabilityData)) {
      rooms.push({
        id: 5,
        type: 'Mixta',
        beds: this.ROOMS[5],
        available: availabilityData.room5 || this.ROOMS[5],
        priority: 2,
        description: 'Habitación alternativa (7 camas)'
      });
    }
    
    // Habitación 3 - CORREGIDO: Aparece cuando cuarto 1 + 5 es insuficiente
    const room1Available = availabilityData.room1 || this.ROOMS[1];
    const room5Available = availabilityData.room5 || this.ROOMS[5];
    const basicCapacity = room1Available + room5Available; // 12 + 7 = 19
    
    if (total > basicCapacity && this.isRoomAvailable(3, availabilityData)) {
      rooms.push({
        id: 3,
        type: 'Mixta',
        beds: this.ROOMS[3],
        available: availabilityData.room3 || this.ROOMS[3],
        priority: 3,
        description: 'Capacidad adicional mixta (12 camas)'
      });
    }
    
    // Habitación 6 - Lógica condicional corregida
    const room6Rule = this.getRoom6Availability(men, women);
    if (room6Rule.available && this.isRoomAvailable(6, availabilityData)) {
      rooms.push({
        id: 6,
        type: room6Rule.type,
        beds: this.ROOMS[6],
        available: availabilityData.room6 || this.ROOMS[6],
        priority: 4,
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
      
      // CORREGIDO: Numeración por grupos de 3 (baja, media, alta)
      const level = this.getBedLevelCorrected(bedNum);
      
      bedEl.innerHTML = `
        <div class="bed-number">${bedNum}</div>
        <div class="bed-level">${level}</div>
        ${occupiedBeds.includes(bedNum) ? '<div class="bed-status">Ocupada</div>' : ''}
      `;
      
      container.appendChild(bedEl);
    }
  }
  
  // CORREGIDO: Lógica de camas por grupos de 3
  getBedLevelCorrected(bedNumber) {
    // Grupos de 3: 1,4,7,10... = Baja | 2,5,8,11... = Media | 3,6,9,12... = Alta
    const position = ((bedNumber - 1) % 3) + 1;
    
    switch (position) {
      case 1: return 'Baja';    // 1, 4, 7, 10...
      case 2: return 'Media';   // 2, 5, 8, 11...
      case 3: return 'Alta';    // 3, 6, 9, 12...
      default: return 'Baja';
    }
  }
}

window.roomManager = new RoomManager();
