// src/lib/availability/availability-checker.ts

import { format, parseISO, isAfter, isBefore, isEqual, eachDayOfInterval } from 'date-fns';

/**
 * Tipos para el sistema de disponibilidad
 */
export interface RoomConfig {
  id: string;
  name: string;
  capacity: number;
  type: 'mixed' | 'female';
  basePrice: number;
  isFlexible: boolean;
}

export interface BookingPeriod {
  checkIn: Date;
  checkOut: Date;
  roomId: string;
  bedsCount: number;
  status: 'CONFIRMED' | 'PENDING' | 'CANCELLED';
}

export interface AvailabilityQuery {
  checkIn: Date;
  checkOut: Date;
  requestedBeds: number;
  guestPreference?: 'mixed' | 'female' | 'any';
}

export interface RoomAvailability {
  roomId: string;
  availableBeds: number;
  totalCapacity: number;
  occupancy: number;
  canAccommodate: boolean;
  conflictDates: Date[];
}

export interface AvailabilityResult {
  isAvailable: boolean;
  totalAvailableBeds: number;
  roomsAvailability: RoomAvailability[];
  suggestedAllocation?: RoomAllocation[];
  alternativeDates?: Date[];
  message: string;
}

export interface RoomAllocation {
  roomId: string;
  bedsAllocated: number;
  roomName: string;
  pricePerNight: number;
}

/**
 * Configuración de las 4 habitaciones del Lapa Casa Hostel
 */
export const ROOM_CONFIGS: RoomConfig[] = [
  {
    id: 'room_mixto_12a',
    name: 'Mixto 12A',
    capacity: 12,
    type: 'mixed',
    basePrice: 60.00,
    isFlexible: false
  },
  {
    id: 'room_mixto_12b',
    name: 'Mixto 12B',
    capacity: 12,
    type: 'mixed',
    basePrice: 60.00,
    isFlexible: false
  },
  {
    id: 'room_mixto_7',
    name: 'Mixto 7',
    capacity: 7,
    type: 'mixed',
    basePrice: 60.00,
    isFlexible: false
  },
  {
    id: 'room_flexible_7',
    name: 'Flexible 7',
    capacity: 7,
    type: 'female', // Default femenino
    basePrice: 60.00,
    isFlexible: true
  }
];

/**
 * Clase principal para verificar disponibilidad de habitaciones
 */
export class AvailabilityChecker {
  private roomConfigs: RoomConfig[];

  constructor(roomConfigs: RoomConfig[] = ROOM_CONFIGS) {
    this.roomConfigs = roomConfigs;
  }

  /**
   * Verifica si hay disponibilidad para una consulta específica
   */
  public checkAvailability(
    query: AvailabilityQuery,
    existingBookings: BookingPeriod[]
  ): AvailabilityResult {
    try {
      // Validar fechas
      if (!this.validateDates(query.checkIn, query.checkOut)) {
        return this.createErrorResult('Fechas inválidas. Check-out debe ser después de check-in.');
      }

      // Filtrar solo reservas confirmadas en el rango de fechas
      const relevantBookings = this.filterRelevantBookings(
        existingBookings,
        query.checkIn,
        query.checkOut
      );

      // Calcular ocupación por habitación
      const roomOccupancy = this.calculateRoomOccupancy(
        relevantBookings,
        query.checkIn,
        query.checkOut
      );

      // Verificar disponibilidad por habitación
      const roomsAvailability = this.calculateRoomsAvailability(
        roomOccupancy,
        query.checkIn,
        query.checkOut
      );

      // Calcular total de camas disponibles
      const totalAvailableBeds = roomsAvailability.reduce(
        (total, room) => total + room.availableBeds,
        0
      );

      // Verificar si se puede acomodar la solicitud
      if (totalAvailableBeds >= query.requestedBeds) {
        const suggestedAllocation = this.findOptimalAllocation(
          query,
          roomsAvailability
        );

        return {
          isAvailable: true,
          totalAvailableBeds,
          roomsAvailability,
          suggestedAllocation,
          message: `Disponible: ${query.requestedBeds} camas confirmadas para las fechas solicitadas.`
        };
      }

      // No hay suficientes camas disponibles
      const alternativeDates = this.findAlternativeDates(
        query,
        existingBookings
      );

      return {
        isAvailable: false,
        totalAvailableBeds,
        roomsAvailability,
        alternativeDates,
        message: `Lo sentimos, solo hay ${totalAvailableBeds} camas disponibles de las ${query.requestedBeds} solicitadas.`
      };

    } catch (error) {
      console.error('Error verificando disponibilidad:', error);
      return this.createErrorResult('Error interno verificando disponibilidad.');
    }
  }

  /**
   * Valida que las fechas sean correctas
   */
  private validateDates(checkIn: Date, checkOut: Date): boolean {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return (
      checkIn instanceof Date &&
      checkOut instanceof Date &&
      isAfter(checkOut, checkIn) &&
      !isBefore(checkIn, today)
    );
  }

  /**
   * Filtra reservas relevantes para el período consultado
   */
  private filterRelevantBookings(
    bookings: BookingPeriod[],
    checkIn: Date,
    checkOut: Date
  ): BookingPeriod[] {
    return bookings.filter(booking => {
      // Solo considerar reservas confirmadas
      if (booking.status !== 'CONFIRMED') return false;

      // Verificar si hay solapamiento de fechas
      return this.datesOverlap(
        booking.checkIn,
        booking.checkOut,
        checkIn,
        checkOut
      );
    });
  }

  /**
   * Verifica si dos rangos de fechas se solapan
   */
  private datesOverlap(
    start1: Date,
    end1: Date,
    start2: Date,
    end2: Date
  ): boolean {
    return (
      isBefore(start1, end2) &&
      isAfter(end1, start2)
    );
  }

  /**
   * Calcula la ocupación por habitación en cada día del período
   */
  private calculateRoomOccupancy(
    bookings: BookingPeriod[],
    checkIn: Date,
    checkOut: Date
  ): Map<string, Map<string, number>> {
    const roomOccupancy = new Map<string, Map<string, number>>();

    // Inicializar ocupación para cada habitación
    this.roomConfigs.forEach(room => {
      roomOccupancy.set(room.id, new Map());
    });

    // Calcular ocupación para cada día del período
    const daysInPeriod = eachDayOfInterval({ start: checkIn, end: checkOut });
    
    daysInPeriod.forEach(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      
      this.roomConfigs.forEach(room => {
        let occupiedBeds = 0;
        
        bookings.forEach(booking => {
          if (
            booking.roomId === room.id &&
            this.isDateInBookingPeriod(day, booking.checkIn, booking.checkOut)
          ) {
            occupiedBeds += booking.bedsCount;
          }
        });
        
        roomOccupancy.get(room.id)?.set(dayStr, occupiedBeds);
      });
    });

    return roomOccupancy;
  }

  /**
   * Verifica si una fecha está dentro del período de reserva (incluyendo check-in, excluyendo check-out)
   */
  private isDateInBookingPeriod(date: Date, checkIn: Date, checkOut: Date): boolean {
    return (
      (isEqual(date, checkIn) || isAfter(date, checkIn)) &&
      isBefore(date, checkOut)
    );
  }

  /**
   * Calcula disponibilidad para cada habitación
   */
  private calculateRoomsAvailability(
    roomOccupancy: Map<string, Map<string, number>>,
    checkIn: Date,
    checkOut: Date
  ): RoomAvailability[] {
    return this.roomConfigs.map(room => {
      const roomOccupancyMap = roomOccupancy.get(room.id)!;
      const daysInPeriod = eachDayOfInterval({ start: checkIn, end: checkOut });
      
      // Encontrar la máxima ocupación durante el período
      let maxOccupancy = 0;
      const conflictDates: Date[] = [];
      
      daysInPeriod.forEach(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayOccupancy = roomOccupancyMap.get(dayStr) || 0;
        
        if (dayOccupancy > maxOccupancy) {
          maxOccupancy = dayOccupancy;
        }
        
        if (dayOccupancy >= room.capacity) {
          conflictDates.push(day);
        }
      });
      
      const availableBeds = Math.max(0, room.capacity - maxOccupancy);
      
      return {
        roomId: room.id,
        availableBeds,
        totalCapacity: room.capacity,
        occupancy: maxOccupancy,
        canAccommodate: availableBeds > 0,
        conflictDates
      };
    });
  }

  /**
   * Encuentra la asignación óptima de habitaciones
   */
  private findOptimalAllocation(
    query: AvailabilityQuery,
    roomsAvailability: RoomAvailability[]
  ): RoomAllocation[] {
    const allocation: RoomAllocation[] = [];
    let remainingBeds = query.requestedBeds;

    // Filtrar habitaciones disponibles y ordenar por capacidad disponible (descendente)
    const availableRooms = roomsAvailability
      .filter(room => room.availableBeds > 0)
      .sort((a, b) => b.availableBeds - a.availableBeds);

    for (const roomAvailability of availableRooms) {
      if (remainingBeds <= 0) break;

      const roomConfig = this.roomConfigs.find(r => r.id === roomAvailability.roomId)!;
      const bedsToAllocate = Math.min(remainingBeds, roomAvailability.availableBeds);

      allocation.push({
        roomId: roomAvailability.roomId,
        bedsAllocated: bedsToAllocate,
        roomName: roomConfig.name,
        pricePerNight: roomConfig.basePrice
      });

      remainingBeds -= bedsToAllocate;
    }

    return allocation;
  }

  /**
   * Busca fechas alternativas cuando no hay disponibilidad
   */
  private findAlternativeDates(
    query: AvailabilityQuery,
    bookings: BookingPeriod[]
  ): Date[] {
    // Lógica simplificada: sugerir fechas 1 semana antes y después
    const oneWeekBefore = new Date(query.checkIn);
    oneWeekBefore.setDate(oneWeekBefore.getDate() - 7);

    const oneWeekAfter = new Date(query.checkIn);
    oneWeekAfter.setDate(oneWeekAfter.getDate() + 7);

    return [oneWeekBefore, oneWeekAfter];
  }

  /**
   * Crea resultado de error estándar
   */
  private createErrorResult(message: string): AvailabilityResult {
    return {
      isAvailable: false,
      totalAvailableBeds: 0,
      roomsAvailability: [],
      message
    };
  }

  /**
   * Obtiene configuración de habitación por ID
   */
  public getRoomConfig(roomId: string): RoomConfig | undefined {
    return this.roomConfigs.find(room => room.id === roomId);
  }

  /**
   * Obtiene todas las configuraciones de habitaciones
   */
  public getAllRoomConfigs(): RoomConfig[] {
    return [...this.roomConfigs];
  }
}
