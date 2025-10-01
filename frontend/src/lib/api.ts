// lapa-casa-hostel/frontend/src/lib/api.ts

/**
 * API Client Library
 * 
 * HTTP client for Lapa Casa Hostel backend API.
 * Handles requests, responses, errors, and authentication.
 * 
 * @module lib/api
 */

/**
 * API configuration
 */
const API_CONFIG = {
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000
} as const;

/**
 * API error class
 */
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * HTTP methods
 */
type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Request options interface
 */
interface RequestOptions {
  method?: HTTPMethod;
  body?: any;
  headers?: Record<string, string>;
  timeout?: number;
  retry?: boolean;
  token?: string;
}

/**
 * API response interface
 */
interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  statusCode?: number;
}

/**
 * Make HTTP request with retry logic
 * 
 * @param endpoint - API endpoint
 * @param options - Request options
 * @returns Response data
 */
async function request<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    body,
    headers = {},
    timeout = API_CONFIG.timeout,
    retry = true,
    token
  } = options;

  const url = `${API_CONFIG.baseURL}${endpoint}`;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers
  };

  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  const requestOptions: RequestInit = {
    method,
    headers: requestHeaders,
    credentials: 'include'
  };

  if (body && method !== 'GET') {
    requestOptions.body = JSON.stringify(body);
  }

  let lastError: Error | null = null;
  const maxAttempts = retry ? API_CONFIG.retryAttempts : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...requestOptions,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type');
      const isJSON = contentType?.includes('application/json');

      let responseData: any;
      if (isJSON) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      if (!response.ok) {
        throw new APIError(
          responseData?.message || responseData?.error || 'Request failed',
          response.status,
          responseData?.code,
          responseData
        );
      }

      return responseData as T;
    } catch (error) {
      lastError = error as Error;

      if (error instanceof APIError && error.statusCode && error.statusCode < 500) {
        throw error;
      }

      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, API_CONFIG.retryDelay * (attempt + 1))
        );
        continue;
      }

      throw error;
    }
  }

  throw lastError || new Error('Request failed');
}

/**
 * API client object
 */
export const api = {
  /**
   * GET request
   */
  get: <T = any>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  /**
   * POST request
   */
  post: <T = any>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method'>) =>
    request<T>(endpoint, { ...options, method: 'POST', body }),

  /**
   * PUT request
   */
  put: <T = any>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method'>) =>
    request<T>(endpoint, { ...options, method: 'PUT', body }),

  /**
   * PATCH request
   */
  patch: <T = any>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method'>) =>
    request<T>(endpoint, { ...options, method: 'PATCH', body }),

  /**
   * DELETE request
   */
  delete: <T = any>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(endpoint, { ...options, method: 'DELETE' })
};

/**
 * Booking API endpoints
 */
export const bookingAPI = {
  /**
   * Create new booking
   */
  create: (data: {
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    checkIn: string;
    checkOut: string;
    rooms: Array<{ roomId: string; beds: number }>;
    specialRequests?: string;
  }) => api.post('/bookings', data),

  /**
   * Get booking by ID
   */
  getById: (bookingId: string) => api.get(`/bookings/${bookingId}`),

  /**
   * Update booking
   */
  update: (bookingId: string, data: any) => api.put(`/bookings/${bookingId}`, data),

  /**
   * Cancel booking
   */
  cancel: (bookingId: string, reason?: string) =>
    api.post(`/bookings/${bookingId}/cancel`, { reason }),

  /**
   * Confirm booking
   */
  confirm: (bookingId: string) => api.post(`/bookings/${bookingId}/confirm`)
};

/**
 * Availability API endpoints
 */
export const availabilityAPI = {
  /**
   * Check availability for date range
   */
  check: (params: { checkIn: string; checkOut: string; beds: number }) =>
    api.get(`/availability/check?checkIn=${params.checkIn}&checkOut=${params.checkOut}&beds=${params.beds}`),

  /**
   * Get room availability
   */
  getRoomAvailability: (roomId: string, params: { checkIn: string; checkOut: string }) =>
    api.get(`/availability/rooms/${roomId}?checkIn=${params.checkIn}&checkOut=${params.checkOut}`)
};

/**
 * Payment API endpoints
 */
export const paymentAPI = {
  /**
   * Create payment intent (Stripe)
   */
  createIntent: (data: { bookingId: string; amount: number; currency: string }) =>
    api.post('/payments/create-intent', data),

  /**
   * Confirm payment
   */
  confirm: (paymentId: string, data: { paymentMethodId: string }) =>
    api.post(`/payments/${paymentId}/confirm`, data),

  /**
   * Process deposit
   */
  processDeposit: (bookingId: string) => api.post(`/payments/${bookingId}/deposit`),

  /**
   * Get payment status
   */
  getStatus: (paymentId: string) => api.get(`/payments/${paymentId}/status`)
};

/**
 * Rooms API endpoints
 */
export const roomsAPI = {
  /**
   * List all rooms
   */
  list: () => api.get('/rooms'),

  /**
   * Get room by ID
   */
  getById: (roomId: string) => api.get(`/rooms/${roomId}`),

  /**
   * Get room pricing
   */
  getPricing: (roomId: string, params: { checkIn: string; checkOut: string; beds: number }) =>
    api.get(`/rooms/${roomId}/pricing?checkIn=${params.checkIn}&checkOut=${params.checkOut}&beds=${params.beds}`)
};

/**
 * Handle API errors globally
 * 
 * @param error - Error object
 * @returns Formatted error message
 */
export function handleAPIError(error: unknown): string {
  if (error instanceof APIError) {
    return error.message;
  }

  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return 'Request timeout. Please try again.';
    }
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Check if error is network error
 * 
 * @param error - Error object
 * @returns True if network error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return error.message.includes('fetch') || error.message.includes('network');
  }
  return false;
}

/**
 * Check if error is timeout error
 * 
 * @param error - Error object
 * @returns True if timeout error
 */
export function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.name === 'AbortError';
  }
  return false;
}

export default api;
