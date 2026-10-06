//
// Cliente API para el panel de administradores de apartamento, alineado
// con backend/src/routes/owner/*.ts. Usa la cookie httpOnly `lch_owner`
// (credentials: 'include' ya está seteado en api.ts) -- este cliente
// nunca maneja el token directamente.

import { api, APIError, getCsrfHeader, tryRefreshOwnerToken } from './api';

/**
 * Para los dos endpoints que arman su propio FormData/fetch en vez de pasar
 * por request() de api.ts (uploadPhoto, ownerDocumentsAPI.upload) -- ese
 * archivo sí reintenta solo una vez tras renovar el access token en un 401,
 * pero un fetch manual no pasa por ahí. Mismo fix, aplicado acá.
 */
async function fetchWithOwnerRetry(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status !== 401) {return res;}

  const refreshed = await tryRefreshOwnerToken();
  if (!refreshed) {return res;}

  return fetch(url, { ...init, headers: { ...init.headers, ...getCsrfHeader() } });
}

export interface OwnerProfile {
  fullName: string;
  email: string;
  mustChangePassword: boolean;
  termAcceptedAt: string | null;
  termVersion: string | null;
  verificationStatus: 'pending' | 'verified' | 'rejected';
}

export interface OwnerDocument {
  id: string;
  docType: 'cpf_cnpj' | 'proof_ownership' | 'other';
  originalName: string | null;
  mimeType: string | null;
  uploadedAt: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
}

export const CURRENT_TERM_VERSION = '2.2';

export interface Apartment {
  id: string;
  code: string;
  name: string;
  capacity: number;
  base_price: number;
  description: string | null;
  neighborhood: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  amenities: unknown;
  external_rating: number | null;
  external_review_count: number | null;
  external_rating_label: string | null;
  address: string | null;
  address_number: string | null;
  cep: string | null;
  /** Avisos del paso de reserva; null = por defecto del sitio */
  important_notices: string[] | null;
  checkin_from: string | null;
  checkin_to: string | null;
  checkout_from: string | null;
  checkout_to: string | null;
  listing_status: 'pending_review' | 'approved' | 'rejected';
  listing_submitted_at: string | null;
  listing_reviewed_at: string | null;
  listing_review_notes: string | null;
}

export interface OwnerBooking {
  id: string;
  reservationNumber: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  status: string;
  finalPrice: number;
  createdAt: string;
  depositPaid: number;
  remainingPaid: number;
  transferredToOwner: number;
  transferPending: boolean;
}

export interface ApartmentBlock {
  id: string;
  start_date: string;
  end_date: string;
  block_type: string;
  reason: string | null;
  notes: string | null;
  created_at: string;
}

export interface HolidayBlockPreset {
  key: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface ApartmentPhoto {
  id: string;
  image_url: string;
  display_order: number;
  is_primary: boolean;
  alt_text: string | null;
  created_at: string;
}

export const ownerAuthAPI = {
  login: (email: string, password: string) =>
    api.post<{ success: boolean; data: OwnerProfile; message: string }>('/owner/login', {
      email,
      password,
    }),

  changePassword: (newPassword: string) =>
    api.post<{ success: boolean; message: string }>('/owner/login/change-password', {
      newPassword,
    }),

  forgotPassword: (email: string) =>
    api.post<{ success: boolean; message: string }>('/owner/login/forgot-password', { email }),

  resetPassword: (token: string, newPassword: string) =>
    api.post<{ success: boolean; message: string }>('/owner/login/reset-password', {
      token,
      newPassword,
    }),

  logout: () => api.post<{ success: boolean; message: string }>('/owner/login/logout'),

  me: () => api.get<{ success: boolean; data: OwnerProfile }>('/owner/me'),

  /**
   * Renueva el access token usando el refresh token en la cookie httpOnly
   * `lch_owner_refresh`. El backend usa rotating refresh tokens: emite un
   * nuevo par access+refresh y revoca el refresh entrante. Solo se llama
   * cuando `/owner/me` devuelve 401 (token expirado) para no forzar
   * re-login al usuario cada 15 minutos.
   */
  refresh: () =>
    api.post<{ success: boolean; message: string }>('/owner/login/refresh'),

  acceptTerms: (version: string) =>
    api.post<{ success: boolean; data: { termAcceptedAt: string; termVersion: string }; message: string }>(
      '/owner/accept-terms',
      { version }
    ),
};

export const ownerApartmentsAPI = {
  list: () => api.get<{ success: boolean; data: { apartments: Apartment[] } }>('/owner/apartments'),

  create: (data: { name: string; capacity: number; base_price: number }) =>
    api.post<{ success: boolean; data: { id: string; code: string; name: string }; message: string }>(
      '/owner/apartments',
      data,
    ),

  getById: (id: string) =>
    api.get<{ success: boolean; data: Apartment }>(`/owner/apartments/${id}`),

  update: (
    id: string,
    data: Partial<
      Pick<Apartment, 'name' | 'description' | 'neighborhood' | 'bedrooms' | 'bathrooms' | 'amenities' | 'address' | 'address_number' | 'cep' | 'base_price' | 'important_notices' | 'checkin_from' | 'checkin_to' | 'checkout_from' | 'checkout_to'>
    >,
  ) =>
    api.put<{ success: boolean; data: Apartment; message: string }>(
      `/owner/apartments/${id}`,
      data,
    ),

  submitForReview: (id: string) =>
    api.post<{ success: boolean; data: { id: string; listing_status: string; listing_submitted_at: string }; message: string }>(
      `/owner/apartments/${id}/submit-for-review`,
    ),

  getPricing: (id: string) =>
    api.get<{ success: boolean; data: { min_price_brl: number | null; max_price_brl: number | null; bot_enabled: boolean; notes: string | null } | null }>(
      `/owner/apartments/${id}/pricing`,
    ),

  updatePricing: (id: string, data: { min_price_brl?: number | null; max_price_brl?: number | null; bot_enabled?: boolean; notes?: string }) =>
    api.put<{ success: boolean; data: unknown; message: string }>(
      `/owner/apartments/${id}/pricing`,
      data,
    ),

  listPhotos: (id: string) =>
    api.get<{ success: boolean; data: { photos: ApartmentPhoto[] } }>(
      `/owner/apartments/${id}/photos`,
    ),

  uploadPhoto: async (id: string, file: File, altText?: string) => {
    const formData = new FormData();
    formData.append('photo', file);
    if (altText) {
      formData.append('altText', altText);
    }

    const res = await fetchWithOwnerRetry(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/owner/apartments/${id}/photos`,
      { method: 'POST', body: formData, credentials: 'include', headers: getCsrfHeader() },
    );
    const responseData = await res.json();
    if (!res.ok) {
      throw new APIError(
        responseData?.message || responseData?.error || 'Erro ao enviar a foto',
        res.status,
        responseData?.code,
      );
    }
    return responseData as { success: boolean; data: { photo: ApartmentPhoto }; message: string };
  },

  setPrimaryPhoto: (photoId: string) =>
    api.patch<{ success: boolean; data: ApartmentPhoto; message: string }>(
      `/owner/apartments/photos/${photoId}`,
      { isPrimary: true },
    ),

  deletePhoto: (photoId: string) =>
    api.delete<{ success: boolean; message: string }>(`/owner/apartments/photos/${photoId}`),

  listBookings: (id: string) =>
    api.get<{ success: boolean; data: { bookings: OwnerBooking[] } }>(`/owner/apartments/${id}/bookings`),

  listBlocks: (id: string) =>
    api.get<{ success: boolean; data: ApartmentBlock[] }>(`/owner/apartments/${id}/blocks`),

  createBlock: (
    id: string,
    data: { start_date: string; end_date: string; block_type?: string; reason?: string; notes?: string },
  ) =>
    api.post<{ success: boolean; data: ApartmentBlock; message: string }>(
      `/owner/apartments/${id}/blocks`,
      data,
    ),

  deleteBlock: (blockId: string) =>
    api.delete<{ success: boolean; message: string }>(`/owner/apartments/blocks/${blockId}`),

  holidayPresets: (year: number) =>
    api.get<{ success: boolean; data: { presets: HolidayBlockPreset[] } }>(
      `/owner/apartments/holiday-presets?year=${year}`,
    ),
};

export const ownerDocumentsAPI = {
  list: () =>
    api.get<{
      success: boolean;
      data: { verificationStatus: string; documents: OwnerDocument[] };
    }>('/owner/documents'),

  upload: async (file: File, docType: 'cpf_cnpj' | 'proof_ownership' | 'other') => {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('docType', docType);

    const res = await fetchWithOwnerRetry(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/owner/documents`,
      { method: 'POST', body: formData, credentials: 'include', headers: getCsrfHeader() },
    );
    const data = await res.json();
    if (!res.ok) {
      throw new APIError(data?.message || data?.error || 'Erro ao enviar o documento', res.status);
    }
    return data as { success: boolean; data: OwnerDocument; message: string };
  },

  delete: (docId: string) =>
    api.delete<{ success: boolean; message: string }>(`/owner/documents/${docId}`),
};

const ownerAPI = { ownerAuthAPI, ownerApartmentsAPI, ownerDocumentsAPI };
export default ownerAPI;
