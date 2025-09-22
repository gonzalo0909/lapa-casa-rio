// src/lib/availability/flexible-room-logic.ts

import { addHours, subHours, isAfter, isBefore, format } from 'date-fns';

/**
 * Configuración específica de la habitación flexible
 */
export interface FlexibleRoomConfig {
  roomId: string;
  roomName: string;
  capacity: number;
  defaultType: 'female' | 'mixed';
  autoConvertHours: number; // Horas antes del check-in para conversión automática
  manualOverride: boolean; // Permite override manual por admin
}

/**
 * Estado actual de la habitación flexible
 */
export interface FlexibleRoomState {
  roomId: string;
  currentType: 'female' | 'mixed';
  isConverted: boolean;
  convertedAt?: Date;
  nextScheduledConversion?: Date;
  lockUntil?: Date; // Lock temporal para evitar cambios
  femaleBookings: FlexibleBooking[];
  mixedBookings: FlexibleBooking[];
  totalBookings: FlexibleBooking[];
}

/**
 * Reserva que afecta a la habitación flexible
 */
export interface FlexibleBooking {
  id: string;
  checkIn: Date;
  checkOut: Date;
  bedsCount: number;
  guestType: 'female' | 'mixed';
  status: 'CONFIRMED' | 'PENDING' | 'CANCELLED';
  createdAt: Date;
  guestEmail: string;
}

/**
 * Resultado de evaluación de conversión
 */
export interface ConversionEvaluation {
  shouldConvert: boolean;
  reason: string;
  confidence: number; // 0-100
  timeUntilConversion?: Date;
  impactedBookings: string[];
  revenueImpact: {
    potentialGain: number;
    potentialLoss: number;
    netImpact: number;
  };
  recommendedAction: 'CONVERT_NOW' | 'SCHEDULE_CONVERSION' | 'KEEP_CURRENT' | 'MANUAL_REVIEW';
}

/**
 * Historial de conversiones para análisis
 */
export interface ConversionHistory {
  id: string;
  roomId: string;
  convertedAt: Date;
  fromType: 'female' | 'mixed';
  toType: 'female' | 'mixed';
  trigger: 'AUTOMATIC' | 'MANUAL' | 'DEMAND_BASED';
  beforeConversion: {
    femaleBookings: number;
    mixedBookings: number;
    occupancyRate: number;
  };
  afterConversion: {
    newBookings: number;
    cancelledBookings: number;
    revenueImpact: number;
  };
  success: boolean;
  notes?: string;
}

/**
 * Configuración por defecto para Lapa Casa Hostel - Habitación Flexible 7
 */
export const DEFAULT_FLEXIBLE_CONFIG: FlexibleRoomConfig = {
  roomId: 'room_flexible_7',
  roomName: 'Flexible 7',
  capacity: 7,
  defaultType: 'female',
  autoConvertHours: 48, // 48 horas antes del check-in
  manualOverride: true
};

/**
 * Clase para manejar la lógica de la habitación flexible
 */
export class FlexibleRoomLogic {
  private config: FlexibleRoomConfig;
  private conversionHistory: ConversionHistory[] = [];

  constructor(config: FlexibleRoomConfig = DEFAULT_FLEXIBLE_CONFIG) {
    this.config = config;
  }

  /**
   * Evalúa si la habitación flexible debería convertirse
   */
  public evaluateConversion(
    currentState: FlexibleRoomState,
    upcomingBookings: FlexibleBooking[],
    currentDate: Date = new Date()
  ): ConversionEvaluation {
    try {
      // 1. Verificar si hay override manual activo
      if (currentState.lockUntil && isAfter(currentState.lockUntil, currentDate)) {
        return this.createEvaluation(
          false,
          'Conversión bloqueada por override manual',
          100,
          [],
          { potentialGain: 0, potentialLoss: 0, netImpact: 0 },
          'KEEP_CURRENT'
        );
      }

      // 2. Evaluar reservas femeninas próximas
      const femaleBookingsNext48h = this.getFemaleBookingsInTimeframe(
        upcomingBookings,
        currentDate,
        this.config.autoConvertHours
      );

      // 3. Si hay reservas femeninas confirmadas, mantener como femenina
      if (femaleBookingsNext48h.confirmed.length > 0) {
        return this.createEvaluation(
          false,
          `${femaleBookingsNext48h.confirmed.length} reservas femeninas confirmadas en próximas ${this.config.autoConvertHours}h`,
          95,
          femaleBookingsNext48h.confirmed.map(b => b.id),
          this.calculateRevenueImpact(currentState, 'female'),
          'KEEP_CURRENT'
        );
      }

      // 4. Si hay reservas femeninas pendientes, evaluar tiempo restante
      if (femaleBookingsNext48h.pending.length > 0) {
        const earliestPending = femaleBookingsNext48h.pending
          .sort((a, b) => a.checkIn.getTime() - b.checkIn.getTime())[0];
        
        const hoursUntilCheckIn = (earliestPending.checkIn.getTime() - currentDate.getTime()) / (1000 * 60 * 60);
        
        if (hoursUntilCheckIn > 24) {
          return this.createEvaluation(
            false,
            `Reservas femeninas pendientes - esperar ${Math.round(hoursUntilCheckIn)}h más`,
            70,
            femaleBookingsNext48h.pending.map(b => b.id),
            this.calculateRevenueImpact(currentState, 'female'),
            'SCHEDULE_CONVERSION',
            addHours(currentDate, hoursUntilCheckIn - 24)
          );
        }
      }

      // 5. Evaluar demanda mixta potencial
      const mixedDemandScore = this.evaluateMixedDemand(currentState, upcomingBookings, currentDate);
      
      if (mixedDemandScore > 70) {
        return this.createEvaluation(
          true,
          `Alta demanda mixta detectada (score: ${mixedDemandScore})`,
          mixedDemandScore,
          [],
          this.calculateRevenueImpact(currentState, 'mixed'),
          'CONVERT_NOW'
        );
      }

      // 6. Conversión automática por tiempo
      if (currentState.currentType === 'female') {
        const nextFemaleBooking = this.getNextFemaleBooking(upcomingBookings, currentDate);
        
        if (!nextFemaleBooking) {
          return this.createEvaluation(
            true,
            'No hay reservas femeninas programadas - convertir a mixta para maximizar disponibilidad',
            80,
            [],
            this.calculateRevenueImpact(currentState, 'mixed'),
            'CONVERT_NOW'
          );
        }

        const hoursUntilNext = (nextFemaleBooking.checkIn.getTime() - currentDate.getTime()) / (1000 * 60 * 60);
        
        if (hoursUntilNext > this.config.autoConvertHours) {
          return this.createEvaluation(
            true,
            `Próxima reserva femenina en ${Math.round(hoursUntilNext)}h - convertir temporalmente`,
            85,
            [],
            this.calculateRevenueImpact(currentState, 'mixed'),
            'CONVERT_NOW'
          );
        }
      }

      // 7. Mantener estado actual por defecto
      return this.createEvaluation(
        false,
        'Condiciones actuales no justifican conversión',
        50,
        [],
        { potentialGain: 0, potentialLoss: 0, netImpact: 0 },
        'KEEP_CURRENT'
      );

    } catch (error) {
      console.error('Error evaluando conversión:', error);
      return this.createEvaluation(
        false,
        'Error en evaluación - mantener estado actual',
        0,
        [],
        { potentialGain: 0, potentialLoss: 0, netImpact: 0 },
        'MANUAL_REVIEW'
      );
    }
  }

  /**
   * Ejecuta la conversión de la habitación
   */
  public async executeConversion(
    currentState: FlexibleRoomState,
    targetType: 'female' | 'mixed',
    trigger: 'AUTOMATIC' | 'MANUAL' | 'DEMAND_BASED' = 'AUTOMATIC',
    notes?: string
  ): Promise<{
    success: boolean;
    newState: FlexibleRoomState;
    impactedBookings: string[];
    message: string;
  }> {
    try {
      // 1. Validar que la conversión es necesaria
      if (currentState.currentType === targetType) {
        return {
          success: false,
          newState: currentState,
          impactedBookings: [],
          message: `Habitación ya está configurada como ${targetType}`
        };
      }

      // 2. Verificar reservas que podrían verse afectadas
      const impactedBookings: string[] = [];
      
      if (targetType === 'female') {
        // Convertir a femenina - verificar reservas mixtas existentes
        const conflictingBookings = currentState.mixedBookings.filter(
          b => b.status === 'CONFIRMED' && b.guestType === 'mixed'
        );
        
        if (conflictingBookings.length > 0) {
          return {
            success: false,
            newState: currentState,
            impactedBookings: conflictingBookings.map(b => b.id),
            message: `No se puede convertir: ${conflictingBookings.length} reservas mixtas confirmadas`
          };
        }
      }

      // 3. Ejecutar conversión
      const newState: FlexibleRoomState = {
        ...currentState,
        currentType: targetType,
        isConverted: targetType !== this.config.defaultType,
        convertedAt: new Date(),
        nextScheduledConversion: undefined,
        lockUntil: undefined
      };

      // 4. Registrar en historial
      const historyEntry: ConversionHistory = {
        id: `conv_${Date.now()}_${currentState.roomId}`,
        roomId: currentState.roomId,
        convertedAt: new Date(),
        fromType: currentState.currentType,
        toType: targetType,
        trigger,
        beforeConversion: {
          femaleBookings: currentState.femaleBookings.length,
          mixedBookings: currentState.mixedBookings.length,
          occupancyRate: this.calculateOccupancyRate(currentState)
        },
        afterConversion: {
          newBookings: 0, // Se actualizará posteriormente
          cancelledBookings: impactedBookings.length,
          revenueImpact: 0 // Se calculará posteriormente
        },
        success: true,
        notes
      };

      this.conversionHistory.push(historyEntry);

      return {
        success: true,
        newState,
        impactedBookings,
        message: `Habitación convertida exitosamente de ${currentState.currentType} a ${targetType}`
      };

    } catch (error) {
      console.error('Error ejecutando conversión:', error);
      return {
        success: false,
        newState: currentState,
        impactedBookings: [],
        message: 'Error interno durante la conversión'
      };
    }
  }

  /**
   * Programa conversión automática para una fecha futura
   */
  public scheduleConversion(
    currentState: FlexibleRoomState,
    targetType: 'female' | 'mixed',
    scheduledFor: Date,
    reason: string
  ): FlexibleRoomState {
    return {
      ...currentState,
      nextScheduledConversion: scheduledFor
    };
  }

  /**
   * Bloquea conversión manual por tiempo determinado
   */
  public lockConversion(
    currentState: FlexibleRoomState,
    lockDurationHours: number,
    reason: string
  ): FlexibleRoomState {
    return {
      ...currentState,
      lockUntil: addHours(new Date(), lockDurationHours)
    };
  }

  /**
   * Obtiene reservas femeninas en ventana de tiempo específica
   */
  private getFemaleBookingsInTimeframe(
    bookings: FlexibleBooking[],
    fromDate: Date,
    hours: number
  ): { confirmed: FlexibleBooking[]; pending: FlexibleBooking[] } {
    const endDate = addHours(fromDate, hours);
    
    const relevantBookings = bookings.filter(booking =>
      booking.guestType === 'female' &&
      booking.checkIn >= fromDate &&
      booking.checkIn <= endDate
    );

    return {
      confirmed: relevantBookings.filter(b => b.status === 'CONFIRMED'),
      pending: relevantBookings.filter(b => b.status === 'PENDING')
    };
  }

  /**
   * Encuentra la próxima reserva femenina
   */
  private getNextFemaleBooking(
    bookings: FlexibleBooking[],
    fromDate: Date
  ): FlexibleBooking | null {
    const futureBookings = bookings
      .filter(b => 
        b.guestType === 'female' && 
        b.checkIn >= fromDate &&
        b.status !== 'CANCELLED'
      )
      .sort((a, b) => a.checkIn.getTime() - b.checkIn.getTime());

    return futureBookings.length > 0 ? futureBookings[0] : null;
  }

  /**
   * Evalúa demanda mixta basada en patrones históricos y tendencias
   */
  private evaluateMixedDemand(
    currentState: FlexibleRoomState,
    upcomingBookings: FlexibleBooking[],
    currentDate: Date
  ): number {
    let score = 0;

    // Factor 1: Reservas mixtas pendientes (40% del score)
    const pendingMixed = upcomingBookings.filter(
      b => b.guestType === 'mixed' && b.status === 'PENDING'
    ).length;
    score += Math.min(pendingMixed * 10, 40);

    // Factor 2: Ocupación actual de habitaciones mixtas (30% del score)
    const mixedRoomOccupancy = this.estimateMixedRoomOccupancy(currentDate);
    if (mixedRoomOccupancy > 0.8) score += 30;
    else if (mixedRoomOccupancy > 0.6) score += 20;
    else if (mixedRoomOccupancy > 0.4) score += 10;

    // Factor 3: Día de la semana (20% del score)
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek >= 5 || dayOfWeek === 0) { // Viernes, sábado, domingo
      score += 20;
    } else if (dayOfWeek >= 3) { // Miércoles, jueves
      score += 10;
    }

    // Factor 4: Temporada alta (10% del score)
    if (this.isHighSeason(currentDate)) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  /**
   * Estima ocupación de habitaciones mixtas (simplificado)
   */
  private estimateMixedRoomOccupancy(date: Date): number {
    // En implementación real, consultar base de datos
    // Por ahora, estimación basada en día de semana
    const dayOfWeek = date.getDay();
    
    if (dayOfWeek >= 5 || dayOfWeek === 0) return 0.85; // Fin de semana
    if (dayOfWeek >= 3) return 0.65; // Miércoles-jueves
    return 0.45; // Lunes-martes
  }

  /**
   * Verifica si es temporada alta
   */
  private isHighSeason(date: Date): boolean {
    const month = date.getMonth(); // 0-11
    // Temporada alta: Diciembre-Marzo (verano brasileño)
    return month >= 11 || month <= 2;
  }

  /**
   * Calcula impacto financiero de la conversión
   */
  private calculateRevenueImpact(
    currentState: FlexibleRoomState,
    targetType: 'female' | 'mixed'
  ): { potentialGain: number; potentialLoss: number; netImpact: number } {
    const basePrice = 60; // BRL por noche
    
    // Estimación simplificada
    if (targetType === 'mixed') {
      // Convertir a mixta generalmente aumenta demanda
      const potentialGain = basePrice * 7 * 0.3; // 30% más ocupación estimada
      const potentialLoss = 0; // Sin pérdidas directas
      
      return {
        potentialGain,
        potentialLoss,
        netImpact: potentialGain - potentialLoss
      };
    } else {
      // Convertir a femenina puede reducir demanda general
      const potentialGain = basePrice * 7 * 0.1; // 10% premium femenino
      const potentialLoss = basePrice * 7 * 0.2; // 20% menos demanda general
      
      return {
        potentialGain,
        potentialLoss,
        netImpact: potentialGain - potentialLoss
      };
    }
  }

  /**
   * Calcula tasa de ocupación actual
   */
  private calculateOccupancyRate(state: FlexibleRoomState): number {
    const totalBookings = state.totalBookings.filter(b => b.status === 'CONFIRMED');
    if (totalBookings.length === 0) return 0;
    
    const totalBeds = totalBookings.reduce((sum, b) => sum + b.bedsCount, 0);
    return (totalBeds / this.config.capacity) * 100;
  }

  /**
   * Crea objeto de evaluación estándar
   */
  private createEvaluation(
    shouldConvert: boolean,
    reason: string,
    confidence: number,
    impactedBookings: string[],
    revenueImpact: { potentialGain: number; potentialLoss: number; netImpact: number },
    recommendedAction: 'CONVERT_NOW' | 'SCHEDULE_CONVERSION' | 'KEEP_CURRENT' | 'MANUAL_REVIEW',
    timeUntilConversion?: Date
  ): ConversionEvaluation {
    return {
      shouldConvert,
      reason,
      confidence: Math.min(Math.max(confidence, 0), 100),
      timeUntilConversion,
      impactedBookings,
      revenueImpact,
      recommendedAction
    };
  }

  /**
   * Obtiene historial de conversiones
   */
  public getConversionHistory(): ConversionHistory[] {
    return [...this.conversionHistory];
  }

  /**
   * Analiza efectividad de conversiones pasadas
   */
  public analyzeConversionEffectiveness(): {
    totalConversions: number;
    successRate: number;
    averageRevenueImpact: number;
    mostCommonTrigger: string;
    recommendations: string[];
  } {
    const total = this.conversionHistory.length;
    if (total === 0) {
      return {
        totalConversions: 0,
        successRate: 0,
        averageRevenueImpact: 0,
        mostCommonTrigger: 'N/A',
        recommendations: ['Insuficiente historial para análisis']
      };
    }

    const successful = this.conversionHistory.filter(h => h.success).length;
    const successRate = (successful / total) * 100;
    
    const averageRevenue = this.conversionHistory.reduce(
      (sum, h) => sum + h.afterConversion.revenueImpact, 0
    ) / total;

    const triggerCounts = this.conversionHistory.reduce((acc, h) => {
      acc[h.trigger] = (acc[h.trigger] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostCommonTrigger = Object.entries(triggerCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A';

    const recommendations: string[] = [];
    
    if (successRate < 70) {
      recommendations.push('Mejorar criterios de evaluación para conversiones');
    }
    
    if (averageRevenue < 0) {
      recommendations.push('Revisar impacto financiero de conversiones automáticas');
    }
    
    if (mostCommonTrigger === 'MANUAL') {
      recommendations.push('Considerar automatizar más conversiones basadas en demanda');
    }

    return {
      totalConversions: total,
      successRate,
      averageRevenueImpact: averageRevenue,
      mostCommonTrigger,
      recommendations
    };
  }

  /**
   * Simula comportamiento de la habitación flexible en diferentes escenarios
   */
  public simulateFlexibleRoomScenarios(
    scenarios: Array<{
      name: string;
      femaleBookings: number;
      mixedDemand: number;
      seasonMultiplier: number;
      dayOfWeek: number;
    }>
  ): Array<{
    scenarioName: string;
    evaluation: ConversionEvaluation;
    recommendedState: 'female' | 'mixed';
    expectedRevenue: number;
  }> {
    return scenarios.map(scenario => {
      // Crear estado simulado
      const mockState: FlexibleRoomState = {
        roomId: this.config.roomId,
        currentType: 'female',
        isConverted: false,
        femaleBookings: Array(scenario.femaleBookings).fill(null).map((_, i) => ({
          id: `female_${i}`,
          checkIn: addHours(new Date(), 24 + i * 24),
          checkOut: addHours(new Date(), 48 + i * 24),
          bedsCount: Math.ceil(Math.random() * 3),
          guestType: 'female' as const,
          status: 'CONFIRMED' as const,
          createdAt: new Date(),
          guestEmail: `female${i}@test.com`
        })),
        mixedBookings: [],
        totalBookings: []
      };

      mockState.totalBookings = [...mockState.femaleBookings, ...mockState.mixedBookings];

      // Evaluar conversión
      const evaluation = this.evaluateConversion(mockState, mockState.totalBookings);
      
      return {
        scenarioName: scenario.name,
        evaluation,
        recommendedState: evaluation.shouldConvert ? 'mixed' : 'female',
        expectedRevenue: evaluation.revenueImpact.netImpact + (this.config.capacity * 60 * scenario.seasonMultiplier)
      };
    });
  }

  /**
   * Obtiene métricas de rendimiento de la habitación flexible
   */
  public getFlexibleRoomMetrics(
    state: FlexibleRoomState,
    dateRange: { from: Date; to: Date }
  ): {
    utilizationRate: number;
    conversionFrequency: number;
    revenueOptimization: number;
    guestSatisfaction: number;
    recommendations: string[];
  } {
    const relevantHistory = this.conversionHistory.filter(h =>
      h.convertedAt >= dateRange.from && h.convertedAt <= dateRange.to
    );

    const totalDays = Math.ceil(
      (dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)
    );

    const utilizationRate = state.totalBookings.length > 0 
      ? (state.totalBookings.reduce((sum, b) => sum + b.bedsCount, 0) / (this.config.capacity * totalDays)) * 100
      : 0;

    const conversionFrequency = relevantHistory.length / Math.max(totalDays, 1);

    const avgRevenueImpact = relevantHistory.length > 0
      ? relevantHistory.reduce((sum, h) => sum + h.afterConversion.revenueImpact, 0) / relevantHistory.length
      : 0;

    const revenueOptimization = Math.max(0, Math.min(100, 50 + avgRevenueImpact));

    // Estimación de satisfacción basada en cancelaciones post-conversión
    const cancelledAfterConversion = relevantHistory.reduce(
      (sum, h) => sum + h.afterConversion.cancelledBookings, 0
    );
    const guestSatisfaction = Math.max(0, 100 - (cancelledAfterConversion * 10));

    const recommendations: string[] = [];

    if (utilizationRate < 60) {
      recommendations.push('Considerar estrategias más agresivas de conversión para mejorar ocupación');
    }

    if (conversionFrequency > 0.5) {
      recommendations.push('Frecuencia de conversión alta - evaluar estabilidad de preferencias');
    }

    if (revenueOptimization < 40) {
      recommendations.push('Optimización de revenue baja - revisar criterios de conversión');
    }

    if (guestSatisfaction < 80) {
      recommendations.push('Satisfacción de huéspedes afectada - comunicar mejor cambios de habitación');
    }

    return {
      utilizationRate,
      conversionFrequency,
      revenueOptimization,
      guestSatisfaction,
      recommendations
    };
  }

  /**
   * Predicción de ocupación futura basada en patrones históricos
   */
  public predictFutureOccupancy(
    currentState: FlexibleRoomState,
    daysAhead: number = 30
  ): Array<{
    date: Date;
    predictedType: 'female' | 'mixed';
    occupancyRate: number;
    confidence: number;
  }> {
    const predictions: Array<{
      date: Date;
      predictedType: 'female' | 'mixed';
      occupancyRate: number;
      confidence: number;
    }> = [];

    const currentDate = new Date();

    for (let day = 1; day <= daysAhead; day++) {
      const targetDate = new Date(currentDate);
      targetDate.setDate(targetDate.getDate() + day);

      const dayOfWeek = targetDate.getDay();
      const isHighSeason = this.isHighSeason(targetDate);

      // Predicción simplificada basada en patrones
      let baseOccupancy = 0.4; // 40% base

      // Ajuste por día de semana
      if (dayOfWeek >= 5 || dayOfWeek === 0) baseOccupancy += 0.3; // Fin de semana
      else if (dayOfWeek >= 3) baseOccupancy += 0.15; // Miércoles-jueves

      // Ajuste por temporada
      if (isHighSeason) baseOccupancy += 0.2;

      // Predicción de tipo de habitación
      const femalePreference = this.predictFemalePreference(targetDate);
      const predictedType: 'female' | 'mixed' = femalePreference > 0.6 ? 'female' : 'mixed';

      // Ajuste de ocupación según tipo
      if (predictedType === 'mixed') baseOccupancy += 0.1;

      const occupancyRate = Math.min(1, Math.max(0, baseOccupancy));
      const confidence = Math.max(60, 90 - day * 1.5); // Confianza decrece con el tiempo

      predictions.push({
        date: targetDate,
        predictedType,
        occupancyRate: occupancyRate * 100,
        confidence
      });
    }

    return predictions;
  }

  /**
   * Predice preferencia femenina basada en patrones históricos
   */
  private predictFemalePreference(date: Date): number {
    const dayOfWeek = date.getDay();
    const month = date.getMonth();

    let femalePreference = 0.4; // Base 40%

    // Días laborables tienden a tener más preferencia femenina
    if (dayOfWeek >= 1 && dayOfWeek <= 4) femalePreference += 0.2;

    // Ciertos meses tienen más demanda femenina (eventos, temporadas)
    if (month === 2 || month === 6) femalePreference += 0.1; // Marzo, Julio

    return Math.min(1, Math.max(0, femalePreference));
  }

  /**
   * Actualiza configuración de la habitación flexible
   */
  public updateConfig(newConfig: Partial<FlexibleRoomConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Obtiene configuración actual
   */
  public getConfig(): FlexibleRoomConfig {
    return { ...this.config };
  }

  /**
   * Resetea historial de conversiones (útil para testing)
   */
  public resetHistory(): void {
    this.conversionHistory = [];
  }

  /**
   * Exporta datos para análisis externo
   */
  public exportAnalyticsData(): {
    config: FlexibleRoomConfig;
    history: ConversionHistory[];
    summary: {
      totalConversions: number;
      successRate: number;
      averageRevenueImpact: number;
      mostCommonTrigger: string;
    };
  } {
    const analysis = this.analyzeConversionEffectiveness();
    
    return {
      config: this.config,
      history: this.conversionHistory,
      summary: {
        totalConversions: analysis.totalConversions,
        successRate: analysis.successRate,
        averageRevenueImpact: analysis.averageRevenueImpact,
        mostCommonTrigger: analysis.mostCommonTrigger
      }
    };
  }
}
