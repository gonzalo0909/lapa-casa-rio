// lapa-casa-hostel/frontend/src/lib/analytics.ts

/**
 * Analytics Helper Library
 * 
 * Utility functions for tracking events and user interactions.
 * Works with Google Analytics 4 and Facebook Pixel.
 * 
 * @module lib/analytics
 */

/**
 * Event parameters type
 */
type EventParams = Record<string, string | number | boolean | undefined>;

/**
 * Track custom event
 * 
 * @param eventName - Name of the event
 * @param params - Event parameters
 * 
 * @example
 * ```ts
 * trackEvent('button_click', { button_id: 'book_now', page: 'home' });
 * ```
 */
export function trackEvent(eventName: string, params?: EventParams): void {
  if (typeof window === 'undefined') return;

  try {
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, params);
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics] Event:', eventName, params);
    }
  } catch (error) {
    console.error('[Analytics] Error tracking event:', error);
  }
}

/**
 * Track page view
 * 
 * @param path - Page path
 * @param title - Page title
 * 
 * @example
 * ```ts
 * trackPageView('/booking', 'Booking Page');
 * ```
 */
export function trackPageView(path: string, title?: string): void {
  if (typeof window === 'undefined') return;

  try {
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_path: path,
        page_title: title || document.title,
        page_location: window.location.href
      });
    }

    if (typeof window.fbq === 'function') {
      window.fbq('track', 'PageView');
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics] Page view:', path, title);
    }
  } catch (error) {
    console.error('[Analytics] Error tracking page view:', error);
  }
}

/**
 * Track booking initiation
 * 
 * @param data - Booking data
 * 
 * @example
 * ```ts
 * trackBookingInitiated({
 *   room_id: 'room_mixto_12a',
 *   beds: 12,
 *   total_price: 4320
 * });
 * ```
 */
export function trackBookingInitiated(data: {
  room_id: string;
  room_name?: string;
  beds: number;
  total_price: number;
  check_in?: string;
  check_out?: string;
}): void {
  trackEvent('begin_checkout', {
    currency: 'BRL',
    value: data.total_price,
    items: [
      {
        item_id: data.room_id,
        item_name: data.room_name || data.room_id,
        quantity: data.beds
      }
    ]
  });

  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', 'InitiateCheckout', {
      content_ids: [data.room_id],
      content_type: 'product',
      value: data.total_price,
      currency: 'BRL',
      num_items: data.beds
    });
  }
}

/**
 * Track booking completion
 * 
 * @param data - Booking completion data
 * 
 * @example
 * ```ts
 * trackBookingCompleted({
 *   booking_id: 'book_123',
 *   room_id: 'room_mixto_12a',
 *   beds: 12,
 *   total_price: 4320,
 *   payment_method: 'credit_card'
 * });
 * ```
 */
export function trackBookingCompleted(data: {
  booking_id: string;
  room_id: string;
  room_name?: string;
  beds: number;
  total_price: number;
  payment_method?: string;
}): void {
  trackEvent('purchase', {
    transaction_id: data.booking_id,
    value: data.total_price,
    currency: 'BRL',
    payment_type: data.payment_method,
    items: [
      {
        item_id: data.room_id,
        item_name: data.room_name || data.room_id,
        quantity: data.beds,
        price: data.total_price
      }
    ]
  });

  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', 'Purchase', {
      content_ids: [data.room_id],
      content_type: 'product',
      value: data.total_price,
      currency: 'BRL'
    });
  }
}

/**
 * Track payment step
 * 
 * @param step - Payment step name
 * @param method - Payment method
 * @param amount - Payment amount
 * 
 * @example
 * ```ts
 * trackPaymentStep('add_payment_info', 'credit_card', 1296);
 * ```
 */
export function trackPaymentStep(
  step: 'add_payment_info' | 'payment_completed' | 'payment_failed',
  method: string,
  amount: number
): void {
  trackEvent(step, {
    payment_type: method,
    value: amount,
    currency: 'BRL'
  });
}

/**
 * Track room view
 * 
 * @param roomId - Room ID
 * @param roomName - Room name
 * 
 * @example
 * ```ts
 * trackRoomView('room_mixto_12a', 'Mixto 12A');
 * ```
 */
export function trackRoomView(roomId: string, roomName: string): void {
  trackEvent('view_item', {
    items: [
      {
        item_id: roomId,
        item_name: roomName,
        item_category: 'room'
      }
    ]
  });

  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', 'ViewContent', {
      content_ids: [roomId],
      content_type: 'product',
      content_name: roomName
    });
  }
}

/**
 * Track search
 * 
 * @param searchTerm - Search term or criteria
 * @param filters - Search filters
 * 
 * @example
 * ```ts
 * trackSearch('group booking', {
 *   check_in: '2025-01-15',
 *   beds: 12
 * });
 * ```
 */
export function trackSearch(searchTerm: string, filters?: EventParams): void {
  trackEvent('search', {
    search_term: searchTerm,
    ...filters
  });

  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', 'Search', {
      search_string: searchTerm
    });
  }
}

/**
 * Track form interaction
 * 
 * @param formName - Form name
 * @param action - Action type
 * @param fieldName - Field name (optional)
 * 
 * @example
 * ```ts
 * trackFormInteraction('booking_form', 'focus', 'guest_email');
 * trackFormInteraction('booking_form', 'submit');
 * ```
 */
export function trackFormInteraction(
  formName: string,
  action: 'start' | 'focus' | 'complete' | 'submit' | 'error',
  fieldName?: string
): void {
  trackEvent(`form_${action}`, {
    form_name: formName,
    field_name: fieldName
  });
}

/**
 * Track error
 * 
 * @param errorType - Type of error
 * @param errorMessage - Error message
 * @param context - Additional context
 * 
 * @example
 * ```ts
 * trackError('api_error', 'Failed to fetch availability', { endpoint: '/api/availability' });
 * ```
 */
export function trackError(
  errorType: string,
  errorMessage: string,
  context?: EventParams
): void {
  trackEvent('error', {
    error_type: errorType,
    error_message: errorMessage,
    ...context
  });
}

/**
 * Track CTA (Call-to-Action) click
 * 
 * @param ctaName - CTA name or ID
 * @param location - Where the CTA is located
 * 
 * @example
 * ```ts
 * trackCTAClick('book_now', 'homepage_hero');
 * ```
 */
export function trackCTAClick(ctaName: string, location: string): void {
  trackEvent('cta_click', {
    cta_name: ctaName,
    cta_location: location
  });
}

/**
 * Track user engagement time
 * 
 * @param page - Page name
 * @param timeInSeconds - Time spent in seconds
 * 
 * @example
 * ```ts
 * trackEngagementTime('booking_page', 180);
 * ```
 */
export function trackEngagementTime(page: string, timeInSeconds: number): void {
  trackEvent('user_engagement', {
    engagement_time_msec: timeInSeconds * 1000,
    page_name: page
  });
}

/**
 * Track scroll depth
 * 
 * @param depth - Scroll depth percentage
 * @param page - Page name
 * 
 * @example
 * ```ts
 * trackScrollDepth(75, 'home');
 * ```
 */
export function trackScrollDepth(depth: number, page: string): void {
  const milestones = [25, 50, 75, 100];
  const milestone = milestones.find((m) => depth >= m);

  if (milestone) {
    trackEvent('scroll', {
      percent_scrolled: milestone,
      page_name: page
    });
  }
}

/**
 * Set user properties
 * 
 * @param properties - User properties
 * 
 * @example
 * ```ts
 * setUserProperties({
 *   user_type: 'returning',
 *   preferred_language: 'pt'
 * });
 * ```
 */
export function setUserProperties(properties: EventParams): void {
  if (typeof window === 'undefined') return;

  try {
    if (typeof window.gtag === 'function') {
      window.gtag('set', 'user_properties', properties);
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics] User properties:', properties);
    }
  } catch (error) {
    console.error('[Analytics] Error setting user properties:', error);
  }
}

/**
 * Set user ID
 * 
 * @param userId - User ID
 * 
 * @example
 * ```ts
 * setUserId('user_12345');
 * ```
 */
export function setUserId(userId: string): void {
  if (typeof window === 'undefined') return;

  try {
    if (typeof window.gtag === 'function') {
      window.gtag('set', { user_id: userId });
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics] User ID:', userId);
    }
  } catch (error) {
    console.error('[Analytics] Error setting user ID:', error);
  }
}

/**
 * Track outbound link click
 * 
 * @param url - Destination URL
 * @param linkText - Link text or description
 * 
 * @example
 * ```ts
 * trackOutboundLink('https://booking.com', 'View on Booking.com');
 * ```
 */
export function trackOutboundLink(url: string, linkText?: string): void {
  trackEvent('click', {
    link_url: url,
    link_text: linkText,
    link_domain: new URL(url).hostname,
    outbound: true
  });
}

/**
 * Declare global window types
 */
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    fbq?: (...args: any[]) => void;
  }
}
