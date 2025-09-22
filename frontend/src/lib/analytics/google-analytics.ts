// src/lib/analytics/google-analytics.ts

interface GAEvent {
  action: string;
  category: string;
  label?: string;
  value?: number;
  custom_parameters?: Record<string, any>;
}

interface BookingEvent {
  booking_id: string;
  room_type: string;
  beds_count: number;
  total_price: number;
  currency: string;
  check_in_date: string;
  check_out_date: string;
  guest_country: string;
  payment_method: string;
  group_discount?: number;
  season_multiplier?: number;
}

interface ConversionEvent {
  funnel_step: string;
  page_path: string;
  user_type: 'new' | 'returning';
  traffic_source: string;
  device_type: string;
  session_duration?: number;
}

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

export class GoogleAnalytics {
  private readonly GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';
  private readonly GA_DEBUG_MODE = process.env.NODE_ENV === 'development';
  private isInitialized = false;
  private userId: string | null = null;
  private sessionId: string | null = null;

  constructor() {
    this.initializeGA();
  }

  // Inicializar Google Analytics
  private async initializeGA(): Promise<void> {
    if (typeof window === 'undefined' || !this.GA_MEASUREMENT_ID) {
      console.warn('Google Analytics no configurado correctamente');
      return;
    }

    try {
      // Cargar script de GA4
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${this.GA_MEASUREMENT_ID}`;
      document.head.appendChild(script);

      // Inicializar dataLayer
      window.dataLayer = window.dataLayer || [];
      window.gtag = function(...args: any[]) {
        window.dataLayer.push(args);
      };

      // Configurar GA4
      window.gtag('js', new Date());
      window.gtag('config', this.GA_MEASUREMENT_ID, {
        debug_mode: this.GA_DEBUG_MODE,
        send_page_view: false, // Manejamos page views manualmente
        anonymize_ip: true,
        allow_google_signals: true,
        allow_ad_personalization_signals: false
      });

      this.generateSessionId();
      this.isInitialized = true;
      
      console.log('Google Analytics inicializado correctamente');
    } catch (error) {
      console.error('Error inicializando Google Analytics:', error);
    }
  }

  // Generar ID de sesión único
  private generateSessionId(): void {
    this.sessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  // Configurar usuario
  setUserId(userId: string): void {
    this.userId = userId;
    if (this.isInitialized) {
      window.gtag('config', this.GA_MEASUREMENT_ID, {
        user_id: userId
      });
    }
  }

  // Evento de página vista
  trackPageView(pagePath: string, pageTitle?: string): void {
    if (!this.isInitialized) return;

    window.gtag('event', 'page_view', {
      page_path: pagePath,
      page_title: pageTitle || document.title,
      page_location: window.location.href,
      session_id: this.sessionId,
      user_id: this.userId
    });

    console.log('Page view tracked:', pagePath);
  }

  // Eventos de booking específicos para Lapa Casa Hostel

  // Inicio del proceso de reserva
  trackBookingStarted(data: {
    room_type: string;
    beds_count: number;
    check_in_date: string;
    check_out_date: string;
    guest_country?: string;
  }): void {
    this.trackEvent({
      action: 'booking_started',
      category: 'booking',
      label: data.room_type,
      custom_parameters: {
        room_type: data.room_type,
        beds_count: data.beds_count,
        check_in_date: data.check_in_date,
        check_out_date: data.check_out_date,
        guest_country: data.guest_country || 'unknown',
        session_id: this.sessionId
      }
    });
  }

  // Selección de habitación
  trackRoomSelected(data: {
    room_id: string;
    room_type: string;
    beds_count: number;
    base_price: number;
    total_price: number;
  }): void {
    this.trackEvent({
      action: 'room_selected',
      category: 'booking',
      label: data.room_type,
      value: data.total_price,
      custom_parameters: {
        room_id: data.room_id,
        room_type: data.room_type,
        beds_count: data.beds_count,
        base_price: data.base_price,
        total_price: data.total_price,
        currency: 'BRL'
      }
    });
  }

  // Aplicación de descuento de grupo
  trackGroupDiscountApplied(data: {
    original_price: number;
    discounted_price: number;
    discount_percentage: number;
    beds_count: number;
  }): void {
    this.trackEvent({
      action: 'group_discount_applied',
      category: 'pricing',
      label: `${data.discount_percentage}% descuento`,
      value: data.original_price - data.discounted_price,
      custom_parameters: {
        original_price: data.original_price,
        discounted_price: data.discounted_price,
        discount_percentage: data.discount_percentage,
        beds_count: data.beds_count,
        savings_amount: data.original_price - data.discounted_price
      }
    });
  }

  // Inicio del proceso de pago
  trackPaymentStarted(data: {
    booking_id: string;
    payment_method: 'stripe' | 'mercadopago';
    amount: number;
    payment_type: 'deposit' | 'remaining';
  }): void {
    this.trackEvent({
      action: 'payment_started',
      category: 'payment',
      label: data.payment_method,
      value: data.amount,
      custom_parameters: {
        booking_id: data.booking_id,
        payment_method: data.payment_method,
        amount: data.amount,
        payment_type: data.payment_type,
        currency: 'BRL'
      }
    });
  }

  // Pago completado exitosamente
  trackPaymentCompleted(data: BookingEvent): void {
    // Evento de conversión estándar de GA4
    window.gtag('event', 'purchase', {
      transaction_id: data.booking_id,
      value: data.total_price,
      currency: data.currency,
      items: [{
        item_id: data.booking_id,
        item_name: `${data.room_type} - ${data.beds_count} camas`,
        item_category: 'hostel_booking',
        item_variant: data.room_type,
        quantity: data.beds_count,
        price: data.total_price
      }],
      // Parámetros personalizados
      booking_id: data.booking_id,
      room_type: data.room_type,
      beds_count: data.beds_count,
      check_in_date: data.check_in_date,
      check_out_date: data.check_out_date,
      guest_country: data.guest_country,
      payment_method: data.payment_method,
      group_discount: data.group_discount || 0,
      season_multiplier: data.season_multiplier || 1
    });

    // Evento personalizado adicional
    this.trackEvent({
      action: 'booking_completed',
      category: 'conversion',
      label: data.room_type,
      value: data.total_price,
      custom_parameters: {
        booking_id: data.booking_id,
        conversion_value: data.total_price,
        booking_source: 'direct_website'
      }
    });
  }

  // Abandono del carrito/reserva
  trackBookingAbandoned(data: {
    step: 'room_selection' | 'guest_info' | 'payment';
    room_type?: string;
    beds_count?: number;
    estimated_value?: number;
    time_spent: number;
  }): void {
    this.trackEvent({
      action: 'booking_abandoned',
      category: 'booking',
      label: data.step,
      value: data.estimated_value,
      custom_parameters: {
        abandonment_step: data.step,
        room_type: data.room_type,
        beds_count: data.beds_count,
        time_spent_seconds: data.time_spent,
        session_id: this.sessionId
      }
    });
  }

  // Eventos de engagement

  // Búsqueda de disponibilidad
  trackAvailabilitySearch(data: {
    check_in_date: string;
    check_out_date: string;
    beds_count: number;
    available_rooms: number;
  }): void {
    this.trackEvent({
      action: 'availability_search',
      category: 'engagement',
      custom_parameters: {
        check_in_date: data.check_in_date,
        check_out_date: data.check_out_date,
        beds_requested: data.beds_count,
        rooms_available: data.available_rooms,
        search_successful: data.available_rooms > 0
      }
    });
  }

  // Interacción con calculadora de precios
  trackPriceCalculation(data: {
    room_type: string;
    beds_count: number;
    nights: number;
    base_price: number;
    final_price: number;
    discounts_applied: string[];
  }): void {
    this.trackEvent({
      action: 'price_calculation',
      category: 'engagement',
      value: data.final_price,
      custom_parameters: {
        room_type: data.room_type,
        beds_count: data.beds_count,
        nights: data.nights,
        base_price: data.base_price,
        final_price: data.final_price,
        discounts_applied: data.discounts_applied.join(','),
        price_per_bed: data.final_price / data.beds_count
      }
    });
  }

  // Visualización de galería de fotos
  trackPhotoGalleryView(data: {
    room_type: string;
    photo_count: number;
    time_spent: number;
  }): void {
    this.trackEvent({
      action: 'photo_gallery_viewed',
      category: 'engagement',
      label: data.room_type,
      custom_parameters: {
        room_type: data.room_type,
        photos_viewed: data.photo_count,
        time_spent_seconds: data.time_spent
      }
    });
  }

  // Eventos de error y problemas

  // Error de pago
  trackPaymentError(data: {
    booking_id: string;
    payment_method: string;
    error_code: string;
    error_message: string;
    amount: number;
  }): void {
    this.trackEvent({
      action: 'payment_error',
      category: 'error',
      label: data.error_code,
      custom_parameters: {
        booking_id: data.booking_id,
        payment_method: data.payment_method,
        error_code: data.error_code,
        error_message: data.error_message,
        amount: data.amount,
        currency: 'BRL'
      }
    });
  }

  // Error de disponibilidad
  trackAvailabilityError(data: {
    check_in_date: string;
    check_out_date: string;
    beds_count: number;
    error_type: 'no_availability' | 'system_error' | 'validation_error';
  }): void {
    this.trackEvent({
      action: 'availability_error',
      category: 'error',
      label: data.error_type,
      custom_parameters: {
        check_in_date: data.check_in_date,
        check_out_date: data.check_out_date,
        beds_requested: data.beds_count,
        error_type: data.error_type
      }
    });
  }

  // Eventos de marketing y conversión

  // Seguimiento de fuentes de tráfico
  trackTrafficSource(data: {
    source: string;
    medium: string;
    campaign?: string;
    term?: string;
    content?: string;
  }): void {
    window.gtag('config', this.GA_MEASUREMENT_ID, {
      campaign_source: data.source,
      campaign_medium: data.medium,
      campaign_name: data.campaign,
      campaign_term: data.term,
      campaign_content: data.content
    });
  }

  // Seguimiento de conversiones por funnel
  trackFunnelStep(data: ConversionEvent): void {
    this.trackEvent({
      action: 'funnel_step',
      category: 'conversion',
      label: data.funnel_step,
      custom_parameters: {
        funnel_step: data.funnel_step,
        page_path: data.page_path,
        user_type: data.user_type,
        traffic_source: data.traffic_source,
        device_type: data.device_type,
        session_duration: data.session_duration,
        session_id: this.sessionId
      }
    });
  }

  // Método genérico para tracking de eventos
  private trackEvent(event: GAEvent): void {
    if (!this.isInitialized) return;

    window.gtag('event', event.action, {
      event_category: event.category,
      event_label: event.label,
      value: event.value,
      ...event.custom_parameters
    });

    if (this.GA_DEBUG_MODE) {
      console.log('GA Event tracked:', event);
    }
  }

  // Configurar objetivos de conversión personalizados
  trackCustomGoal(goalName: string, goalValue?: number): void {
    this.trackEvent({
      action: 'custom_goal',
      category: 'goal',
      label: goalName,
      value: goalValue,
      custom_parameters: {
        goal_name: goalName,
        goal_value: goalValue,
        timestamp: Date.now()
      }
    });
  }

  // Tracking de experiencia de usuario
  trackUserExperience(data: {
    page_load_time: number;
    first_contentful_paint: number;
    largest_contentful_paint: number;
    cumulative_layout_shift: number;
  }): void {
    this.trackEvent({
      action: 'user_experience',
      category: 'performance',
      custom_parameters: {
        page_load_time: data.page_load_time,
        first_contentful_paint: data.first_contentful_paint,
        largest_contentful_paint: data.largest_contentful_paint,
        cumulative_layout_shift: data.cumulative_layout_shift,
        page_path: window.location.pathname
      }
    });
  }

  // Obtener ID de cliente de GA
  getClientId(): Promise<string> {
    return new Promise((resolve) => {
      if (!this.isInitialized) {
        resolve('');
        return;
      }

      window.gtag('get', this.GA_MEASUREMENT_ID, 'client_id', (clientId: string) => {
        resolve(clientId);
      });
    });
  }

  // Configurar dimensiones personalizadas
  setCustomDimensions(dimensions: Record<string, string>): void {
    if (!this.isInitialized) return;

    window.gtag('config', this.GA_MEASUREMENT_ID, {
      custom_map: dimensions
    });
  }

  // Estado del servicio
  isReady(): boolean {
    return this.isInitialized;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }
}

// Singleton instance
export const googleAnalytics = new GoogleAnalytics();
