// frontend/src/components/booking/hostel-engine.utils.ts
// 12 funciones puras — sin React, sin estado.

import { BCP47 } from '@/lib/utils';

// ─── Temporada ────────────────────────────────────────────
export function getSeason(date: Date) {
  const m = date.getMonth();
  if (m===11||m===0||m===1||m===6||m===7) {return { mult:1.5, label:'Alta Temporada', minNights:1 };}
  if (m===5||m===8)                        {return { mult:0.8, label:'Baixa Temporada', minNights:1 };}
  return { mult:1.0, label:'Média Temporada', minNights:1 };
}

// ─── Validación y formateo CPF ─────────────────────────────
// FIX (auditoría 2026-08-30): validateCPF/formatCPF vivían acá duplicadas
// (mismo algoritmo, distinto estilo) con apartment-engine.utils.ts --
// consolidadas en @/lib/utils, re-exportadas de vuelta para no tener que
// tocar cada import existente.
export { validateCPF, formatCPF } from '@/lib/utils';

export { formatBRPhone as formatPhone } from '@/lib/utils';

// ─── Formateo fecha/dinero ────────────────────────────────
export function fmtDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

export function fmtMoney(v: number): string {
  return 'R$ ' + v.toFixed(2).replace('.', ',');
}

// ─── Helpers de fecha ─────────────────────────────────────
export function dateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function sameDay(a: Date | null, b: Date | null): boolean {
  return !!a && !!b && a.toDateString() === b.toDateString();
}

export function dayBefore(a: Date, b: Date): boolean {
  return dateOnly(a) < dateOnly(b);
}

export function inRange(d: Date, a: Date | null, b: Date | null): boolean {
  if (!a || !b) {return false;}
  const [s, e] = dayBefore(a, b) ? [a, b] : [b, a];
  return dateOnly(d) > dateOnly(s) && dateOnly(d) < dateOnly(e);
}

// ─── Labels de calendario (Intl API) ─────────────────────
export { weekdayLabels } from '@/lib/utils';

export function monthLabel(m: number, locale: string): string {
  return new Date(2023, m, 1).toLocaleDateString(BCP47[locale] ?? 'pt-BR', { month: 'long' });
}
