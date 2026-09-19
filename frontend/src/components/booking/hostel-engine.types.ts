// frontend/src/components/booking/hostel-engine.types.ts
// Tipos TypeScript · DEFAULT_ROOMS

import type { BookingLocale } from '@/types/global';
import ptH from '@/messages/pt.json';
import esH from '@/messages/es.json';
import enH from '@/messages/en.json';
import frH from '@/messages/fr.json';
import deH from '@/messages/de.json';
import itH from '@/messages/it.json';

// ─── Tipos base ─────────────────────────────────────────
export type Phase = 'wizard' | 'success' | 'expired' | 'group';
export type PayMethod = 'pix' | 'card';

export interface RoomDef {
  id: string;
  realId?: string;
  /** code real de room_types (backend/database/seeds/0001_seed.sql) -- clave estable para matchear con la API de disponibilidad, a diferencia del name que es solo texto para mostrar. */
  code: string;
  name: string;
  type: 'mixed' | 'female';
  capacity: number;
  available: number;
  price: number;
  isFlexible: boolean;
}

export interface FormState {
  name: string;
  email: string;
  email2: string;
  phone: string;
  country: string;
  doc: string;
  arrival: string;
  requests: string;
  /** Foto del documento (DNI/pasaporte) como data URL base64 — obligatoria */
  docPhotoBase64: string;
  /** Confirmación de que ningún huésped supera los 50 años ni tiene movilidad reducida */
  restrictionAccepted: boolean;
}

export interface FormErrors {
  name?: string;
  email?: string;
  email2?: string;
  phone?: string;
  country?: string;
  doc?: string;
  arrival?: string;
  docPhoto?: string;
  restriction?: string;
}

/** Feedback de validación inline (email/teléfono/documento) — el ícono lo pone la UI, esto solo dice el texto y si está OK. */
export interface FieldFeedback {
  text: string;
  ok: boolean;
}

// ─── Traducciones ────────────────────────────────────────
export const T = {
  pt: ptH.hostel,
  es: esH.hostel,
  en: enH.hostel,
  fr: frH.hostel,
  de: deH.hostel,
  it: itH.hostel,
} as const;

export type Translations = (typeof T)[BookingLocale];

export interface PriceQuote {
  nights: number;
  beds: number;
  season: { mult: number; label: string; minNights: number };
  pbn: number;
  subtotal: number;
  total: number;
  deposit: number;
}

// ─── Estructura de cuartos (sin precios — los precios siempre vienen de la API) ─
export const DEFAULT_ROOMS: RoomDef[] = [
  { id: 'cuarto1', code: 'mixto_12a',  name: 'Cuarto 1', type: 'mixed',  capacity: 12, available: 12, price: 0, isFlexible: false },
  { id: 'cuarto3', code: 'mixto_12b',  name: 'Cuarto 3', type: 'mixed',  capacity: 12, available: 12, price: 0, isFlexible: false },
  { id: 'cuarto4', code: 'mixto_7',    name: 'Cuarto 4', type: 'mixed',  capacity: 7,  available: 7,  price: 0, isFlexible: false },
  { id: 'cuarto5', code: 'mixto_7c',   name: 'Cuarto 5', type: 'mixed',  capacity: 7,  available: 7,  price: 0, isFlexible: false },
  { id: 'cuarto6', code: 'flexible_7', name: 'Cuarto 6', type: 'female', capacity: 7,  available: 7,  price: 0, isFlexible: true  },
];
