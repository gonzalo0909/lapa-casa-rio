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
    check: async (request:
