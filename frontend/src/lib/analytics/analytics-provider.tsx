// src/components/analytics/analytics-provider.tsx

'use client';

import { createContext, useContext, useEffect, useRef, ReactNode } from 'react';
import { googleAnalytics } from '@/lib/analytics/google-analytics';
import { eventTracker } from '@/lib/analytics/event-tracking';
import { conversionTracker } from '@/lib/analytics/conversion-tracking';
import { performanceMonitor } from '@/lib/analytics/performance-monitoring';

interface AnalyticsContextType {
  // Google Analytics
  trackPageView: (path: string, title?: string) => void;
  trackEvent: (action: string, category: string, label?: string, value?: number) => void;
  
  // Event Tracking
  trackAvailabilitySearch: (data: any) => void;
  trackRoomSelection: (data: any) => void;
  trackBookingConversion: (data: any) => void;
  trackPaymentProcess: (data: any) => void;
  
  // Conversion Tracking
  trackConversion: (goalId: string, value?: number, properties?: any) => void;
  startFunnelTracking: (sessionId: string) => void;
  trackFunnelStep: (stepId: string, data?: any) => void;
  
  // Performance Monitoring
  measureOperation: <T>(name: string, operation: () => T) => T;
  measureAsyncOperation: <T>(name: string, operation: () => Promise<T>) => Promise<T>;
  
  // Utilities
  setUserId: (userId: string) => void;
  getSessionMetrics: () => any;
  isAnalyticsReady: () => boolean;
}

const AnalyticsContext = createContext<AnalyticsContextType | null>(null);

interface AnalyticsProviderProps {
  children: ReactNode;
  config?: {
    enableGoogleAnalytics?: boolean;
    enableEventTracking?: boolean;
    enableConversionTracking?: boolean;
    enablePerformanceMonitoring?: boolean;
    debug?: boolean;
  };
}

export function AnalyticsProvider({ 
  children, 
  config = {
    enableGoogleAnalytics: true,
    enableEventTracking: true,
    enableConversionTracking: true,
    enablePerformanceMonitoring: true,
    debug: process.env.NODE_ENV === 'development'
  } 
}: AnalyticsProviderProps) {
  const initialized = useRef(false);
  const sessionId = useRef<string>('');

  useEffect(() => {
    if (initialized.current) return;

    // Generar session ID único
    sessionId.current = Date.now().toString() + Math.random().toString(36).substr(2, 9);

    // Inicializar servicios de analytics
    initializeAnalytics();
    
    initialized.current = true;
  }, []);

  const initializeAnalytics = async () => {
    try {
      // Configurar Google Analytics
      if (config.enableGoogleAnalytics) {
        await initializeGoogleAnalytics();
      }

      // Configurar Event Tracking
      if (config.enableEventTracking) {
        initializeEventTracking();
      }

      // Configurar Conversion Tracking
      if (config.enableConversionTracking) {
        initializeConversionTracking();
      }

      // Configurar Performance Monitoring
      if (config.enablePerformanceMonitoring) {
        initializePerformanceMonitoring();
      }

      // Trackear página inicial
      trackInitialPageView();

      if (config.debug) {
        console.log('Analytics Provider inicializado correctamente');
      }
    } catch (error) {
      console.error('Error inicializando Analytics Provider:', error);
    }
  };

  const initializeGoogleAnalytics = async () => {
    // GA ya se inicializa automáticamente en su constructor
    if (config.debug) {
      console.log('Google Analytics inicializado');
    }
  };

  const initializeEventTracking = () => {
    // Event Tracker ya se inicializa automáticamente
    if (config.debug) {
      console.log('Event Tracking inicializado');
    }
  };

  const initializeConversionTracking = () => {
    conversionTracker.startFunnelTracking(sessionId.current);
    if (config.debug) {
      console.log('Conversion Tracking inicializado');
    }
  };

  const initializePerformanceMonitoring = () => {
    // Performance Monitor ya se inicializa automáticamente
    if (config.debug) {
      console.log('Performance Monitoring inicializado');
    }
  };

  const trackInitialPageView = () => {
    const currentPath = window.location.pathname;
    trackPageView(currentPath, document.title);
  };

  // Implementación de métodos del contexto

  const trackPageView = (path: string, title?: string) => {
    try {
      if (config.enableGoogleAnalytics) {
        googleAnalytics.trackPageView(path, title);
      }
      
      if (config.enableEventTracking) {
        eventTracker.trackPageView(path);
      }

      if (config.debug) {
        console.log('Page view tracked:', path);
      }
    } catch (error) {
      console.error('Error tracking page view:', error);
    }
  };

  const trackEvent = (action: string, category: string, label?: string, value?: number) => {
    try {
      if (config.enableGoogleAnalytics) {
        googleAnalytics.trackEvent({
          action,
          category,
          label,
          value
        });
      }

      if (config.debug) {
        console.log('Event tracked:', { action, category, label, value });
      }
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  };

  const trackAvailabilitySearch = (data: {
    checkIn: string;
    checkOut: string;
    beds: number;
    source: string;
  }) => {
    try {
      if (config.enableGoogleAnalytics) {
        googleAnalytics.trackAvailabilitySearch({
          check_in_date: data.checkIn,
          check_out_date: data.checkOut,
          beds_count: data.beds,
          available_rooms: 1 // Se actualizaría con datos reales
        });
      }

      if (config.enableEventTracking) {
        eventTracker.trackAvailabilitySearch({
          checkIn: data.checkIn,
          checkOut: data.checkOut,
          beds: data.beds,
          source: data.source as any
        });
      }

      if (config.enableConversionTracking) {
        conversionTracker.trackFunnelStep('availability_search', data);
      }

      if (config.debug) {
        console.log('Availability search tracked:', data);
      }
    } catch (error) {
      console.error('Error tracking availability search:', error);
    }
  };

  const trackRoomSelection = (data: {
    roomId: string;
    roomType: string;
    beds: number;
    basePrice: number;
    finalPrice: number;
    discountApplied?: number;
  }) => {
    try {
      if (config.enableGoogleAnalytics) {
        googleAnalytics.trackRoomSelected({
          room_id: data.roomId,
          room_type: data.roomType,
          beds_count: data.beds,
          base_price: data.basePrice,
          total_price: data.finalPrice
        });
      }

      if (config.enableEventTracking) {
        eventTracker.trackRoomSelection(data);
      }

      if (config.enableConversionTracking) {
        conversionTracker.trackFunnelStep('room_selection', data);
        conversionTracker.trackConversion('room_selection', 25, data);
      }

      if (config.debug) {
        console.log('Room selection tracked:', data);
      }
    } catch (error) {
      console.error('Error tracking room selection:', error);
    }
  };

  const trackBookingConversion = (data: {
    bookingId: string;
    totalValue: number;
    roomType: string;
    beds: number;
    nights: number;
    paymentMethod: string;
    isGroupBooking: boolean;
    isRepeatCustomer: boolean;
  }) => {
    try {
      if (config.enableGoogleAnalytics) {
        googleAnalytics.trackPaymentCompleted({
          booking_id: data.bookingId,
          room_type: data.roomType,
          beds_count: data.beds,
          total_price: data.totalValue,
          currency: 'BRL',
          check_in_date: '', // Se obtendría de los datos de reserva
          check_out_date: '',
          guest_country: 'BR',
          payment_method: data.paymentMethod
        });
      }

      if (config.enableEventTracking) {
        eventTracker.trackBookingConversion({
          bookingId: data.bookingId,
          totalValue: data.totalValue,
          roomType: data.roomType,
          beds: data.beds,
          nights: data.nights,
          paymentMethod: data.paymentMethod,
          conversionTime: 0 // Se calcularía desde el inicio del funnel
        });
      }

      if (config.enableConversionTracking) {
        conversionTracker.trackBookingConversion({
          bookingId: data.bookingId,
          totalValue: data.totalValue,
          roomType: data.roomType,
          beds: data.beds,
          nights: data.nights,
          paymentMethod: data.paymentMethod,
          isGroupBooking: data.isGroupBooking,
          isRepeatCustomer: data.isRepeatCustomer
        });
      }

      if (config.debug) {
        console.log('Booking conversion tracked:', data);
      }
    } catch (error) {
      console.error('Error tracking booking conversion:', error);
    }
  };

  const trackPaymentProcess = (data: {
    step: 'started' | 'method_selected' | 'processing' | 'completed' | 'failed';
    paymentMethod?: string;
    paymentType?: 'deposit' | 'remaining';
    amount?: number;
    errorCode?: string;
  }) => {
    try {
      if (config.enableGoogleAnalytics) {
        googleAnalytics.trackPaymentStarted({
          booking_id: sessionId.current,
          payment_method: data.paymentMethod as any,
          amount: data.amount || 0,
          payment_type: data.paymentType as any
        });
      }

      if (config.enableEventTracking) {
        eventTracker.trackPaymentProcess({
          step: data.step,
          paymentMethod: data.paymentMethod as any,
          paymentType: data.paymentType,
          amount: data.amount,
          errorCode: data.errorCode
        });
