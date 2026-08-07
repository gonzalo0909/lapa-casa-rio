// lapa-casa-hostel/frontend/src/types/global.ts

/**
 * Tipos compartidos del flujo de reserva.
 * Alineados con el esquema real del backend (room_types, reservations, guests)
 * — ver backend/database/migrations/0002_tables.sql.
 */

export type BookingStep = 'dates' | 'rooms' | 'guest' | 'summary';

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
