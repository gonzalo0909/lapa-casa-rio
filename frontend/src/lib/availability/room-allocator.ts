// src/lib/availability/room-allocator.ts

import { ROOM_CONFIGS, RoomConfig, RoomAllocation } from './availability-checker';

/**
 * Estrategias de asignación de habitaciones
 */
export enum AllocationStrategy {
  MAXIMIZE_UTILIZATION = 'maximize_utilization',
  MINIMIZE_FRAGMENTATION = 'minimize_fragmentation',
  PREFER_LARGER_ROOMS = 'prefer_larger_rooms',
  PREFER_SMALLER_ROOMS = 'prefer_smaller_rooms',
  GROUP_FRIENDLY = 'group_friendly'
}

/**
 * Preferencias del huésped para asignación
 */
export interface GuestPreferences {
  roomType?: 'mixed' | 'female' | 'any';
  preferLargerRooms?: boolean;
  preferSeparateRooms?: boolean;
  avoidFlexibleRooms?: boolean;
}

/**
 * Resultado de asignación con métricas
 */
export interface AllocationResult {
  success: boolean;
  allocation: RoomAllocation[];
  totalBedsAllocated: number;
  roomsUsed: number;
  utilizationScore: number;
  fragmentationScore: number;
  warnings: string[];
  message: string;
}

/**
 * Estado de ocupación de una habitación
 */
interface RoomOccupancyState {
  roomId: string;
  roomConfig: RoomConfig;
  currentOccupancy: number;
  availableBeds: number;
  utilizationRate: number;
}

/**
 * Clase para manejar la asignación óptima de habitaciones
 */
export class RoomAllocator {
  private roomConfigs: RoomConfig[];

  constructor(roomConfigs: RoomConfig[] = ROOM_CONFIGS) {
    this.roomConfigs = roomConfigs;
  }

  /**
   * Asigna habitaciones usando la estrategia especificada
   */
  public allocateRooms(
    requestedBeds: number,
    availableRooms: Map<string, number>, // roomId -> available beds
    strategy: AllocationStrategy = AllocationStrategy.GROUP_FRIENDLY,
    preferences: GuestPreferences = {}
  ): AllocationResult {
    try {
      // Validar entrada
      if (requestedBeds <= 0) {
        return this.createErrorResult('Número de camas solicitadas debe ser mayor a 0');
      }

      // Preparar estado de ocupación
      const roomStates = this.prepareRoomStates(availableRooms);
      
      // Filtrar habitaciones según preferencias
      const filteredRooms = this.filterRoomsByPreferences(roomStates, preferences);
      
      if (filteredRooms.length === 0) {
        return this.createErrorResult('No hay habitaciones disponibles que cumplan las preferencias');
      }

      // Verificar disponibilidad total
      const totalAvailable = filteredRooms.reduce(
        (total, room) => total + room.availableBeds,
        0
      );

      if (totalAvailable < requestedBeds) {
        return this.createErrorResult(
          `Solo ${totalAvailable} camas disponibles de ${requestedBeds} solicitadas`
        );
      }

      // Aplicar estrategia de asignación
      const allocation = this.applyAllocationStrategy(
        requestedBeds,
        filteredRooms,
        strategy,
        preferences
      );

      // Calcular métricas
      const metrics = this.calculateMetrics(allocation, filteredRooms);
      
      // Generar warnings
      const warnings = this.generateWarnings(allocation, preferences);

      return {
        success: true,
        allocation,
        totalBedsAllocated: allocation.reduce((total, room) => total + room.bedsAllocated, 0),
        roomsUsed: allocation.length,
        utilizationScore: metrics.utilizationScore,
        fragmentationScore: metrics.fragmentationScore,
        warnings,
        message: this.generateSuccessMessage(allocation, requestedBeds)
      };

    } catch (error) {
      console.error('Error en asignación de habitaciones:', error);
      return this.createErrorResult('Error interno en la asignación');
    }
  }

  /**
   * Prepara el estado de ocupación de las habitaciones
   */
  private prepareRoomStates(availableRooms: Map<string, number>): RoomOccupancyState[] {
    const states: RoomOccupancyState[] = [];

    for (const roomConfig of this.roomConfigs) {
      const availableBeds = availableRooms.get(roomConfig.id) || 0;
      const currentOccupancy = roomConfig.capacity - availableBeds;
      
      states.push({
        roomId: roomConfig.id,
        roomConfig,
        currentOccupancy,
        availableBeds,
        utilizationRate: currentOccupancy / roomConfig.capacity
      });
    }

    return states;
  }

  /**
   * Filtra habitaciones según preferencias del huésped
   */
  private filterRoomsByPreferences(
    rooms: RoomOccupancyState[],
    preferences: GuestPreferences
  ): RoomOccupancyState[] {
    return rooms.filter(room => {
      // Solo habitaciones con camas disponibles
      if (room.availableBeds <= 0) return false;

      // Preferencia de tipo de habitación
      if (preferences.roomType && preferences.roomType !== 'any') {
        if (room.roomConfig.type !== preferences.roomType) {
          // Excepción: habitación flexible puede convertirse
          if (room.roomConfig.isFlexible && preferences.roomType === 'mixed') {
            // OK - habitación flexible puede ser mixta
          } else {
            return false;
          }
        }
      }

      // Evitar habitaciones flexibles si se especifica
      if (preferences.avoidFlexibleRooms && room.roomConfig.isFlexible) {
        return false;
      }

      return true;
    });
  }

  /**
   * Aplica la estrategia de asignación seleccionada
   */
  private applyAllocationStrategy(
    requestedBeds: number,
    availableRooms: RoomOccupancyState[],
    strategy: AllocationStrategy,
    preferences: GuestPreferences
  ): RoomAllocation[] {
    switch (strategy) {
      case AllocationStrategy.MAXIMIZE_UTILIZATION:
        return this.allocateMaximizeUtilization(requestedBeds, availableRooms);
      
      case AllocationStrategy.MINIMIZE_FRAGMENTATION:
        return this.allocateMinimizeFragmentation(requestedBeds, availableRooms);
      
      case AllocationStrategy.PREFER_LARGER_ROOMS:
        return this.allocatePreferLargerRooms(requestedBeds, availableRooms);
      
      case AllocationStrategy.PREFER_SMALLER_ROOMS:
        return this.allocatePreferSmallerRooms(requestedBeds, availableRooms);
      
      case AllocationStrategy.GROUP_FRIENDLY:
      default:
        return this.allocateGroupFriendly(requestedBeds, availableRooms, preferences);
    }
  }

  /**
   * Estrategia: Maximizar utilización de habitaciones
   */
  private allocateMaximizeUtilization(
    requestedBeds: number,
    availableRooms: RoomOccupancyState[]
  ): RoomAllocation[] {
    const allocation: RoomAllocation[] = [];
    let remainingBeds = requestedBeds;

    // Ordenar por menor disponibilidad (llenar habitaciones más ocupadas primero)
    const sortedRooms = [...availableRooms].sort((a, b) => 
      a.availableBeds - b.availableBeds
    );

    for (const room of sortedRooms) {
      if (remainingBeds <= 0) break;
      
      const bedsToAllocate = Math.min(remainingBeds, room.availableBeds);
      
      allocation.push({
        roomId: room.roomId,
        bedsAllocated: bedsToAllocate,
        roomName: room.roomConfig.name,
        pricePerNight: room.roomConfig.basePrice
      });

      remainingBeds -= bedsToAllocate;
    }

    return allocation;
  }

  /**
   * Estrategia: Minimizar fragmentación
   */
  private allocateMinimizeFragmentation(
    requestedBeds: number,
    availableRooms: RoomOccupancyState[]
  ): RoomAllocation[] {
    const allocation: RoomAllocation[] = [];
    let remainingBeds = requestedBeds;

    // Ordenar por mayor disponibilidad (usar habitaciones vacías primero)
    const sortedRooms = [...availableRooms].sort((a, b) => 
      b.availableBeds - a.availableBeds
    );

    for (const room of sortedRooms) {
      if (remainingBeds <= 0) break;
      
      const bedsToAllocate = Math.min(remainingBeds, room.availableBeds);
      
      allocation.push({
        roomId: room.roomId,
        bedsAllocated: bedsToAllocate,
        roomName: room.roomConfig.name,
        pricePerNight: room.roomConfig.basePrice
      });

      remainingBeds -= bedsToAllocate;
    }

    return allocation;
  }

  /**
   * Estrategia: Preferir habitaciones más grandes
   */
  private allocatePreferLargerRooms(
    requestedBeds: number,
    availableRooms: RoomOccupancyState[]
  ): RoomAllocation[] {
    const allocation: RoomAllocation[] = [];
    let remainingBeds = requestedBeds;

    // Ordenar por capacidad (habitaciones más grandes primero)
    const sortedRooms = [...availableRooms].sort((a, b) => 
      b.roomConfig.capacity - a.roomConfig.capacity
    );

    for (const room of sortedRooms) {
      if (remainingBeds <= 0) break;
      
      const bedsToAllocate = Math.min(remainingBeds, room.availableBeds);
      
      allocation.push({
        roomId: room.roomId,
        bedsAllocated: bedsToAllocate,
        roomName: room.roomConfig.name,
        pricePerNight: room.roomConfig.basePrice
      });

      remainingBeds -= bedsToAllocate;
    }

    return allocation;
  }

  /**
   * Estrategia: Preferir habitaciones más pequeñas
   */
  private allocatePreferSmallerRooms(
    requestedBeds: number,
    availableRooms: RoomOccupancyState[]
  ): RoomAllocation[] {
    const allocation: RoomAllocation[] = [];
    let remainingBeds = requestedBeds;

    // Ordenar por capacidad (habitaciones más pequeñas primero)
    const sortedRooms = [...availableRooms].sort((a, b) => 
      a.roomConfig.capacity - b.roomConfig.capacity
    );

    for (const room of sortedRooms) {
      if (remainingBeds <= 0) break;
      
      const bedsToAllocate = Math.min(remainingBeds, room.availableBeds);
      
      allocation.push({
        roomId: room.roomId,
        bedsAllocated: bedsToAllocate,
        roomName: room.roomConfig.name,
        pricePerNight: room.roomConfig.basePrice
      });

      remainingBeds -= bedsToAllocate;
    }

    return allocation;
  }

  /**
   * Estrategia: Optimizada para grupos (default para Lapa Casa)
   */
  private allocateGroupFriendly(
    requestedBeds: number,
    availableRooms: RoomOccupancyState[],
    preferences: GuestPreferences
  ): RoomAllocation[] {
    const allocation: RoomAllocation[] = [];
    let remainingBeds = requestedBeds;

    // Para grupos grandes (7+), priorizar habitaciones grandes
    if (requestedBeds >= 7) {
      return this.allocateForLargeGroups(requestedBeds, availableRooms);
    }

    // Para grupos pequeños, minimizar fragmentación
    const sortedRooms = [...availableRooms].sort((a, b) => {
      // Prioridad 1: Habitaciones que pueden alojar todo el grupo
      const aCanFitAll = a.availableBeds >= requestedBeds;
      const bCanFitAll = b.availableBeds >= requestedBeds;
      
      if (aCanFitAll && !bCanFitAll) return -1;
      if (!aCanFitAll && bCanFitAll) return 1;
      
      // Prioridad 2: Mayor disponibilidad
      return b.availableBeds - a.availableBeds;
    });

    for (const room of sortedRooms) {
      if (remainingBeds <= 0) break;
      
      const bedsToAllocate = Math.min(remainingBeds, room.availableBeds);
      
      allocation.push({
        roomId: room.roomId,
        bedsAllocated: bedsToAllocate,
        roomName: room.roomConfig.name,
        pricePerNight: room.roomConfig.basePrice
      });

      remainingBeds -= bedsToAllocate;
    }

    return allocation;
  }

  /**
   * Asignación especializada para grupos grandes
   */
  private allocateForLargeGroups(
    requestedBeds: number,
    availableRooms: RoomOccupancyState[]
  ): RoomAllocation[] {
    const allocation: RoomAllocation[] = [];
    let remainingBeds = requestedBeds;

    // Priorizar habitaciones de 12 camas para grupos grandes
    const largeRooms = availableRooms.filter(room => room.roomConfig.capacity >= 12);
    const smallRooms = availableRooms.filter(room => room.roomConfig.capacity < 12);

    // Primero usar habitaciones grandes
    const sortedLargeRooms = largeRooms.sort((a, b) => b.availableBeds - a.availableBeds);
    
    for (const room of sortedLargeRooms) {
      if (remainingBeds <= 0) break;
      
      const bedsToAllocate = Math.min(remainingBeds, room.availableBeds);
      
      allocation.push({
        roomId: room.roomId,
        bedsAllocated: bedsToAllocate,
        roomName: room.roomConfig.name,
        pricePerNight: room.roomConfig.basePrice
      });

      remainingBeds -= bedsToAllocate;
    }

    // Luego usar habitaciones pequeñas si es necesario
    const sortedSmallRooms = smallRooms.sort((a, b) => b.availableBeds - a.availableBeds);
    
    for (const room of sortedSmallRooms) {
      if (remainingBeds <= 0) break;
      
      const bedsToAllocate = Math.min(remainingBeds, room.availableBeds);
      
      allocation.push({
        roomId: room.roomId,
        bedsAllocated: bedsToAllocate,
        roomName: room.roomConfig.name,
        pricePerNight: room.roomConfig.basePrice
      });

      remainingBeds -= bedsToAllocate;
    }

    return allocation;
  }

  /**
   * Calcula métricas de la asignación
   */
  private calculateMetrics(
    allocation: RoomAllocation[],
    availableRooms: RoomOccupancyState[]
  ): { utilizationScore: number; fragmentationScore: number } {
    let totalUtilization = 0;
    let roomsWithAllocation = 0;

    for (const alloc of allocation) {
      const room = availableRooms.find(r => r.roomId === alloc.roomId);
      if (room) {
        const newOccupancy = room.currentOccupancy + alloc.bedsAllocated;
        const utilization = newOccupancy / room.roomConfig.capacity;
        totalUtilization += utilization;
        roomsWithAllocation++;
      }
    }

    const utilizationScore = roomsWithAllocation > 0 
      ? (totalUtilization / roomsWithAllocation) * 100 
      : 0;

    const fragmentationScore = (allocation.length / this.roomConfigs.length) * 100;

    return { utilizationScore, fragmentationScore };
  }

  /**
   * Genera warnings para la asignación
   */
  private generateWarnings(
    allocation: RoomAllocation[],
    preferences: GuestPreferences
  ): string[] {
    const warnings: string[] = [];

    // Warning si se usan múltiples habitaciones para grupos pequeños
    if (allocation.length > 1) {
      const totalBeds = allocation.reduce((sum, alloc) => sum + alloc.bedsAllocated, 0);
      if (totalBeds <= 7) {
        warnings.push('El grupo se dividirá en múltiples habitaciones.');
      }
    }

    // Warning si se usa habitación flexible
    const flexibleRoomUsed = allocation.some(alloc => 
      this.roomConfigs.find(room => room.id === alloc.roomId)?.isFlexible
    );
    
    if (flexibleRoomUsed) {
      warnings.push('Se asignó habitación flexible - puede cambiar de femenina a mixta según disponibilidad.');
    }

    // Warning si no se cumple preferencia de habitaciones separadas
    if (preferences.preferSeparateRooms && allocation.length === 1) {
      warnings.push('Preferencia de habitaciones separadas no se pudo cumplir.');
    }

    return warnings;
  }

  /**
   * Genera mensaje de éxito
   */
  private generateSuccessMessage(allocation: RoomAllocation[], requestedBeds: number): string {
    const roomNames = allocation.map(alloc => 
      `${alloc.roomName} (${alloc.bedsAllocated} camas)`
    ).join(', ');

    if (allocation.length === 1) {
      return `Asignación exitosa: ${requestedBeds} camas en ${roomNames}`;
    } else {
      return `Asignación exitosa: ${requestedBeds} camas distribuidas en ${allocation.length} habitaciones - ${roomNames}`;
    }
  }

  /**
   * Crea resultado de error
   */
  private createErrorResult(message: string): AllocationResult {
    return {
      success: false,
      allocation: [],
      totalBedsAllocated: 0,
      roomsUsed: 0,
      utilizationScore: 0,
      fragmentationScore: 0,
      warnings: [],
      message
    };
  }

  /**
   * Simula diferentes escenarios de asignación
   */
  public simulateAllocation(
    requestedBeds: number,
    availableRooms: Map<string, number>
  ): Map<AllocationStrategy, AllocationResult> {
    const results = new Map<AllocationStrategy, AllocationResult>();

    const strategies = Object.values(AllocationStrategy);

    for (const strategy of strategies) {
      const result = this.allocateRooms(
        requestedBeds,
        availableRooms,
        strategy as AllocationStrategy
      );
      results.set(strategy as AllocationStrategy, result);
    }

    return results;
  }

  /**
   * Recomienda la mejor estrategia basada en el contexto
   */
  public recommendStrategy(
    requestedBeds: number,
    availableRooms: Map<string, number>,
    preferences: GuestPreferences = {}
  ): AllocationStrategy {
    const totalAvailable = Array.from(availableRooms.values()).reduce((sum, beds) => sum + beds, 0);

    // Para grupos muy grandes, maximizar utilización
    if (requestedBeds >= 20) {
      return AllocationStrategy.MAXIMIZE_UTILIZATION;
    }

    // Para grupos grandes, estrategia group-friendly
    if (requestedBeds >= 7) {
      return AllocationStrategy.GROUP_FRIENDLY;
    }

    // Si hay mucha disponibilidad, minimizar fragmentación
    if (totalAvailable >= requestedBeds * 2) {
      return AllocationStrategy.MINIMIZE_FRAGMENTATION;
    }

    // Si la disponibilidad es justa, maximizar utilización
    if (totalAvailable <= requestedBeds * 1.2) {
      return AllocationStrategy.MAXIMIZE_UTILIZATION;
    }

    // Default para Lapa Casa Hostel
    return AllocationStrategy.GROUP_FRIENDLY;
  }

  /**
   * Obtiene estadísticas de utilización del hostel
   */
  public getUtilizationStats(currentBookings: Map<string, number>): {
    totalCapacity: number;
    totalOccupied: number;
    totalAvailable: number;
    utilizationRate: number;
    roomUtilization: Array<{
      roomId: string;
      roomName: string;
      capacity: number;
      occupied: number;
      available: number;
      utilizationRate: number;
    }>;
  } {
    const totalCapacity = this.roomConfigs.reduce((sum, room) => sum + room.capacity, 0);
    let totalOccupied = 0;
    
    const roomUtilization = this.roomConfigs.map(room => {
      const available = currentBookings.get(room.id) || 0;
      const occupied = room.capacity - available;
      totalOccupied += occupied;
      
      return {
        roomId: room.id,
        roomName: room.name,
        capacity: room.capacity,
        occupied,
        available,
        utilizationRate: (occupied / room.capacity) * 100
      };
    });

    return {
      totalCapacity,
      totalOccupied,
      totalAvailable: totalCapacity - totalOccupied,
      utilizationRate: (totalOccupied / totalCapacity) * 100,
      roomUtilization
    };
  }
}
