// src/components/analytics/page-view-tracker.tsx

'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAnalytics } from './analytics-provider';

interface PageViewTrackerProps {
  trackOnMount?: boolean;
  enableScrollTracking?: boolean;
  enableTimeTracking?: boolean;
  enableExitTracking?: boolean;
}

export function PageViewTracker({
  trackOnMount = true,
  enableScrollTracking = true,
  enableTimeTracking = true,
  enableExitTracking = true
}: PageViewTrackerProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const analytics = useAnalytics();
  
  const pageStartTime = useRef<number>(0);
  const maxScrollDepth = useRef<number>(0);
  const scrollCheckpoints = useRef<Set<number>>(new Set());
  const isTracking = useRef<boolean>(false);

  // Track page view cuando cambia la ruta
  useEffect(() => {
    if (!trackOnMount) return;

    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    const title = document.title;

    // Track page view
    analytics.trackPageView(url, title);
    
    // Reset tracking state
    pageStartTime.current = Date.now();
    maxScrollDepth.current = 0;
    scrollCheckpoints.current.clear();
    isTracking.current = true;

    // Track page metadata
    trackPageMetadata(url, title);

  }, [pathname, searchParams, analytics, trackOnMount]);

  // Configurar scroll tracking
  useEffect(() => {
    if (!enableScrollTracking || !isTracking.current) return;

    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const docHeight = Math.max(
        document.body.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.clientHeight,
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight
      );
      const windowHeight = window.innerHeight;
      const scrollPercent = Math.round((scrollTop / (docHeight - windowHeight)) * 100);

      // Actualizar máximo scroll depth
      maxScrollDepth.current = Math.max(maxScrollDepth.current, scrollPercent);

      // Track checkpoints de scroll (25%, 50%, 75%, 100%)
      const checkpoints = [25, 50, 75, 100];
      checkpoints.forEach(checkpoint => {
        if (scrollPercent >= checkpoint && !scrollCheckpoints.current.has(checkpoint)) {
          scrollCheckpoints.current.add(checkpoint);
          analytics.trackEvent('scroll_depth', 'engagement', `${checkpoint}%`, checkpoint);
        }
      });
    };

    const throttledScrollHandler = throttle(handleScroll, 500);
    window.addEventListener('scroll', throttledScrollHandler, { passive: true });

    return () => {
      window.removeEventListener('scroll', throttledScrollHandler);
    };
  }, [enableScrollTracking, analytics]);

  // Configurar time tracking
  useEffect(() => {
    if (!enableTimeTracking || !isTracking.current) return;

    const trackTimeSpent = () => {
      const timeSpent = Date.now() - pageStartTime.current;
      
      analytics.trackEvent('time_on_page', 'engagement', pathname, Math.round(timeSpent / 1000));
      
      // Track engagement basado en tiempo
      const engagementLevel = getEngagementLevel(timeSpent);
      analytics.trackEvent('engagement_level', 'engagement', engagementLevel);
    };

    // Track tiempo cada 30 segundos
    const timeInterval = setInterval(trackTimeSpent, 30000);

    return () => {
      clearInterval(timeInterval);
    };
  }, [enableTimeTracking, analytics, pathname]);

  // Configurar exit tracking
  useEffect(() => {
    if (!enableExitTracking || !isTracking.current) return;

    const handleBeforeUnload = () => {
      trackPageExit();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        trackPageExit();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      // Track exit al desmontar el componente
      trackPageExit();
    };
  }, [enableExitTracking, analytics]);

  const trackPageMetadata = (url: string, title: string) => {
    const pageType = getPageType(url);
    const referrer = document.referrer;
    const loadTime = performance.timing ? 
      performance.timing.loadEventEnd - performance.timing.navigationStart : 0;

    analytics.trackEvent('page_metadata', 'page_info', pageType, loadTime);

    // Track datos específicos por tipo de página
    switch (pageType) {
      case 'home':
        trackHomePage();
        break;
      case 'booking':
        trackBookingPage(url);
        break;
      case 'rooms':
        trackRoomsPage();
        break;
      case 'payment':
        trackPaymentPage();
        break;
    }
  };

  const trackHomePage = () => {
    analytics.trackEvent('homepage_view', 'page_type', 'landing');
    
    // Track si es primera visita
    const isFirstVisit = !localStorage.getItem('visited_before');
    if (isFirstVisit) {
      localStorage.setItem('visited_before', 'true');
      analytics.trackEvent('first_visit', 'user_journey', 'new_user');
    } else {
      analytics.trackEvent('return_visit', 'user_journey', 'returning_user');
    }
  };

  const trackBookingPage = (url: string) => {
    const urlParams = new URLSearchParams(url.split('?')[1] || '');
    const step = urlParams.get('step') || 'initial';
    
    analytics.trackEvent('booking_page_view', 'booking_flow', step);
    
    // Track parámetros de búsqueda si existen
    const checkIn = urlParams.get('checkin');
    const checkOut = urlParams.get('checkout');
    const beds = urlParams.get('beds');
    
    if (checkIn && checkOut && beds) {
      analytics.trackEvent('booking_with_params', 'booking_flow', 'prefilled', parseInt(beds));
    }
  };

  const trackRoomsPage = () => {
    analytics.trackEvent('rooms_page_view', 'page_type', 'catalog');
  };

  const trackPaymentPage = () => {
    analytics.trackEvent('payment_page_view', 'conversion_funnel', 'payment_step');
  };

  const trackPageExit = () => {
    if (!isTracking.current) return;

    const timeSpent = Date.now() - pageStartTime.current;
    const scrollDepth = maxScrollDepth.current;

    // Track métricas de salida
    analytics.trackEvent('page_exit', 'engagement', pathname, Math.round(timeSpent / 1000));
    analytics.trackEvent('final_scroll_depth', 'engagement', `${scrollDepth}%`, scrollDepth);

    // Determinar calidad de la sesión
    const sessionQuality = calculateSessionQuality(timeSpent, scrollDepth);
    analytics.trackEvent('session_quality', 'engagement', sessionQuality);

    isTracking.current = false;
  };

  const getPageType = (url: string): string => {
    if (url === '/' || url === '/pt' || url === '/en' || url === '/es') return 'home';
    if (url.includes('/booking') || url.includes('/reserva')) return 'booking';
    if (url.includes('/rooms') || url.includes('/habitaciones')) return 'rooms';
    if (url.includes('/payment') || url.includes('/pago')) return 'payment';
    if (url.includes('/confirmation') || url.includes('/confirmacion')) return 'confirmation';
    return 'other';
  };

  const getEngagementLevel = (timeSpent: number): string => {
    const seconds = timeSpent / 1000;
    if (seconds < 10) return 'bounce';
    if (seconds < 30) return 'low';
    if (seconds < 120) return 'medium';
    if (seconds < 300) return 'high';
    return 'very_high';
  };

  const calculateSessionQuality = (timeSpent: number, scrollDepth: number): string => {
    const timeScore = Math.min(timeSpent / 60000, 1); // Normalizar a 1 minuto
    const scrollScore = scrollDepth / 100;
    const combinedScore = (timeScore + scrollScore) / 2;

    if (combinedScore < 0.1) return 'very_poor';
    if (combinedScore < 0.3) return 'poor';
    if (combinedScore < 0.6) return 'average';
    if (combinedScore < 0.8) return 'good';
    return 'excellent';
  };

  // No renderiza nada - solo tracking
  return null;
}

// Hook para tracking manual de page views
export function usePageViewTracking() {
  const analytics = useAnalytics();

  const trackCustomPageView = (pageName: string, properties?: Record<string, any>) => {
    analytics.trackPageView(pageName);
    
    if (properties) {
      Object.entries(properties).forEach(([key, value]) => {
        analytics.trackEvent('page_property', 'page_data', key, 
          typeof value === 'number' ? value : undefined);
      });
    }
  };

  const trackPageSection = (sectionName: string, action: 'view' | 'interact' = 'view') => {
    analytics.trackEvent(`section_${action}`, 'page_section', sectionName);
  };

  const trackPageElement = (elementName: string, action: string) => {
    analytics.trackEvent(action, 'page_element', elementName);
  };

  const trackFormView = (formName: string) => {
    analytics.trackEvent('form_view', 'form_interaction', formName);
  };

  const trackModalView = (modalName: string) => {
    analytics.trackEvent('modal_view', 'ui_interaction', modalName);
  };

  return {
    trackCustomPageView,
    trackPageSection,
    trackPageElement,
    trackFormView,
    trackModalView
  };
}

// Componente específico para tracking de booking flow
export function BookingFlowTracker({ step }: { step: string }) {
  const analytics = useAnalytics();
  const stepStartTime = useRef<number>(0);

  useEffect(() => {
    stepStartTime.current = Date.now();
    analytics.trackEvent('booking_step_start', 'booking_flow', step);

    return () => {
      const timeInStep = Date.now() - stepStartTime.current;
      analytics.trackEvent('booking_step_duration', 'booking_flow', step, 
        Math.round(timeInStep / 1000));
    };
  }, [step, analytics]);

  return null;
}

// Componente para tracking de errores de carga
export function PageLoadErrorTracker() {
  const analytics = useAnalytics();

  useEffect(() => {
    const handleResourceError = (event: Event) => {
      const target = event.target as HTMLElement;
      const resourceType = target.tagName?.toLowerCase() || 'unknown';
      const resourceSrc = (target as any).src || (target as any).href || 'unknown';

      analytics.trackEvent('resource_load_error', 'error', resourceType);
      analytics.trackEvent('failed_resource', 'error', resourceSrc);
    };

    // Escuchar errores de recursos
    document.addEventListener('error', handleResourceError, true);

    // Escuchar errores de promesas no manejadas
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      analytics.trackEvent('unhandled_promise_rejection', 'error', 
        event.reason?.toString() || 'unknown');
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      document.removeEventListener('error', handleResourceError, true);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [analytics]);

  return null;
}

// Utilidad para throttling
function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return function(this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}
