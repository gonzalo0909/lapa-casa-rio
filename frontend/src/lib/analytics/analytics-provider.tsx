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

      if (config.enableConversionTracking) {
        conversionTracker.trackFunnelStep('payment_process', data);
      }

      if (config.debug) {
        console.log('Payment process tracked:', data);
      }
    } catch (error) {
      console.error('Error tracking payment process:', error);
    }
  };

  const trackConversion = (goalId: string, value?: number, properties?: any) => {
    try {
      if (config.enableConversionTracking) {
        conversionTracker.trackConversion(goalId, value, properties);
      }

      if (config.debug) {
        console.log('Conversion tracked:', { goalId, value, properties });
      }
    } catch (error) {
      console.error('Error tracking conversion:', error);
    }
  };

  const startFunnelTracking = (sessionId: string) => {
    try {
      if (config.enableConversionTracking) {
        conversionTracker.startFunnelTracking(sessionId);
      }

      if (config.debug) {
        console.log('Funnel tracking started:', sessionId);
      }
    } catch (error) {
      console.error('Error starting funnel tracking:', error);
    }
  };

  const trackFunnelStep = (stepId: string, data?: any) => {
    try {
      if (config.enableConversionTracking) {
        conversionTracker.trackFunnelStep(stepId, data);
      }

      if (config.debug) {
        console.log('Funnel step tracked:', stepId, data);
      }
    } catch (error) {
      console.error('Error tracking funnel step:', error);
    }
  };

  const measureOperation = <T>(name: string, operation: () => T): T => {
    try {
      if (config.enablePerformanceMonitoring) {
        return performanceMonitor.measureOperation(name, operation);
      }
      return operation();
    } catch (error) {
      console.error('Error measuring operation:', error);
      return operation();
    }
  };

  const measureAsyncOperation = async <T>(name: string, operation: () => Promise<T>): Promise<T> => {
    try {
      if (config.enablePerformanceMonitoring) {
        return await performanceMonitor.measureAsyncOperation(name, operation);
      }
      return await operation();
    } catch (error) {
      console.error('Error measuring async operation:', error);
      return await operation();
    }
  };

  const setUserId = (userId: string) => {
    try {
      if (config.enableGoogleAnalytics) {
        googleAnalytics.setUserId(userId);
      }

      if (config.enableEventTracking) {
        eventTracker.setUserId(userId);
      }

      if (config.debug) {
        console.log('User ID set:', userId);
      }
    } catch (error) {
      console.error('Error setting user ID:', error);
    }
  };

  const getSessionMetrics = () => {
    try {
      if (config.enableEventTracking) {
        return eventTracker.getSessionMetrics();
      }
      return null;
    } catch (error) {
      console.error('Error getting session metrics:', error);
      return null;
    }
  };

  const isAnalyticsReady = (): boolean => {
    try {
      return (
        (!config.enableGoogleAnalytics || googleAnalytics.isReady()) &&
        (!config.enablePerformanceMonitoring || performanceMonitor.isMonitoringActive())
      );
    } catch (error) {
      console.error('Error checking analytics readiness:', error);
      return false;
    }
  };

  const contextValue: AnalyticsContextType = {
    trackPageView,
    trackEvent,
    trackAvailabilitySearch,
    trackRoomSelection,
    trackBookingConversion,
    trackPaymentProcess,
    trackConversion,
    startFunnelTracking,
    trackFunnelStep,
    measureOperation,
    measureAsyncOperation,
    setUserId,
    getSessionMetrics,
    isAnalyticsReady
  };

  return (
    <AnalyticsContext.Provider value={contextValue}>
      {children}
    </AnalyticsContext.Provider>
  );
}

// Hook para usar el contexto de analytics
export function useAnalytics(): AnalyticsContextType {
  const context = useContext(AnalyticsContext);
  
  if (!context) {
    throw new Error('useAnalytics debe usarse dentro de AnalyticsProvider');
  }
  
  return context;
}

// Hook específico para tracking de booking
export function useBookingAnalytics() {
  const analytics = useAnalytics();

  const trackBookingStep = (step: string, data?: any) => {
    analytics.trackFunnelStep(step, data);
    analytics.trackEvent('booking_step', 'booking', step);
  };

  const trackRoomInteraction = (roomId: string, action: string) => {
    analytics.trackEvent(action, 'room_interaction', roomId);
  };

  const trackPriceCalculation = (data: {
    roomType: string;
    beds: number;
    basePrice: number;
    finalPrice: number;
    discounts: string[];
  }) => {
    analytics.trackEvent('price_calculation', 'pricing', data.roomType, data.finalPrice);
  };

  const trackFormInteraction = (formName: string, action: string, fieldName?: string) => {
    analytics.trackEvent(action, 'form_interaction', `${formName}_${fieldName || 'unknown'}`);
  };

  return {
    trackBookingStep,
    trackRoomInteraction,
    trackPriceCalculation,
    trackFormInteraction,
    ...analytics
  };
}

// Hook para tracking de performance
export function usePerformanceAnalytics() {
  const analytics = useAnalytics();

  const trackPageLoadTime = (pageName: string, loadTime: number) => {
    analytics.trackEvent('page_load_time', 'performance', pageName, loadTime);
  };

  const trackApiResponse = (endpoint: string, responseTime: number, success: boolean) => {
    analytics.trackEvent('api_response', 'performance', endpoint, responseTime);
    
    if (!success) {
      analytics.trackEvent('api_error', 'error', endpoint);
    }
  };

  const trackUserInteraction = (element: string, action: string) => {
    analytics.trackEvent(action, 'user_interaction', element);
  };

  const measurePagePerformance = () => {
    return analytics.measureOperation('page_render', () => {
      // Lógica de medición específica
      return performance.now();
    });
  };

  return {
    trackPageLoadTime,
    trackApiResponse,
    trackUserInteraction,
    measurePagePerformance,
    measureOperation: analytics.measureOperation,
    measureAsyncOperation: analytics.measureAsyncOperation
  };
}

// HOC para componentes con tracking automático
export function withAnalytics<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: {
    trackMount?: boolean;
    trackUnmount?: boolean;
    componentName?: string;
    customEvents?: Array<{
      trigger: string;
      eventName: string;
      category: string;
    }>;
  } = {}
) {
  return function AnalyticsWrappedComponent(props: P) {
    const analytics = useAnalytics();
    const mountTime = useRef<number>(0);

    useEffect(() => {
      const componentName = options.componentName || WrappedComponent.displayName || WrappedComponent.name;
      
      if (options.trackMount) {
        mountTime.current = performance.now();
        analytics.trackEvent('component_mount', 'component', componentName);
      }

      return () => {
        if (options.trackUnmount) {
          const timeOnComponent = performance.now() - mountTime.current;
          analytics.trackEvent('component_unmount', 'component', componentName, timeOnComponent);
        }
      };
    }, [analytics]);

    return <WrappedComponent {...props} />;
  };
}

// Componente para tracking de errores
export function AnalyticsErrorBoundary({ 
  children, 
  fallback 
}: { 
  children: ReactNode; 
  fallback?: ReactNode;
}) {
  const analytics = useAnalytics();

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      analytics.trackEvent('javascript_error', 'error', event.error?.message || 'Unknown error');
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      analytics.trackEvent('unhandled_rejection', 'error', event.reason?.toString() || 'Unknown rejection');
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [analytics]);

  return <>{children}</>;
}

// Componente para debugging de analytics
export function AnalyticsDebugger() {
  const analytics = useAnalytics();
  const [metrics, setMetrics] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const interval = setInterval(() => {
        setMetrics(analytics.getSessionMetrics());
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [analytics]);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setIsVisible(!isVisible)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 9999,
          background: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '60px',
          height: '60px',
          fontSize: '12px',
          cursor: 'pointer'
        }}
      >
        📊
      </button>

      {isVisible && (
        <div
          style={{
            position: 'fixed',
            bottom: '100px',
            right: '20px',
            zIndex: 9999,
            background: 'white',
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '16px',
            maxWidth: '300px',
            fontSize: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}
        >
          <h4>Analytics Debug</h4>
          <p><strong>Ready:</strong> {analytics.isAnalyticsReady() ? 'Yes' : 'No'}</p>
          {metrics && (
            <>
              <p><strong>Session Duration:</strong> {Math.round(metrics.duration / 1000)}s</p>
              <p><strong>Page Views:</strong> {metrics.pageViews}</p>
              <p><strong>Events:</strong> {metrics.eventsCount}</p>
              <p><strong>Funnel Progress:</strong> {metrics.funnelProgress}</p>
              <p><strong>Engagement Score:</strong> {metrics.engagementScore}</p>
            </>
          )}
        </div>
      )}
    </>
  );
}
