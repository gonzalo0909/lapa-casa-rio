// lapa-casa-hostel/frontend/src/components/analytics/analytics-provider.tsx

/**
 * Analytics Provider Component
 * 
 * Comprehensive analytics tracking for Lapa Casa Hostel.
 * Integrates Google Analytics 4, Facebook Pixel, and custom events.
 * 
 * @module components/analytics/analytics-provider
 * @requires react
 * @requires next/script
 */

'use client';

import React, { createContext, useContext, useEffect, useCallback } from 'react';
import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Analytics configuration
 */
const ANALYTICS_CONFIG = {
  ga4MeasurementId: 'G-XXXXXXXXXX', // Replace with actual GA4 ID
  facebookPixelId: '1234567890', // Replace with actual FB Pixel ID
  enableDebug: process.env.NODE_ENV === 'development',
  cookieConsent: true
} as const;

/**
 * Event parameters interface
 */
interface EventParams {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Booking event data
 */
interface BookingEventData {
  booking_id: string;
  room_id: string;
  room_name: string;
  check_in: string;
  check_out: string;
  beds_count: number;
  total_price: number;
  currency: string;
  payment_method?: string;
}

/**
 * Search event data
 */
interface SearchEventData {
  search_term: string;
  check_in?: string;
  check_out?: string;
  guests?: number;
}

/**
 * Analytics context interface
 */
interface AnalyticsContextValue {
  trackPageView: (url: string) => void;
  trackEvent: (eventName: string, params?: EventParams) => void;
  trackBookingInitiated: (data: Partial<BookingEventData>) => void;
  trackBookingCompleted: (data: BookingEventData) => void;
  trackPaymentInitiated: (data: { amount: number; currency: string; method: string }) => void;
  trackPaymentCompleted: (data: { transaction_id: string; amount: number; currency: string }) => void;
  trackRoomView: (roomId: string, roomName: string) => void;
  trackSearch: (data: SearchEventData) => void;
  trackError: (error: string, context?: string) => void;
  setUserId: (userId: string) => void;
  setUserProperties: (properties: Record<string, any>) => void;
}

/**
 * Analytics Context
 */
const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

/**
 * Declare gtag function for TypeScript
 */
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    fbq?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

/**
 * Initialize Google Analytics 4
 */
function initializeGA4() {
  if (typeof window === 'undefined') return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer?.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', ANALYTICS_CONFIG.ga4MeasurementId, {
    debug_mode: ANALYTICS_CONFIG.enableDebug,
    send_page_view: false
  });

  if (ANALYTICS_CONFIG.enableDebug) {
    console.log('[Analytics] GA4 initialized:', ANALYTICS_CONFIG.ga4MeasurementId);
  }
}

/**
 * Initialize Facebook Pixel
 */
function initializeFacebookPixel() {
  if (typeof window === 'undefined') return;

  window.fbq = function fbq() {
    if (window.fbq?.callMethod) {
      window.fbq.callMethod.apply(window.fbq, arguments as any);
    } else {
      window.fbq?.queue?.push(arguments);
    }
  };

  if (!window.fbq) {
    window.fbq = window.fbq || function() {};
  }

  (window.fbq as any).push = window.fbq;
  (window.fbq as any).loaded = true;
  (window.fbq as any).version = '2.0';
  (window.fbq as any).queue = [];

  window.fbq('init', ANALYTICS_CONFIG.facebookPixelId);
  window.fbq('track', 'PageView');

  if (ANALYTICS_CONFIG.enableDebug) {
    console.log('[Analytics] Facebook Pixel initialized:', ANALYTICS_CONFIG.facebookPixelId);
  }
}

/**
 * Analytics Provider Props
 */
interface AnalyticsProviderProps {
  children: React.ReactNode;
  enabled?: boolean;
}

/**
 * Analytics Provider Component
 * 
 * Provides analytics tracking throughout the application.
 * Automatically tracks page views and provides event tracking methods.
 * 
 * @example
 * ```tsx
 * <AnalyticsProvider>
 *   <App />
 * </AnalyticsProvider>
 * ```
 */
export function AnalyticsProvider({ 
  children, 
  enabled = true 
}: AnalyticsProviderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /**
   * Track page view
   */
  const trackPageView = useCallback((url: string) => {
    if (!enabled) return;

    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_path: url,
        page_location: window.location.href,
        page_title: document.title
      });
    }

    if (typeof window.fbq === 'function') {
      window.fbq('track', 'PageView');
    }

    if (ANALYTICS_CONFIG.enableDebug) {
      console.log('[Analytics] Page view tracked:', url);
    }
  }, [enabled]);

  /**
   * Track custom event
   */
  const trackEvent = useCallback((eventName: string, params?: EventParams) => {
    if (!enabled) return;

    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, params);
    }

    if (ANALYTICS_CONFIG.enableDebug) {
      console.log('[Analytics] Event tracked:', eventName, params);
    }
  }, [enabled]);

  /**
   * Track booking initiated
   */
  const trackBookingInitiated = useCallback((data: Partial<BookingEventData>) => {
    if (!enabled) return;

    trackEvent('begin_checkout', {
      currency: data.currency || 'BRL',
      value: data.total_price || 0,
      items: [
        {
          item_id: data.room_id,
          item_name: data.room_name,
          quantity: data.beds_count || 1
        }
      ]
    });

    if (typeof window.fbq === 'function') {
      window.fbq('track', 'InitiateCheckout', {
        content_ids: [data.room_id],
        content_type: 'product',
        value: data.total_price || 0,
        currency: data.currency || 'BRL'
      });
    }

    if (ANALYTICS_CONFIG.enableDebug) {
      console.log('[Analytics] Booking initiated:', data);
    }
  }, [enabled, trackEvent]);

  /**
   * Track booking completed
   */
  const trackBookingCompleted = useCallback((data: BookingEventData) => {
    if (!enabled) return;

    trackEvent('purchase', {
      transaction_id: data.booking_id,
      value: data.total_price,
      currency: data.currency,
      items: [
        {
          item_id: data.room_id,
          item_name: data.room_name,
          quantity: data.beds_count,
          price: data.total_price
        }
      ]
    });

    if (typeof window.fbq === 'function') {
      window.fbq('track', 'Purchase', {
        content_ids: [data.room_id],
        content_type: 'product',
        value: data.total_price,
        currency: data.currency
      });
    }

    if (ANALYTICS_CONFIG.enableDebug) {
      console.log('[Analytics] Booking completed:', data);
    }
  }, [enabled, trackEvent]);

  /**
   * Track payment initiated
   */
  const trackPaymentInitiated = useCallback((data: {
    amount: number;
    currency: string;
    method: string;
  }) => {
    if (!enabled) return;

    trackEvent('add_payment_info', {
      currency: data.currency,
      value: data.amount,
      payment_type: data.method
    });

    if (ANALYTICS_CONFIG.enableDebug) {
      console.log('[Analytics] Payment initiated:', data);
    }
  }, [enabled, trackEvent]);

  /**
   * Track payment completed
   */
  const trackPaymentCompleted = useCallback((data: {
    transaction_id: string;
    amount: number;
    currency: string;
  }) => {
    if (!enabled) return;

    trackEvent('payment_completed', {
      transaction_id: data.transaction_id,
      value: data.amount,
      currency: data.currency
    });

    if (ANALYTICS_CONFIG.enableDebug) {
      console.log('[Analytics] Payment completed:', data);
    }
  }, [enabled, trackEvent]);

  /**
   * Track room view
   */
  const trackRoomView = useCallback((roomId: string, roomName: string) => {
    if (!enabled) return;

    trackEvent('view_item', {
      items: [
        {
          item_id: roomId,
          item_name: roomName,
          item_category: 'room'
        }
      ]
    });

    if (typeof window.fbq === 'function') {
      window.fbq('track', 'ViewContent', {
        content_ids: [roomId],
        content_type: 'product',
        content_name: roomName
      });
    }

    if (ANALYTICS_CONFIG.enableDebug) {
      console.log('[Analytics] Room viewed:', roomId, roomName);
    }
  }, [enabled, trackEvent]);

  /**
   * Track search
   */
  const trackSearch = useCallback((data: SearchEventData) => {
    if (!enabled) return;

    trackEvent('search', {
      search_term: data.search_term,
      check_in: data.check_in,
      check_out: data.check_out,
      guests: data.guests
    });

    if (typeof window.fbq === 'function') {
      window.fbq('track', 'Search', {
        search_string: data.search_term
      });
    }

    if (ANALYTICS_CONFIG.enableDebug) {
      console.log('[Analytics] Search tracked:', data);
    }
  }, [enabled, trackEvent]);

  /**
   * Track error
   */
  const trackError = useCallback((error: string, context?: string) => {
    if (!enabled) return;

    trackEvent('error', {
      error_message: error,
      error_context: context || 'unknown'
    });

    if (ANALYTICS_CONFIG.enableDebug) {
      console.error('[Analytics] Error tracked:', error, context);
    }
  }, [enabled, trackEvent]);

  /**
   * Set user ID
   */
  const setUserId = useCallback((userId: string) => {
    if (!enabled) return;

    if (typeof window.gtag === 'function') {
      window.gtag('set', { user_id: userId });
    }

    if (ANALYTICS_CONFIG.enableDebug) {
      console.log('[Analytics] User ID set:', userId);
    }
  }, [enabled]);

  /**
   * Set user properties
   */
  const setUserProperties = useCallback((properties: Record<string, any>) => {
    if (!enabled) return;

    if (typeof window.gtag === 'function') {
      window.gtag('set', 'user_properties', properties);
    }

    if (ANALYTICS_CONFIG.enableDebug) {
      console.log('[Analytics] User properties set:', properties);
    }
  }, [enabled]);

  /**
   * Track page views on route change
   */
  useEffect(() => {
    if (!enabled) return;

    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    trackPageView(url);
  }, [pathname, searchParams, enabled, trackPageView]);

  const contextValue: AnalyticsContextValue = {
    trackPageView,
    trackEvent,
    trackBookingInitiated,
    trackBookingCompleted,
    trackPaymentInitiated,
    trackPaymentCompleted,
    trackRoomView,
    trackSearch,
    trackError,
    setUserId,
    setUserProperties
  };

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <AnalyticsContext.Provider value={contextValue}>
      {/* Google Analytics 4 */}
      <Script
        id="ga4-script"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${ANALYTICS_CONFIG.ga4MeasurementId}`}
        onLoad={initializeGA4}
      />

      {/* Facebook Pixel */}
      <Script
        id="fb-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
          `
        }}
        onLoad={initializeFacebookPixel}
      />

      {children}
    </AnalyticsContext.Provider>
  );
}

/**
 * Hook to use analytics context
 * 
 * @example
 * ```tsx
 * const { trackEvent, trackBookingCompleted } = useAnalytics();
 * 
 * trackEvent('button_click', { button_name: 'book_now' });
 * ```
 */
export function useAnalytics() {
  const context = useContext(AnalyticsContext);

  if (!context) {
    throw new Error('useAnalytics must be used within AnalyticsProvider');
  }

  return context;
}

export default AnalyticsProvider;
