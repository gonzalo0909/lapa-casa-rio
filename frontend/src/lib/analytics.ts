// src/lib/analytics.ts
declare global {
  interface Window {
    gtag: (command: string, ...args: any[]) => void;
    dataLayer: any[];
    fbq: (command: string, ...args: any[]) => void;
    clarity: (command: string, ...args: any[]) => void;
  }
}

interface AnalyticsConfig {
  googleAnalyticsId: string;
  facebookPixelId: string;
  microsoftClarityId: string;
  hotjarId: string;
  enabled: boolean;
  debug: boolean;
}

interface BookingEvent {
  event_name: 'booking_started' | 'booking_completed' | 'booking_abandoned';
  currency: string;
  value: number;
  items: Array<{
    item_id: string;
    item_name: string;
    category: string;
    quantity: number;
    price: number;
  }>;
  booking_id?: string;
  check_in_date: string;
  check_out_date: string;
  guests: number;
  room_type: string;
  discount_applied?: number;
}

interface PageViewEvent {
  page_title: string;
  page_location: string;
  page_path: string;
  content_group1?: string; // Seção (booking, rooms, etc)
  content_group2?: string; // Idioma
  content_group3?: string; // Tipo de dispositivo
}

interface ConversionEvent {
  event_name: string;
  currency?: string;
  value?: number;
  transaction_id?: string;
  custom_parameters?: Record<string, any>;
}

const analyticsConfig: AnalyticsConfig = {
  googleAnalyticsId: process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID || 'G-XXXXXXXXXX',
  facebookPixelId: process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID || '000000000000000',
  microsoftClarityId: process.env.NEXT_PUBLIC_MICROSOFT_CLARITY_ID || 'xxxxxxxxxx',
  hotjarId: process.env.NEXT_PUBLIC_HOTJAR_ID || '0000000',
  enabled: process.env.NODE_ENV === 'production',
  debug: process.env.NODE_ENV === 'development',
};

class LapaCasaAnalytics {
  private config: AnalyticsConfig;
  private initialized: boolean = false;

  constructor(config: AnalyticsConfig) {
    this.config = config;
  }

  // Inicialización de todos los scripts de analytics
  public async initialize(): Promise<void> {
    if (!this.config.enabled || this.initialized) return;

    try {
      await Promise.all([
        this.initializeGoogleAnalytics(),
        this.initializeFacebookPixel(),
        this.initializeMicrosoftClarity(),
        this.initializeHotjar(),
      ]);

      this.initialized = true;
      this.log('Analytics initialized successfully');
    } catch (error) {
      console.error('Failed to initialize analytics:', error);
    }
  }

  // Google Analytics 4
  private async initializeGoogleAnalytics(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') {
        resolve();
        return;
      }

      // Crear script tag
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${this.config.googleAnalyticsId}`;
      
      script.onload = () => {
        window.dataLayer = window.dataLayer || [];
        window.gtag = function() {
          window.dataLayer.push(arguments);
        };

        window.gtag('js', new Date());
        window.gtag('config', this.config.googleAnalyticsId, {
          page_title: document.title,
          page_location: window.location.href,
          anonymize_ip: true,
          allow_google_signals: false,
          cookie_flags: 'SameSite=None;Secure',
          custom_map: {
            custom_parameter_1: 'booking_step',
            custom_parameter_2: 'room_type',
            custom_parameter_3: 'group_size',
          },
        });

        this.log('Google Analytics initialized');
        resolve();
      };

      document.head.appendChild(script);
    });
  }

  // Facebook Pixel
  private async initializeFacebookPixel(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') {
        resolve();
        return;
      }

      window.fbq = function() {
        window.fbq.callMethod ? 
        window.fbq.callMethod.apply(window.fbq, arguments) : 
        window.fbq.queue.push(arguments);
      };

      if (!window.fbq.queue) window.fbq.queue = [];
      
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      
      script.onload = () => {
        window.fbq('init', this.config.facebookPixelId);
        window.fbq('track', 'PageView');
        
        this.log('Facebook Pixel initialized');
        resolve();
      };

      document.head.appendChild(script);
    });
  }

  // Microsoft Clarity
  private async initializeMicrosoftClarity(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.innerHTML = `
        (function(c,l,a,r,i,t,y){
          c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
          t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
          y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window, document, "clarity", "script", "${this.config.microsoftClarityId}");
      `;

      document.head.appendChild(script);
      
      setTimeout(() => {
        this.log('Microsoft Clarity initialized');
        resolve();
      }, 1000);
    });
  }

  // Hotjar
  private async initializeHotjar(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.innerHTML = `
        (function(h,o,t,j,a,r){
          h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
          h._hjSettings={hjid:${this.config.hotjarId},hjsv:6};
          a=o.getElementsByTagName('head')[0];
          r=o.createElement('script');r.async=1;
          r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
          a.appendChild(r);
        })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
      `;

      document.head.appendChild(script);
      
      setTimeout(() => {
        this.log('Hotjar initialized');
        resolve();
      }, 1000);
    });
  }

  // Tracking de eventos específicos para Lapa Casa Hostel
  public trackBookingStarted(data: {
    roomType: string;
    checkIn: string;
    checkOut: string;
    guests: number;
    estimatedValue: number;
  }): void {
    if (!this.initialized) return;

    const event: BookingEvent = {
      event_name: 'booking_started',
      currency: 'BRL',
      value: data.estimatedValue,
      items: [{
        item_id: data.roomType,
        item_name: `Hospedagem ${data.roomType}`,
        category: 'accommodation',
        quantity: 1,
        price: data.estimatedValue,
      }],
      check_in_date: data.checkIn,
      check_out_date: data.checkOut,
      guests: data.guests,
      room_type: data.roomType,
    };

    // Google Analytics
    if (window.gtag) {
      window.gtag('event', 'begin_checkout', {
        currency: 'BRL',
        value: data.estimatedValue,
        items: event.items,
        custom_parameter_1: 'started',
        custom_parameter_2: data.roomType,
        custom_parameter_3: data.guests.toString(),
      });
    }

    // Facebook Pixel
    if (window.fbq) {
      window.fbq('track', 'InitiateCheckout', {
        value: data.estimatedValue,
        currency: 'BRL',
        content_ids: [data.roomType],
        content_type: 'product',
        num_items: 1,
      });
    }

    this.log('Booking started tracked', event);
  }

  public trackBookingCompleted(data: {
    bookingId: string;
    roomType: string;
    checkIn: string;
    checkOut: string;
    guests: number;
    totalValue: number;
    discountApplied?: number;
    paymentMethod: string;
  }): void {
    if (!this.initialized) return;

    const event: BookingEvent = {
      event_name: 'booking_completed',
      currency: 'BRL',
      value: data.totalValue,
      items: [{
        item_id: data.roomType,
        item_name: `Hospedagem ${data.roomType}`,
        category: 'accommodation',
        quantity: 1,
        price: data.totalValue,
      }],
      booking_id: data.bookingId,
      check_in_date: data.checkIn,
      check_out_date: data.checkOut,
      guests: data.guests,
      room_type: data.roomType,
      discount_applied: data.discountApplied,
    };

    // Google Analytics - Conversão
    if (window.gtag) {
      window.gtag('event', 'purchase', {
        transaction_id: data.bookingId,
        currency: 'BRL',
        value: data.totalValue,
        items: event.items,
        custom_parameter_1: 'completed',
        custom_parameter_2: data.roomType,
        custom_parameter_3: data.guests.toString(),
      });

      // Evento personalizado para grupos
      if (data.guests >= 7) {
        window.gtag('event', 'group_booking_completed', {
          currency: 'BRL',
          value: data.totalValue,
          group_size: data.guests,
          discount_percentage: data.discountApplied || 0,
        });
      }
    }

    // Facebook Pixel - Purchase
    if (window.fbq) {
      window.fbq('track', 'Purchase', {
        value: data.totalValue,
        currency: 'BRL',
        content_ids: [data.roomType],
        content_type: 'product',
        num_items: 1,
      });
    }

    this.log('Booking completed tracked', event);
  }

  public trackPageView(data: PageViewEvent): void {
    if (!this.initialized) return;

    // Google Analytics
    if (window.gtag) {
      window.gtag('config', this.config.googleAnalyticsId, {
        page_title: data.page_title,
        page_location: data.page_location,
        page_path: data.page_path,
        content_group1: data.content_group1,
        content_group2: data.content_group2,
        content_group3: data.content_group3,
      });
    }

    // Facebook Pixel
    if (window.fbq) {
      window.fbq('track', 'PageView');
    }

    this.log('Page view tracked', data);
  }

  public trackRoomView(roomType: string, roomPrice: number): void {
    if (!this.initialized) return;

    // Google Analytics
    if (window.gtag) {
      window.gtag('event', 'view_item', {
        currency: 'BRL',
        value: roomPrice,
        items: [{
          item_id: roomType,
          item_name: `Habitação ${roomType}`,
          category: 'accommodation',
          quantity: 1,
          price: roomPrice,
        }],
      });
    }

    // Facebook Pixel
    if (window.fbq) {
      window.fbq('track', 'ViewContent', {
        value: roomPrice,
        currency: 'BRL',
        content_ids: [roomType],
        content_type: 'product',
      });
    }

    this.log('Room view tracked', { roomType, roomPrice });
  }

  public trackFormStep(step: string, formData?: Record<string, any>): void {
    if (!this.initialized) return;

    // Google Analytics
    if (window.gtag) {
      window.gtag('event', 'form_step', {
        form_name: 'booking_form',
        step_name: step,
        custom_parameter_1: step,
        ...formData,
      });
    }

    this.log('Form step tracked', { step, formData });
  }

  public trackError(errorType: string, errorMessage: string, page: string): void {
    if (!this.initialized) return;

    // Google Analytics
    if (window.gtag) {
      window.gtag('event', 'exception', {
        description: `${errorType}: ${errorMessage}`,
        fatal: false,
        page_location: page,
      });
    }

    this.log('Error tracked', { errorType, errorMessage, page });
  }

  public trackSearch(searchTerm: string, results: number): void {
    if (!this.initialized) return;

    // Google Analytics
    if (window.gtag) {
      window.gtag('event', 'search', {
        search_term: searchTerm,
        results_count: results,
      });
    }

    this.log('Search tracked', { searchTerm, results });
  }

  public trackWhatsAppClick(source: string): void {
    if (!this.initialized) return;

    // Google Analytics
    if (window.gtag) {
      window.gtag('event', 'whatsapp_click', {
        source: source,
        method: 'whatsapp',
      });
    }

    // Facebook Pixel
    if (window.fbq) {
      window.fbq('track', 'Contact', {
        content_name: 'WhatsApp Contact',
      });
    }

    this.log('WhatsApp click tracked', { source });
  }

  public trackEmailClick(source: string): void {
    if (!this.initialized) return;

    // Google Analytics
    if (window.gtag) {
      window.gtag('event', 'email_click', {
        source: source,
        method: 'email',
      });
    }

    this.log('Email click tracked', { source });
  }

  // Utilidades
  private log(message: string, data?: any): void {
    if (this.config.debug) {
      console.log(`[Analytics] ${message}`, data);
    }
  }

  public getUserId(): string | null {
    if (typeof window === 'undefined') return null;
    
    // Intentar obtener user ID de analytics
    return localStorage.getItem('lapa_casa_user_id') || null;
  }

  public setUserId(userId: string): void {
    if (typeof window === 'undefined') return;
    
    localStorage.setItem('lapa_casa_user_id', userId);

    // Google Analytics
    if (window.gtag) {
      window.gtag('config', this.config.googleAnalyticsId, {
        user_id: userId,
      });
    }
  }

  public getSessionId(): string {
    if (typeof window === 'undefined') return 'server';
    
    let sessionId = sessionStorage.getItem('lapa_casa_session_id');
    if (!sessionId) {
      sessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('lapa_casa_session_id', sessionId);
    }
    return sessionId;
  }
}

// Instancia singleton
export const analytics = new LapaCasaAnalytics(analyticsConfig);

// Hook para React
export function useAnalytics() {
  const trackBooking = (action: 'started' | 'completed' | 'abandoned', data: any) => {
    switch (action) {
      case 'started':
        analytics.trackBookingStarted(data);
        break;
      case 'completed':
        analytics.trackBookingCompleted(data);
        break;
      case 'abandoned':
        // Implementar lógica de abandono
        break;
    }
  };

  const trackInteraction = (type: 'whatsapp' | 'email' | 'phone', source: string) => {
    switch (type) {
      case 'whatsapp':
        analytics.trackWhatsAppClick(source);
        break;
      case 'email':
        analytics.trackEmailClick(source);
        break;
    }
  };

  return {
    trackBooking,
    trackInteraction,
    trackPageView: analytics.trackPageView.bind(analytics),
    trackRoomView: analytics.trackRoomView.bind(analytics),
    trackFormStep: analytics.trackFormStep.bind(analytics),
    trackError: analytics.trackError.bind(analytics),
    trackSearch: analytics.trackSearch.bind(analytics),
  };
}

// Inicialización automática
if (typeof window !== 'undefined') {
  analytics.initialize();
}
