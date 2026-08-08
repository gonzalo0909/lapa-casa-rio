// lapa-casa-hostel/frontend/src/types/global.ts

/**
 * Tipos compartidos del flujo de reserva.
 * Alineados con el esquema real del backend (room_types, reservations, guests)
 * — ver backend/database/migrations/0002_tables.sql.
 */

export type BookingStep = 'dates' | 'rooms' | 'guest' | 'summary';

/** Género elegido por el huésped junto con las fechas -- filtra qué cuartos son elegibles (mixto ve solo mixtos; mujeres ven mixtos + el cuarto solo-mujeres). */
export type BookingGender = 'mixed' | 'female';

export interface DateRange {
  checkIn: Date | null;
  checkOut: Date | null;
}

/** Habitación tal como la devuelve GET /api/v1/rooms (catálogo + disponibilidad). */
export interface RoomAvailability {
  id: string;
  code: string;
  name: string;
  type: 'mixed' | 'female' | 'male';
  capacity: number;
  availableBeds: number;
  basePrice: number;
  isFlexible: boolean;
}

/** Tramo de descuento por grupo -- global, se evalúa sobre el total de camas de toda la reserva (no por cuarto). */
export interface GroupDiscountTier {
  minBeds: number;
  percentage: number;
}

/** Habitación + cantidad de camas elegidas por el huésped durante la reserva. */
export interface Room {
  id: string;
  name: string;
  type: 'mixed' | 'female' | 'male';
  bedsCount: number;
  capacity: number;
  basePrice: number;
  isFlexible: boolean;
}

export interface GuestDetails {
  fullName: string;
  email: string;
  phone: string;
  country: string;
  documentNumber: string;
  specialRequests?: string;
  arrivalTime?: string;
  dietaryRestrictions?: string;
}
