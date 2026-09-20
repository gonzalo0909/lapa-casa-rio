'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { bookingAPI, paymentAPI } from '@/lib/api';
import type { BookingLocale } from '@/types/global';
import type { PayMethod, Phase, RoomDef, FormState, Translations } from './hostel-engine.types';
import type { AppliedCoupon } from './hostel-guest-form';
import { fmtDate, fmtMoney } from './hostel-engine.utils';

type PriceQuote = {
  nights: number; beds: number; season: { mult: number; label: string; minNights: number };
  pbn: number; subtotal: number; total: number; deposit: number;
};

interface PaymentInput {
  lang: BookingLocale;
  t: Translations;
  backendLang: 'pt' | 'en' | 'es';
  price: PriceQuote | null;
  cardSurchargeMult: number;
  form: FormState;
  beds: Record<string, number>;
  rooms: RoomDef[];
  checkIn: Date | null;
  checkOut: Date | null;
  totalBeds: number;
  appliedCoupon: AppliedCoupon | null;
  gpName: string;
  gpEmail: string;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  setStep: React.Dispatch<React.SetStateAction<number>>;
}

export function useHostelPayment({
  lang, t, backendLang, price, cardSurchargeMult,
  form, beds, rooms, checkIn, checkOut, totalBeds,
  appliedCoupon, gpName, gpEmail, setForm, setStep,
}: PaymentInput) {
  const [payMethod, setPayMethod]               = useState<PayMethod>('pix');
  const [phase, setPhase]                       = useState<Phase>('wizard');
  const [bookingCode, setBookingCode]           = useState('');
  const [reservationId, setReservationId]       = useState('');
  const [ownReferralCode, setOwnReferralCode]   = useState<string | null>(null);
  const [timerSecs, setTimerSecs]               = useState(300);
  const [isProcessing, setIsProcessing]         = useState(false);
  const [bookingError, setBookingError]         = useState('');
  const [isWaLoading, setIsWaLoading]           = useState(false);
  const [pixData, setPixData]                   = useState<{ qrCode: string; qrCodeBase64: string } | null>(null);
  const [pixCopied, setPixCopied]               = useState(false);
  const [stripeUrl, setStripeUrl]               = useState<string | null>(null);
  const [paymentInitFailed, setPaymentInitFailed] = useState(false);
  const [paymentLinkError, setPaymentLinkError] = useState(false);
  const [isRetryingPayment, setIsRetryingPayment] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isGroupLoading, setIsGroupLoading]     = useState(false);
  const [groupError, setGroupError]             = useState('');
  const [groupWaUrl, setGroupWaUrl]             = useState('');
  const [groupResNum, setGroupResNum]           = useState('');
  const [groupAmountPerBed, setGroupAmountPerBed] = useState(0);
  const [groupTotalBeds, setGroupTotalBeds]     = useState(0);

  useEffect(() => { if (form.country !== 'BR') { setPayMethod('card'); } }, [form.country]);

  useEffect(() => () => { if (timerRef.current) { clearInterval(timerRef.current); } }, []);

  const startTimer = useCallback(() => {
    let secs = 300;
    setTimerSecs(300);
    if (timerRef.current) { clearInterval(timerRef.current); }
    timerRef.current = setInterval(() => {
      secs--;
      setTimerSecs(secs);
      if (secs <= 0) { clearInterval(timerRef.current!); setPhase('expired'); }
    }, 1000);
  }, []);

  const initPaymentLink = useCallback(async (
    method: PayMethod,
    resId: string,
  ): Promise<{ pixData: { qrCode: string; qrCodeBase64: string } } | { stripeUrl: string } | null> => {
    if (method === 'pix') {
      const dep = await paymentAPI.processDeposit(resId, 'mercadopago');
      const p = dep.data?.payment;
      if (p?.qrCodeBase64 || p?.qrCode) {
        return { pixData: { qrCode: p.qrCode ?? '', qrCodeBase64: p.qrCodeBase64 ?? '' } };
      }
      return null;
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    let ct: string | undefined;
    try { ct = sessionStorage.getItem(`ct_${resId}`) ?? undefined; } catch {}
    const checkout = await paymentAPI.stripeCheckout(resId, origin, ct);
    const url: string | undefined = checkout.data?.url;
    if (url) { window.open(url, '_blank', 'noopener,noreferrer'); return { stripeUrl: url }; }
    return null;
  }, []);

  const handleConfirm = useCallback(async () => {
    setIsProcessing(true);
    setBookingError('');
    try {
      const nameParts = form.name.trim().split(/\s+/);
      const firstName = nameParts[0] ?? form.name;
      const lastName = nameParts.slice(1).join(' ') || firstName;
      const selectedRooms = rooms.filter((r) => (beds[r.id] ?? 0) > 0);
      const c6 = beds['cuarto6'] ?? 0;
      const gender = c6 > 0 && totalBeds === c6 ? 'female' : 'mixed';

      const response = await bookingAPI.create({
        checkIn: checkIn!.toISOString().slice(0, 10),
        checkOut: checkOut!.toISOString().slice(0, 10),
        rooms: selectedRooms.map((r) => ({ roomId: r.realId || r.id, bedsCount: beds[r.id] ?? 0 })),
        guest: {
          firstName, lastName, email: form.email, phone: form.phone,
          country: form.country, document: form.doc, documentPhotoBase64: form.docPhotoBase64,
        },
        specialRequests: form.requests,
        arrivalTime: form.arrival,
        language: backendLang,
        source: 'direct',
        guestGender: gender,
        ...(appliedCoupon ? { offerCode: appliedCoupon.code } : {}),
      });

      const newReservationId: string = response.data?.booking?.id || response.data?.bookingId || '';
      const displayCode = newReservationId
        ? 'LCH-' + newReservationId.substring(0, 8).toUpperCase()
        : 'LCH-' + Math.random().toString(36).slice(2, 8).toUpperCase();
      setBookingCode(displayCode);
      setReservationId(newReservationId);
      setOwnReferralCode(response.data?.booking?.referralCode ?? null);
      if (response.data?.booking?.confirmationToken && newReservationId) {
        try { sessionStorage.setItem(`ct_${newReservationId}`, response.data.booking.confirmationToken); } catch {}
      }

      setPaymentInitFailed(false);
      try {
        const result = await initPaymentLink(payMethod, newReservationId);
        if (result) {
          if ('pixData' in result) { setPixData(result.pixData); }
          if ('stripeUrl' in result) { setStripeUrl(result.stripeUrl); }
        } else {
          setPaymentInitFailed(true);
        }
      } catch {
        setPaymentInitFailed(true);
      }
      setForm((f) => ({ ...f, docPhotoBase64: '' }));
      setPhase('success');
      startTimer();
    } catch {
      setBookingError(t.errorBooking);
    } finally {
      setIsProcessing(false);
    }
  }, [form, beds, rooms, checkIn, checkOut, backendLang, totalBeds, payMethod, appliedCoupon, t, initPaymentLink, startTimer]);

  const handleSwitchPayMethod = useCallback(async () => {
    if (!reservationId) { return; }
    const nextMethod: PayMethod = payMethod === 'pix' ? 'card' : 'pix';
    if (nextMethod === 'pix' && form.country !== 'BR') { return; }
    setIsProcessing(true);
    setBookingError('');
    setPaymentInitFailed(false);
    try {
      const result = await initPaymentLink(nextMethod, reservationId);
      if (result) {
        if ('pixData' in result) { setPixData(result.pixData); }
        if ('stripeUrl' in result) { setStripeUrl(result.stripeUrl); }
      } else {
        setPaymentInitFailed(true);
      }
      setPayMethod(nextMethod);
      startTimer();
    } catch {
      setPaymentInitFailed(true);
      setBookingError(t.errorBooking);
    } finally {
      setIsProcessing(false);
    }
  }, [reservationId, payMethod, form.country, t, initPaymentLink, startTimer]);

  const handleRetryPaymentLink = useCallback(async () => {
    if (!reservationId || isRetryingPayment) { return; }
    setIsRetryingPayment(true);
    setPaymentLinkError(false);
    try {
      const result = await initPaymentLink(payMethod, reservationId);
      if (result) {
        if ('pixData' in result) { setPixData(result.pixData); }
        if ('stripeUrl' in result) { setStripeUrl(result.stripeUrl); }
        setPaymentInitFailed(false);
      } else {
        setPaymentLinkError(true);
      }
    } catch {
      setPaymentLinkError(true);
    } finally {
      setIsRetryingPayment(false);
    }
  }, [reservationId, payMethod, isRetryingPayment, initPaymentLink]);

  const buildWaMsg = useCallback((stripeLink?: string) => {
    if (!checkIn || !checkOut || !price) { return '#'; }
    const selR = rooms.filter((r) => (beds[r.id] ?? 0) > 0);
    const roomsStr = selR
      .map((r) => { const cnt = beds[r.id] ?? 0; return `${r.name}: ${cnt} ${cnt > 1 ? t.tBeds : t.tBed}`; })
      .join(', ');
    const surchargePct = Math.round((cardSurchargeMult - 1) * 100);
    const depPix  = Math.round(price.deposit);
    const depCard = Math.round(price.deposit * cardSurchargeMult);
    const remPix  = Math.round(price.total - price.deposit);
    const remCard = Math.round((price.total - price.deposit) * cardSurchargeMult);
    const cardLine = stripeLink
      ? `• ${t.waCard} (+${surchargePct}%): ${fmtMoney(depCard)} → ${stripeLink}`
      : `• ${t.waCard} (+${surchargePct}%): ${fmtMoney(depCard)}`;
    const arrivalLine = form.arrival ? `\n${t.waArrival}: ${form.arrival}` : '';
    const msg = encodeURIComponent(
      `${t.waGreet}\n\nCheck-in: ${fmtDate(checkIn)}${arrivalLine}\nCheck-out: ${fmtDate(checkOut)}\n${price.nights} ${price.nights > 1 ? t.tNights2 : t.tNight} · ${roomsStr}\n\n${t.tTotal}: ${fmtMoney(price.total)}\n\n${t.waDeposit}:\n• PIX: ${fmtMoney(depPix)} → ${process.env.NEXT_PUBLIC_PIX_KEY ?? ''}\n${cardLine}\n\n${t.waRemain}:\n• PIX: ${fmtMoney(remPix)}\n• ${t.waCard} (+${surchargePct}%): ${fmtMoney(remCard)}\n\n${t.waAwait}`,
    );
    const waNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
    if (!waNumber) { return '#'; }
    return `https://wa.me/${waNumber}?text=${msg}`;
  }, [checkIn, checkOut, price, rooms, beds, cardSurchargeMult, form.arrival, t]);

  const handleWaClick = useCallback(async () => {
    if (!price) { return; }
    setIsWaLoading(true);
    let stripeLink: string | undefined;
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const depCard = Math.round(price.deposit * cardSurchargeMult);
      const res = await paymentAPI.stripeWaLink(
        depCard, `Depósito reserva — Lapa Casa Rio`, form.email || undefined, origin,
      );
      stripeLink = res.data?.url;
    } catch {
      // message opens without Stripe link
    } finally {
      setIsWaLoading(false);
    }
    window.open(buildWaMsg(stripeLink), '_blank', 'noopener,noreferrer');
  }, [price, cardSurchargeMult, form.email, buildWaMsg]);

  const handleGroupSession = useCallback(async () => {
    if (!checkIn || !checkOut || !price) { return; }
    const titularName  = form.name.trim()  || gpName.trim();
    const titularEmail = form.email.trim() || gpEmail.trim();
    if (!titularName || !titularEmail) {
      setGroupError(t.gpErrRequired);
      return;
    }
    setIsGroupLoading(true);
    setGroupError('');
    try {
      const c6 = beds['cuarto6'] ?? 0;
      const gender: 'mixed' | 'female' | 'male' = c6 > 0 && totalBeds === c6 ? 'female' : 'mixed';
      const result = await paymentAPI.createGroupSession({
        checkIn:  checkIn.toISOString().slice(0, 10),
        checkOut: checkOut.toISOString().slice(0, 10),
        totalBeds,
        nights: price.nights,
        guestGender: gender,
        titular: {
          full_name: titularName,
          email: titularEmail,
          phone: form.phone || undefined,
          country: form.country || undefined,
          language: backendLang,
        },
        specialRequests: form.requests || undefined,
      });
      const payload = result.data?.data ?? result.data;
      setGroupWaUrl(payload.waShareUrl ?? '');
      setGroupResNum(payload.reservationNumber ?? '');
      setGroupAmountPerBed(payload.amountPerBed ?? 0);
      setGroupTotalBeds(payload.totalBeds ?? Math.max(0, totalBeds - 1));
      setPhase('group');
    } catch {
      setGroupError(t.gpErrGeneric);
    } finally {
      setIsGroupLoading(false);
    }
  }, [checkIn, checkOut, price, beds, totalBeds, form, gpName, gpEmail, lang, backendLang, t]);

  const handlePixCopy = useCallback(() => {
    if (!pixData?.qrCode) { return; }
    navigator.clipboard.writeText(pixData.qrCode).catch(() => {});
    setPixCopied(true);
    setTimeout(() => setPixCopied(false), 3000);
  }, [pixData]);

  const handleNewBooking = useCallback(() => { window.location.reload(); }, []);

  const handleBookOwnBed = useCallback(() => {
    setForm((f) => ({ ...f, name: f.name || gpName, email: f.email || gpEmail }));
    setPhase('wizard');
    setStep(3);
  }, [gpName, gpEmail, setForm, setStep]);

  const timerStr = `${Math.floor(timerSecs / 60)}:${String(timerSecs % 60).padStart(2, '0')}`;

  return {
    payMethod, setPayMethod, phase, bookingCode, reservationId, ownReferralCode,
    timerSecs, timerStr, isProcessing, bookingError, isWaLoading,
    pixData, pixCopied, stripeUrl, paymentInitFailed, paymentLinkError, isRetryingPayment,
    isGroupLoading, groupError, groupWaUrl, groupResNum, groupAmountPerBed, groupTotalBeds,
    handleConfirm, handleSwitchPayMethod, handleRetryPaymentLink,
    handleWaClick, handleGroupSession, handlePixCopy, handleNewBooking, handleBookOwnBed,
  };
}
