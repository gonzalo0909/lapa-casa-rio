// frontend/src/components/booking/hostel-engine.utils.ts
// 12 funciones puras — sin React, sin estado.

// ─── Temporada ────────────────────────────────────────────
export function getSeason(date: Date) {
  const m = date.getMonth(), d = date.getDate(), y = date.getFullYear();
  if (m===1 && ((y===2027 && d>=13 && d<=17) || (y===2026 && d>=28)))
    {return { mult:2.0, label:'Carnaval', minNights:5 };}
  if (m===11||m===0||m===6||m===7) {return { mult:1.5, label:'Alta Temporada', minNights:1 };}
  if (m===5||m===8)                 {return { mult:0.8, label:'Baixa Temporada', minNights:1 };}
  return { mult:1.0, label:'Média Temporada', minNights:1 };
}

// ─── Cálculo de precio ────────────────────────────────────
export function calcPrice(
  ci: Date | null,
  co: Date | null,
  beds: Record<string, number>,
) {
  if (!ci || !co) {return null;}
  const nights = Math.round((co.getTime() - ci.getTime()) / 86400000);
  const totalB = Object.values(beds).reduce((s, n) => s + n, 0);
  if (nights <= 0 || totalB === 0) {return null;}
  const season  = getSeason(ci);
  const pbn     = 85 * season.mult;
  const subtotal = pbn * totalB * nights;
  const total   = subtotal;
  return { nights, beds: totalB, season, pbn, subtotal, total, deposit: total * 0.3 };
}

// ─── Validación y formateo CPF ─────────────────────────────
// FIX (auditoría 2026-08-30): validateCPF/formatCPF vivían acá duplicadas
// (mismo algoritmo, distinto estilo) con apartment-engine.utils.ts --
// consolidadas en @/lib/utils, re-exportadas de vuelta para no tener que
// tocar cada import existente.
export { validateCPF, formatCPF } from '@/lib/utils';

// ─── Formateo teléfono ────────────────────────────────────
export function formatPhone(raw: string): string {
  const clean  = raw.replace(/[^\d+]/g, '');
  const digits = clean.replace(/\D/g, '');
  if (digits.length <= 2) {return clean;}
  if (clean.startsWith('+55')) {
    const d = digits.slice(2);
    let f = '+55 ';
    if (d.length > 0) {f += '(' + d.slice(0, 2) + ')';}
    if (d.length > 2) {f += ' ' + d.slice(2, 7);}
    if (d.length > 7) {f += '-' + d.slice(7, 11);}
    return f;
  }
  if (!clean.startsWith('+')) {
    const local = digits.slice(2, 11);
    const sp    = local.length > 8 ? 5 : 4;
    let f = '(' + digits.slice(0, 2) + ')';
    if (local.length > 0) {f += ' ' + local.slice(0, sp);}
    if (local.length > sp) {f += '-' + local.slice(sp);}
    return f;
  }
  return clean.slice(0, 18);
}

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
