// src/lib/analytics/conversion-tracking.ts

interface ConversionGoal {
  id: string;
  name: string;
  type: 'booking' | 'payment' | 'engagement' | 'custom';
  value?: number;
  description: string;
  isActive: boolean;
}

interface ConversionEvent {
  goalId: string;
  sessionId: string;
  userId?: string;
  value: number;
  currency: string;
  timestamp: number;
  properties: Record<string, any>;
  attribution: {
    source: string;
    medium: string;
    campaign?: string;
    firstTouch: boolean;
    lastTouch: boolean;
  };
}

interface FunnelStep {
  id: string;
  name: string;
  required: boolean;
  order: number;
  expectedConversionRate: number;
}

interface FunnelAnalysis {
  sessionId: string;
  steps: Array<{
    stepId: string;
    completed: boolean;
    timestamp?: number;
    timeSpent?: number;
    dropOff?: boolean;
  }>;
  conversionRate: number;
  totalTime: number;
  bottleneckStep?: string;
}

export class ConversionTracker {
  private readonly goals: Map<string, ConversionGoal> = new Map();
  private readonly funnelSteps: FunnelStep[] = [];
  private conversions: ConversionEvent[] = [];
  private currentFunnel: FunnelAnalysis | null = null;
  private attributionData: any = null;

  constructor() {
    this.initializeGoals();
    this.initializeFunnel();
    this.loadAttributionData();
  }

  // Inicializar objetivos de conversión específicos de Lapa Casa Hostel
  private initializeGoals(): void {
    const defaultGoals: ConversionGoal[] = [
      {
        id: 'booking_completed',
        name: 'Reserva Completada',
        type: 'booking',
        value: 100,
        description: 'Usuario completó el proceso de reserva y pago',
        isActive: true
      },
      {
        id: 'deposit_payment',
        name: 'Pago de Depósito',
        type: 'payment',
        value: 50,
        description: 'Usuario realizó el pago de depósito',
        isActive: true
      },
      {
        id: 'remaining_payment',
        name: 'Pago Restante',
        type: 'payment',
        value: 75,
        description: 'Usuario completó el pago restante',
        isActive: true
      },
      {
        id: 'room_selection',
        name: 'Selección de Habitación',
        type: 'engagement',
        value: 25,
        description: 'Usuario seleccionó una habitación específica',
        isActive: true
      },
      {
        id: 'guest_info_completed',
        name: 'Información de Huésped Completada',
        type: 'engagement',
        value: 40,
        description: 'Usuario completó formulario de información',
        isActive: true
      },
      {
        id: 'email_signup',
        name: 'Registro de Email',
        type: 'engagement',
        value: 15,
        description: 'Usuario se registró para newsletter',
        isActive: true
      },
      {
        id: 'group_booking',
        name: 'Reserva Grupal',
        type: 'booking',
        value: 150,
        description: 'Reserva para 7+ personas con descuento grupal',
        isActive: true
      },
      {
        id: 'repeat_booking',
        name: 'Reserva Repetida',
        type: 'booking',
        value: 120,
        description: 'Cliente realizó segunda reserva o más',
        isActive: true
      }
    ];

    defaultGoals.forEach(goal => {
      this.goals.set(goal.id, goal);
    });
  }

  // Inicializar funnel de conversión
  private initializeFunnel(): void {
    this.funnelSteps = [
      {
        id: 'landing',
        name: 'Página de Aterrizaje',
        required: true,
        order: 1,
        expectedConversionRate: 100
      },
      {
        id: 'availability_search',
        name: 'Búsqueda de Disponibilidad',
        required: true,
        order: 2,
        expectedConversionRate: 60
      },
      {
        id: 'room_selection',
        name: 'Selección de Habitación',
        required: true,
        order: 3,
        expectedConversionRate: 40
      },
      {
        id: 'guest_information',
        name: 'Información del Huésped',
        required: true,
        order: 4,
        expectedConversionRate: 25
      },
      {
        id: 'payment_process',
        name: 'Proceso de Pago',
        required: true,
        order: 5,
        expectedConversionRate: 15
      },
      {
        id: 'booking_confirmation',
        name: 'Confirmación de Reserva',
        required: true,
        order: 6,
        expectedConversionRate: 12
      }
    ];
  }

  // Cargar datos de atribución
  private loadAttributionData(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const utmSource = urlParams.get('utm_source');
    const utmMedium = urlParams.get('utm_medium');
    const utmCampaign = urlParams.get('utm_campaign');
    const referrer = document.referrer;

    this.attributionData = {
      source: utmSource || this.getSourceFromReferrer(referrer) || 'direct',
      medium: utmMedium || this.getMediumFromReferrer(referrer) || 'none',
      campaign: utmCampaign || '',
      referrer: referrer,
      landingPage: window.location.pathname,
      timestamp: Date.now()
    };

    // Guardar en sessionStorage para persistencia
    sessionStorage.setItem('attribution_data', JSON.stringify(this.attributionData));
  }

  private getSourceFromReferrer(referrer: string): string {
    if (!referrer) return 'direct';
    
    const domain = new URL(referrer).hostname;
    
    if (domain.includes('google')) return 'google';
    if (domain.includes('facebook')) return 'facebook';
    if (domain.includes('instagram')) return 'instagram';
    if (domain.includes('booking')) return 'booking';
    if (domain.includes('airbnb')) return 'airbnb';
    if (domain.includes('hostelworld')) return 'hostelworld';
    
    return 'referral';
  }

  private getMediumFromReferrer(referrer: string): string {
    if (!referrer) return 'none';
    
    const domain = new URL(referrer).hostname;
    
    if (domain.includes('google') || domain.includes('bing')) return 'organic';
    if (domain.includes('facebook') || domain.includes('instagram')) return 'social';
    if (domain.includes('booking') || domain.includes('airbnb')) return 'ota';
    
    return 'referral';
  }

  // Iniciar tracking de funnel
  startFunnelTracking(sessionId: string): void {
    this.currentFunnel = {
      sessionId,
      steps: this.funnelSteps.map(step => ({
        stepId: step.id,
        completed: false
      })),
      conversionRate: 0,
      totalTime: 0
    };

    this.trackFunnelStep('landing');
  }

  // Trackear paso específico del funnel
  trackFunnelStep(stepId: string, additionalData: Record<string, any> = {}): void {
    if (!this.currentFunnel) {
      console.warn('Funnel tracking no iniciado');
      return;
    }

    const stepIndex = this.currentFunnel.steps.findIndex(s => s.stepId === stepId);
    if (stepIndex === -1) {
      console.warn('Paso de funnel no encontrado:', stepId);
      return;
    }

    const step = this.currentFunnel.steps[stepIndex];
    const timestamp = Date.now();

    // Marcar paso como completado
    step.completed = true;
    step.timestamp = timestamp;

    // Calcular tiempo gastado en el paso anterior
    if (stepIndex > 0) {
      const previousStep = this.currentFunnel.steps[stepIndex - 1];
      if (previousStep.timestamp) {
        step.timeSpent = timestamp - previousStep.timestamp;
      }
    }

    // Actualizar métricas del funnel
    this.updateFunnelMetrics();

    // Trackear evento
    this.trackEvent('funnel_step_completed', {
      step_id: stepId,
      step_order: stepIndex + 1,
      step_name: this.funnelSteps.find(s => s.id === stepId)?.name || stepId,
      time_spent: step.timeSpent || 0,
      total_funnel_time: timestamp - (this.currentFunnel.steps[0].timestamp || timestamp),
      ...additionalData
    });
  }

  // Actualizar métricas del funnel
  private updateFunnelMetrics(): void {
    if (!this.currentFunnel) return;

    const completedSteps = this.currentFunnel.steps.filter(s => s.completed).length;
    const totalSteps = this.currentFunnel.steps.length;
    
    this.currentFunnel.conversionRate = (completedSteps / totalSteps) * 100;
    
    const firstStep = this.currentFunnel.steps[0];
    const lastCompletedStep = this.currentFunnel.steps
      .slice()
      .reverse()
      .find(s => s.completed);
    
    if (firstStep.timestamp && lastCompletedStep?.timestamp) {
      this.currentFunnel.totalTime = lastCompletedStep.timestamp - firstStep.timestamp;
    }

    // Identificar paso cuello de botella
    this.identifyBottleneck();
  }

  // Identificar paso cuello de botella
  private identifyBottleneck(): void {
    if (!this.currentFunnel) return;

    let maxDropOff = 0;
    let bottleneckStep = '';

    for (let i = 0; i < this.currentFunnel.steps.length - 1; i++) {
      const currentStep = this.currentFunnel.steps[i];
      const nextStep = this.currentFunnel.steps[i + 1];

      if (currentStep.completed && !nextStep.completed) {
        const expectedRate = this.funnelSteps[i + 1].expectedConversionRate;
        const actualRate = 0; // No completó el siguiente paso
        const dropOff = expectedRate - actualRate;

        if (dropOff > maxDropOff) {
          maxDropOff = dropOff;
          bottleneckStep = this.funnelSteps[i + 1].id;
        }
      }
    }

    this.currentFunnel.bottleneckStep = bottleneckStep;
  }

  // Trackear conversión específica
  trackConversion(goalId: string, value: number = 0, properties: Record<string, any> = {}): void {
    const goal = this.goals.get(goalId);
    if (!goal || !goal.isActive) {
      console.warn('Objetivo de conversión no encontrado o inactivo:', goalId);
      return;
    }

    const sessionId = this.currentFunnel?.sessionId || this.generateSessionId();
    const conversionValue = value || goal.value || 0;

    const conversion: ConversionEvent = {
      goalId,
      sessionId,
      value: conversionValue,
      currency: 'BRL',
      timestamp: Date.now(),
      properties,
      attribution: {
        source: this.attributionData?.source || 'unknown',
        medium: this.attributionData?.medium || 'unknown',
        campaign: this.attributionData?.campaign,
        firstTouch: this.isFirstTouchConversion(sessionId),
        lastTouch: true // Siempre es last touch para conversiones inmediatas
      }
    };

    this.conversions.push(conversion);

    // Trackear evento genérico
    this.trackEvent('conversion', {
      goal_id: goalId,
      goal_name: goal.name,
      goal_type: goal.type,
      conversion_value: conversionValue,
      currency: 'BRL',
      attribution_source: conversion.attribution.source,
      attribution_medium: conversion.attribution.medium,
      attribution_campaign: conversion.attribution.campaign,
      is_first_touch: conversion.attribution.firstTouch,
      session_id: sessionId,
      ...properties
    });

    // Enviar a sistemas externos
    this.sendConversionToExternalSystems(conversion, goal);
  }

  // Conversiones específicas del negocio

  // Reserva completada
  trackBookingConversion(data: {
    bookingId: string;
    totalValue: number;
    roomType: string;
    beds: number;
    nights: number;
    paymentMethod: string;
    isGroupBooking: boolean;
    isRepeatCustomer: boolean;
  }): void {
    // Conversión principal
    this.trackConversion('booking_completed', data.totalValue, {
      booking_id: data.bookingId,
      room_type: data.roomType,
      beds_count: data.beds,
      nights_count: data.nights,
      payment_method: data.paymentMethod,
      revenue_per_bed: data.totalValue / data.beds,
      average_night_rate: data.totalValue / data.nights
    });

    // Conversiones adicionales
    if (data.isGroupBooking) {
      this.trackConversion('group_booking', data.totalValue * 0.1, {
        booking_id: data.bookingId,
        group_size: data.beds
      });
    }

    if (data.isRepeatCustomer) {
      this.trackConversion('repeat_booking', data.totalValue * 0.05, {
        booking_id: data.bookingId,
        customer_type: 'repeat'
      });
    }

    // Completar funnel
    this.trackFunnelStep('booking_confirmation', {
      booking_id: data.bookingId,
      total_value: data.totalValue
    });
  }

  // Pago completado
  trackPaymentConversion(data: {
    bookingId: string;
    paymentType: 'deposit' | 'remaining';
    amount: number;
    paymentMethod: string;
  }): void {
    const goalId = data.paymentType === 'deposit' ? 'deposit_payment' : 'remaining_payment';
    
    this.trackConversion(goalId, data.amount, {
      booking_id: data.bookingId,
      payment_type: data.paymentType,
      payment_method: data.paymentMethod,
      amount: data.amount
    });
  }

  // Engagement conversions
  trackEngagementConversion(data: {
    type: 'room_selection' | 'guest_info_completed' | 'email_signup';
    value?: number;
    properties?: Record<string, any>;
  }): void {
    this.trackConversion(data.type, data.value, data.properties);
  }

  // Análisis y reportes

  // Obtener métricas de conversión
  getConversionMetrics(timeframe: 'day' | 'week' | 'month' = 'day'): {
    totalConversions: number;
    conversionRate: number;
    totalValue: number;
    averageValue: number;
    topGoals: Array<{ goalId: string; count: number; value: number }>;
  } {
    const now = Date.now();
    const timeframeMs = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000
    }[timeframe];

    const recentConversions = this.conversions.filter(
      c => c.timestamp >= now - timeframeMs
    );

    const totalConversions = recentConversions.length;
    const totalValue = recentConversions.reduce((sum, c) => sum + c.value, 0);
    const averageValue = totalConversions > 0 ? totalValue / totalConversions : 0;

    // Agrupar por objetivo
    const goalCounts = new Map<string, { count: number; value: number }>();
    recentConversions.forEach(c => {
      const existing = goalCounts.get(c.goalId) || { count: 0, value: 0 };
      goalCounts.set(c.goalId, {
        count: existing.count + 1,
        value: existing.value + c.value
      });
    });

    const topGoals = Array.from(goalCounts.entries())
      .map(([goalId, data]) => ({ goalId, ...data }))
      .sort((a, b) => b.value - a.value);

    return {
      totalConversions,
      conversionRate: 0, // Se calcularía con datos de tráfico total
      totalValue,
      averageValue,
      topGoals
    };
  }

  // Obtener análisis de atribución
  getAttributionAnalysis(): {
    sources: Map<string, { conversions: number; value: number; rate: number }>;
    mediums: Map<string, { conversions: number; value: number; rate: number }>;
    campaigns: Map<string, { conversions: number; value: number; rate: number }>;
  } {
    const sources = new Map();
    const mediums = new Map();
    const campaigns = new Map();

    this.conversions.forEach(conversion => {
      const { source, medium, campaign } = conversion.attribution;

      // Fuentes
      const sourceData = sources.get(source) || { conversions: 0, value: 0, rate: 0 };
      sourceData.conversions++;
      sourceData.value += conversion.value;
      sources.set(source, sourceData);

      // Medios
      const mediumData = mediums.get(medium) || { conversions: 0, value: 0, rate: 0 };
      mediumData.conversions++;
      mediumData.value += conversion.value;
      mediums.set(medium, mediumData);

      // Campañas
      if (campaign) {
        const campaignData = campaigns.get(campaign) || { conversions: 0, value: 0, rate: 0 };
        campaignData.conversions++;
        campaignData.value += conversion.value;
        campaigns.set(campaign, campaignData);
      }
    });

    return { sources, mediums, campaigns };
  }

  // Obtener análisis de funnel
  getFunnelAnalysis(): FunnelAnalysis | null {
    return this.currentFunnel;
  }

  // Utilidades privadas

  private isFirstTouchConversion(sessionId: string): boolean {
    return !this.conversions.some(c => c.sessionId === sessionId);
  }

  private generateSessionId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  private trackEvent(name: string, data: Record<string, any>): void {
    // Integración con sistema de eventos principal
    if (typeof window !== 'undefined' && (window as any).eventTracker) {
      (window as any).eventTracker.trackEvent(name, data);
    }
  }

  private async sendConversionToExternalSystems(conversion: ConversionEvent, goal: ConversionGoal): Promise<void> {
    try {
      // Enviar a servidor para persistencia
      await fetch('/api/analytics/conversions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ conversion, goal })
      });

      // Integrar con Google Analytics si está disponible
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'conversion', {
          transaction_id: conversion.sessionId,
          value: conversion.value,
          currency: conversion.currency,
          event_category: 'conversion',
          event_label: goal.name
        });
      }
    } catch (error) {
      console.error('Error enviando conversión a sistemas externos:', error);
    }
  }

  // Métodos públicos de configuración

  addCustomGoal(goal: ConversionGoal): void {
    this.goals.set(goal.id, goal);
  }

  updateGoal(goalId: string, updates: Partial<ConversionGoal>): void {
    const goal = this.goals.get(goalId);
    if (goal) {
      this.goals.set(goalId, { ...goal, ...updates });
    }
  }

  getGoals(): ConversionGoal[] {
    return Array.from(this.goals.values());
  }

  clearConversions(): void {
    this.conversions = [];
  }
}

// Singleton instance
export const conversionTracker = new ConversionTracker();
