'use client';
// frontend/src/hooks/use-currency.ts
// Detecta el país del visitante por IP y obtiene la tasa BRL → moneda local.
// Falla silenciosamente — nunca rompe el flujo de reserva.

import { useState, useEffect } from 'react';

interface CurrencyInfo {
  code: string;   // 'USD'
  symbol: string; // 'USD' | '€' | '£' …
  rate: number;   // cuántas unidades de la moneda local vale 1 BRL
}

// Países → moneda. Los países de la eurozona comparten EUR.
const COUNTRY_CURRENCY: Record<string, { code: string; symbol: string }> = {
  US: { code: 'USD', symbol: 'USD' },
  CA: { code: 'CAD', symbol: 'CAD' },
  AU: { code: 'AUD', symbol: 'AUD' },
  NZ: { code: 'NZD', symbol: 'NZD' },
  GB: { code: 'GBP', symbol: '£' },
  AR: { code: 'ARS', symbol: 'ARS' },
  CL: { code: 'CLP', symbol: 'CLP' },
  CO: { code: 'COP', symbol: 'COP' },
  UY: { code: 'UYU', symbol: 'UYU' },
  PY: { code: 'PYG', symbol: 'PYG' },
  MX: { code: 'MXN', symbol: 'MXN' },
  PE: { code: 'PEN', symbol: 'PEN' },
  BO: { code: 'BOB', symbol: 'BOB' },
  VE: { code: 'USD', symbol: 'USD' }, // Venezuela → USD
  JP: { code: 'JPY', symbol: '¥' },
  CN: { code: 'CNY', symbol: '¥' },
  IN: { code: 'INR', symbol: '₹' },
  ZA: { code: 'ZAR', symbol: 'ZAR' },
  IL: { code: 'ILS', symbol: '₪' },
  // Eurozona
  DE: { code: 'EUR', symbol: '€' },
  FR: { code: 'EUR', symbol: '€' },
  ES: { code: 'EUR', symbol: '€' },
  IT: { code: 'EUR', symbol: '€' },
  PT: { code: 'EUR', symbol: '€' },
  NL: { code: 'EUR', symbol: '€' },
  BE: { code: 'EUR', symbol: '€' },
  AT: { code: 'EUR', symbol: '€' },
  GR: { code: 'EUR', symbol: '€' },
  FI: { code: 'EUR', symbol: '€' },
  IE: { code: 'EUR', symbol: '€' },
  PL: { code: 'EUR', symbol: '€' },
  CH: { code: 'CHF', symbol: 'CHF' },
  SE: { code: 'SEK', symbol: 'SEK' },
  NO: { code: 'NOK', symbol: 'NOK' },
  DK: { code: 'DKK', symbol: 'DKK' },
};

// Cache en memoria para la sesión (evita llamadas repetidas)
let cachedInfo: CurrencyInfo | null | undefined = undefined; // undefined = sin resolver aún

export function useCurrency(): CurrencyInfo | null {
  const [info, setInfo] = useState<CurrencyInfo | null | undefined>(cachedInfo);

  useEffect(() => {
    if (cachedInfo !== undefined) {
      setInfo(cachedInfo);
      return;
    }

    let cancelled = false;

    async function detect() {
      try {
        // 1. País por IP
        const geoRes = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
        const geo = await geoRes.json();
        const country: string = geo.country_code ?? '';

        if (!country || country === 'BR') {
          cachedInfo = null;
          if (!cancelled) setInfo(null);
          return;
        }

        const curr = COUNTRY_CURRENCY[country];
        if (!curr) {
          cachedInfo = null;
          if (!cancelled) setInfo(null);
          return;
        }

        // 2. Tasa BRL → moneda detectada
        const fxRes = await fetch(
          `https://api.frankfurter.app/latest?from=BRL&to=${curr.code}`,
          { signal: AbortSignal.timeout(4000) },
        );
        const fx = await fxRes.json();
        const rate: number = fx?.rates?.[curr.code];

        if (!rate) {
          cachedInfo = null;
          if (!cancelled) setInfo(null);
          return;
        }

        const result: CurrencyInfo = { code: curr.code, symbol: curr.symbol, rate };
        cachedInfo = result;
        if (!cancelled) setInfo(result);
      } catch {
        // Falla silenciosa — no mostrar conversión
        cachedInfo = null;
        if (!cancelled) setInfo(null);
      }
    }

    detect();
    return () => { cancelled = true; };
  }, []);

  return info ?? null;
}

/** Convierte un monto en BRL y devuelve el string formateado en la moneda local */
export function convertBRL(amountBRL: number, info: CurrencyInfo): string {
  const converted = amountBRL * info.rate;
  // Monedas sin decimales (CLP, PYG, JPY, COP, IDR…)
  const noDecimals = ['CLP', 'PYG', 'JPY', 'COP', 'IDR', 'KRW'];
  const decimals = noDecimals.includes(info.code) ? 0 : 0; // siempre entero — más limpio visualmente
  return `≈ ${info.symbol} ${Math.round(converted).toLocaleString('es-AR')}`;
}
