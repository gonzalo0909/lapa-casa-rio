// src/components/analytics/event-tracker.tsx

'use client';

import { useEffect, useRef, ReactNode, MouseEvent, FocusEvent, ChangeEvent } from 'react';
import { useAnalytics } from './analytics-provider';

interface EventTrackerProps {
  children: ReactNode;
  trackClicks?: boolean;
  trackForms?: boolean;
  trackLinks?: boolean;
  trackButtons?: boolean;
  trackScroll?: boolean;
  trackHover?: boolean;
  customEvents?: Array<{
    selector: string;
    event: string;
    category: string;
    action: string;
    label?: string;
  }>;
}

export function EventTracker({
  children,
  trackClicks = true,
  trackForms = true,
  trackLinks = true,
  trackButtons = true,
  trackScroll = false,
  trackHover = false,
  customEvents = []
}: EventTrackerProps) {
  const analytics = useAnalytics();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    // Track clicks generales
    if (trackClicks) {
      const handleClick = (event: MouseEvent<HTMLElement>) => {
        const target = event.target as HTMLElement;
        const elementType = target.tagName.toLowerCase();
        const elementId = target.id || '';
        const elementClass = target.className || '';
        const elementText = target.textContent?.trim().substring(0, 50) || '';

        analytics.trackEvent('element_click', 'interaction', elementType, 1);

        // Track información adicional
        if (elementId) {
          analytics.trackEvent('element_click_id', 'interaction', elementId);
        }

        if (elementText) {
          analytics.trackEvent('element_click_text', 'interaction', elementText);
        }
      };

      container.addEventListener('click', handleClick as any);
    }

    // Track interacciones con formularios
    if (trackForms) {
      const handleFormSubmit = (event: Event) => {
        const form = event.target as HTMLFormElement;
        const formName = form.name || form.id || 'unnamed_form';
        const formMethod = form.method || 'get';
        const formAction = form.action || '';

        analytics.trackEvent('form_submit', 'form', formName);
        analytics.trackEvent('form_method', 'form', formMethod);
      };

      const handleFormFocus = (event: FocusEvent<HTMLInputElement>) => {
        const input = event.target as HTMLInputElement;
        const inputType = input.type || 'text';
        const inputName = input.name || input.id || 'unnamed_input';
        const formName = input.form?.name || input.form?.id || 'unnamed_form';

        analytics.trackEvent('form_field_focus', 'form', `${formName}_${inputName}`);
      };

      const handleFormChange = (event: ChangeEvent<HTMLInputElement>) => {
        const input = event.target as HTMLInputElement;
        const inputType = input.type || 'text';
        const inputName = input.name || input.id || 'unnamed_input';
        const hasValue = input.value.length > 0;

        analytics.trackEvent('form_field_change', 'form', inputName);
        
        if (hasValue) {
          analytics.trackEvent('form_field_completed', 'form', inputName);
        }
      };

      container.addEventListener('submit', handleFormSubmit);
      container.addEventListener('focus', handleFormFocus as any, true);
      container.addEventListener('change', handleFormChange as any);
    }

    // Track clicks en enlaces
    if (trackLinks) {
      const handleLinkClick = (event: MouseEvent<HTMLAnchorElement>) => {
        const link = event.target as HTMLAnchorElement;
        const href = link.href;
        const linkText = link.textContent?.trim() || '';
        const isExternal = href && !href.startsWith(window.location.origin);
        const isDownload = link.hasAttribute('download');

        analytics.trackEvent('link_click', 'navigation', isExternal ? 'external' : 'internal');
        
        if (linkText) {
          analytics.trackEvent('link_text', 'navigation', linkText);
        }

        if (isExternal) {
          analytics.trackEvent('external_link', 'navigation', href);
        }

        if (isDownload) {
          analytics.trackEvent('download_link', 'navigation', href);
        }
      };

      const links = container.querySelectorAll('a');
      links.forEach(link => {
        link.addEventListener('click', handleLinkClick as any);
      });
    }

    // Track clicks en botones específicos
    if (trackButtons) {
      const handleButtonClick = (event: MouseEvent<HTMLButtonElement>) => {
        const button = event.target as HTMLButtonElement;
        const buttonText = button.textContent?.trim() || '';
        const buttonType = button.type || 'button';
        const buttonId = button.id || '';
        const buttonClass = button.className || '';

        analytics.trackEvent('button_click', 'interaction', buttonType);
        
        if (buttonText) {
          analytics.trackEvent('button_text', 'interaction', buttonText);
        }

        if (buttonId) {
          analytics.trackEvent('button_id', 'interaction', buttonId);
        }

        // Track botones específicos del booking
        if (buttonText.toLowerCase().includes('reservar') || buttonText.toLowerCase().includes('book')) {
          analytics.trackEvent('booking_button_click', 'conversion', 'booking_cta');
        }

        if (buttonText.toLowerCase().includes('pagar') || buttonText.toLowerCase().includes('pay')) {
          analytics.trackEvent('payment_button_click', 'conversion', 'payment_cta');
        }

        if (buttonText.toLowerCase().includes('buscar') || buttonText.toLowerCase().includes('search')) {
          analytics.trackEvent('search_button_click', 'interaction', 'search_cta');
        }
      };

      const buttons = container.querySelectorAll('button, input[type="button"], input[type="submit"]');
      buttons.forEach(button => {
        button.addEventListener('click', handleButtonClick as any);
      });
    }

    // Track eventos de hover
    if (trackHover) {
      const handleMouseEnter = (event: MouseEvent<HTMLElement>) => {
        const target = event.target as HTMLElement;
        const elementType = target.tagName.toLowerCase();
        const elementId = target.id || '';

        analytics.trackEvent('element_hover', 'interaction', elementType);
        
        if (elementId) {
          analytics.trackEvent('element_hover_id', 'interaction', elementId);
        }
      };

      container.addEventListener('mouseenter', handleMouseEnter as any, true);
    }

    // Track eventos personalizados
    customEvents.forEach(({ selector, event, category, action, label }) => {
      const elements = container.querySelectorAll(selector);
      elements.forEach(element => {
        element.addEventListener(event, () => {
          analytics.trackEvent(action, category, label || selector);
        });
      });
    });

    // Cleanup
    return () => {
      // Los event listeners se limpian automáticamente cuando el DOM cambia
    };
  }, [analytics, trackClicks, trackForms, trackLinks, trackButtons, trackHover, customEvents]);

  return (
    <div ref={containerRef} style={{ display: 'contents' }}>
      {children}
    </div>
  );
}

// Hook para tracking manual de eventos
export function useEventTracking() {
  const analytics = useAnalytics();

  const trackCustomEvent = (action: string, category: string, label?: string, value?: number) => {
    analytics.trackEvent(action, category, label, value);
  };

  const trackUserAction = (action: string, element: string, context?: string) => {
    analytics.trackEvent(action, 'user_action', `${element}${context ? `_${context}` : ''}`);
  };

  const trackBusinessEvent = (event: string, value?: number, properties?: Record<string, any>) => {
    analytics.trackEvent(event, 'business', event, value);
    
    if (properties) {
      Object.entries(properties).forEach(([key, val]) => {
        analytics.trackEvent(`${event}_${key}`, 'business_property', 
          typeof val === 'string' ? val : undefined,
          typeof val === 'number' ? val : undefined
        );
      });
    }
  };

  return {
    trackCustomEvent,
    trackUserAction,
    trackBusinessEvent
  };
}

// Componente específico para tracking de booking
export function BookingEventTracker({ children }: { children: ReactNode }) {
  const analytics = useAnalytics();

  const bookingEvents = [
    {
      selector: '[data-track="room-select"]',
      event: 'click',
      category: 'booking',
      action: 'room_selection',
      label: 'room_card_click'
    },
    {
      selector: '[data-track="date-picker"]',
      event: 'change',
      category: 'booking',
      action: 'date_selection',
      label: 'date_picker_change'
    },
    {
      selector: '[data-track="guest-count"]',
      event: 'change',
      category: 'booking',
      action: 'guest_count_change',
      label: 'guest_input'
    },
    {
      selector: '[data-track="price-calculator"]',
      event: 'click',
      category: 'booking',
      action: 'price_calculation',
      label: 'price_calculator_interaction'
    },
    {
      selector: '[data-track="booking-form"]',
      event: 'submit',
      category: 'booking',
      action: 'booking_form_submit',
      label: 'booking_form'
    },
    {
      selector: '[data-track="payment-method"]',
      event: 'change',
      category: 'payment',
      action: 'payment_method_selection',
      label: 'payment_method_radio'
    }
  ];

  return (
    <EventTracker
      trackClicks={true}
      trackForms={true}
      trackLinks={true}
      trackButtons={true}
      customEvents={bookingEvents}
    >
      {children}
    </EventTracker>
  );
}

// Componente para tracking de errores de formulario
export function FormErrorTracker({ formName }: { formName: string }) {
  const analytics = useAnalytics();

  useEffect(() => {
    const handleInvalidInput = (event: Event) => {
      const input = event.target as HTMLInputElement;
      const fieldName = input.name || input.id || 'unknown_field';
      const errorMessage = input.validationMessage || 'validation_error';

      analytics.trackEvent('form_validation_error', 'form_error', `${formName}_${fieldName}`);
      analytics.trackEvent('validation_message', 'form_error', errorMessage);
    };

    const handleFormError = (event: Event) => {
      analytics.trackEvent('form_submission_error', 'form_error', formName);
    };

    document.addEventListener('invalid', handleInvalidInput, true);
    document.addEventListener('formerror', handleFormError, true);

    return () => {
      document.removeEventListener('invalid', handleInvalidInput, true);
      document.removeEventListener('formerror', handleFormError, true);
    };
  }, [analytics, formName]);

  return null;
}

// Componente para tracking de performance de elementos
export function ElementPerformanceTracker({ 
  elementSelector,
  trackVisibility = true,
  trackLoadTime = true,
  trackInteractionLatency = true
}: {
  elementSelector: string;
  trackVisibility?: boolean;
  trackLoadTime?: boolean;
  trackInteractionLatency?: boolean;
}) {
  const analytics = useAnalytics();

  useEffect(() => {
    const element = document.querySelector(elementSelector);
    if (!element) return;

    // Track tiempo de carga del elemento
    if (trackLoadTime) {
      const loadStartTime = performance.now();
      
      const checkElementReady = () => {
        if (element.getBoundingClientRect().height > 0) {
          const loadTime = performance.now() - loadStartTime;
          analytics.trackEvent('element_load_time', 'performance', elementSelector, Math.round(loadTime));
        } else {
          setTimeout(checkElementReady, 10);
        }
      };
      
      checkElementReady();
    }

    // Track visibilidad del elemento
    if (trackVisibility && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            analytics.trackEvent('element_visible', 'visibility', elementSelector);
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.5 });

      observer.observe(element);
    }

    // Track latencia de interacción
    if (trackInteractionLatency) {
      let interactionStartTime = 0;

      const handleInteractionStart = () => {
        interactionStartTime = performance.now();
      };

      const handleInteractionEnd = () => {
        if (interactionStartTime > 0) {
          const latency = performance.now() - interactionStartTime;
          analytics.trackEvent('interaction_latency', 'performance', elementSelector, Math.round(latency));
        }
      };

      element.addEventListener('mousedown', handleInteractionStart);
      element.addEventListener('touchstart', handleInteractionStart);
      element.addEventListener('click', handleInteractionEnd);
      element.addEventListener('touchend', handleInteractionEnd);
    }

  }, [analytics, elementSelector, trackVisibility, trackLoadTime, trackInteractionLatency]);

  return null;
}

// Componente para tracking de scroll en secciones específicas
export function SectionScrollTracker({ 
  sectionName,
  threshold = 0.5
}: { 
  sectionName: string;
  threshold?: number;
}) {
  const analytics = useAnalytics();
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            analytics.trackEvent('section_viewed', 'content', sectionName);
            
            // Track tiempo que el usuario pasa viendo la sección
            const startTime = Date.now();
            
            const handleVisibilityChange = () => {
              if (document.hidden) {
                const viewTime = Date.now() - startTime;
                analytics.trackEvent('section_view_time', 'engagement', sectionName, Math.round(viewTime / 1000));
              }
            };

            document.addEventListener('visibilitychange', handleVisibilityChange, { once: true });
          }
        });
      },
      { threshold }
    );

    observer.observe(sectionRef.current);

    return () => {
      observer.disconnect();
    };
  }, [analytics, sectionName, threshold]);

  return <div ref={sectionRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '1px', pointerEvents: 'none' }} />;
}

// HOC para agregar tracking automático a componentes
export function withEventTracking<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  trackingConfig: {
    componentName: string;
    trackMounts?: boolean;
    trackProps?: string[];
    trackErrors?: boolean;
  }
) {
  return function TrackedComponent(props: P) {
    const analytics = useAnalytics();
    const mountTime = useRef<number>(0);

    useEffect(() => {
      if (trackingConfig.trackMounts) {
        mountTime.current = Date.now();
        analytics.trackEvent('component_mount', 'component', trackingConfig.componentName);
      }

      return () => {
        if (trackingConfig.trackMounts) {
          const sessionTime = Date.now() - mountTime.current;
          analytics.trackEvent('component_unmount', 'component', trackingConfig.componentName, Math.round(sessionTime / 1000));
        }
      };
    }, [analytics]);

    // Track cambios en props específicas
    useEffect(() => {
      if (trackingConfig.trackProps) {
        trackingConfig.trackProps.forEach(propName => {
          const propValue = (props as any)[propName];
          if (propValue !== undefined) {
            analytics.trackEvent('prop_change', 'component', `${trackingConfig.componentName}_${propName}`);
          }
        });
      }
    }, [analytics, props]);

    // Track errores si está habilitado
    if (trackingConfig.trackErrors) {
      try {
        return <WrappedComponent {...props} />;
      } catch (error) {
        analytics.trackEvent('component_error', 'error', trackingConfig.componentName);
        throw error;
      }
    }

    return <WrappedComponent {...props} />;
  };
}
