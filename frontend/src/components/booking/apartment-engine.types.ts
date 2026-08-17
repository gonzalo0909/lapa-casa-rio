// frontend/src/components/booking/apartment-engine.types.ts

import type { ApartmentAvailability } from '@/types/global';

export type Step = 1 | 2 | 3 | 4;

export type AptLocale = 'pt' | 'es' | 'en' | 'fr' | 'de';

export interface GuestForm {
  fullName: string;
  email: string;
  confirmEmail: string;
  phone: string;
  country: string;
  document: string;
  arrivalTime: string;
  specialRequests: string;
}

export const EMPTY_FORM: GuestForm = {
  fullName: '',
  email: '',
  confirmEmail: '',
  phone: '',
  country: 'Brasil',
  document: '',
  arrivalTime: '',
  specialRequests: '',
};

export interface CreatedBooking {
  id: string;
  confirmationNumber: string;
  pendingExpiresAt: string | null;
  total: number;
  deposit: number;
  remaining: number;
  checkIn: string;
}

export interface ApartmentEngineProps {
  locale?: AptLocale;
}

/** BCP-47 usado para nomes de mês/dia da semana localizados (Intl), no mesmo
 * mapeamento que o resto do site (ver date-selector.tsx). */
export const BCP47: Record<string, string> = {
  pt: 'pt-BR',
  es: 'es-ES',
  en: 'en-US',
  fr: 'fr-FR',
  de: 'de-DE',
};

export const CHECKIN_TIMES = [
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00',
];

export interface RankedApartment {
  apt: ApartmentAvailability;
  disabledReason: 'unavailable' | 'too-small' | undefined;
}
