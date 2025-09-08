
import { db } from '../services/database';
import { redis } from '../services/redis';
import { BedSelection, OccupiedBeds } from './room';
import { logger } from '../utils/logger';

export class InventoryService {
  private lockTTL = 300; // 5 minutos para locks

  /**
   * Obtener camas ocupadas en un rango de fechas
   */
  public async getOccupiedBeds(dateFrom: string, dateTo: string): Promise<OccupiedBeds> {
    const prisma = db.getClient();

    const checkIn = new Date(dateFrom + 'T00:00:00');
    const checkOut = new Date(dateTo + 'T23:59:59');

    // Buscar bookings que se superponen con el rango
    const bookings = await prisma.booking.findMany({
      where: {
        AND: [
          { salida: { gt: checkIn } },   // Booking sale después del check-in
          { entrada: { lt: checkOut } }, // Booking entra antes del check-out
          { 
            status: { 
              in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] 
            } 
          },
          {
            payStatus: {
              in: ['PAID', 'PENDING'] // Incluir pending por seguridad
            }
          }
        ],
      },
      include: {
        beds: true,
      },
    });

    // Obtener holds activos de Redis
    const holdKeys = await redis.keys('hold:*');
    const holdBeds: BedSelection[] = [];

    for (const key of holdKeys) {
      const holdData = await redis.get(key);
      if (holdData) {
        try {
          const hold = JSON.parse(holdData);
          if (this.holdsOverlapWithDates(hold, dateFrom, dateTo)) {
            holdBeds.push(...(hold.beds || []));
          }
        } catch (error) {
          logger.warn(`Invalid hold data in Redis: ${key}`);
        }
      }
    }

    // Combinar camas ocupadas
    const occupied: OccupiedBeds = { 1: [], 3: [], 5: [], 6: [] };

    // Camas de bookings confirmados
    for (const booking of bookings) {
      for (const bed of booking.beds) {
        if (!occupied[bed.roomId]) occupied[bed.roomId] = [];
        if (!occupied[bed.roomId].includes(bed.bedNumber)) {
          occupied[bed.roomId].push(bed.bedNumber);
        }
      }
    }

    // Camas de holds activos
    for (const bed of holdBeds) {
      if (!occupied[bed.roomId]) occupied[bed.roomId] = [];
      if (!occupied[bed.roomId].includes(bed.bedNumber)) {
        occupied[bed.roomId].push(bed.bedNumber);
      }
    }

    // Ordenar arrays
    for (const roomId of [1, 3, 5, 6]) {
      occupied[roomId] = occupied[roomId].sort((a, b) => a - b);
    }

    return occupied;
  }

  /**
   * Verificar si camas específicas están disponibles
   */
  public async verifyBedsAvailable(
    beds: BedSelection[], 
    dateFrom: string, 
    dateTo: string
  ): Promise<boolean> {
    const occupiedBeds = await this.getOccupiedBeds(dateFrom, dateTo);

    for (const bed of beds) {
      if (occupiedBeds[bed.roomId]?.includes(bed.bedNumber)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Crear lock temporal para prevenir double booking
   */
  public async createBedLock(beds: BedSelection[], lockId: string): Promise<boolean> {
    await redis.connect();

    try {
      // Verificar que no hay locks existentes para estas camas
      for (const bed of beds) {
        const lockKey = `lock:${bed.roomId}:${bed.bedNumber}`;
        const existingLock = await redis.get(lockKey);
        
        if (existingLock && existingLock !== lockId) {
          // Ya hay un lock diferente
          return false;
        }
      }

      // Crear todos los locks
      for (const bed of beds) {
        const lockKey = `lock:${bed.roomId}:${bed.bedNumber}`;
        await redis.set(lockKey, lockId, this.lockTTL);
      }

      logger.info(`Bed locks created: ${lockId}`, { beds });
      return true;

    } catch (error) {
      logger.error('Error creating bed locks:', error);
      return false;
    }
  }

  /**
   * Liberar locks de camas
   */
  public async releaseBedLock(beds: BedSelection[], lockId: string): Promise<void> {
    await redis.connect();

    try {
      for (const bed of beds) {
        const lockKey = `lock:${bed.roomId}:${bed.bedNumber}`;
        const currentLock = await redis.get(lockKey);
        
        // Solo liberar si el lock nos pertenece
        if (currentLock === lockId) {
          await redis.del(lockKey);
        }
      }

      logger.info(`Bed locks released: ${lockId}`, { beds });

    } catch (error) {
      logger.error('Error releasing bed locks:', error);
    }
  }

  /**
   * Limpiar locks expirados (llamar periódicamente)
   */
  public async cleanupExpiredLocks(): Promise<number> {
    await redis.connect();

    try {
      const lockKeys = await redis.keys('lock:*');
      let cleaned = 0;

      for (const key of lockKeys) {
        const ttl = await redis.ttl(key);
        if (ttl <= 0) { // Expirado o sin TTL
          await redis.del(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.info(`Cleaned ${cleaned} expired bed locks`);
      }

      return cleaned;

    } catch (error) {
      logger.error('Error cleaning expired locks:', error);
      return 0;
    }
  }

  /**
   * Verificar si un hold se superpone con fechas dadas
   */
  private holdsOverlapWithDates(hold: any, dateFrom: string, dateTo: string): boolean {
    if (!hold.dates || !hold.dates.entrada || !hold.dates.salida) {
      return false;
    }

    const holdStart = new Date(hold.dates.entrada + 'T00:00:00');
    const holdEnd = new Date(hold.dates.salida + 'T23:59:59');
    const rangeStart = new Date(dateFrom + 'T00:00:00');
    const rangeEnd = new Date(dateTo + 'T23:59:59');

    // Verificar superposición
    return holdEnd > rangeStart && holdStart < rangeEnd;
  }

  /**
   * Obtener estadísticas de ocupación
   */
  public async getOccupancyStats(dateFrom: string, dateTo: string): Promise<{
    totalCapacity: number;
    totalOccupied: number;
    occupancyRate: number;
    byRoom: Record<number, { capacity: number; occupied: number; rate: number }>;
  }> {
    const rooms = { 1: 12, 3: 12, 5: 7, 6: 7 };
    const occupiedBeds = await this.getOccupiedBeds(dateFrom, dateTo);

    let totalCapacity = 0;
    let totalOccupied = 0;
    const byRoom: Record<number, { capacity: number; occupied: number; rate: number }> = {};

    for (const [roomId, capacity] of Object.entries(rooms)) {
      const id = parseInt(roomId);
      const occupied = occupiedBeds[id]?.length || 0;
      const rate = capacity > 0 ? (occupied / capacity) * 100 : 0;

      byRoom[id] = { capacity, occupied, rate };
      totalCapacity += capacity;
      totalOccupied += occupied;
    }

    const occupancyRate = totalCapacity > 0 ? (totalOccupied / totalCapacity) * 100 : 0;

    return {
      totalCapacity,
      totalOccupied,
      occupancyRate,
      byRoom,
    };
  }

  /**
   * Obtener información detallada de disponibilidad por habitación
   */
  public async getRoomAvailabilityDetails(
    dateFrom: string, 
    dateTo: string
  ): Promise<{
    [roomId: number]: {
      totalBeds: number;
      availableBeds: number[];
      occupiedBeds: number[];
      occupancyRate: number;
      nextAvailableDate?: string;
    };
  }> {
    const rooms = { 1: 12, 3: 12, 5: 7, 6: 7 };
    const occupiedBeds = await this.getOccupiedBeds(dateFrom, dateTo);
    const details: any = {};

    for (const [roomId, totalBeds] of Object.entries(rooms)) {
      const id = parseInt(roomId);
      const occupied = occupiedBeds[id] || [];
      const available = Array.from({ length: totalBeds }, (_, i) => i + 1)
        .filter(bedNum => !occupied.includes(bedNum));

      details[id] = {
        totalBeds,
        availableBeds: available,
        occupiedBeds: occupied,
        occupancyRate: (occupied.length / totalBeds) * 100,
      };

      // Si está completamente ocupada, buscar próxima fecha disponible
      if (available.length === 0) {
        details[id].nextAvailableDate = await this.findNextAvailableDate(id, dateTo);
      }
    }

    return details;
  }

  /**
   * Buscar próxima fecha disponible para una habitación
   */
  private async findNextAvailableDate(roomId: number, fromDate: string): Promise<string | undefined> {
    const prisma = db.getClient();
    const startDate = new Date(fromDate + 'T00:00:00');

    // Buscar próximo checkout en esta habitación
    const nextCheckout = await prisma.booking.findFirst({
      where: {
        beds: {
          some: { roomId }
        },
        salida: { gt: startDate },
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
      },
      orderBy: { salida: 'asc' },
    });

    return nextCheckout?.salida.toISOString().split('T')[0];
  }

  /**
   * Verificar capacidad total disponible para un grupo
   */
  public async checkGroupCapacity(
    dateFrom: string,
    dateTo: string,
    guestCount: number
  ): Promise<{
    canAccommodate: boolean;
    availableCapacity: number;
    recommendedRooms: number[];
    alternatives?: string[];
  }> {
    const details = await this.getRoomAvailabilityDetails(dateFrom, dateTo);
    
    let totalAvailable = 0;
    const availableRooms: Array<{ roomId: number; available: number }> = [];

    // Calcular disponibilidad total
    for (const [roomId, info] of Object.entries(details)) {
      const available = info.availableBeds.length;
      totalAvailable += available;
      
      if (available > 0) {
        availableRooms.push({ roomId: parseInt(roomId), available });
      }
    }

    const canAccommodate = totalAvailable >= guestCount;

    // Recomendar habitaciones en orden de disponibilidad
    const recommendedRooms = availableRooms
      .sort((a, b) => b.available - a.available)
      .map(room => room.roomId);

    const result: any = {
      canAccommodate,
      availableCapacity: totalAvailable,
      recommendedRooms,
    };

    // Si no puede acomodar, sugerir alternativas
    if (!canAccommodate) {
      const alternatives = [];
      
      // Buscar fechas cercanas con más disponibilidad
      const tomorrow = new Date(dateFrom);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const nextDayAvailability = await this.getOccupancyStats(
        tomorrow.toISOString().split('T')[0],
        dateTo
      );

      if (nextDayAvailability.totalOccupied < nextDayAvailability.totalCapacity - guestCount) {
        alternatives.push(`Disponible desde ${tomorrow.toISOString().split('T')[0]}`);
      }

      // Sugerir dividir el grupo
      if (totalAvailable > guestCount * 0.7) {
        alternatives.push(`${totalAvailable} camas disponibles - considera dividir el grupo`);
      }

      result.alternatives = alternatives;
    }

    return result;
  }

  /**
   * Crear snapshot de inventario para auditoría
   */
  public async createInventorySnapshot(date: string): Promise<{
    timestamp: string;
    date: string;
    totalCapacity: number;
    totalOccupied: number;
    occupancyRate: number;
    roomDetails: any;
    bookingCount: number;
    holdCount: number;
  }> {
    const prisma = db.getClient();
    const tomorrow = new Date(date);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [occupancyStats, roomDetails, bookingCount, holdStats] = await Promise.all([
      this.getOccupancyStats(date, tomorrow.toISOString().split('T')[0]),
      this.getRoomAvailabilityDetails(date, tomorrow.toISOString().split('T')[0]),
      prisma.booking.count({
        where: {
          entrada: { lte: new Date(tomorrow.toISOString()) },
          salida: { gt: new Date(date + 'T00:00:00') },
          status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        },
      }),
      this.getActiveHoldsCount(),
    ]);

    return {
      timestamp: new Date().toISOString(),
      date,
      totalCapacity: occupancyStats.totalCapacity,
      totalOccupied: occupancyStats.totalOccupied,
      occupancyRate: occupancyStats.occupancyRate,
      roomDetails,
      bookingCount,
      holdCount: holdStats,
    };
  }

  /**
   * Obtener count de holds activos
   */
  private async getActiveHoldsCount(): Promise<number> {
    try {
      const holdKeys = await redis.keys('hold:*');
      return holdKeys.length;
    } catch (error) {
      logger.error('Error getting active holds count:', error);
      return 0;
    }
  }
}
