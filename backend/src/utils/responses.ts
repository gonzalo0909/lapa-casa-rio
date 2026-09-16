// lapa-casa-hostel/backend/src/utils/responses.ts
//
// FIX (auditoría 2026-08-30): se eliminaron ~19 exports sin ningún uso
// en las 30 rutas que sí importan de este archivo -- todas usan
// exclusivamente ApiResponse.success()/ApiResponse.error(). El resto
// (successResponse, errorResponse, createdResponse, noContentResponse,
// paginatedResponse, bookingResponses, paymentResponses,
// availabilityResponses, authResponses, validationResponses,
// rateLimitResponse, notFoundResponse, serverErrorResponse,
// badRequestResponse, conflictResponse, serviceUnavailableResponse,
// maintenanceResponse, healthCheckResponse, PaginationParams) era un
// segundo diseño de helpers de respuesta que nunca se conectó a ninguna
// ruta real.

/**
 * Standard API Response Interface
 */
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  code?: string;
  meta?: ResponseMeta;
  timestamp: string;
}

/** Referenciado solo por ApiResponse.meta de arriba -- no se exporta. */
interface ResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  hasNext?: boolean;
  hasPrev?: boolean;
}

/**
 * Objeto en runtime con el mismo nombre que la interface ApiResponse<T>.
 * TypeScript permite esto (namespace de tipos vs. namespace de valores son
 * distintos). Varias rutas llaman `ApiResponse.success(data, message)` /
 * `ApiResponse.error(message, details)` como si fuera un objeto -- antes
 * de este fix, `ApiResponse` solo existia como tipo y esas llamadas
 * fallaban en runtime con "ApiResponse.success is not a function".
 */
export const ApiResponse = {
  success: <T>(data: T, message?: string): ApiResponse<T> => {
    const response: ApiResponse<T> = { success: true, data, timestamp: new Date().toISOString() };
    if (message) {response.message = message;}
    return response;
  },
  error: (message: string, details?: any, code?: string): ApiResponse => {
    const response: ApiResponse = { success: false, error: message, timestamp: new Date().toISOString() };
    if (details !== undefined) {response.data = details;}
    if (code) {response.code = code;}
    return response;
  }
};
