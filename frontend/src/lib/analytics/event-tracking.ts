// src/lib/analytics/event-tracking.ts

interface EventData {
  [key: string]: string | number | boolean | null | undefined;
}

interface UserSession {
  sessionId: string;
  startTime: number;
  lastActivity: number;
  pageViews: number;
  events: string[];
  userAgent: string;
  referrer: string;
  landingPage: string;
}

interface BookingFunnel {
  sessionId: string;
  step: 'landing' | 'search' | 'selection' | 'guest_info' | 'payment' | 'confirmation';
  timestamp: number;
  data: EventData;
  duration?: number;
}

export class EventTracker {
  private session: UserSession;
  private bookingFunnel: BookingFunnel[] = [];
  private eventQueue: Array<{ name: string; data: EventData; timestamp: number }> = [];
  private isOnline = navigator.onLine;
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.session = this.initializeSession();
    this.setupEventListeners();
    this.startPeriodicFlush();
  }

  // Inicializar sesión de usuario
  private initializeSession(): UserSession {
    const sessionId = this.generateSessionId();
    const session: UserSession = {
      sessionId,
      startTime: Date.now(),
      lastActivity: Date.now(),
      pageViews: 0,
      events: [],
      userAgent: navigator.userAgent,
      referrer: document.referrer,
      landingPage: window.location.pathname
    };

    // Guardar en sessionStorage
    sessionStorage.setItem('analytics_session', JSON.stringify(session));
    return session;
  }

  private generateSessionId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  // Configurar event listeners
  private setupEventListeners(): void {
    // Actualizar actividad en eventos de usuario
    ['click', 'scroll', 'keydown', 'mousemove'].forEach(eventType => {
      document.addEventListener(eventType, () => {
        this.updateLastActivity();
      }, { passive: true });
    });

    // Tracking de cambios de página (SPA)
    window.addEventListener('popstate', () => {
      this.trackPageView();
    });

    // Detectar cambios de conectividad
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flushEvents();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Flush eventos antes de cerrar
    window.addEventListener('beforeunload', () => {
      this.flushEvents(true);
    });

    // Visibility API para pausar/resumir tracking
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.trackEvent('session_pause', {
          duration: Date.now() - this.session.lastActivity
        });
      } else {
        this.updateLastActivity();
        this.trackEvent('session_resume');
      }
    });
  }

  private updateLastActivity(): void {
    this.session.lastActivity = Date.now();
    this.saveSession();
  }

  private saveSession(): void {
    sessionStorage.setItem('analytics_session', JSON.stringify(this.session));
  }

  // Tracking de eventos específicos de Lapa Casa Hostel

  // Página vista
  trackPageView(pagePath?: string): void {
    const path = pagePath || window.location.pathname;
    this.session.pageViews++;
    
    this.trackEvent('page_view', {
      page_path: path,
      page_title: document.title,
      page_location: window.location.href,
      referrer: document.referrer,
      session_page_views: this.session.pageViews
    });

    this.updateLastActivity();
  }

  // Búsqueda de disponibilidad
  trackAvailabilitySearch(data: {
    checkIn: string;
    checkOut: string;
    beds: number;
    source: 'homepage' | 'booking_page' | 'mobile_app';
  }): void {
    this.trackEvent('availability_search', {
      check_in_date: data.checkIn,
      check_out_date: data.checkOut,
      beds_requested: data.beds,
      search_source: data.source,
      nights: this.calculateNights(data.checkIn, data.checkOut)
    });

    this.addToBookingFunnel('search', {
      check_in: data.checkIn,
      check_out: data.checkOut,
      beds: data.beds
    });
  }

  // Selección de habitación
  trackRoomSelection(data: {
    roomId: string;
    roomType: string;
    beds: number;
    basePrice: number;
    finalPrice: number;
    discountApplied?: number;
  }): void {
    this.trackEvent('room_selection', {
      room_id: data.roomId,
      room_type: data.roomType,
      beds_selected: data.beds,
      base_price: data.basePrice,
      final_price: data.finalPrice,
      discount_applied: data.discountApplied || 0,
      price_per_bed: data.finalPrice / data.beds
    });

    this.addToBookingFunnel('selection', {
      room_id: data.roomId,
      room_type: data.roomType,
      final_price: data.finalPrice
    });
  }

  // Interacción con calculadora de precios
  trackPriceCalculation(data: {
    roomType: string;
    beds: number;
    nights: number;
    basePrice: number;
    groupDiscount: number;
    seasonMultiplier: number;
    finalPrice: number;
  }): void {
    this.trackEvent('price_calculation', {
      room_type: data.roomType,
      beds_count: data.beds,
      nights_count: data.nights,
      base_price: data.basePrice,
      group_discount_percentage: data.groupDiscount * 100,
      season_multiplier: data.seasonMultiplier,
      final_price: data.finalPrice,
      savings_amount: (data.basePrice * data.beds * data.nights) - data.finalPrice
    });
  }

  // Formulario de información del huésped
  trackGuestInfoStep(data: {
    step: 'started' | 'completed' | 'abandoned';
    fieldsCompleted?: string[];
    timeSpent?: number;
    validationErrors?: string[];
  }): void {
    this.trackEvent('guest_info_step', {
      step_action: data.step,
      fields_completed: data.fieldsCompleted?.join(',') || '',
      time_spent_seconds: data.timeSpent || 0,
      validation_errors: data.validationErrors?.join(',') || '',
      fields_count: data.fieldsCompleted?.length || 0
    });

    if (data.step === 'completed') {
      this.addToBookingFunnel('guest_info', {
        fields_completed: data.fieldsCompleted?.length || 0,
        time_spent: data.timeSpent || 0
      });
    }
  }

  // Proceso de pago
  trackPaymentProcess(data: {
    step: 'started' | 'method_selected' | 'processing' | 'completed' | 'failed';
    paymentMethod?: 'stripe' | 'mercadopago';
    paymentType?: 'deposit' | 'remaining';
    amount?: number;
    errorCode?: string;
    processingTime?: number;
  }): void {
    this.trackEvent('payment_process', {
      payment_step: data.step,
      payment_method: data.paymentMethod || '',
      payment_type: data.paymentType || '',
      amount: data.amount || 0,
      currency: 'BRL',
      error_code: data.errorCode || '',
      processing_time_ms: data.processingTime || 0
    });

    if (data.step === 'started') {
      this.addToBookingFunnel('payment', {
        payment_method: data.paymentMethod,
        amount: data.amount
      });
    }
  }

  // Conversión completada
  trackBookingConversion(data: {
    bookingId: string;
    totalValue: number;
    roomType: string;
    beds: number;
    nights: number;
    paymentMethod: string;
    conversionTime: number;
  }): void {
    this.trackEvent('booking_conversion', {
      booking_id: data.bookingId,
      conversion_value: data.totalValue,
      room_type: data.roomType,
      beds_count: data.beds,
      nights_count: data.nights,
      payment_method: data.paymentMethod,
      conversion_time_seconds: data.conversionTime,
      funnel_steps: this.bookingFunnel.length,
      session_duration: Date.now() - this.session.startTime
    });

    this.addToBookingFunnel('confirmation', {
      booking_id: data.bookingId,
      total_value: data.totalValue
    });

    // Calcular métricas del funnel
    this.trackFunnelMetrics();
  }

  // Eventos de engagement

  // Tiempo en página
  trackTimeOnPage(pagePath: string, timeSpent: number): void {
    this.trackEvent('time_on_page', {
      page_path: pagePath,
      time_spent_seconds: timeSpent,
      engagement_level: this.calculateEngagementLevel(timeSpent)
    });
  }

  // Scroll depth
  trackScrollDepth(percentage: number): void {
    this.trackEvent('scroll_depth', {
      scroll_percentage: percentage,
      page_height: document.documentElement.scrollHeight,
      viewport_height: window.innerHeight
    });
  }

  // Clicks en elementos específicos
  trackElementClick(data: {
    elementType: string;
    elementId?: string;
    elementText?: string;
    pageLocation: string;
  }): void {
    this.trackEvent('element_click', {
      element_type: data.elementType,
      element_id: data.elementId || '',
      element_text: data.elementText || '',
      page_location: data.pageLocation,
      click_position_x: 0, // Se puede obtener del evento
      click_position_y: 0
    });
  }

  // Interacciones con formularios
  trackFormInteraction(data: {
    formName: string;
    action: 'focus' | 'blur' | 'change' | 'submit' | 'error';
    fieldName?: string;
    fieldValue?: string;
    errorMessage?: string;
  }): void {
    this.trackEvent('form_interaction', {
      form_name: data.formName,
      interaction_type: data.action,
      field_name: data.fieldName || '',
      field_value_length: data.fieldValue?.length || 0,
      error_message: data.errorMessage || ''
    });
  }

  // Errores y problemas

  // Errores de JavaScript
  trackJavaScriptError(error: Error): void {
    this.trackEvent('javascript_error', {
      error_message: error.message,
      error_stack: error.stack || '',
      page_path: window.location.pathname,
      user_agent: navigator.userAgent,
      timestamp: Date.now()
    });
  }

  // Errores de API
  trackApiError(data: {
    endpoint: string;
    method: string;
    statusCode: number;
    errorMessage: string;
    requestTime: number;
  }): void {
    this.trackEvent('api_error', {
      api_endpoint: data.endpoint,
      http_method: data.method,
      status_code: data.statusCode,
      error_message: data.errorMessage,
      request_time_ms: data.requestTime,
      page_path: window.location.pathname
    });
  }

  // Métodos de análisis del funnel

  private addToBookingFunnel(step: BookingFunnel['step'], data: EventData): void {
    const previousStep = this.bookingFunnel[this.bookingFunnel.length - 1];
    const duration = previousStep ? Date.now() - previousStep.timestamp : 0;

    this.bookingFunnel.push({
      sessionId: this.session.sessionId,
      step,
      timestamp: Date.now(),
      data,
      duration
    });
  }

  private trackFunnelMetrics(): void {
    const funnelData = this.bookingFunnel.reduce((acc, step, index) => {
      acc[`step_${index + 1}_${step.step}`] = step.duration || 0;
      return acc;
    }, {} as EventData);

    this.trackEvent('funnel_completion', {
      total_steps: this.bookingFunnel.length,
      total_time_seconds: (Date.now() - this.session.startTime) / 1000,
      conversion_rate: 1, // 100% ya que completó
      ...funnelData
    });
  }

  // Utilidades

  private calculateNights(checkIn: string, checkOut: string): number {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }

  private calculateEngagementLevel(timeSpent: number): string {
    if (timeSpent < 10) return 'low';
    if (timeSpent < 60) return 'medium';
    if (timeSpent < 300) return 'high';
    return 'very_high';
  }

  // Gestión de eventos

  private trackEvent(name: string, data: EventData = {}): void {
    const event = {
      name,
      data: {
        ...data,
        session_id: this.session.sessionId,
        timestamp: Date.now(),
        page_path: window.location.pathname,
        user_agent: navigator.userAgent
      },
      timestamp: Date.now()
    };

    this.eventQueue.push(event);
    this.session.events.push(name);
    this.saveSession();

    // Flush inmediato para eventos críticos
    if (this.isCriticalEvent(name)) {
      this.flushEvents();
    }
  }

  private isCriticalEvent(eventName: string): boolean {
    const criticalEvents = [
      'booking_conversion',
      'payment_process',
      'javascript_error',
      'api_error'
    ];
    return criticalEvents.includes(eventName);
  }

  private startPeriodicFlush(): void {
    this.flushInterval = setInterval(() => {
      if (this.isOnline && this.eventQueue.length > 0) {
        this.flushEvents();
      }
    }, 30000); // Flush cada 30 segundos
  }

  private async flushEvents(isBeforeUnload: boolean = false): Promise<void> {
    if (this.eventQueue.length === 0 || (!this.isOnline && !isBeforeUnload)) {
      return;
    }

    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];

    try {
      const payload = {
        session: this.session,
        events: eventsToSend,
        funnel: this.bookingFunnel,
        timestamp: Date.now()
      };

      if (isBeforeUnload) {
        // Usar sendBeacon para envío confiable al cerrar
        const blob = new Blob([JSON.stringify(payload)], {
          type: 'application/json'
        });
        navigator.sendBeacon('/api/analytics/events', blob);
      } else {
        // Envío normal con fetch
        await fetch('/api/analytics/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
      }

      console.log(`✅ ${eventsToSend.length} eventos enviados a analytics`);
    } catch (error) {
      console.error('❌ Error enviando eventos:', error);
      
      // Requeue eventos si falla el envío (excepto en beforeunload)
      if (!isBeforeUnload) {
        this.eventQueue.unshift(...eventsToSend);
      }
    }
  }

  // Métodos de configuración y estado

  setUserId(userId: string): void {
    this.session.sessionId = `${userId}_${this.session.sessionId}`;
    this.saveSession();
    
    this.trackEvent('user_identified', {
      user_id: userId,
      session_events_count: this.session.events.length
    });
  }

  getSessionData(): UserSession {
    return { ...this.session };
  }

  getFunnelData(): BookingFunnel[] {
    return [...this.bookingFunnel];
  }

  // Limpiar datos de sesión
  clearSession(): void {
    sessionStorage.removeItem('analytics_session');
    this.session = this.initializeSession();
    this.bookingFunnel = [];
    this.eventQueue = [];
  }

  // Pausar/reanudar tracking
  pauseTracking(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.trackEvent('tracking_paused');
  }

  resumeTracking(): void {
    if (!this.flushInterval) {
      this.startPeriodicFlush();
    }
    this.trackEvent('tracking_resumed');
  }

  // Obtener métricas de sesión
  getSessionMetrics(): {
    duration: number;
    pageViews: number;
    eventsCount: number;
    funnelProgress: number;
    engagementScore: number;
  } {
    const duration = Date.now() - this.session.startTime;
    const funnelProgress = this.bookingFunnel.length;
    const engagementScore = this.calculateEngagementScore();

    return {
      duration,
      pageViews: this.session.pageViews,
      eventsCount: this.session.events.length,
      funnelProgress,
      engagementScore
    };
  }

  private calculateEngagementScore(): number {
    const duration = Date.now() - this.session.startTime;
    const pageViews = this.session.pageViews;
    const events = this.session.events.length;
    const funnelProgress = this.bookingFunnel.length;

    // Algoritmo simple de engagement score (0-100)
    let score = 0;
    
    // Tiempo en sitio (max 30 puntos)
    score += Math.min(duration / (5 * 60 * 1000) * 30, 30);
    
    // Páginas vistas (max 25 puntos)
    score += Math.min(pageViews * 5, 25);
    
    // Eventos de interacción (max 25 puntos)
    score += Math.min(events * 2, 25);
    
    // Progreso en funnel (max 20 puntos)
    score += Math.min(funnelProgress * 4, 20);

    return Math.round(score);
  }

  // Destructor
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushEvents(true);
  }
}

// Singleton instance
export const eventTracker = new EventTracker();

// Hook para React
export function useEventTracking() {
  const [sessionMetrics, setSessionMetrics] = useState(eventTracker.getSessionMetrics());

  useEffect(() => {
    const interval = setInterval(() => {
      setSessionMetrics(eventTracker.getSessionMetrics());
    }, 10000); // Actualizar cada 10 segundos

    return () => clearInterval(interval);
  }, []);

  return {
    // Métodos de tracking
    trackPageView: eventTracker.trackPageView.bind(eventTracker),
    trackAvailabilitySearch: eventTracker.trackAvailabilitySearch.bind(eventTracker),
    trackRoomSelection: eventTracker.trackRoomSelection.bind(eventTracker),
    trackPriceCalculation: eventTracker.trackPriceCalculation.bind(eventTracker),
    trackGuestInfoStep: eventTracker.trackGuestInfoStep.bind(eventTracker),
    trackPaymentProcess: eventTracker.trackPaymentProcess.bind(eventTracker),
    trackBookingConversion: eventTracker.trackBookingConversion.bind(eventTracker),
    trackTimeOnPage: eventTracker.trackTimeOnPage.bind(eventTracker),
    trackScrollDepth: eventTracker.trackScrollDepth.bind(eventTracker),
    trackElementClick: eventTracker.trackElementClick.bind(eventTracker),
    trackFormInteraction: eventTracker.trackFormInteraction.bind(eventTracker),
    trackJavaScriptError: eventTracker.trackJavaScriptError.bind(eventTracker),
    trackApiError: eventTracker.trackApiError.bind(eventTracker),
    
    // Estado y configuración
    setUserId: eventTracker.setUserId.bind(eventTracker),
    getSessionData: eventTracker.getSessionData.bind(eventTracker),
    getFunnelData: eventTracker.getFunnelData.bind(eventTracker),
    clearSession: eventTracker.clearSession.bind(eventTracker),
    pauseTracking: eventTracker.pauseTracking.bind(eventTracker),
    resumeTracking: eventTracker.resumeTracking.bind(eventTracker),
    
    // Métricas
    sessionMetrics
  };
}

// Componente HOC para tracking automático
export function withEventTracking<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  eventName: string,
  getEventData?: (props: P) => EventData
) {
  return function EventTrackedComponent(props: P) {
    useEffect(() => {
      const eventData = getEventData ? getEventData(props) : {};
      eventTracker.trackEvent(eventName, eventData);
    }, []);

    return <WrappedComponent {...props} />;
  };
}
