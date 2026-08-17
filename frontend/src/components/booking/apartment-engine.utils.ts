// frontend/src/components/booking/apartment-engine.utils.ts

import type { ApartmentAvailability } from '@/types/global';
import { BCP47 } from './apartment-engine.types';
import type { RankedApartment } from './apartment-engine.types';

export function toDs(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function parseDs(s: string): Date {
  const [y, m, d] = s.split('-') as [string, string, string];
  return new Date(Number(y), Number(m) - 1, Number(d));
}

/** ds está en formato YYYY-MM-DD, comparable lexicográficamente como fecha. */
export function isCarnivalDs(ds: string, ranges: Array<{ startDate: string; endDate: string }>): boolean {
  return ranges.some((r) => ds >= r.startDate && ds <= r.endDate);
}

export function fmtDate(ds: string | null, locale: string): string {
  if (!ds) { return ''; }
  const d = parseDs(ds);
  const month = d.toLocaleDateString(BCP47[locale] ?? 'pt-BR', { month: 'short' });
  return String(d.getDate()).padStart(2, '0') + ' ' + month + ' ' + d.getFullYear();
}

export function monthYearLabel(y: number, m: number, locale: string): string {
  const label = new Date(y, m, 1).toLocaleDateString(BCP47[locale] ?? 'pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function weekdayLabels(locale: string): string[] {
  const bcp = BCP47[locale] ?? 'pt-BR';
  const labels: string[] = [];
  for (let i = 0; i < 7; i++) {
    labels.push(new Date(2023, 0, 1 + i).toLocaleDateString(bcp, { weekday: 'short' }));
  }
  return labels;
}

export function todayDs(): string {
  return toDs(new Date());
}

export function validateCPF(raw: string): boolean {
  const cpf = raw.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) { return false; }
  let s = 0;
  for (let i = 0; i < 9; i++) { s += parseInt(cpf[i] ?? '0', 10) * (10 - i); }
  let d = (s * 10) % 11; if (d >= 10) { d = 0; }
  if (d !== parseInt(cpf[9] ?? '0', 10)) { return false; }
  s = 0;
  for (let i = 0; i < 10; i++) { s += parseInt(cpf[i] ?? '0', 10) * (11 - i); }
  d = (s * 10) % 11; if (d >= 10) { d = 0; }
  return d === parseInt(cpf[10] ?? '0', 10);
}

export function formatCPF(v: string): string {
  const digits = v.replace(/\D/g, '').slice(0, 11);
  if (digits.length > 9) { return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`; }
  if (digits.length > 6) { return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`; }
  if (digits.length > 3) { return `${digits.slice(0, 3)}.${digits.slice(3)}`; }
  return digits;
}

export function isEmailFmt(v: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/.test(v) && !v.includes('..') && v.indexOf('@') > 0;
}

export function formatBRPhone(raw: string): string {
  const clean = raw.replace(/[^\d+]/g, '');
  const digits = clean.replace(/\D/g, '');
  if (digits.length <= 2) { return clean; }
  // Só tratamos como "já tem código de país" quando o usuário digitou "+55" de fato --
  // "55" sozinho também é um DDD válido (Rio Grande do Sul), então não pode ser usado
  // como sinal de código de país por coincidência de dígitos.
  if (clean.startsWith('+55')) {
    const d = digits.slice(2);
    let fmt = '+55 ';
    if (d.length > 0) { fmt += '(' + d.slice(0, 2) + ')'; }
    if (d.length > 2) { fmt += ' ' + d.slice(2, 7); }
    if (d.length > 7) { fmt += '-' + d.slice(7, 11); }
    return fmt;
  }
  if (!clean.startsWith('+')) {
    // Número local (sem código de país): DDD de 2 dígitos + número de 8 ou 9 dígitos.
    const local = digits.slice(2, 11);
    const isNineDigit = local.length > 8;
    const splitAt = isNineDigit ? 5 : 4;
    let fmt = '(' + digits.slice(0, 2) + ')';
    if (local.length > 0) { fmt += ' ' + local.slice(0, splitAt); }
    if (local.length > splitAt) { fmt += '-' + local.slice(splitAt); }
    return fmt;
  }
  return clean.slice(0, 18);
}

export function rankApartments(apartments: ApartmentAvailability[], guestCount: number): RankedApartment[] {
  const fits = (a: ApartmentAvailability) => a.available && a.capacity >= guestCount;
  const tooSmall = (a: ApartmentAvailability) => a.available && a.capacity < guestCount;
  return [
    ...apartments.filter(fits).map((apt) => ({ apt, disabledReason: undefined as 'unavailable' | 'too-small' | undefined })),
    ...apartments.filter(tooSmall).map((apt) => ({ apt, disabledReason: 'too-small' as const })),
    ...apartments.filter((a) => !a.available).map((apt) => ({ apt, disabledReason: 'unavailable' as const })),
  ];
}
