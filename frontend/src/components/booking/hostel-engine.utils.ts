// frontend/src/components/booking/hostel-engine.utils.ts
// 12 funciones puras — sin React, sin estado.

// ─── Temporada ────────────────────────────────────────────
export function getSeason(date: Date) {
  const m = date.getMonth(), d = date.getDate(), y = date.getFullYear();
  if (m===1 && ((y===2027 && d>=13 && d<=17) || (y===2026 && d>=28)))
    return { mult:2.0, label:'Carnaval', minNights:5 };
  if (m===11||m===0||m===6||m===7) return { mult:1.5, label:'Alta Temporada', minNights:1 };
  if (m===5||m===8)                 return { mult:0.8, label:'Baixa Temporada', minNights:1 };
  return { mult:1.0, label:'Média Temporada', minNights:1 };
}

// ─── Descuento de grupo ───────────────────────────────────
export function groupDisc(beds: number): number {
  return beds >= 13 ? 0.15 : beds >= 3 ? 0.10 : 0;
}

// ─── Cálculo de precio ────────────────────────────────────
export function calcPrice(
  ci: Date | null,
  co: Date | null,
  beds: Record<string, number>,
) {
  if (!ci || !co) return null;
  const nights = Math.round((co.getTime() - ci.getTime()) / 86400000);
  const totalB = Object.values(beds).reduce((s, n) => s + n, 0);
  if (nights <= 0 || totalB === 0) return null;
  const season  = getSeason(ci);
  const pbn     = 85 * season.mult;
  const subtotal = pbn * totalB * nights;
  const disc    = groupDisc(totalB);
  const total   = subtotal * (1 - disc);
  return { nights, beds: totalB, season, pbn, subtotal, disc, discAmt: subtotal * disc, total, deposit: total * 0.3 };
}

// ─── Validación CPF (sin acceso por índice a string) ──────
export function validateCPF(raw: string): boolean {
  const c = raw.replace(/\D/g, '');
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const d0 = (i: number) => c.charCodeAt(i) - 48;
  let s = 0;
  for (let i = 0; i < 9; i++) s += d0(i) * (10 - i);
  let d = (s * 10) % 11; if (d >= 10) d = 0; if (d !== d0(9)) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += d0(i) * (11 - i);
  d = (s * 10) % 11; if (d >= 10) d = 0;
  return d === d0(10);
}

// ─── Formateo CPF ─────────────────────────────────────────
export function formatCPF(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length > 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  if (d.length > 6) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
  if (d.length > 3) return `${d.slice(0,3)}.${d.slice(3)}`;
  return d;
}

// ─── Formateo teléfono ────────────────────────────────────
export function formatPhone(raw: string): string {
  const clean  = raw.replace(/[^\d+]/g, '');
  const digits = clean.replace(/\D/g, '');
  if (digits.length <= 2) return clean;
  if (clean.startsWith('+55')) {
    const d = digits.slice(2);
    let f = '+55 ';
    if (d.length > 0) f += '(' + d.slice(0, 2) + ')';
    if (d.length > 2) f += ' ' + d.slice(2, 7);
    if (d.length > 7) f += '-' + d.slice(7, 11);
    return f;
  }
  if (!clean.startsWith('+')) {
    const local = digits.slice(2, 11);
    const sp    = local.length > 8 ? 5 : 4;
    let f = '(' + digits.slice(0, 2) + ')';
    if (local.length > 0) f += ' ' + local.slice(0, sp);
    if (local.length > sp) f += '-' + local.slice(sp);
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
  if (!a || !b) return false;
  const [s, e] = dayBefore(a, b) ? [a, b] : [b, a];
  return dateOnly(d) > dateOnly(s) && dateOnly(d) < dateOnly(e);
}
