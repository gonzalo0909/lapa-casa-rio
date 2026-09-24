'use client';

import { useState, useEffect } from 'react';
import { FALLBACK_BED_PRICE_BRL, type RoomDef, type Translations } from './hostel-engine.types';
import { getSeason, fmtMoney, toLocalISODate } from './hostel-engine.utils';
import { availabilityAPI } from '@/lib/api';

interface PricingInput {
  checkIn: Date | null;
  checkOut: Date | null;
  beds: Record<string, number>;
  rooms: RoomDef[];
  totalBeds: number;
  t: Translations;
}

export function useHostelPricing({ checkIn, checkOut, beds, rooms, totalBeds, t }: PricingInput) {
  const [quote, setQuote] = useState<{
    nights: number;
    totalPrice: number;
    depositAmount: number;
    basePrice: number;
    pricePerBed: number;
    cardSurchargePercent: number;
  } | null>(null);
  const [minNightsError, setMinNightsError] = useState<{ minNights: number; label: string | null } | null>(null);

  useEffect(() => {
    if (!checkIn || !checkOut || totalBeds === 0) { setQuote(null); setMinNightsError(null); return; }
    const selected = rooms.filter((r) => (beds[r.id] ?? 0) > 0);
    if (selected.some((r) => !r.realId)) { return; }
    const payload = {
      checkIn: toLocalISODate(checkIn),
      checkOut: toLocalISODate(checkOut),
      rooms: selected.map((r) => ({ roomId: r.realId!, bedsCount: beds[r.id] ?? 0 })),
    };
    let cancelled = false;
    const timer = setTimeout(() => {
      availabilityAPI
        .quote(payload)
        .then((res) => {
          if (cancelled || !res.data) { return; }
          setMinNightsError(null);
          const p = res.data;
          setQuote({
            nights: p.nights,
            totalPrice: p.totalPrice,
            depositAmount: p.depositAmount,
            basePrice: p.basePrice,
            pricePerBed: p.pricePerBed,
            cardSurchargePercent: p.cardSurchargePercent ?? 10,
          });
        })
        .catch((err) => {
          if (cancelled) { return; }
          setQuote(null);
          // 422: el cuarto elegido tiene un período especial (0045) que exige
          // más noches de las pedidas -- se avisa en vez de dejar el precio en blanco.
          const details = err?.details?.data;
          setMinNightsError(
            err?.statusCode === 422 && details?.minNights
              ? { minNights: details.minNights, label: details.label ?? null }
              : null
          );
        });
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [checkIn, checkOut, beds, rooms]);

  const season = getSeason(checkIn ?? new Date());

  const price = quote
    ? {
        nights: quote.nights,
        beds: totalBeds,
        season,
        pbn: quote.pricePerBed,
        subtotal: quote.basePrice,
        total: quote.totalPrice,
        deposit: quote.depositAmount,
      }
    : null;

  const cardSurchargeMult = 1 + (quote?.cardSurchargePercent ?? 10) / 100;

  const footerPrice = (() => {
    if (minNightsError) {
      const label = minNightsError.label ? `${minNightsError.label}: ` : '';
      return { main: '—', sub: `${label}${t.tToastMinNights} ${minNightsError.minNights} ${t.tToastNights}` };
    }
    if (price) {
      return {
        main: fmtMoney(price.total),
        sub: `${price.beds} ${price.beds === 1 ? t.tBed : t.tBeds} · ${price.nights} ${price.nights === 1 ? t.tNight : t.tNights2}`,
      };
    }
    if (checkIn && !checkOut) { return { main: t.tSelectCheckout, sub: t.tClickCheckout }; }
    const s = getSeason(new Date());
    return { main: fmtMoney(FALLBACK_BED_PRICE_BRL * s.mult) + '/' + t.tBed + '/' + t.tNight, sub: t.tInProgress };
  })();

  return { price, cardSurchargeMult, footerPrice, season, minNightsError };
}
