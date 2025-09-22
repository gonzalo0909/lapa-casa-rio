// src/lib/availability/anti-overbooking.ts

import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { AvailabilityChecker, BookingPeriod, RoomConfig } from './availability-checker';
import { RoomAllocator, AllocationStrategy } from './room-allocator';

/**
 * Estados de reserva para control de overbooking
 */
export enum BookingStatus {
  PENDING = 'PENDING',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED'
}

/**
 * Datos de reserva para validación anti-overbooking
 */
export interface BookingValidationData {
  id?: string; // Para actualizaciones
  roomId: string;
  checkIn: Date;
  checkOut: Date;
  bedsCount: number;
  status: BookingStatus;
  guestEmail: string;
  createdAt: Date;
  expiresAt?: Date; // Para reservas pendientes
}

/**
 * Resultado de validación anti-overbooking
 */
export interface ValidationResult {
  isValid: boolean;
  canProceed: boolean;
  conflicts: BookingConflict[];
  warnings: string[];
  suggestedAlternatives?: AlternativeSuggestion[];
  lockRequired: boolean;
  message: string;
}

/**
 * Conflicto detectado en reservas
 */
export interface BookingConflict {
  conflictType: 'OVERBOOKING' | 'DUPLICATE' | 'INVALID_DATES' | 'ROOM_UNAVAILABLE';
  conflictingBookingId?: string;
  roomId: string;
  conflictDate: Date;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
}

/**
 * Sugerencias alternativas cuando hay conflictos
 */
export interface AlternativeSuggestion {
  type: 'DIFFERENT_ROOM' | 'DIFFERENT_DATES' | 'SPLIT_BOOKING';
  suggestion: string;
  roomIds?: string[];
  alternativeDates?: { checkIn: Date; checkOut: Date };
  feasibilityScore: number; // 0-100
}

/**
 * Configuración del sistema anti-overbooking
 */
interface AntiOverbookingConfig {
  maxPendingMinutes: number; // Tiempo máximo para reservas pendientes
  lockTimeoutMinutes: number; // Tiempo de bloqueo durante validación
  allowOverbookingPercentage: number; // % de sobrereservación permitida (0 = ninguna)
  enableDoubleBookingPrevention: boolean;
  enableRaceConditionProtection: boolean;
}

/**
 * Clase principal para prevenir overbooking en Lapa Casa Hostel
 */
export class AntiOverbookingSystem {
  private availabilityChecker: AvailabilityChecker;
  private roomAllocator: RoomAllocator;
  private config: AntiOverbookingConfig;
  private activeLocks: Map<string, Date> = new Map();
  private bookingCache: Map<string, BookingValidationData[]> = new Map();

  constructor(
    availabilityChecker: AvailabilityChecker,
    roomAllocator: RoomAllocator,
    config: Partial<AntiOverbookingConfig> = {}
  ) {
    this.availabilityChecker = availabilityChecker;
    this.roomAllocator = roomAllocator;
    this.config = {
      maxPendingMinutes: 15, // 15 minutos para completar pago
      lockTimeoutMinutes: 5, // 5 minutos de lock por validación
      allowOverbookingPercentage: 0, // 0% overbooking para Lapa Casa
      enableDoubleBookingPrevention: true,
      enableRaceConditionProtection: true,
      ...config
    };
  }

  /**
   * Validación principal anti-overbooking antes de crear reserva
   */
  public async validateBooking(
    bookingData: Omit<BookingValidationData, 'id' | 'createdAt'>,
    existingBookings: BookingValidationData[]
  ): Promise<ValidationResult> {
    try {
      // 1. Validaciones básicas
      const basicValidation = this.validateBasicBookingData(bookingData);
      if (!basicValidation.isValid) {
        return basicValidation;
      }

      // 2. Limpiar reservas expiradas
      const activeBookings = this.filterActiveBookings(existingBookings);

      // 3. Detectar conflictos
      const conflicts = await this.detectConflicts(bookingData, activeBookings);

      // 4. Evaluar si se puede proceder
      const canProceed = this.evaluateConflicts(conflicts);

      // 5. Generar alternativas si hay conflictos
      const alternatives = canProceed ? undefined : 
        await this.generateAlternatives(bookingData, activeBookings, conflicts);

      // 6. Determinar si necesita lock
      const lockRequired = this.config.enableRaceConditionProtection && 
        this.hasHighSeverityConflicts(conflicts);

      return {
        isValid: conflicts.length === 0,
        canProceed,
        conflicts,
        warnings: this.generateWarnings(bookingData, conflicts),
        suggestedAlternatives: alternatives,
        lockRequired,
        message: this.generateValidationMessage(conflicts, canProceed)
      };

    } catch (error) {
      console.error('Error en validación anti-overbooking:', error);
      return {
        isValid: false,
        canProceed: false,
        conflicts: [{
          conflictType: 'INVALID_DATES',
          roomId: bookingData.roomId,
          conflictDate: bookingData.checkIn,
          severity: 'HIGH',
          description: 'Error interno en la validación'
        }],
        warnings: [],
        lockRequired: false,
        message: 'Error interno en la validación de disponibilidad'
      };
    }
  }

  /**
   * Validaciones básicas de datos de reserva
   */
  private validateBasicBookingData(
    bookingData: Omit<BookingValidationData, 'id' | 'createdAt'>
  ): ValidationResult {
    const conflicts: BookingConflict[] = [];

    // Validar fechas
    if (bookingData.checkIn >= bookingData.checkOut) {
      conflicts.push({
        conflictType: 'INVALID_DATES',
        roomId: bookingData.roomId,
        conflictDate: bookingData.checkIn,
        severity: 'HIGH',
        description: 'La fecha de check-out debe ser posterior al check-in'
      });
    }

    // Validar fecha no sea en el pasado
    const today = startOfDay(new Date());
    if (bookingData.checkIn < today) {
      conflicts.push({
        conflictType: 'INVALID_DATES',
        roomId: bookingData.roomId,
        conflictDate: bookingData.checkIn,
        severity: 'HIGH',
        description: 'No se pueden hacer reservas para fechas pasadas'
      });
    }

    // Validar número de camas
    if (bookingData.bedsCount <= 0) {
      conflicts.push({
        conflictType: 'INVALID_DATES',
        roomId: bookingData.roomId,
        conflictDate: bookingData.checkIn,
        severity: 'HIGH',
        description: 'El número de camas debe ser mayor a 0'
      });
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(bookingData.guestEmail)) {
      conflicts.push({
        conflictType: 'INVALID_DATES',
        roomId: bookingData.roomId,
        conflictDate: bookingData.checkIn,
        severity: 'HIGH',
        description: 'Email del huésped no es válido'
      });
    }

    return {
      isValid: conflicts.length === 0,
      canProceed: conflicts.length === 0,
      conflicts,
      warnings: [],
      lockRequired: false,
      message: conflicts.length === 0 ? 'Datos básicos válidos' : 'Errores en datos básicos'
    };
  }

  /**
   * Filtra reservas activas eliminando las expiradas
   */
  private filterActiveBookings(bookings: BookingValidationData[]): BookingValidationData[] {
    const now = new Date();
    
    return bookings.filter(booking => {
      // Excluir reservas canceladas o expiradas
      if (booking.status === BookingStatus.CANCELLED || booking.status === BookingStatus.EXPIRED) {
        return false;
      }

      // Verificar si reservas pendientes han expirado
      if (booking.status === BookingStatus.PENDING && booking.expiresAt) {
        if (now > booking.expiresAt) {
          // Marcar como expirada (en implementación real, actualizar en BD)
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Detecta todos los tipos de conflictos posibles
   */
  private async detectConflicts(
    newBooking: Omit<BookingValidationData, 'id' | 'createdAt'>,
    existingBookings: BookingValidationData[]
  ): Promise<BookingConflict[]> {
    const conflicts: BookingConflict[] = [];

    // 1. Detectar overbooking
    const overbookingConflicts = await this.detectOverbooking(newBooking, existingBookings);
    conflicts.push(...overbookingConflicts);

    // 2. Detectar reservas duplicadas (mismo email, fechas solapadas)
    if (this.config.enableDoubleBookingPrevention) {
      const duplicateConflicts = this.detectDuplicateBookings(newBooking, existingBookings);
      conflicts.push(...duplicateConflicts);
    }

    // 3. Validar disponibilidad de habitación específica
    const roomUnavailableConflicts = this.detectRoomUnavailability(newBooking, existingBookings);
    conflicts.push(...roomUnavailableConflicts);

    return conflicts;
  }

  /**
   * Detecta overbooking en habitaciones
   */
  private async detectOverbooking(
    newBooking: Omit<BookingValidationData, 'id' | 'createdAt'>,
    existingBookings: BookingValidationData[]
  ): Promise<BookingConflict[]> {
    const conflicts: BookingConflict[] = [];

    // Obtener configuración de la habitación
    const roomConfig = this.availabilityChecker.getRoomConfig(newBooking.roomId);
    if (!roomConfig) {
      conflicts.push({
        conflictType: 'ROOM_UNAVAILABLE',
        roomId: newBooking.roomId,
        conflictDate: newBooking.checkIn,
        severity: 'HIGH',
        description: 'Habitación no encontrada en configuración'
      });
      return conflicts;
    }

    // Calcular ocupación máxima durante el período
    const relevantBookings = existingBookings.filter(booking =>
      booking.roomId === newBooking.roomId &&
      this.datesOverlap(
        booking.checkIn, booking.checkOut,
        newBooking.checkIn, newBooking.checkOut
      )
    );

    // Verificar cada día del período
    const checkInDate = startOfDay(newBooking.checkIn);
    const checkOutDate = startOfDay(newBooking.checkOut);
    
    for (let currentDate = new Date(checkInDate); 
         currentDate < checkOutDate; 
         currentDate.setDate(currentDate.getDate() + 1)) {
      
      let totalOccupancy = 0;
      
      // Sumar camas ocupadas en esta fecha
      relevantBookings.forEach(booking => {
        if (this.isDateInBookingPeriod(currentDate, booking.checkIn, booking.checkOut)) {
          totalOccupancy += booking.bedsCount;
        }
      });

      // Agregar la nueva reserva
      const projectedOccupancy = totalOccupancy + newBooking.bedsCount;
      
      // Verificar si excede capacidad
      const maxAllowed = Math.floor(
        roomConfig.capacity * (1 + this.config.allowOverbookingPercentage / 100)
      );

      if (projectedOccupancy > maxAllowed) {
        conflicts.push({
          conflictType: 'OVERBOOKING',
          roomId: newBooking.roomId,
          conflictDate: currentDate,
          severity: 'HIGH',
          description: `Overbooking detectado: ${projectedOccupancy} camas exceden capacidad de ${maxAllowed} en ${format(currentDate, 'dd/MM/yyyy')}`
        });
      }
    }

    return conflicts;
  }

  /**
   * Detecta reservas duplicadas del mismo huésped
   */
  private detectDuplicateBookings(
    newBooking: Omit<BookingValidationData, 'id' | 'createdAt'>,
    existingBookings: BookingValidationData[]
  ): BookingConflict[] {
    const conflicts: BookingConflict[] = [];

    const duplicates = existingBookings.filter(booking =>
      booking.guestEmail.toLowerCase() === newBooking.guestEmail.toLowerCase() &&
      this.datesOverlap(
        booking.checkIn, booking.checkOut,
        newBooking.checkIn, newBooking.checkOut
      ) &&
      booking.status !== BookingStatus.CANCELLED
    );

    duplicates.forEach(duplicate => {
      conflicts.push({
        conflictType: 'DUPLICATE',
        conflictingBookingId: duplicate.id,
        roomId: newBooking.roomId,
        conflictDate: newBooking.checkIn,
        severity: 'MEDIUM',
        description: `Posible reserva duplicada para ${newBooking.guestEmail} en fechas solapadas`
      });
    });

    return conflicts;
  }

  /**
   * Detecta si la habitación específica no está disponible
   */
  private detectRoomUnavailability(
    newBooking: Omit<BookingValidationData, 'id' | 'createdAt'>,
    existingBookings: BookingValidationData[]
  ): BookingConflict[] {
    const conflicts: BookingConflict[] = [];

    // Verificar que la habitación existe
    const roomConfig = this.availabilityChecker.getRoomConfig(newBooking.roomId);
    if (!roomConfig) {
      conflicts.push({
        conflictType: 'ROOM_UNAVAILABLE',
        roomId: newBooking.roomId,
        conflictDate: newBooking.checkIn,
        severity: 'HIGH',
        description: 'La habitación solicitada no existe'
      });
      return conflicts;
    }

    // Verificar si las camas solicitadas exceden la capacidad total
    if (newBooking.bedsCount > roomConfig.capacity) {
      conflicts.push({
        conflictType: 'ROOM_UNAVAILABLE',
        roomId: newBooking.roomId,
        conflictDate: newBooking.checkIn,
        severity: 'HIGH',
        description: `Se solicitan ${newBooking.bedsCount} camas pero la habitación solo tiene ${roomConfig.capacity}`
      });
    }

    return conflicts;
  }

  /**
   * Verifica si dos rangos de fechas se solapan
   */
  private datesOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
    return start1 < end2 && end1 > start2;
  }

  /**
   * Verifica si una fecha está en el período de reserva
   */
  private isDateInBookingPeriod(date: Date, checkIn: Date, checkOut: Date): boolean {
    const dateOnly = startOfDay(date);
    const checkInOnly = startOfDay(checkIn);
    const checkOutOnly = startOfDay(checkOut);
    
    return dateOnly >= checkInOnly && dateOnly < checkOutOnly;
  }

  /**
   * Evalúa si se puede proceder a pesar de los conflictos
   */
  private evaluateConflicts(conflicts: BookingConflict[]): boolean {
    // No proceder si hay conflictos de alta severidad
    const highSeverityConflicts = conflicts.filter(c => c.severity === 'HIGH');
    if (highSeverityConflicts.length > 0) {
      return false;
    }

    // Evaluar conflictos de severidad media
    const mediumSeverityConflicts = conflicts.filter(c => c.severity === 'MEDIUM');
    if (mediumSeverityConflicts.length > 2) {
      return false; // Demasiados conflictos medios
    }

    return true;
  }

  /**
   * Genera alternativas cuando hay conflictos
   */
  private async generateAlternatives(
    bookingData: Omit<BookingValidationData, 'id' | 'createdAt'>,
    existingBookings: BookingValidationData[],
    conflicts: BookingConflict[]
  ): Promise<AlternativeSuggestion[]> {
    const alternatives: AlternativeSuggestion[] = [];

    // Sugerir habitaciones alternativas
    const roomAlternatives = await this.suggestAlternativeRooms(bookingData, existingBookings);
    alternatives.push(...roomAlternatives);

    // Sugerir fechas alternativas
    const dateAlternatives = await this.suggestAlternativeDates(bookingData, existingBookings);
    alternatives.push(...dateAlternatives);

    // Sugerir división de reserva en múltiples habitaciones
    if (bookingData.bedsCount > 7) {
      const splitAlternatives = await this.suggestSplitBooking(bookingData, existingBookings);
      alternatives.push(...splitAlternatives);
    }

    return alternatives.sort((a, b) => b.feasibilityScore - a.feasibilityScore);
  }

  /**
   * Sugiere habitaciones alternativas disponibles
   */
  private async suggestAlternativeRooms(
    bookingData: Omit<BookingValidationData, 'id' | 'createdAt'>,
    existingBookings: BookingValidationData[]
  ): Promise<AlternativeSuggestion[]> {
    const alternatives: AlternativeSuggestion[] = [];
    
    const allRoomConfigs = this.availabilityChecker.getAllRoomConfigs();
    
    for (const roomConfig of allRoomConfigs) {
      if (roomConfig.id === bookingData.roomId) continue;
      
      // Verificar disponibilidad en habitación alternativa
      const alternativeBooking = { ...bookingData, roomId: roomConfig.id };
      const validation = await this.validateBooking(alternativeBooking, existingBookings);
      
      if (validation.canProceed) {
        alternatives.push({
          type: 'DIFFERENT_ROOM',
          suggestion: `Habitación ${roomConfig.name} disponible para las mismas fechas`,
          roomIds: [roomConfig.id],
          feasibilityScore: 90
        });
      }
    }
    
    return alternatives;
  }

  /**
   * Sugiere fechas alternativas cercanas
   */
  private async suggestAlternativeDates(
    bookingData: Omit<BookingValidationData, 'id' | 'createdAt'>,
    existingBookings: BookingValidationData[]
  ): Promise<AlternativeSuggestion[]> {
    const alternatives: AlternativeSuggestion[] = [];
    
    // Probar fechas 1 semana antes y después
    const originalDuration = bookingData.checkOut.getTime() - bookingData.checkIn.getTime();
    
    for (let dayOffset of [-7, -3, 3, 7]) {
      const newCheckIn = new Date(bookingData.checkIn);
      newCheckIn.setDate(newCheckIn.getDate() + dayOffset);
      
      const newCheckOut = new Date(newCheckIn.getTime() + originalDuration);
      
      const alternativeBooking = {
        ...bookingData,
        checkIn: newCheckIn,
        checkOut: newCheckOut
      };
      
      const validation = await this.validateBooking(alternativeBooking, existingBookings);
      
      if (validation.canProceed) {
        alternatives.push({
          type: 'DIFFERENT_DATES',
          suggestion: `Fechas alternativas: ${format(newCheckIn, 'dd/MM/yyyy')} - ${format(newCheckOut, 'dd/MM/yyyy')}`,
          alternativeDates: { checkIn: newCheckIn, checkOut: newCheckOut },
          feasibilityScore: Math.max(0, 80 - Math.abs(dayOffset) * 5)
        });
      }
    }
    
    return alternatives;
  }

  /**
   * Sugiere dividir la reserva en múltiples habitaciones
   */
  private async suggestSplitBooking(
    bookingData: Omit<BookingValidationData, 'id' | 'createdAt'>,
    existingBookings: BookingValidationData[]
  ): Promise<AlternativeSuggestion[]> {
    const alternatives: AlternativeSuggestion[] = [];
    
    // Simular disponibilidad total
    const availabilityMap = new Map<string, number>();
    
    const allRoomConfigs = this.availabilityChecker.getAllRoomConfigs();
    for (const room of allRoomConfigs) {
      // Calcular disponibilidad actual (simplificado)
      const roomBookings = existingBookings.filter(b => 
        b.roomId === room.id &&
        this.datesOverlap(b.checkIn, b.checkOut, bookingData.checkIn, bookingData.checkOut)
      );
      
      const occupied = roomBookings.reduce((sum, b) => sum + b.bedsCount, 0);
      availabilityMap.set(room.id, Math.max(0, room.capacity - occupied));
    }
    
    // Intentar asignación con múltiples habitaciones
    const allocationResult = this.roomAllocator.allocateRooms(
      bookingData.bedsCount,
      availabilityMap,
      AllocationStrategy.GROUP_FRIENDLY
    );
    
    if (allocationResult.success && allocationResult.roomsUsed > 1) {
      const roomNames = allocationResult.allocation.map(a => a.roomName).join(', ');
      alternatives.push({
        type: 'SPLIT_BOOKING',
        suggestion: `Dividir reserva en ${allocationResult.roomsUsed} habitaciones: ${roomNames}`,
        roomIds: allocationResult.allocation.map(a => a.roomId),
        feasibilityScore: 70
      });
    }
    
    return alternatives;
  }

  /**
   * Verifica si hay conflictos de alta severidad
   */
  private hasHighSeverityConflicts(conflicts: BookingConflict[]): boolean {
    return conflicts.some(conflict => conflict.severity === 'HIGH');
  }

  /**
   * Genera warnings para el usuario
   */
  private generateWarnings(
    bookingData: Omit<BookingValidationData, 'id' | 'createdAt'>,
    conflicts: BookingConflict[]
  ): string[] {
    const warnings: string[] = [];

    // Warning por conflictos de severidad media
    const mediumConflicts = conflicts.filter(c => c.severity === 'MEDIUM');
    if (mediumConflicts.length > 0) {
      warnings.push('Se detectaron posibles conflictos menores que requieren verificación');
    }

    // Warning por habitación flexible
    const roomConfig = this.availabilityChecker.getRoomConfig(bookingData.roomId);
    if (roomConfig?.isFlexible) {
      warnings.push('Habitación flexible seleccionada - puede cambiar de femenina a mixta');
    }

    // Warning por grupos grandes
    if (bookingData.bedsCount >= 20) {
      warnings.push('Reserva de grupo muy grande - verificar disponibilidad total del hostel');
    }

    return warnings;
  }

  /**
   * Genera mensaje de resultado de validación
   */
  private generateValidationMessage(conflicts: BookingConflict[], canProceed: boolean): string {
    if (conflicts.length === 0) {
      return 'Reserva válida - no se detectaron conflictos';
    }

    if (!canProceed) {
      const highConflicts = conflicts.filter(c => c.severity === 'HIGH');
      if (highConflicts.length > 0) {
        return `No se puede proceder: ${highConflicts.length} conflictos críticos detectados`;
      }
      return 'No se puede proceder: demasiados conflictos detectados';
    }

    return `Se puede proceder con advertencias: ${conflicts.length} conflictos menores detectados`;
  }

  /**
   * Adquiere lock temporal para prevenir race conditions
   */
  public async acquireLock(lockKey: string): Promise<boolean> {
    if (!this.config.enableRaceConditionProtection) {
      return true;
    }

    const now = new Date();
    const existingLock = this.activeLocks.get(lockKey);

    // Verificar si el lock ya existe y no ha expirado
    if (existingLock) {
      const lockExpiry = new Date(existingLock.getTime() + this.config.lockTimeoutMinutes * 60000);
      if (now < lockExpiry) {
        return false; // Lock ya existe
      }
    }

    // Crear nuevo lock
    this.activeLocks.set(lockKey, now);
    return true;
  }

  /**
   * Libera lock temporal
   */
  public releaseLock(lockKey: string): void {
    this.activeLocks.delete(lockKey);
  }

  /**
   * Limpia locks expirados
   */
  public cleanupExpiredLocks(): void {
    const now = new Date();
    const expiredKeys: string[] = [];

    this.activeLocks.forEach((lockTime, key) => {
      const lockExpiry = new Date(lockTime.getTime() + this.config.lockTimeoutMinutes * 60000);
      if (now >= lockExpiry) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => this.activeLocks.delete(key));
  }

  /**
   * Genera clave de lock para una reserva específica
   */
  public generateLockKey(roomId: string, checkIn: Date, checkOut: Date): string {
    const checkInStr = format(checkIn, 'yyyy-MM-dd');
    const checkOutStr = format(checkOut, 'yyyy-MM-dd');
    return `booking_lock_${roomId}_${checkInStr}_${checkOutStr}`;
  }

  /**
   * Valida y actualiza reserva existente (para modificaciones)
   */
  public async validateBookingUpdate(
    bookingId: string,
    updatedData: Partial<BookingValidationData>,
    existingBookings: BookingValidationData[]
  ): Promise<ValidationResult> {
    // Encontrar reserva existente
    const existingBooking = existingBookings.find(b => b.id === bookingId);
    if (!existingBooking) {
      return {
        isValid: false,
        canProceed: false,
        conflicts: [{
          conflictType: 'INVALID_DATES',
          roomId: updatedData.roomId || '',
          conflictDate: new Date(),
          severity: 'HIGH',
          description: 'Reserva a actualizar no encontrada'
        }],
        warnings: [],
        lockRequired: false,
        message: 'Reserva no encontrada'
      };
    }

    // Merge datos actualizados con existentes
    const mergedBooking = { ...existingBooking, ...updatedData };

    // Filtrar otras reservas (excluir la que se está actualizando)
    const otherBookings = existingBookings.filter(b => b.id !== bookingId);

    // Validar como nueva reserva
    return this.validateBooking(mergedBooking, otherBookings);
  }

  /**
   * Obtiene estadísticas del sistema anti-overbooking
   */
  public getSystemStats(): {
    activeLocks: number;
    lockTimeoutMinutes: number;
    maxPendingMinutes: number;
    overbookingAllowed: number;
    doubleBookingPrevention: boolean;
    raceConditionProtection: boolean;
  } {
    return {
      activeLocks: this.activeLocks.size,
      lockTimeoutMinutes: this.config.lockTimeoutMinutes,
      maxPendingMinutes: this.config.maxPendingMinutes,
      overbookingAllowed: this.config.allowOverbookingPercentage,
      doubleBookingPrevention: this.config.enableDoubleBookingPrevention,
      raceConditionProtection: this.config.enableRaceConditionProtection
    };
  }

  /**
   * Actualiza configuración del sistema
   */
  public updateConfig(newConfig: Partial<AntiOverbookingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Simula carga alta para testing de race conditions
   */
  public async simulateHighLoad(
    bookingData: Omit<BookingValidationData, 'id' | 'createdAt'>,
    existingBookings: BookingValidationData[],
    concurrentRequests: number = 10
  ): Promise<{
    successful: number;
    failed: number;
    conflicts: number;
    averageResponseTime: number;
  }> {
    const promises: Promise<ValidationResult>[] = [];
    const startTime = Date.now();

    // Crear múltiples validaciones concurrentes
    for (let i = 0; i < concurrentRequests; i++) {
      const promise = this.validateBooking(
        { ...bookingData, guestEmail: `test${i}@example.com` },
        existingBookings
      );
      promises.push(promise);
    }

    const results = await Promise.all(promises);
    const endTime = Date.now();

    const successful = results.filter(r => r.canProceed).length;
    const failed = results.filter(r => !r.canProceed).length;
    const conflicts = results.filter(r => r.conflicts.length > 0).length;

    return {
      successful,
      failed,
      conflicts,
      averageResponseTime: (endTime - startTime) / concurrentRequests
    };
  }
}
