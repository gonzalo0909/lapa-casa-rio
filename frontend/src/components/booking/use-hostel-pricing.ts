'use client';

import { useState, useEffect } from 'react';
import type { RoomDef, Translations } from './hostel-engine.types';
import { getSeason, fmtMoney } from './hostel-engine.utils';
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

  useEffect(() => {
    if (!checkIn || !checkOut || totalBeds === 0) { setQuote(null); return; }
    const selected = rooms.filter((r) => (beds[r.id] ?? 0) > 0);
    if (selected.some((r) => !r.realId)) { return; }
    const payload = {
      checkIn: checkIn.toISOString().slice(0, 10),
      checkOut: checkOut.toISOString().slice(0, 10),
      rooms: selected.map((r) => ({ roomId: r.realId!, bedsCount: beds[r.id] ?? 0 })),
    };
    let cancelled = false;
    const timer = setTimeout(() => {
      availabilityAPI
        .quote(payload)
        .then((res) => {
          if (cancelled || !res.data) { return; }
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
        .catch(() => { if (!cancelled) { setQuote(null); } });
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
    if (price) {
      return {
        main: fmtMoney(price.total),
        sub: `${price.beds} ${price.beds === 1 ? t.tBed : t.tBeds} · ${price.nights} ${price.nights === 1 ? t.tNight : t.tNights2}`,
      };
    }
    if (checkIn && !checkOut) { return { main: t.tSelectCheckout, sub: t.tClickCheckout }; }
    const s = getSeason(new Date());
    return { main: fmtMoney(85 * s.mult) + '/' + t.tBed + '/' + t.tNight, sub: t.tInProgress };
  })();

  return { price, cardSurchargeMult, footerPrice, season };
}
