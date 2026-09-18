
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
  retryDelay: 1000,
} as const;

/**
 * API error class
 */
/**
 * Lee el valor de una cookie no-httpOnly por nombre (para el token CSRF
 * del panel de administradores de apartamento, ver owner-auth.routes.ts).
 * Solo funciona client-side -- `document` no existe en SSR, pero este
 * cliente solo se usa desde componentes de cliente ('use client').
 */
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match?.[1] !== undefined ? decodeURIComponent(match[1]) : null;
}

/**
 * Persiste el CSRF token en localStorage (cross-origin: el backend está en
 * un dominio distinto al frontend en producción, por lo que document.cookie
 * no puede leer la cookie lch_owner_csrf del dominio de la API). Se llama
 * automáticamente desde request() cuando la respuesta incluye csrfToken.
 */
function storeCsrfToken(token: string): void {
  try {
    localStorage.setItem('lch_owner_csrf', token);
  } catch {
    // localStorage no disponible (modo privado extremo, etc.) -- degradación
    // silenciosa: la cookie seguirá intentándose como fallback.
  }
}

/**
 * Lee el CSRF token: primero localStorage (configuración cross-origin con
 * el backend en Fly.io), después la cookie (same-origin / local dev).
 */
function readCsrfToken(): string | null {
  try {
    const fromStorage = localStorage.getItem('lch_owner_csrf');
    if (fromStorage) { return fromStorage; }
  } catch {
    // localStorage inaccesible -- caer al cookie
  }
  return getCookie('lch_owner_csrf');
}

/**
 * Para los pocos requests que arman su propio FormData en vez de pasar por
 * `request()` de arriba (ver owner-api.ts uploadPhoto) -- mismo token,
 * mismo header, expuesto acá para no duplicar la lectura de la cookie.
 */
export function getCsrfHeader(): Record<string, string> {
  const csrfToken = readCsrfToken();
  return csrfToken ? { 'x-csrf-token': csrfToken } : {};
}

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string,
    public details?: any,
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
async function request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    headers = {},
    timeout = API_CONFIG.timeout,
    retry = true,
    token,
  } = options;

  const url = `${API_CONFIG.baseURL}${endpoint}`;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  // Agrega Bearer token solo si se pasa explícitamente. El panel admin real
  // es la app vanilla JS servida aparte por el backend (backend/src/admin/)
  // y se autentica con su propia cookie httpOnly -- este cliente Next.js
  // nunca llama a un endpoint /admin/*, así que no hay token de admin que
  // leer acá.
  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  // CSRF (patrón doble cookie, ver backend/src/middleware/csrf.ts): solo
  // aplica a las requests autenticadas del panel de administradores de
  // apartamento. En producción el token se lee de localStorage (el backend
  // está en otro dominio y document.cookie no puede leer sus cookies). En
  // local dev cae al cookie como fallback. Las rutas públicas de reservas/
  // pagos no tienen este token, así que el header simplemente no se manda.
  if (method !== 'GET') {
    const csrfToken = readCsrfToken();
    if (csrfToken) {
      requestHeaders['x-csrf-token'] = csrfToken;
    }
  }

  const requestOptions: RequestInit = {
    method,
    headers: requestHeaders,
    credentials: 'include',
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
        signal: controller.signal,
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
          responseData,
        );
      }

      // Si la respuesta incluye un csrfToken (login / refresh del panel de
      // owners), persistirlo en localStorage para usarlo como header en los
      // siguientes requests. Esto resuelve el caso cross-origin donde el
      // frontend (lapacasario.com) no puede leer cookies del backend (Fly.io).
      const csrfInResponse =
        (responseData as any)?.data?.csrfToken ?? (responseData as any)?.csrfToken;
      if (typeof csrfInResponse === 'string' && csrfInResponse.length > 0) {
        storeCsrfToken(csrfInResponse);
      }

      return responseData as T;
    } catch (error) {
      lastError = error as Error;

      if (error instanceof APIError && error.statusCode && error.statusCode < 500) {
        throw error;
      }

      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, API_CONFIG.retryDelay * (attempt + 1)));
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
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};

/**
 * Booking API endpoints — alineados con backend/src/routes/bookings/bookings.routes.ts
 */

/** Campos comunes a ambos motores de reserva. */
type BookingCreateBase = {
  checkIn: string;
  checkOut: string;
  rooms: Array<{ roomId: string; bedsCount?: number; preferredBedIds?: string[] }>;
  guest: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    country: string;
    document?: string;
    documentPhotoBase64?: string;
  };
  additionalGuests?: Array<{
    fullName: string;
    document: string;
    documentType?: string;
    documentPhotoBase64?: string;
  }>;
  specialRequests?: string;
  arrivalTime?: string;
  language?: 'pt' | 'es' | 'en' | 'fr' | 'de' | 'it';
  source?: string;
  offerCode?: string;
};

/** Payload para reservas de hostel (camas compartidas). */
type HostelBookingData = BookingCreateBase & {
  guestGender?: 'mixed' | 'female';
};

/** Payload para reservas de apartamento. Sin guestGender: el backend lo fija como 'mixed'. */
type ApartmentBookingData = BookingCreateBase;

export const bookingAPI = {
  /**
   * Crea una reserva de hostel (camas compartidas).
   * Endpoint: POST /bookings
   */
  create: (data: HostelBookingData) => api.post('/bookings', data),

  /**
   * Crea una reserva de apartamento.
   * Endpoint: POST /apartment-bookings
   * Incluye regla 48h, programa de referidos y verificación directa por NOT EXISTS.
   */
  createApartment: (data: ApartmentBookingData) => api.post('/apartment-bookings', data),

  /**
   * Confirmation details (número de confirmación, QR, instrucciones de check-in)
   */
  getConfirmation: (bookingId: string, token?: string) =>
    api.get(`/bookings/${bookingId}/confirmation${token ? `?token=${encodeURIComponent(token)}` : ''}`),

  /**
   * Abandon a pending_payment booking (called when guest goes back from payment step).
   * Requires confirmationToken to prove ownership.
   */
  abandon: (bookingId: string, token: string) =>
    api.post(`/bookings/${bookingId}/abandon`, { token }),
};

/**
 * Availability API endpoints — alineados con backend/src/routes/availability/
 */
export const availabilityAPI = {
  /**
   * Check availability for date range (devuelve las 5 habitaciones reales + pricing)
   */
  check: (params: { checkIn: string; checkOut: string; beds: number }) =>
    api.get(
      `/availability/check?checkIn=${params.checkIn}&checkOut=${params.checkOut}&beds=${params.beds}`,
    ),

  /**
   * Monthly calendar of occupancy
   */
  getCalendar: (params: { month: string; roomId?: string }) =>
    api.get(
      `/availability/calendar?month=${params.month}${params.roomId ? `&roomId=${params.roomId}` : ''}`,
    ),

  /**
   * Precio real (temporada + descuento de grupo real, no un cálculo del
   * navegador) para los cuartos/camas que el huésped ya eligió.
   */
  quote: (data: {
    checkIn: string;
    checkOut: string;
    rooms: Array<{ roomId: string; bedsCount: number }>;
  }) => api.post('/availability/quote', data),

  /**
   * Disponibilidad de los 10 apartamentos para el rango de fechas indicado.
   */
  checkApartments: (params: { checkIn: string; checkOut: string; guests?: number }) =>
    api.get(`/availability/apartments?checkIn=${params.checkIn}&checkOut=${params.checkOut}${params.guests ? `&guests=${params.guests}` : ''}`),

  /**
   * Configuración editable del motor de apartamentos: checkinTimes y maxGuests.
   */
  getApartmentConfig: () =>
    api.get<{ checkinTimes: string[]; maxGuests: number }>('/availability/apartment-config'),

};

/** Read the HMAC confirmation token stored when the booking was created. */
export function getBookingToken(reservationId: string): string | undefined {
  try { return sessionStorage.getItem(`ct_${reservationId}`) ?? undefined; } catch { return undefined; }
}

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
    confirmationToken?: string;
  }) => api.post('/payments/intent', data),

  /**
   * Confirm a payment by its ID
   */
  confirm: (paymentId: string, reservationId: string, confirmationToken?: string) =>
    api.post('/payments/confirm', { paymentId, reservationId, confirmationToken }),

  /**
   * Process the deposit shortcut for a reservation
   */
  processDeposit: (
    reservationId: string,
    provider: 'stripe' | 'mercadopago',
    installments?: number,
    confirmationToken?: string,
  ) => api.post('/payments/deposit', { reservationId, provider, installments, confirmationToken }),

  /**
   * Process the deposit for an apartment reservation (separate engine from hostel)
   */
  processApartmentDeposit: (
    reservationId: string,
    provider: 'stripe' | 'mercadopago',
    installments?: number,
    confirmationToken?: string,
  ) => api.post('/payments/apartments/deposit', { reservationId, provider, installments, confirmationToken }),

  /**
   * Get payment status — requires reservationId + confirmationToken to prove ownership.
   */
  getStatus: (paymentId: string, reservationId: string, confirmationToken?: string) =>
    api.get(`/payments/${paymentId}/status?reservationId=${encodeURIComponent(reservationId)}${confirmationToken ? `&token=${encodeURIComponent(confirmationToken)}` : ''}`),

  /**
   * Crea una Stripe Checkout Session (pago con tarjeta) y devuelve la URL de pago
   */
  stripeCheckout: (reservationId: string, frontendUrl: string, confirmationToken?: string) =>
    api.post('/payments/stripe-checkout', { reservationId, confirmationToken, frontendUrl }),

  /**
   * Genera un link de Stripe para el flujo WhatsApp (sin reserva previa)
   */
  stripeWaLink: (
    amountBRL: number,
    description: string,
    guestEmail?: string,
    frontendUrl?: string,
  ) => api.post('/payments/stripe-wa-link', { amountBRL, description, guestEmail, frontendUrl }),

  /**
   * Crea una sesión de pago grupal — el titular organiza y todos pagan via un único link compartible
   */
  createGroupSession: (data: {
    checkIn: string;
    checkOut: string;
    totalBeds: number;
    nights: number;
    guestGender?: 'mixed' | 'female' | 'male';
    titular: {
      full_name: string;
      email: string;
      phone?: string;
      country?: string;
      language?: string;
    };
    specialRequests?: string;
    appBaseUrl?: string;
  }) => api.post('/payments/group-session', data),
};

/**
 * Photos API — galería pública de fotos de huéspedes ("bitácora de viajantes"),
 * alineada con backend/src/routes/photos/photos.routes.ts. Solo lectura:
 * la carga es exclusiva del admin (backend/src/admin/photos.html).
 */
export const photosAPI = {
  list: () => api.get('/photos'),
};

/**
 * Offers API — validación pública de códigos de descuento de apartamentos.
 * Ruta pública: POST /api/v1/offers/validate
 */
export const offersAPI = {
  // apartmentId opcional -- el hostel también usa este endpoint para
  // validar códigos de referido (idea #49), sin apartamento asociado.
  // El backend (POST /offers/validate) ya trata apartmentId como
  // opcional, solo el tipo acá no lo reflejaba.
  validate: (code: string, apartmentId: string | undefined, checkIn: string, checkOut?: string) =>
    api.post('/offers/validate', { code, apartmentId, checkIn, checkOut }),
};

/**
 * Partners API — formulario de contacto de la página pública de partners.
 * Ruta pública: POST /api/v1/partners/contact
 */
export const partnersAPI = {
  contact: (data: {
    name: string;
    email: string;
    phone?: string;
    property: string;
    message?: string;
  }) => api.post('/partners/contact', data),
};

/**
 * Handle API errors globally
 *
 * @param error - Error object
 * @returns Formatted error message
 */
const GENERIC_ERROR_TEXT: Record<string, { timeout: string; unexpected: string }> = {
  pt: {
    timeout: 'A conexão demorou demais. Tente novamente.',
    unexpected: 'Ocorreu um erro inesperado. Tente novamente.',
  },
  es: {
    timeout: 'La conexión demoró demasiado. Intentá de nuevo.',
    unexpected: 'Ocurrió un error inesperado. Intentá de nuevo.',
  },
  en: {
    timeout: 'The connection timed out. Please try again.',
    unexpected: 'An unexpected error occurred. Please try again.',
  },
  fr: {
    timeout: 'La connexion a pris trop de temps. Réessayez.',
    unexpected: 'Une erreur inattendue est survenue. Réessayez.',
  },
  de: {
    timeout: 'Die Verbindung hat zu lange gedauert. Bitte versuchen Sie es erneut.',
    unexpected: 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.',
  },
  it: {
    timeout: 'La connessione ha impiegato troppo tempo. Riprova.',
    unexpected: 'Si è verificato un errore imprevisto. Riprova.',
  },
};

export function handleAPIError(
  error: unknown,
  locale: 'pt' | 'es' | 'en' | 'fr' | 'de' | 'it' = 'pt',
): string {
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

// FIX (auditoría 17 secciones, sección 13): se eliminan roomsAPI,
// isNetworkError, isTimeoutError y el `export default api` (duplicaba el
// export nombrado `api` de arriba) -- sin ningún import externo, verificado
// con knip + grep manual.
