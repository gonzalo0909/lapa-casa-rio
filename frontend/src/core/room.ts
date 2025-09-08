import { config } from '../config';
import { ConflictError, ValidationError } from '../utils/errors';

export interface RoomConfig {
  name: string;
  beds: number;
  femaleOnly: boolean;
  basePrice: number;
}

export interface BedSelection {
  roomId: number;
  bedNumber: number;
}

export interface OccupiedBeds {
  [roomId: number]: number[];
}

export class RoomService {
  private rooms: Record<number, RoomConfig>;
  private capacityThreshold = 31; // Para regla de habitación 6

  constructor() {
    this.rooms = config.business.rooms;
  }

  /**
   * Verifica si una habitación puede alojar el grupo según las reglas
   */
  public canAccommodateGroup(roomId: number, men: number, women: number): {
    allowed: boolean;
    reason?: string;
  } {
    const room = this.rooms[roomId];
    if (!room) {
      return { allowed: false, reason: `Habitación ${roomId} no existe` };
    }

    const total = men + women;

    // Regla especial para habitación 6
    if (roomId === 6) {
      // Si hay hombres y el grupo es <= 31 personas, no permitir
      if (men > 0 && total <= this.capacityThreshold) {
        return { 
          allowed: false, 
          reason: `Habitación 6 es exclusiva para mujeres con grupos ≤${this.capacityThreshold} personas` 
        };
      }

      // Si es solo mujeres o grupo grande mixto, permitir
      if (women > 0 && men === 0) {
        return { allowed: true }; // Solo mujeres
      }

      if (total > this.capacityThreshold) {
        return { allowed: true }; // Grupo grande mixto
      }

      return { allowed: false, reason: 'Configuración inválida para habitación 6' };
    }

    // Para habitaciones mixtas (1, 3, 5), siempre permitir
    return { allowed: true };
  }

  /**
   * Obtiene habitaciones disponibles para el grupo
   */
  public getAvailableRooms(men: number, women: number, occupiedBeds: OccupiedBeds): {
    roomId: number;
    name: string;
    totalBeds: number;
    availableBeds: number[];
    basePrice: number;
    allowedForGroup: boolean;
    reason?: string;
  }[] {
    const result = [];

    for (const [roomId, room] of Object.entries(this.rooms)) {
      const id = parseInt(roomId);
      const occupied = occupiedBeds[id] || [];
      const availableBeds = Array.from({ length: room.beds }, (_, i) => i + 1)
        .filter(bedNum => !occupied.includes(bedNum));

      const groupCheck = this.canAccommodateGroup(id, men, women);

      result.push({
        roomId: id,
        name: room.name,
        totalBeds: room.beds,
        availableBeds,
        basePrice: room.basePrice,
        allowedForGroup: groupCheck.allowed,
        reason: groupCheck.reason,
      });
    }

    return result.sort((a, b) => a.roomId - b.roomId);
  }

  /**
   * Valida selección de camas según reglas de negocio
   */
  public validateBedSelection(
    beds: BedSelection[], 
    men: number, 
    women: number,
    occupiedBeds: OccupiedBeds
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const total = men + women;

    // Verificar que hay camas seleccionadas
    if (beds.length === 0) {
      errors.push('Debe seleccionar al menos una cama');
      return { valid: false, errors };
    }

    // Verificar que coincide el número de camas con huéspedes
    if (beds.length !== total) {
      errors.push(`Debe seleccionar exactamente ${total} camas para ${total} huéspedes`);
    }

    // Agrupar camas por habitación
    const bedsByRoom: Record<number, number[]> = {};
    for (const bed of beds) {
      if (!bedsByRoom[bed.roomId]) {
        bedsByRoom[bed.roomId] = [];
      }
      bedsByRoom[bed.roomId].push(bed.bedNumber);
    }

    // Validar cada habitación
    for (const [roomIdStr, bedNumbers] of Object.entries(bedsByRoom)) {
      const roomId = parseInt(roomIdStr);
      const room = this.rooms[roomId];

      if (!room) {
        errors.push(`Habitación ${roomId} no existe`);
        continue;
      }

      // Verificar que las camas existen en la habitación
      for (const bedNum of bedNumbers) {
        if (bedNum < 1 || bedNum > room.beds) {
          errors.push(`Cama ${bedNum} no existe en habitación ${roomId}`);
        }

        // Verificar que la cama no está ocupada
        if (occupiedBeds[roomId]?.includes(bedNum)) {
          errors.push(`Cama ${bedNum} en habitación ${roomId} ya está ocupada`);
        }
      }

      // Aplicar reglas específicas de la habitación
      const groupCheck = this.canAccommodateGroup(roomId, men, women);
      if (!groupCheck.allowed) {
        errors.push(groupCheck.reason || `No se puede usar habitación ${roomId}`);
      }

      // Verificar límites por habitación para habitación 6
      if (roomId === 6 && total <= this.capacityThreshold) {
        if (bedNumbers.length > women) {
          errors.push(`En habitación 6 no pueden haber más camas (${bedNumbers.length}) que mujeres (${women})`);
        }
      }
    }

    // Verificar duplicados
    const allBeds = beds.map(b => `${b.roomId}-${b.bedNumber}`);
    const uniqueBeds = [...new Set(allBeds)];
    if (allBeds.length !== uniqueBeds.length) {
      errors.push('No se pueden seleccionar camas duplicadas');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Sugiere distribución óptima de camas
   */
  public suggestBedDistribution(
    men: number, 
    women: number, 
    occupiedBeds: OccupiedBeds
  ): BedSelection[] {
    const total = men + women;
    const suggestions: BedSelection[] = [];
    let remaining = total;

    // Estrategia: llenar habitaciones en orden de prioridad
    const availableRooms = this.getAvailableRooms(men, women, occupiedBeds)
      .filter(room => room.allowedForGroup && room.availableBeds.length > 0)
      .sort((a, b) => {
        // Prioridad: habitación con más camas disponibles primero
        return b.availableBeds.length - a.availableBeds.length;
      });

    for (const room of availableRooms) {
      if (remaining <= 0) break;

      const canTake = Math.min(remaining, room.availableBeds.length);
      for (let i = 0; i < canTake; i++) {
        suggestions.push({
          roomId: room.roomId,
          bedNumber: room.availableBeds[i],
        });
      }
      remaining -= canTake;
    }

    return suggestions;
  }

  /**
   * Calcula precio total para selección de camas
   */
  public calculatePrice(beds: BedSelection[], nights: number): {
    subtotal: number;
    breakdown: Array<{ roomId: number; beds: number; pricePerNight: number; total: number }>;
    total: number;
  } {
    const breakdown: Array<{ roomId: number; beds: number; pricePerNight: number; total: number }> = [];
    let subtotal = 0;

    // Agrupar por habitación
    const bedsByRoom: Record<number, number> = {};
    for (const bed of beds) {
      bedsByRoom[bed.roomId] = (bedsByRoom[bed.roomId] || 0) + 1;
    }

    // Calcular por habitación
    for (const [roomIdStr, bedCount] of Object.entries(bedsByRoom)) {
      const roomId = parseInt(roomIdStr);
      const room = this.rooms[roomId];
      
      if (room) {
        const roomTotal = room.basePrice * bedCount * nights;
        breakdown.push({
          roomId,
          beds: bedCount,
          pricePerNight: room.basePrice,
          total: roomTotal,
        });
        subtotal += roomTotal;
      }
    }

    return {
      subtotal,
      breakdown,
      total: subtotal, // Aquí se pueden agregar impuestos o fees en el futuro
    };
  }

  /**
   * Verifica disponibilidad total del hostel
   */
  public getTotalAvailability(occupiedBeds: OccupiedBeds): {
    totalCapacity: number;
    totalOccupied: number;
    totalAvailable: number;
    byRoom: Record<number, { capacity: number; occupied: number; available: number }>;
  } {
    let totalCapacity = 0;
    let totalOccupied = 0;
    const byRoom: Record<number, { capacity: number; occupied: number; available: number }> = {};

    for (const [roomIdStr, room] of Object.entries(this.rooms)) {
      const roomId = parseInt(roomIdStr);
      const occupied = occupiedBeds[roomId]?.length || 0;
      const available = room.beds - occupied;

      byRoom[roomId] = {
        capacity: room.beds,
        occupied,
        available,
      };

      totalCapacity += room.beds;
      totalOccupied += occupied;
    }

    return {
      totalCapacity,
      totalOccupied,
      totalAvailable: totalCapacity - totalOccupied,
      byRoom,
    };
  }
}
