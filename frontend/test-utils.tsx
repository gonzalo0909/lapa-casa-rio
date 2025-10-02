// lapa-casa-hostel/tests/frontend/test-utils.tsx

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IntlProvider } from 'next-intl';

/**
 * @fileoverview Test utilities for frontend component testing
 * Provides wrapped render function with providers and mock data
 */

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  locale?: string;
  queryClient?: QueryClient;
}

const messages = {
  pt: {
    booking: {
      checkIn: 'Data de entrada',
      checkOut: 'Data de saída',
      selectDates: 'Selecione as datas',
      selectRoom: 'Selecione pelo menos um quarto',
      continue: 'Continuar',
      back: 'Voltar'
    },
    payment: {
      creditCard: 'Cartão de crédito',
      pix: 'PIX',
      mercadoPago: 'Mercado Pago',
      payDeposit: 'Pagar depósito',
      processing: 'Processando'
    }
  }
};

/**
 * Custom render function that wraps components with necessary providers
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    locale = 'pt',
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    }),
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <IntlProvider locale={locale} messages={messages[locale]}>
          {children}
        </IntlProvider>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Mock booking data for tests
 */
export const mockBookingData = {
  checkIn: '2025-07-01',
  checkOut: '2025-07-05',
  rooms: [
    { id: 'room_mixto_12a', beds: 8, basePrice: 60 }
  ],
  guest: {
    name: 'Test User',
    email: 'test@example.com',
    phone: '+5521999999999',
    country: 'BR'
  }
};

/**
 * Mock availability response
 */
export const mockAvailability = {
  available: true,
  rooms: [
    {
      id: 'room_mixto_12a',
      name: 'Mixto 12A',
      capacity: 12,
      type: 'mixed',
      available: 12,
      basePrice: 60.00,
      isFlexible: false
    },
    {
      id: 'room_mixto_12b',
      name: 'Mixto 12B',
      capacity: 12,
      type: 'mixed',
      available: 12,
      basePrice: 60.00,
      isFlexible: false
    },
    {
      id: 'room_mixto_7',
      name: 'Mixto 7',
      capacity: 7,
      type: 'mixed',
      available: 7,
      basePrice: 60.00,
      isFlexible: false
    },
    {
      id: 'room_flexible_7',
      name: 'Flexible 7',
      capacity: 7,
      type: 'female',
      available: 7,
      basePrice: 60.00,
      isFlexible: true
    }
  ]
};

/**
 * Mock payment intent response
 */
export const mockPaymentIntent = {
  clientSecret: 'pi_test_secret_123',
  amount: 41472,
  currency: 'brl',
  status: 'requires_payment_method'
};

/**
 * Mock successful payment response
 */
export const mockPaymentSuccess = {
  paymentIntent: {
    id: 'pi_123456',
    status: 'succeeded',
    amount: 41472,
    currency: 'brl'
  },
  bookingId: 'booking_123456'
};

/**
 * Mock PIX payment response
 */
export const mockPixPayment = {
  qrCode: '00020126580014br.gov.bcb.pix0136a629532e-7693-4846-852d-1bbff6b2f8cd520400005303986540510.005802BR5913Lapa Casa6009Sao Paulo62070503***63041D3D',
  qrCodeUrl: 'https://example.com/qr-code.png',
  paymentId: 'pix_123456',
  expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
};

/**
 * Wait for element with custom timeout
 */
export async function waitForElement(
  callback: () => Promise<void>,
  timeout = 5000
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      await callback();
      return;
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  throw new Error('Timeout waiting for element');
}

/**
 * Mock window.matchMedia for responsive tests
 */
export function mockMatchMedia(width: number) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: width <= parseInt(query.match(/\d+/)?.[0] || '0'),
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn()
    }))
  });
}

/**
 * Mock IntersectionObserver
 */
export function mockIntersectionObserver() {
  global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    takeRecords() { return []; }
    unobserve() {}
  } as any;
}

/**
 * Mock ResizeObserver
 */
export function mockResizeObserver() {
  global.ResizeObserver = class ResizeObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    unobserve() {}
  } as any;
}

/**
 * Create mock user event
 */
export function createMockEvent(type: string, data: any = {}) {
  return {
    type,
    target: { value: '', ...data },
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    ...data
  };
}

/**
 * Mock fetch for API calls
 */
export function mockFetch(response: any, status = 200) {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(JSON.stringify(response))
    } as Response)
  );
}

/**
 * Mock console methods to suppress warnings
 */
export function suppressConsole() {
  const originalError = console.error;
  const originalWarn = console.warn;

  beforeAll(() => {
    console.error = jest.fn();
    console.warn = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
    console.warn = originalWarn;
  });
}

/**
 * Create mock router for Next.js
 */
export function createMockRouter(overrides: any = {}) {
  return {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
    route: '/',
    ...overrides
  };
}

/**
 * Mock local storage
 */
export function mockLocalStorage() {
  const store: Record<string, string> = {};

  const mockStorage = {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    })
  };

  Object.defineProperty(window, 'localStorage', {
    value: mockStorage,
    writable: true
  });

  return mockStorage;
}

/**
 * Mock session storage
 */
export function mockSessionStorage() {
  const store: Record<string, string> = {};

  const mockStorage = {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    })
  };

  Object.defineProperty(window, 'sessionStorage', {
    value: mockStorage,
    writable: true
  });

  return mockStorage;
}

/**
 * Wait for async updates
 */
export async function flushPromises() {
  return new Promise(resolve => setImmediate(resolve));
}

/**
 * Create test query client
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0
      },
      mutations: {
        retry: false
      }
    },
    logger: {
      log: console.log,
      warn: console.warn,
      error: () => {}
    }
  });
}

// Re-export everything from testing library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
