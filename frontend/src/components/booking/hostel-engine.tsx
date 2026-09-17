'use client';
// frontend/src/components/booking/hostel-engine.tsx
// Orquestador slim — estado global, API, navegación, Step 4, éxito, expirado, CSS, footer.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { bookingAPI, availabilityAPI, paymentAPI, offersAPI } from '@/lib/api';
import { useCurrency, convertBRL } from '@/hooks/use-currency';
import {
  type Lang,
  type Phase,
  type PayMethod,
  type RoomDef,
  type FormState,
  type FormErrors,
  type FieldFeedback,
  T,
  DEFAULT_ROOMS,
} from './hostel-engine.types';
import { getSeason, validateCPF, fmtDate, fmtMoney } from './hostel-engine.utils';
import { HOSTEL_ENGINE_CSS } from './hostel-engine.styles';
import { HostelCalendar } from './hostel-calendar';
import { HostelRoomSelector } from './hostel-room-selector';
import { HostelGuestForm, type AppliedCoupon } from './hostel-guest-form';
import { HostelInfoBanner } from './hostel-info-banner';

// Solo se ven después de que el usuario avanza el wizard (step 4, o tras
// confirmar/expirar/generar un link grupal) -- nunca en el primer render,
// así que se cargan en su propio chunk en vez de ir en el bundle inicial.
const HostelStep4Summary = dynamic(() =>
  import('./hostel-step4-summary').then((m) => m.HostelStep4Summary),
);
const HostelSuccessPanel = dynamic(() =>
  import('./hostel-success-panel').then((m) => m.HostelSuccessPanel),
);
const HostelExpiredPanel = dynamic(() =>
  import('./hostel-expired-panel').then((m) => m.HostelExpiredPanel),
);
const HostelGroupPanel = dynamic(() =>
  import('./hostel-group-panel').then((m) => m.HostelGroupPanel),
);

// ─── Props ────────────────────────────────────────────────
interface HostelEngineProps {
  locale?: string;
}

// ─── Component ────────────────────────────────────────────
export function HostelEngine({ locale = 'pt' }: HostelEngineProps) {
  const initLang: Lang = (['pt', 'es', 'en', 'fr', 'de', 'it'] as Lang[]).includes(locale as Lang)
    ? (locale as Lang)
    : 'pt';
  const [lang, setLang] = useState<Lang>(initLang);
  const t = T[lang];
  const currency = useCurrency();
  const TODAY = useRef(
    (() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    })(),
  );

  // ─ Estado del wizard ─
  const [step, setStep] = useState(1);
  const [calMonth, setCalMonth] = useState(
    () => new Date(TODAY.current.getFullYear(), TODAY.current.getMonth(), 1),
  );
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [beds, setBeds] = useState<Record<string, number>>({
    cuarto1: 0,
    cuarto3: 0,
    cuarto4: 0,
    cuarto5: 0,
    cuarto6: 0,
  });
  const [revealed, setRevealed] = useState({ cuarto3: false, cuarto5: false });
  const [rooms, setRooms] = useState<RoomDef[]>(DEFAULT_ROOMS);
  const [toast, setToast] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethod>('pix');
  const [phase, setPhase] = useState<Phase>('wizard');
  const [bookingCode, setBookingCode] = useState('');
  // Pedido del dueño: en el panel de éxito, cambiar de PIX a tarjeta (o
  // viceversa) reusaba `onNewBooking` -- window.location.reload() -- que
  // perdía la reserva ya creada y todo el formulario. Guardamos el id real
  // acá para poder pedir un depósito nuevo sobre la MISMA reserva en vez de
  // crear una reserva duplicada.
  const [reservationId, setReservationId] = useState('');
  // Programa de referidos (idea #49, roadmap.html): appliedCoupon es el
  // código que el huésped ingresó para descontar ESTA reserva; ownReferralCode
  // es el código nuevo que le toca a ÉL para compartir, devuelto por el
  // backend al crear la reserva -- se muestra en la pantalla de éxito.
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [ownReferralCode, setOwnReferralCode] = useState<string | null>(null);
  const [timerSecs, setTimerSecs] = useState(300);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [isWaLoading, setIsWaLoading] = useState(false);
  const [pixData, setPixData] = useState<{ qrCode: string; qrCodeBase64: string } | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [stripeUrl, setStripeUrl] = useState<string | null>(null);
  // La reserva se confirma igual aunque falle Mercado Pago/Stripe -- se aparta
  // el error de generar el pago del error de crear la reserva, para poder
  // avisarle al huésped en la pantalla de éxito en vez de mostrar el QR
  // decorativo de relleno como si fuera uno real.
  const [paymentInitFailed, setPaymentInitFailed] = useState(false);
  // Falla al reintentar el link de pago desde la pantalla de éxito.
  const [paymentLinkError, setPaymentLinkError] = useState(false);
  const [isRetryingPayment, setIsRetryingPayment] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─ Estado del pago grupal ─
  const [isGroupLoading, setIsGroupLoading] = useState(false);
  const [groupError, setGroupError] = useState('');
  const [groupWaUrl, setGroupWaUrl] = useState('');
  const [groupResNum, setGroupResNum] = useState('');
  const [groupAmountPerBed, setGroupAmountPerBed] = useState(0);
  // N-1: invitados que tienen que pagar (no incluye la cama del titular)
  const [groupTotalBeds, setGroupTotalBeds] = useState(0);
  // Datos mínimos del titular para el flujo grupal desde Step 2
  const [gpName, setGpName] = useState('');
  const [gpEmail, setGpEmail] = useState('');

  // ─ Estado del formulario ─
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    email2: '',
    phone: '',
    country: 'BR',
    doc: '',
    arrival: '',
    requests: '',
    docPhotoBase64: '',
    restrictionAccepted: false,
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [docFeedback, setDocFeedback] = useState<FieldFeedback | null>(null);
  const [emailFb, setEmailFb] = useState<FieldFeedback | null>(null);
  const [phoneFb, setPhoneFb] = useState<FieldFeedback | null>(null);

  // ─ Fetch cuartos reales cuando hay fechas ─
  useEffect(() => {
    if (!checkIn || !checkOut) {return;}
    const ci = checkIn.toISOString().slice(0, 10);
    const co = checkOut.toISOString().slice(0, 10);
    availabilityAPI
      .check({ checkIn: ci, checkOut: co, beds: 1 })
      .then((res) => {
        const apiRooms: any[] = res.data?.rooms || [];
        if (!apiRooms.length) {return;}
        setRooms(
          DEFAULT_ROOMS.map((dr) => {
            // Match por code real de room_types (mixto_12a, flexible_7, etc.) --
            // el name ("Mixto 12A") no tiene relación con los ids de fallback
            // ("cuarto1") y nunca matcheaba, dejando realId sin asignar y
            // mandando el slug en vez del UUID real a POST /bookings.
            const match = apiRooms.find((ar: any) => ar.code === dr.code);
            if (!match) {return dr;}
            return {
              ...dr,
              realId: match.roomId,
              available: match.availableBeds ?? dr.available,
              price: match.basePrice || dr.price,
            };
          }),
        );
      })
      .catch(() => {
        /* fallback a defaults */
      });
  }, [checkIn, checkOut]);

  // ─ Precio real: pedido a POST /availability/quote, la misma
  // pricingService.calculateTotalPrice() que create-booking.ts usa para
  // fijar booking.deposit_amount -- el monto que de verdad se cobra.
  // Antes se recalculaba en el navegador con un precio base fijo (85 BRL
  // parejo para los 5 cuartos, que en realidad son 55/65) y sin el
  // descuento de grupo, así que el depósito mostrado en Step 4 y el WhatsApp
  // no coincidía con lo que MercadoPago/Stripe terminaba cobrando.
  const [quote, setQuote] = useState<{
    nights: number;
    totalPrice: number;
    depositAmount: number;
    basePrice: number;
    pricePerBed: number;
    cardSurchargePercent: number;
  } | null>(null);

  useEffect(() => {
    const totalBedsNow = Object.values(beds).reduce((s, n) => s + n, 0);
    if (!checkIn || !checkOut || totalBedsNow === 0) {
      setQuote(null);
      return;
    }
    const selected = rooms.filter((r) => (beds[r.id] ?? 0) > 0);
    if (selected.some((r) => !r.realId)) {return;} // todavía no resolvió el UUID real del cuarto
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
          if (cancelled || !res.data) {return;}
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
        .catch(() => {
          if (!cancelled) {setQuote(null);}
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [checkIn, checkOut, beds, rooms]);

  // ─ Valores derivados ─
  const totalBeds = Object.values(beds).reduce((s, n) => s + n, 0);
  const season = getSeason(checkIn ?? TODAY.current);
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
  // Recargo real de tarjeta (system_config.card_surcharge_percent, ver
  // process-deposit.ts) -- nunca hardcodear 1.10 acá: el dueño lo ajusta
  // desde /admin/pricing.html sin deploy, y un valor fijo queda
  // desincronizado del monto que Stripe termina cobrando de verdad.
  const cardSurchargeMult = 1 + (quote?.cardSurchargePercent ?? 10) / 100;

  // Cuartos visibles (reveal progresivo)
  const visibleRooms = rooms.filter((r) => {
    if (r.id === 'cuarto3') {return revealed.cuarto3;}
    if (r.id === 'cuarto5') {return revealed.cuarto5;}
    return true;
  });

  // ─ Calendario ─
  const handleCalClick = useCallback(
    (date: Date) => {
      if (!checkIn || (checkIn && checkOut) || date < checkIn) {
        setCheckIn(date);
        setCheckOut(null);
        setSelectingEnd(true);
      } else {
        setCheckOut(date);
        setSelectingEnd(false);
        setHoverDate(null);
      }
    },
    [checkIn, checkOut],
  );

  const handleMonthChange = useCallback((delta: number) => {
    setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }, []);

  // ─ Camas / reveal ─
  const changeBeds = useCallback(
    (id: string, delta: number) => {
      setRevealed((prev) => {
        const r1 = rooms.find((r) => r.id === 'cuarto1');
        const r4 = rooms.find((r) => r.id === 'cuarto4');
        const newRev = { ...prev };
        setBeds((prevBeds) => {
          const cur = prevBeds[id] ?? 0;
          const room = rooms.find((r) => r.id === id)!;
          const next = { ...prevBeds };
          if (delta > 0) {
            if (cur < room.available) {
              next[id] = cur + 1;
            } else if (id === 'cuarto1' && !newRev.cuarto3) {
              newRev.cuarto3 = true;
            } else if (id === 'cuarto4' && !newRev.cuarto5) {
              newRev.cuarto5 = true;
            }
          } else {
            next[id] = Math.max(0, cur - 1);
          }
          // Collapse progresivo: si el cuarto principal baja del máximo
          if ((next['cuarto1'] ?? 0) < (r1?.available ?? 12)) {
            newRev.cuarto3 = false;
            next['cuarto3'] = 0;
          }
          if ((next['cuarto4'] ?? 0) < (r4?.available ?? 7)) {
            newRev.cuarto5 = false;
            next['cuarto5'] = 0;
          }
          if (id === 'cuarto5' && delta < 0 && (next['cuarto5'] ?? 0) === 0) {newRev.cuarto5 = false;}
          return next;
        });
        return newRev;
      });
    },
    [rooms],
  );

  // ─ Scroll suave al tope de la card (step tracker) ─
  const scrollToCard = useCallback(() => {
    // Pequeño delay para que React renderice el nuevo step antes de animar
    setTimeout(() => {
      const el = document.querySelector('.he-steps') as HTMLElement | null;
      if (el) {el.scrollIntoView({ behavior: 'smooth', block: 'start' });}
    }, 40);
  }, []);

  // ─ Toast ─
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }, []);

  // ─ Formulario ─
  const handleFormChange = useCallback((patch: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...patch }));
  }, []);

  const handleFormErrors = useCallback((patch: Partial<FormErrors>) => {
    setFormErrors((fe) => ({ ...fe, ...patch }));
  }, []);

  // ─ Validación completa (Step 3 → Step 4) ─
  const validateForm = useCallback((): boolean => {
    const isBR = form.country === 'BR';
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
    const email2Ok = emailOk && form.email2 === form.email;
    const digits = form.doc.replace(/\D/g, '');
    const docOk = isBR ? digits.length === 11 && validateCPF(digits) : form.doc.trim().length > 4;

    const errs: FormErrors = {};
    if (form.name.trim().length <= 2) {errs.name = t.errName;}
    if (!emailOk) {errs.email = t.errEmail;}
    if (!email2Ok) {errs.email2 = t.errEmail2;}
    if (form.phone.replace(/\D/g, '').length < 10) {errs.phone = t.errPhone;}
    if (!form.country) {errs.country = t.errCountry;}
    if (!docOk) {errs.doc = isBR ? t.errCPF : t.errDocForeign;}
    if (!form.arrival) {errs.arrival = t.errArrival;}
    if (!form.docPhotoBase64) {errs.docPhoto = t.errDocPhoto;}
    if (!form.restrictionAccepted) {errs.restriction = t.errRestriction;}

    setFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      const firstKey = Object.keys(errs)[0] ?? '';
      const fieldMap: Record<string, string> = {
        name: 'he-f-name',
        email: 'he-f-email',
        email2: 'he-f-email2',
        phone: 'he-f-phone',
        country: 'he-f-country',
        doc: 'he-f-doc',
        arrival: 'he-f-arrival',
        docPhoto: 'he-f-doc-photo',
        restriction: 'he-f-restriction',
      };
      const el = document.getElementById(fieldMap[firstKey] ?? '');
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => el.focus(), 350);
        }, 60);
      }
      return false;
    }
    return true;
  }, [form, t]);

  // ─ Navegación ─
  const goNext = useCallback(() => {
    if (step === 1) {
      if (!checkIn) {
        showToast(t.tToastCheckin);
        scrollToCard();
        return;
      }
      if (!checkOut) {
        showToast(t.tToastCheckout);
        scrollToCard();
        return;
      }
      const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000);
      const s = getSeason(checkIn);
      if (s.minNights > 1 && nights < s.minNights) {
        showToast(`${s.label}: ${t.tToastMinNights} ${s.minNights} ${t.tToastNights}`);
        scrollToCard();
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (totalBeds === 0) {
        showToast(t.tToastBeds);
        scrollToCard();
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (!validateForm()) {return;} // validateForm ya hace scroll al primer campo con error
      setStep(4);
    }
    // Al avanzar: scroll suave al indicador de pasos, sin ir al tope de la página
    scrollToCard();
  }, [step, checkIn, checkOut, totalBeds, t, showToast, validateForm, scrollToCard]);

  // ─ Confirmar reserva ─
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
          firstName,
          lastName,
          email: form.email,
          phone: form.phone,
          country: form.country,
          document: form.doc,
          documentPhotoBase64: form.docPhotoBase64,
        },
        specialRequests: form.requests,
        arrivalTime: form.arrival,
        // El backend (email-service.ts) solo soporta pt/en/es -- de/fr/it
        // caen a 'en' antes de mandarlas, mismo mapeo que apartment-engine.tsx.
        language: lang === 'de' || lang === 'fr' || lang === 'it' ? 'en' : lang,
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

      setPaymentInitFailed(false);
      if (payMethod === 'pix') {
        // PIX: generar QR real via Mercado Pago
        try {
          const dep = await paymentAPI.processDeposit(newReservationId, 'mercadopago');
          const p = dep.data?.payment;
          if (p?.qrCodeBase64 || p?.qrCode) {
            setPixData({ qrCode: p.qrCode ?? '', qrCodeBase64: p.qrCodeBase64 ?? '' });
          } else {
            setPaymentInitFailed(true);
          }
        } catch {
          // La reserva ya está confirmada -- se avisa en la pantalla de éxito,
          // no se corta el flujo.
          setPaymentInitFailed(true);
        }
        setPhase('success');
        startTimer();
      } else {
        // Tarjeta: Stripe Checkout Session — se abre en nueva pestaña
        try {
          const origin = typeof window !== 'undefined' ? window.location.origin : '';
          const checkout = await paymentAPI.stripeCheckout(newReservationId, origin);
          const url: string | undefined = checkout.data?.url;
          if (url) {
            setStripeUrl(url);
            window.open(url, '_blank', 'noopener');
          }
          // Sin URL inmediata igual llega el link por e-mail (t.cardInstruction)
          // -- no es una falla real, a diferencia del catch de abajo.
        } catch {
          setPaymentInitFailed(true);
        }
        setPhase('success');
        startTimer();
      }
    } catch (err: any) {
      setBookingError(err?.response?.data?.error || err?.message || t.errorBooking);
    } finally {
      setIsProcessing(false);
    }
  }, [form, beds, rooms, checkIn, checkOut, lang, t, totalBeds, payMethod, appliedCoupon]);

  // ─ Cambiar de método de pago sin perder la reserva ya creada ─
  const handleSwitchPayMethod = useCallback(async () => {
    if (!reservationId) {return;}
    const nextMethod: PayMethod = payMethod === 'pix' ? 'card' : 'pix';
    if (nextMethod === 'pix' && form.country !== 'BR') {return;}
    setIsProcessing(true);
    setBookingError('');
    setPaymentInitFailed(false);
    try {
      if (nextMethod === 'pix') {
        const dep = await paymentAPI.processDeposit(reservationId, 'mercadopago');
        const p = dep.data?.payment;
        if (p?.qrCodeBase64 || p?.qrCode) {
          setPixData({ qrCode: p.qrCode ?? '', qrCodeBase64: p.qrCodeBase64 ?? '' });
        } else {
          setPaymentInitFailed(true);
        }
      } else {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const checkout = await paymentAPI.stripeCheckout(reservationId, origin);
        const url: string | undefined = checkout.data?.url;
        if (url) {
          setStripeUrl(url);
          window.open(url, '_blank', 'noopener');
        }
      }
      setPayMethod(nextMethod);
      startTimer();
    } catch (err: any) {
      setPaymentInitFailed(true);
      setBookingError(err?.response?.data?.error || err?.message || t.errorBooking);
    } finally {
      setIsProcessing(false);
    }
  }, [reservationId, payMethod, form.country, t]);

  // ─ Reintentar link de pago desde la pantalla de éxito ─
  const handleRetryPaymentLink = useCallback(async () => {
    if (!reservationId || isRetryingPayment) {return;}
    setIsRetryingPayment(true);
    setPaymentLinkError(false);
    try {
      if (payMethod === 'pix') {
        const dep = await paymentAPI.processDeposit(reservationId, 'mercadopago');
        const p = dep.data?.payment;
        if (p?.qrCodeBase64 || p?.qrCode) {
          setPixData({ qrCode: p.qrCode ?? '', qrCodeBase64: p.qrCodeBase64 ?? '' });
          setPaymentInitFailed(false);
        } else {
          setPaymentLinkError(true);
        }
      } else {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const checkout = await paymentAPI.stripeCheckout(reservationId, origin);
        const url: string | undefined = checkout.data?.url;
        if (url) {
          setStripeUrl(url);
          setPaymentInitFailed(false);
          window.open(url, '_blank', 'noopener');
        } else {
          setPaymentLinkError(true);
        }
      }
    } catch (err) {
      console.error('handleRetryPaymentLink failed', err);
      setPaymentLinkError(true);
    } finally {
      setIsRetryingPayment(false);
    }
  }, [reservationId, payMethod, isRetryingPayment]);

  // ─ Timer 5 minutos ─
  const startTimer = useCallback(() => {
    let secs = 300;
    setTimerSecs(300);
    if (timerRef.current) {clearInterval(timerRef.current);}
    timerRef.current = setInterval(() => {
      secs--;
      setTimerSecs(secs);
      if (secs <= 0) {
        clearInterval(timerRef.current!);
        setPhase('expired');
      }
    }, 1000);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) {clearInterval(timerRef.current);}
    },
    [],
  );

  // ─ PIX solo disponible para residentes brasileros ─
  // Si el huésped eligió un país distinto de BR, forzamos 'card' automáticamente
  useEffect(() => {
    if (form.country !== 'BR') {setPayMethod('card');}
  }, [form.country]);
  const timerStr = `${Math.floor(timerSecs / 60)}:${String(timerSecs % 60).padStart(2, '0')}`;

  // ─ Precio en footer ─
  const footerPrice = (() => {
    if (price) {
      return {
        main: fmtMoney(price.total),
        sub: `${price.beds} ${price.beds === 1 ? t.tBed : t.tBeds} · ${price.nights} ${price.nights === 1 ? t.tNight : t.tNights2}`,
      };
    }
    if (checkIn && !checkOut) {return { main: t.tSelectCheckout, sub: t.tClickCheckout };}
    const s = getSeason(TODAY.current);
    return { main: fmtMoney(85 * s.mult) + '/' + t.tBed + '/' + t.tNight, sub: t.tInProgress };
  })();

  // ─ Botón WhatsApp — genera link de Stripe para tarjeta on-click ─
  const buildWaMsg = (stripeLink?: string) => {
    if (!checkIn || !checkOut || !price) {return '#';}
    const selR = rooms.filter((r) => (beds[r.id] ?? 0) > 0);
    const roomsStr = selR
      .map((r) => {
        const cnt = beds[r.id] ?? 0;
        return `${r.name}: ${cnt} ${cnt > 1 ? t.tBeds : t.tBed}`;
      })
      .join(', ');
    const surchargePct = Math.round((cardSurchargeMult - 1) * 100);
    const depPix = Math.round(price.deposit);
    const depCard = Math.round(price.deposit * cardSurchargeMult);
    const remPix = Math.round(price.total - price.deposit);
    const remCard = Math.round((price.total - price.deposit) * cardSurchargeMult);
    const cardLine = stripeLink
      ? `• Tarjeta (+${surchargePct}%): ${fmtMoney(depCard)} → ${stripeLink}`
      : `• Tarjeta (+${surchargePct}%): ${fmtMoney(depCard)}`;
    const arrivalLine = form.arrival ? `\nHora de llegada: ${form.arrival}` : '';
    const msg = encodeURIComponent(
      `${t.waGreet}\n\nCheck-in: ${fmtDate(checkIn)}${arrivalLine}\nCheck-out: ${fmtDate(checkOut)}\n${price.nights} ${price.nights > 1 ? t.tNights2 : t.tNight} · ${roomsStr}\n\n${t.tTotal}: ${fmtMoney(price.total)}\n\nDepósito (30%):\n• PIX: ${fmtMoney(depPix)} → lapalandiarj@gmail.com\n${cardLine}\n\nRestante en check-in:\n• PIX: ${fmtMoney(remPix)}\n• Tarjeta (+${surchargePct}%): ${fmtMoney(remCard)}\n\n${t.waAwait}`,
    );
    const waNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '5521977157530';
    return `https://wa.me/${waNumber}?text=${msg}`;
  };

  const handleWaClick = async () => {
    if (!price) {return;}
    setIsWaLoading(true);
    let stripeLink: string | undefined;
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const depCard = Math.round(price.deposit * cardSurchargeMult);
      const res = await paymentAPI.stripeWaLink(
        depCard,
        `Depósito reserva — Lapa Casa Rio`,
        form.email || undefined,
        origin,
      );
      stripeLink = res.data?.url;
    } catch {
      // Si falla, el mensaje igual se abre sin link de Stripe
    } finally {
      setIsWaLoading(false);
    }
    window.open(buildWaMsg(stripeLink), '_blank');
  };

  // ─ Crear sesión de pago grupal ─
  const handleGroupSession = useCallback(async () => {
    if (!checkIn || !checkOut || !price) {return;}
    // Datos del titular: usa el formulario completo (step 4) o los campos mínimos (step 2)
    const titularName = form.name.trim() || gpName.trim();
    const titularEmail = form.email.trim() || gpEmail.trim();
    if (!titularName || !titularEmail) {
      setGroupError(
        lang === 'pt'
          ? 'Nome e e-mail são obrigatórios.'
          : lang === 'es'
            ? 'Nombre y email son requeridos.'
            : 'Name and email are required.',
      );
      return;
    }
    setIsGroupLoading(true);
    setGroupError('');
    try {
      const c6 = beds['cuarto6'] ?? 0;
      const gender: 'mixed' | 'female' | 'male' = c6 > 0 && totalBeds === c6 ? 'female' : 'mixed';
      const result = await paymentAPI.createGroupSession({
        checkIn: checkIn.toISOString().slice(0, 10),
        checkOut: checkOut.toISOString().slice(0, 10),
        totalBeds,
        nights: price.nights,
        guestGender: gender,
        titular: {
          full_name: titularName,
          email: titularEmail,
          phone: form.phone || undefined,
          country: form.country || undefined,
          language: lang === 'de' || lang === 'fr' || lang === 'it' ? 'en' : lang,
        },
        specialRequests: form.requests || undefined,
      });
      const payload = result.data?.data ?? result.data;
      setGroupWaUrl(payload.waShareUrl ?? '');
      setGroupResNum(payload.reservationNumber ?? '');
      setGroupAmountPerBed(payload.amountPerBed ?? 0);
      // El backend ya descuenta la cama del titular (N-1 invitados)
      setGroupTotalBeds(payload.totalBeds ?? Math.max(0, totalBeds - 1));
      setPhase('group');
    } catch (err: any) {
      setGroupError(err?.response?.data?.error || err?.message || t.gpErrGeneric);
    } finally {
      setIsGroupLoading(false);
    }
  }, [checkIn, checkOut, price, beds, totalBeds, form, gpName, gpEmail, lang, t]);

  // ─ Copiar código PIX / link grupal ─
  const handlePixCopy = useCallback(() => {
    if (!pixData?.qrCode) {return;}
    navigator.clipboard.writeText(pixData.qrCode).catch(() => {});
    setPixCopied(true);
    setTimeout(() => setPixCopied(false), 3000);
  }, [pixData]);

  const handleNewBooking = useCallback(() => {
    window.location.reload();
  }, []);

  // ─ El titular reserva su propia cama, aparte de la sesión grupal ─
  const handleBookOwnBed = useCallback(() => {
    setForm((f) => ({ ...f, name: f.name || gpName, email: f.email || gpEmail }));
    setPhase('wizard');
    setStep(3);
  }, [gpName, gpEmail]);

  // ─── JSX ────────────────────────────────────────────────
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: HOSTEL_ENGINE_CSS }} />
      <div className="he-wrap">
        {/* Volver al home */}
        <div
          style={{
            width: '100%',
            maxWidth: 500,
            padding: '.6rem 0 .1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '.6rem',
          }}
        >
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '.3rem',
              fontSize: '.78rem',
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 700,
              letterSpacing: '.04em',
              background: 'rgba(0,0,0,.42)',
              borderRadius: '999px',
              padding: '.28em .85em',
              border: '1.5px solid rgba(255,255,255,.25)',
              backdropFilter: 'blur(6px)',
              boxShadow: '0 1px 6px rgba(0,0,0,.35)',
            }}
          >
            ← Home
          </Link>
          <Link
            href={`/${lang}/santa-teresa`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: '.78rem',
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 700,
              letterSpacing: '.04em',
              background: 'rgba(0,0,0,.42)',
              borderRadius: '999px',
              padding: '.28em .85em',
              border: '1.5px solid rgba(255,255,255,.25)',
              backdropFilter: 'blur(6px)',
              boxShadow: '0 1px 6px rgba(0,0,0,.35)',
            }}
          >
            Santa Teresa
          </Link>
        </div>

        {/* Header */}
        <div className="he-header">
          <div className="he-brand-loc">Santa Teresa · Rio de Janeiro</div>
          <h1 className="he-brand">
            Lapa Casa
            <span>Hostel</span>
          </h1>
          <div className="he-lang-sw">
            {(['pt', 'es', 'en', 'fr', 'de', 'it'] as Lang[]).map((l) => (
              <button
                key={l}
                className={`he-lang-btn${lang === l ? ' active' : ''}`}
                onClick={() => setLang(l)}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* ── Info importante ── */}
        <HostelInfoBanner lang={lang} />

        {/* ── Panel Wizard ── */}
        {phase === 'wizard' && (
          <div className="he-card">
            {/* Step tracker — horizontal badges + connectors */}
            <div className="he-steps">
              {[t.step1, t.step2, t.step3, t.step4].map((lbl, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <div className={`he-step-conn${step > i ? ' done' : ''}`} />}
                  <div
                    className={`he-step-item${step === i + 1 ? ' active' : step > i + 1 ? ' done' : ''}`}
                  >
                    <div
                      className={`he-step-badge${step === i + 1 ? ' active' : step > i + 1 ? ' done' : ''}`}
                    >
                      {i + 1}
                    </div>
                    <div className="he-step-lbl">{lbl}</div>
                  </div>
                </React.Fragment>
              ))}
            </div>

            {toast && <div className="he-toast">{toast}</div>}

            {/* Step 1 — Calendario */}
            {step === 1 && (
              <HostelCalendar
                lang={lang}
                calMonth={calMonth}
                checkIn={checkIn}
                checkOut={checkOut}
                hoverDate={hoverDate}
                selectingEnd={selectingEnd}
                today={TODAY.current}
                onCalClick={handleCalClick}
                onMonthChange={handleMonthChange}
                onHoverDate={setHoverDate}
              />
            )}

            {/* Step 2 — Cuartos */}
            {step === 2 && (
              <>
                <HostelRoomSelector
                  lang={lang}
                  rooms={visibleRooms}
                  beds={beds}
                  revealed={revealed}
                  season={season}
                  onChangeBeds={changeBeds}
                />

                {/* ── Pago grupal (solo si hay 2+ camas y hay fechas) ── */}
                {totalBeds >= 2 && checkIn && checkOut && (
                  <>
                    <div className="he-or-divider">{t.gpOr}</div>
                    <div className="he-group-box">
                      <div className="he-group-title">{t.gpTitle}</div>
                      <div className="he-group-desc">{t.gpDesc}</div>
                      <div className="he-group-meta">
                        {totalBeds} {totalBeds === 1 ? t.tBed : t.tBeds} · {t.gpMetaEach}{' '}
                        {price ? fmtMoney(Math.round(price.total / totalBeds)) : ''}
                      </div>
                      <label htmlFor="he-gp-name" className="sr-only">
                        {t.lblName ?? 'Nome completo'}
                      </label>
                      <input
                        id="he-gp-name"
                        className="he-group-input"
                        type="text"
                        placeholder={t.lblName ?? 'Nome completo'}
                        value={gpName}
                        onChange={(e) => setGpName(e.target.value)}
                        autoComplete="name"
                      />
                      <label htmlFor="he-gp-email" className="sr-only">
                        {t.lblEmail ?? 'E-mail'}
                      </label>
                      <input
                        id="he-gp-email"
                        className="he-group-input"
                        type="email"
                        placeholder={t.lblEmail ?? 'E-mail'}
                        value={gpEmail}
                        onChange={(e) => setGpEmail(e.target.value)}
                        autoComplete="email"
                      />
                      {groupError && <div className="he-group-err">{groupError}</div>}
                      <button
                        className="he-btn-group"
                        onClick={handleGroupSession}
                        disabled={isGroupLoading || !gpName.trim() || !gpEmail.trim()}
                      >
                        {isGroupLoading ? t.gpLoading : t.gpBtn}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Step 3 — Formulario del huésped */}
            {step === 3 && (
              <HostelGuestForm
                lang={lang}
                form={form}
                formErrors={formErrors}
                docFeedback={docFeedback}
                emailFb={emailFb}
                phoneFb={phoneFb}
                cancelOpen={cancelOpen}
                onFormChange={handleFormChange}
                onFormErrors={handleFormErrors}
                onDocFeedback={setDocFeedback}
                onEmailFb={setEmailFb}
                onPhoneFb={setPhoneFb}
                onCancelToggle={() => setCancelOpen((o) => !o)}
                appliedCoupon={appliedCoupon}
                onCouponApply={setAppliedCoupon}
                onCouponRemove={() => setAppliedCoupon(null)}
                onValidateCoupon={async (code) => {
                  const res = await offersAPI.validate(
                    code,
                    undefined,
                    checkIn ? checkIn.toISOString().slice(0, 10) : '',
                  );
                  return res.data as {
                    valid: boolean;
                    discount_percent?: number;
                    label?: string;
                    code?: string;
                    message?: string;
                  };
                }}
              />
            )}

            {/* Step 4 — Resumen */}
            {step === 4 && price && checkIn && checkOut && (
              <HostelStep4Summary
                t={t}
                form={form}
                price={price}
                checkIn={checkIn}
                checkOut={checkOut}
                rooms={rooms}
                beds={beds}
                payMethod={payMethod}
                onPayMethodChange={setPayMethod}
                cardSurchargeMult={cardSurchargeMult}
                currency={currency}
                convertBRL={convertBRL}
                bookingError={bookingError}
                isProcessing={isProcessing}
                isWaLoading={isWaLoading}
                onConfirm={handleConfirm}
                onWaClick={handleWaClick}
              />
            )}

            {/* Footer con precio y navegación */}
            <div className="he-foot">
              <div>
                <div className="he-price-main">{footerPrice.main}</div>
                <div className="he-price-sub">{footerPrice.sub}</div>
                {currency && price && (
                  <div className="he-conv">{convertBRL(price.total, currency)}</div>
                )}
              </div>
              <div className="he-foot-btns">
                {step > 1 && (
                  <button
                    className="he-btn-back"
                    onClick={() => setStep((s) => Math.max(1, s - 1))}
                  >
                    {t.btnBack}
                  </button>
                )}
                {step < 4 && (
                  <button className="he-btn-next" onClick={goNext}>
                    {t.btnNext}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Panel Éxito ── */}
        {phase === 'success' && (
          <HostelSuccessPanel
            t={t}
            payMethod={payMethod}
            bookingCode={bookingCode}
            price={price}
            pixData={pixData}
            pixCopied={pixCopied}
            onPixCopy={handlePixCopy}
            stripeUrl={stripeUrl}
            timerStr={timerStr}
            onNewBooking={handleNewBooking}
            onSwitchMethod={form.country === 'BR' ? handleSwitchPayMethod : undefined}
            paymentInitFailed={paymentInitFailed}
            paymentLinkError={paymentLinkError}
            isRetryingPayment={isRetryingPayment}
            onRetryPaymentLink={handleRetryPaymentLink}
            referralCode={ownReferralCode}
          />
        )}

        {/* ── Panel Expirado ── */}
        {phase === 'expired' && <HostelExpiredPanel t={t} onTryAgain={handleNewBooking} />}

        {/* ── Panel Link Grupal ── */}
        {phase === 'group' && (
          <HostelGroupPanel
            t={t}
            totalBeds={groupTotalBeds}
            groupResNum={groupResNum}
            groupWaUrl={groupWaUrl}
            groupAmountPerBed={groupAmountPerBed}
            onBookOwnBed={handleBookOwnBed}
          />
        )}
      </div>
    </>
  );
}
