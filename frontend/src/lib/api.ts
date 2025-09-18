// ============================================================================
// API CLIENT - Lapa Casa Hostel MVP
// Centralized API communication with proper error handling and types
// ============================================================================

import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import type {
  ApiResponse,
  PaginatedResponse,
  Room,
  Booking,
  Payment,
  AvailabilityRequest,
  AvailabilityResponse,
  BookingFormData,
  AppError,
  ERROR_CODES
} from './types';

// ============================================================================
// Configuration
// ============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const API_TIMEOUT = 30000; // 30 seconds

// ============================================================================
// Axios Instance Setup
// ============================================================================

const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: API_TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request Interceptor
  client.interceptors.request.use(
    (config) => {
      // Add timestamp for cache busting if needed
      if (config.method === 'get') {
        config.params = {
          ...config.params,
          _t: Date.now(),
        };
      }

      // Add auth token if available (for admin endpoints)
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response Interceptor
  client.interceptors.response.use(
    (response: AxiosResponse) => {
      return response;
    },
    (error: AxiosError) => {
      const appError = handleApiError(error);
      return Promise.reject(appError);
    }
  );

  return client;
};

// ============================================================================
// Error Handling
// ============================================================================

const handleApiError = (error: AxiosError): AppError => {
  if (error.response) {
    // Server responded with error status
    const { status, data } = error.response;
    
    return {
      code: (data as any)?.error?.code || 'API_ERROR',
      message: (data as any)?.error?.message || 'An error occurred',
      statusCode: status,
      details: (data as any)?.error?.details,
    };
  } else if (error.request) {
    // Network error
    return {
      code: 'NETWORK_ERROR',
      message: 'Unable to connect to the server. Please check your internet connection.',
      statusCode: 0,
    };
  } else {
    // Request setup error
    return {
      code: 'REQUEST_ERROR',
      message: error.message || 'An unexpected error occurred',
      statusCode: 0,
    };
  }
};

// ============================================================================
// API Client Instance
// ============================================================================

const apiClient = createApiClient();

// ============================================================================
// Utility Functions
// ============================================================================

const handleResponse = <T>(response: AxiosResponse<ApiResponse<T>>): T => {
  const { data } = response;
  
  if (!data.success) {
    throw {
      code: data.error?.code || 'UNKNOWN_ERROR',
      message: data.error?.message || 'An unknown error occurred',
      statusCode: response.status,
      details: data.error?.details,
    } as AppError;
  }
  
  return data.data as T;
};

// ============================================================================
// API ENDPOINTS
// ============================================================================

export const api = {
  // ==========================================
  // ROOMS API
  // ==========================================
  
  rooms: {
    /**
     * Get all available rooms
     */
    getAll: async (): Promise<Room[]> => {
      const response = await apiClient.get<ApiResponse<Room[]>>('/api/rooms');
      return handleResponse(response);
    },

    /**
     * Get specific room by ID
     */
    getById: async (id: string): Promise<Room> => {
      const response = await apiClient.get<ApiResponse<Room>>(`/api/rooms/${id}`);
      return handleResponse(response);
    },
  },

  // ==========================================
  // AVAILABILITY API
  // ==========================================
  
  availability: {
    /**
     * Check availability for specific dates and bed count
     */
    check: async (request: AvailabilityRequest): Promise<AvailabilityResponse> => {
      const response = await apiClient.post<ApiResponse<AvailabilityResponse>>(
        '/api/availability/check',
        request
      );
      return handleResponse(response);
    },

    /**
     * Get availability calendar for date range
     */
    getCalendar: async (startDate: string, endDate: string): Promise<any[]> => {
      const response = await apiClient.get<ApiResponse<any[]>>(
        `/api/availability/calendar?startDate=${startDate}&endDate=${endDate}`
      );
      return handleResponse(response);
    },
  },

  // ==========================================
  // BOOKINGS API
  // ==========================================
  
  bookings: {
    /**
     * Create a new booking
     */
    create: async (bookingData: BookingFormData): Promise<Booking> => {
      const response = await apiClient.post<ApiResponse<Booking>>(
        '/api/bookings',
        bookingData
      );
      return handleResponse(response);
    },

    /**
     * Get booking by ID
     */
    getById: async (id: string): Promise<Booking> => {
      const response = await apiClient.get<ApiResponse<Booking>>(`/api/bookings/${id}`);
      return handleResponse(response);
    },

    /**
     * Update booking
     */
    update: async (id: string, updates: Partial<Booking>): Promise<Booking> => {
      const response = await apiClient.patch<ApiResponse<Booking>>(
        `/api/bookings/${id}`,
        updates
      );
      return handleResponse(response);
    },

    /**
     * Cancel booking
     */
    cancel: async (id: string, reason?: string): Promise<Booking> => {
      const response = await apiClient.post<ApiResponse<Booking>>(
        `/api/bookings/${id}/cancel`,
        { reason }
      );
      return handleResponse(response);
    },

    /**
     * Get bookings list (admin)
     */
    getList: async (params?: {
      page?: number;
      limit?: number;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
    }): Promise<PaginatedResponse<Booking>> => {
      const response = await apiClient.get<PaginatedResponse<Booking>>(
        '/api/bookings',
        { params }
      );
      return response.data;
    },
  },

  // ==========================================
  // PAYMENTS API
  // ==========================================
  
  payments: {
    /**
     * Create Stripe payment intent
     */
    createStripeIntent: async (bookingId: string, paymentType: 'deposit' | 'remaining'): Promise<{
      clientSecret: string;
      paymentIntentId: string;
    }> => {
      const response = await apiClient.post<ApiResponse<{
        clientSecret: string;
        paymentIntentId: string;
      }>>('/api/payments/stripe/create-intent', {
        bookingId,
        paymentType,
      });
      return handleResponse(response);
    },

    /**
     * Confirm Stripe payment
     */
    confirmStripe: async (paymentIntentId: string): Promise<Payment> => {
      const response = await apiClient.post<ApiResponse<Payment>>(
        '/api/payments/stripe/confirm',
        { paymentIntentId }
      );
      return handleResponse(response);
    },

    /**
     * Create Mercado Pago preference
     */
    createMPPreference: async (bookingId: string, paymentType: 'deposit' | 'remaining'): Promise<{
      preferenceId: string;
      initPoint: string;
      sandboxInitPoint: string;
    }> => {
      const response = await apiClient.post<ApiResponse<{
        preferenceId: string;
        initPoint: string;
        sandboxInitPoint: string;
      }>>('/api/payments/mercadopago/create-preference', {
        bookingId,
        paymentType,
      });
      return handleResponse(response);
    },

    /**
     * Create PIX payment
     */
    createPIX: async (bookingId: string, paymentType: 'deposit' | 'remaining'): Promise<{
      paymentId: string;
      qrCode: string;
      qrCodeBase64: string;
      ticketUrl: string;
    }> => {
      const response = await apiClient.post<ApiResponse<{
        paymentId: string;
        qrCode: string;
        qrCodeBase64: string;
        ticketUrl: string;
      }>>('/api/payments/mercadopago/create-pix', {
        bookingId,
        paymentType,
      });
      return handleResponse(response);
    },

    /**
     * Get payment status
     */
    getStatus: async (paymentId: string): Promise<Payment> => {
      const response = await apiClient.get<ApiResponse<Payment>>(`/api/payments/${paymentId}`);
      return handleResponse(response);
    },

    /**
     * Get payments for booking
     */
    getByBooking: async (bookingId: string): Promise<Payment[]> => {
      const response = await apiClient.get<ApiResponse<Payment[]>>(
        `/api/payments/booking/${bookingId}`
      );
      return handleResponse(response);
    },
  },

  // ==========================================
  // PRICING API
  // ==========================================
  
  pricing: {
    /**
     * Calculate price for booking
     */
    calculate: async (params: {
      checkInDate: string;
      checkOutDate: string;
      bedsCount: number;
      roomId?: string;
    }) => {
      const response = await apiClient.post<ApiResponse<any>>(
        '/api/pricing/calculate',
        params
      );
      return handleResponse(response);
    },

    /**
     * Get group discounts
     */
    getGroupDiscounts: async () => {
      const response = await apiClient.get<ApiResponse<any>>('/api/pricing/group-discounts');
      return handleResponse(response);
    },

    /**
     * Get seasonal pricing
     */
    getSeasonalPricing: async (year: number) => {
      const response = await apiClient.get<ApiResponse<any>>(
        `/api/pricing/seasonal/${year}`
      );
      return handleResponse(response);
    },
  },

  // ==========================================
  // ADMIN API (Phase 4)
  // ==========================================
  
  admin: {
    /**
     * Admin login
     */
    login: async (email: string, password: string): Promise<{
      token: string;
      user: any;
    }> => {
      const response = await apiClient.post<ApiResponse<{
        token: string;
        user: any;
      }>>('/api/admin/login', {
        email,
        password,
      });
      
      const result = handleResponse(response);
      
      // Store token
      if (typeof window !== 'undefined') {
        localStorage.setItem('admin_token', result.token);
      }
      
      return result;
    },

    /**
     * Admin logout
     */
    logout: async (): Promise<void> => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('admin_token');
      }
    },

    /**
     * Get dashboard stats
     */
    getDashboardStats: async (): Promise<any> => {
      const response = await apiClient.get<ApiResponse<any>>('/api/admin/dashboard/stats');
      return handleResponse(response);
    },

    /**
     * Update room settings
     */
    updateRoom: async (roomId: string, updates: Partial<Room>): Promise<Room> => {
      const response = await apiClient.patch<ApiResponse<Room>>(
        `/api/admin/rooms/${roomId}`,
        updates
      );
      return handleResponse(response);
    },

    /**
     * Update pricing settings
     */
    updatePricing: async (settings: any): Promise<any> => {
      const response = await apiClient.patch<ApiResponse<any>>(
        '/api/admin/pricing',
        settings
      );
      return handleResponse(response);
    },
  },

  // ==========================================
  // UTILITIES
  // ==========================================
  
  utils: {
    /**
     * Health check
     */
    healthCheck: async (): Promise<{ status: string; timestamp: string }> => {
      const response = await apiClient.get<ApiResponse<{
        status: string;
        timestamp: string;
      }>>('/api/health');
      return handleResponse(response);
    },

    /**
     * Send contact email
     */
    sendContact: async (data: {
      name: string;
      email: string;
      message: string;
    }): Promise<void> => {
      const response = await apiClient.post<ApiResponse<void>>('/api/contact', data);
      return handleResponse(response);
    },
  },
};

// ============================================================================
// EXPORT DEFAULT API CLIENT
// ============================================================================

export default api;

// ============================================================================
// HELPER FUNCTIONS FOR COMMON USE CASES
// ============================================================================

/**
 * Check if a date range is available for booking
 */
export const checkDateAvailability = async (
  checkIn: Date,
  checkOut: Date,
  beds: number
): Promise<boolean> => {
  try {
    const result = await api.availability.check({
      checkInDate: checkIn.toISOString(),
      checkOutDate: checkOut.toISOString(),
      bedsCount: beds,
    });
    return result.isAvailable;
  } catch (error) {
    console.error('Error checking availability:', error);
    return false;
  }
};

/**
 * Create booking with automatic error handling
 */
export const createBookingWithErrorHandling = async (
  bookingData: BookingFormData
): Promise<{ success: boolean; booking?: Booking; error?: AppError }> => {
  try {
    const booking = await api.bookings.create(bookingData);
    return { success: true, booking };
  } catch (error) {
    console.error('Error creating booking:', error);
    return { success: false, error: error as AppError };
  }
};

/**
 * Process payment with retry logic
 */
export const processPaymentWithRetry = async (
  paymentMethod: 'stripe' | 'mercadopago',
  bookingId: string,
  paymentType: 'deposit' | 'remaining',
  retries = 3
): Promise<{ success: boolean; payment?: Payment; error?: AppError }> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      let payment: Payment;
      
      if (paymentMethod === 'stripe') {
        const intent = await api.payments.createStripeIntent(bookingId, paymentType);
        payment = await api.payments.confirmStripe(intent.paymentIntentId);
      } else {
        // Handle Mercado Pago payment
        const preference = await api.payments.createMPPreference(bookingId, paymentType);
        // Additional MP logic would go here
        throw new Error('MP payment flow not fully implemented in this helper');
      }
      
      return { success: true, payment };
    } catch (error) {
      console.error(`Payment attempt ${attempt} failed:`, error);
      
      if (attempt === retries) {
        return { success: false, error: error as AppError };
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  
  return { success: false, error: { code: 'MAX_RETRIES_EXCEEDED', message: 'Payment failed after maximum retries', statusCode: 500 } };
};

/**
 * Format API errors for display
 */
export const formatApiError = (error: AppError): string => {
  switch (error.code) {
    case ERROR_CODES.INSUFFICIENT_AVAILABILITY:
      return 'Sorry, there are not enough beds available for your selected dates.';
    case ERROR_CODES.INVALID_DATE_RANGE:
      return 'Please select valid check-in and check-out dates.';
    case ERROR_CODES.PAYMENT_FAILED:
      return 'Payment processing failed. Please try again or use a different payment method.';
    case 'NETWORK_ERROR':
      return 'Connection error. Please check your internet and try again.';
    default:
      return error.message || 'An unexpected error occurred. Please try again.';
  }
};
