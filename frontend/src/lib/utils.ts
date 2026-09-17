// lapa-casa-hostel/frontend/src/lib/utils.ts

/**
 * Utility Functions Library
 *
 * Common utility functions for Lapa Casa application.
 * Includes class name management and CPF validation/formatting.
 *
 * @module lib/utils
 * @requires clsx
 * @requires tailwind-merge
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with proper conflict resolution
 *
 * @param inputs - Class values to merge
 * @returns Merged class string
 *
 * @example
 * ```ts
 * cn('px-2 py-1', 'px-4') // Returns: 'py-1 px-4'
 * cn('text-red-500', condition && 'text-blue-500') // Conditional classes
 * ```
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// FIX (auditoría 2026-08-30): calculateNights duplicada acá sin ningún
// import externo -- la versión real en uso es lib/pricing.ts (usada
// internamente por calculateTotalPrice/etc ahí mismo).

// FIX (auditoría 2026-08-30): formatPhone duplicada acá sin ningún import
// externo -- la versión real en uso (con soporte de "+55" en vivo
// mientras se tipea) es components/booking/hostel-engine.utils.ts. No es
// el mismo algoritmo (esta era una versión más simple para exactamente
// 10-11 dígitos), así que no se puede fusionar sin decidir cuál
// comportamiento es el correcto -- se elimina la que nadie usa.

// FIX (auditoría 17 secciones, sección 13): se eliminan 18 funciones más
// sin ningún import externo (formatCurrency, formatDate, generateId,
// debounce, throttle, sleep, capitalize, truncate, parseQueryString,
// buildQueryString, isEmpty, deepClone, compareDates, isDateInRange,
// getDateRange, toDateOnly, splitFullName, getNestedValue) -- verificado
// con knip + grep manual de cada candidato (3 "usos" que aparecían en el
// grep inicial eran falsos positivos: una función local con el mismo
// nombre en otro archivo, la clase CSS `capitalize` de Tailwind, y una key
// de objeto `isEmpty` sin relación).

// FIX (auditoría 2026-08-30): validateCPF/formatCPF estaban duplicadas
// -- byte por byte el mismo algoritmo, solo con estilo distinto -- en
// components/booking/apartment-engine.utils.ts y hostel-engine.utils.ts.
// Se consolidan acá; ambos motores ahora importan de este único lugar.

/** Valida un CPF brasileño por dígito verificador (módulo 11). */
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

/** Formatea dígitos de CPF progresivamente como 000.000.000-00 mientras se tipea. */
export function formatCPF(v: string): string {
  const digits = v.replace(/\D/g, '').slice(0, 11);
  if (digits.length > 9) { return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`; }
  if (digits.length > 6) { return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`; }
  if (digits.length > 3) { return `${digits.slice(0, 3)}.${digits.slice(3)}`; }
  return digits;
}
