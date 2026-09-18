
/**
 * Tipos compartidos del flujo de reserva.
 * Alineados con el esquema real del backend (room_types, reservations, guests)
 * — ver backend/database/migrations/0002_tables.sql.
 */

/** Locale soportado por ambos motores de reserva (hostel y apartamentos). */
export type BookingLocale = 'pt' | 'es' | 'en' | 'fr' | 'de' | 'it';

/** Género elegido por el huésped junto con las fechas -- filtra qué cuartos son elegibles (mixto ve solo mixtos; mujeres ven mixtos + el cuarto solo-mujeres). */
export type BookingGender = 'mixed' | 'female';

export interface GuestPhoto {
  id: string;
  image_url: string;
  guest_name: string | null;
  guest_country: string | null;
  caption: string | null;
  created_at: string;
}

export interface GuestDetails {
  fullName: string;
  email: string;
  /** Solo se usa cuando el formulario corre en modo `strict` (Apartamentos). */
  confirmEmail?: string;
  phone: string;
  country: string;
  documentNumber: string;
  specialRequests?: string;
  arrivalTime: string;
}

export interface ApartmentPhoto {
  id: string;
  url: string;
  isPrimary: boolean;
  altText: string | null;
}

/** Apartamento tal como lo devuelve GET /api/v1/availability/apartments */
export interface ApartmentAvailability {
  id: string;
  code: string;
  name: string;
  neighborhood?: string;
  /** Nombre de la calle sin número — para mostrar en el mapa público */
  street?: string;
  /** Coordenadas para el mapa; null = usar centroide del barrio como fallback */
  lat?: number;
  lng?: number;
  capacity: number;
  basePrice: number;
  priceTotal: number;
  seasonMultiplier: number;
  seasonType: 'alta' | 'media' | 'baja' | 'carnaval';
  depositAmount: number;
  available: boolean;
  photos: ApartmentPhoto[];
  /** Puntuación externa (Airbnb / Booking) — null = no mostrar nada en la UI */
  externalRating?: number | null;
  externalReviewCount?: number | null;
  externalRatingLabel?: string | null;
  /** true cuando el check-in es en < 48h y se requiere el pago completo al reservar */
  fullPaymentRequired?: boolean;
  fullPaymentReason?: 'less_than_48h' | null;
  /** true si el apartamento tiene capacidad suficiente para los huéspedes solicitados */
  fitsGuests?: boolean;
  /** true cuando la query de pricing falló — priceTotal es estimativa (base_price × noches) */
  pricingFailed?: boolean;
}

