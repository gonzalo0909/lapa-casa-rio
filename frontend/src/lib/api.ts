// lapa-casa-hostel/frontend/src/lib/api.ts

/**
 * API Client Library
 * 
 * HTTP client for Lapa Casa backend API.
 * Handles requests, responses, errors, and authentication.
 * 
 * @module lib/api
 */

/**
 * API configuration
 */
const API_CONFIG = {
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
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
export interface APIResponse<T = any> {
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
 * Booking API endpoints — alineados con backend/src/routes/bookings/bookings.routes.ts
 */
export const bookingAPI = {
  /**
   * Create new booking. Body shape matches create-booking.ts exactamente
   * (roomId = room_types.id real, guest.firstName/lastName por separado).
   */
  create: (data: {
    checkIn: string;
    checkOut: string;
    rooms: Array<{ roomId: string; bedsCount: number; preferredBedIds?: string[] }>;
    guest: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      country: string;
      document?: string;
    };
    /** Acompañantes declarados en el checkout (tabla booking_guests). */
    additionalGuests?: Array<{
      fullName: string;
      document: string;
      documentType?: string;
    }>;
    specialRequests?: string;
    arrivalTime?: string;
    language?: 'pt' | 'es' | 'en' | 'fr' | 'de';
    source?: string;
    guestGender?: 'mixed' | 'female';
  }) => api.post('/bookings', data),

  /**
   * Get booking by ID
   */
  getById: (bookingId: string) => api.get(`/bookings/${bookingId}`),

  /**
   * Update booking (fechas/habitaciones bloqueadas dentro de 48h del check-in)
   */
  update: (bookingId: string, data: any) => api.patch(`/bookings/${bookingId}`, data),

  /**
   * Cancel booking. El backend calcula el reembolso automático según política.
   */
  cancel: (bookingId: string, reason?: string) =>
    api.delete(`/bookings/${bookingId}${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`),

  /**
   * Confirmation details (número de confirmación, QR, instrucciones de check-in)
   */
  getConfirmation: (bookingId: string) => api.get(`/bookings/${bookingId}/confirmation`)
};

/**
 * Availability API endpoints — alineados con backend/src/routes/availability/
 */
export const availabilityAPI = {
  /**
   * Check availability for date range (devuelve las 5 habitaciones reales + pricing)
   */
  check: (params: { checkIn: string; checkOut: string; beds: number }) =>
    api.get(`/availability/check?checkIn=${params.checkIn}&checkOut=${params.checkOut}&beds=${params.beds}`),

  /**
   * Get single room availability. roomId = room_types.id real (UUID).
   */
  getRoomAvailability: (roomId: string, params: { checkIn: string; checkOut: string }) =>
    api.get(`/availability/room/${roomId}?checkIn=${params.checkIn}&checkOut=${params.checkOut}`),

  /**
   * Monthly calendar of occupancy
   */
  getCalendar: (params: { month: string; roomId?: string }) =>
    api.get(`/availability/calendar?month=${params.month}${params.roomId ? `&roomId=${params.roomId}` : ''}`),

  /**
   * Precio real (temporada + descuento de grupo real, no un cálculo del
   * navegador) para los cuartos/camas que el huésped ya eligió.
   */
  quote: (data: { checkIn: string; checkOut: string; rooms: Array<{ roomId: string; bedsCount: number }> }) =>
    api.post('/availability/quote', data),

  /**
   * Disponibilidad de los 10 apartamentos para el rango de fechas indicado.
   */
  checkApartments: (params: { checkIn: string; checkOut: string }) =>
    api.get(`/availability/apartments?checkIn=${params.checkIn}&checkOut=${params.checkOut}`),

  /**
   * Fechas de Carnaval (system_config.carnival_dates), públicas, para pintar
   * el calendario del motor de Apartamentos antes de elegir fechas.
   */
  getCarnivalDates: () => api.get('/availability/carnival-dates'),
};

/**
 * Payment API endpoints — alineados con backend/src/routes/payments/
 */
export const paymentAPI = {
  /**
   * Create a payment intent (Stripe o Mercado Pago, depósito o saldo)
   */
  createIntent: (data: {
    reservationId: string;
    paymentType: 'deposit' | 'remaining';
    provider: 'stripe' | 'mercadopago';
    currency?: string;
    installments?: number;
  }) => api.post('/payments/intent', data),

  /**
   * Confirm a payment by its ID
   */
  confirm: (paymentId: string) => api.post('/payments/confirm', { paymentId }),

  /**
   * Process the deposit shortcut for a reservation
   */
  processDeposit: (reservationId: string, provider: 'stripe' | 'mercadopago', installments?: number) =>
    api.post('/payments/deposit', { reservationId, provider, installments }),

  /**
   * Get payment status
   */
  getStatus: (paymentId: string) => api.get(`/payments/${paymentId}/status`),

  /**
   * Full payment history for a reservation
   */
  getByReservation: (reservationId: string) => api.get(`/payments/reservation/${reservationId}`)
};

/**
 * Rooms API endpoints — alineados con backend/src/routes/rooms/
 */
export const roomsAPI = {
  /**
   * List all rooms (las 5 reales) + info del hostel, precios base, descuentos, políticas
   */
  list: () => api.get('/rooms'),

  /**
   * Get room by real room_types.id UUID
   */
  getById: (roomId: string) => api.get(`/rooms/${roomId}`),

  /**
   * Flexible-7 conversion status/prediction for a date
   */
  getFlexibleStatus: (date: string) => api.get(`/rooms/flexible/status?date=${date}`)
};

/**
 * Photos API — galería pública de fotos de huéspedes ("bitácora de viajantes"),
 * alineada con backend/src/routes/photos/photos.routes.ts. Solo lectura:
 * la carga es exclusiva del admin (backend/src/admin/photos.html).
 */
export const photosAPI = {
  list: () => api.get('/photos')
};

/**
 * Handle API errors globally
 * 
 * @param error - Error object
 * @returns Formatted error message
 */
const GENERIC_ERROR_TEXT: Record<string, { timeout: string; unexpected: string }> = {
  pt: { timeout: 'A conexão demorou demais. Tente novamente.', unexpected: 'Ocorreu um erro inesperado. Tente novamente.' },
  es: { timeout: 'La conexión demoró demasiado. Intentá de nuevo.', unexpected: 'Ocurrió un error inesperado. Intentá de nuevo.' },
  en: { timeout: 'The connection timed out. Please try again.', unexpected: 'An unexpected error occurred. Please try again.' },
  fr: { timeout: 'La connexion a pris trop de temps. Réessayez.', unexpected: 'Une erreur inattendue est survenue. Réessayez.' },
  de: { timeout: 'Die Verbindung hat zu lange gedauert. Bitte versuchen Sie es erneut.', unexpected: 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' },
};

export function handleAPIError(error: unknown, locale: 'pt' | 'es' | 'en' | 'fr' | 'de' = 'pt'): string {
  const text = GENERIC_ERROR_TEXT[locale] ?? GENERIC_ERROR_TEXT.pt!;

  if (error instanceof APIError) {
    return error.message;
  }

  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return text.timeout;
    }
    return error.message;
  }

  return text.unexpected;
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
