// Orquestador del motor de reservas de Apartamentos.
// Gestiona el estado global entre pasos y delega cada paso a su componente:
//   Paso 1 → ApartmentDateStep
//   Paso 2 → ApartmentSelectorStep
//   Paso 3 → ApartmentGuestForm
//   Paso 4 → PaymentProcessor (inline, mínimo)
//
// Ajustes deliberados en este motor:
//  1. El "10% de desconto no PIX" no existe en el backend real — se omite.
//  2. El Paso 4 usa el componente de pago real (Stripe + Mercado Pago PIX).

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  KeyRound,
  DoorOpen,
  FileText,
  Ban,
  CigaretteOff,
  Users,
  CheckCircle2,
  Mail,
  Gift,
  Check,
} from 'lucide-react';
import styles from './apartment-engine.module.css';
import { Modal, ModalBody } from '../ui/modal';
import { PaymentCountdown } from '../payment/payment-countdown';
import { LoadingSpinner } from '../ui/loading-spinner';
import { availabilityAPI, bookingAPI, offersAPI, handleAPIError } from '@/lib/api';
import { ApartmentDateStep } from './apartment-date-step';
import { ApartmentSelectorStep } from './apartment-selector-step';
import { ApartmentGuestForm } from './apartment-guest-form';
import { parseDs, isEmailFmt, validateCPF } from './apartment-engine.utils';
import type { ApartmentAvailability } from '@/types/global';
import {
  type Step,
  type GuestForm,
  type CreatedBooking,
  type ApartmentEngineProps,
  type AdditionalGuest,
  type AppliedCoupon,
  EMPTY_FORM,
  CHECKIN_TIMES,
  MAX_APT_GUESTS,
} from './apartment-engine.types';

// Carga @stripe/stripe-js + @stripe/react-stripe-js (SDK pesado) recién al
// llegar al paso 4 (pago) en vez de en el bundle inicial del wizard.
const PaymentProcessor = dynamic(
  () => import('../payment/payment-processor').then((m) => m.PaymentProcessor),
  {
    loading: () => (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
        <LoadingSpinner size="md" />
      </div>
    ),
  },
);

export const ApartmentEngine: React.FC<ApartmentEngineProps> = ({ locale = 'pt' }) => {
  const t = useTranslations('apartments');
  const tc = useTranslations('common');

  // ── Navegación ───────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState<string | null>(null);

  // ── Config editable desde /admin/pricing.html ────────────────────────────
  const [checkinTimes, setCheckinTimes] = useState<string[]>(CHECKIN_TIMES);
  const [maxAptGuests, setMaxAptGuests] = useState<number>(MAX_APT_GUESTS);
  useEffect(() => {
    availabilityAPI.getApartmentConfig().then((res: any) => {
      if (res?.data?.checkinTimes?.length) setCheckinTimes(res.data.checkinTimes);
      if (res?.data?.maxGuests) setMaxAptGuests(res.data.maxGuests);
    }).catch(() => { /* fallback a los valores por defecto */ });
  }, []);

  // ── Paso 1: fechas y huéspedes ───────────────────────────────────────────
  const [guestCount, setGuestCount] = useState(2);
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);

  // ── Paso 2: apartamentos ─────────────────────────────────────────────────
  const [apartments, setApartments] = useState<ApartmentAvailability[]>([]);
  const [isLoadingApartments, setIsLoadingApartments] = useState(false);
  const [selectedApartment, setSelectedApartment] = useState<ApartmentAvailability | null>(null);

  // ── Paso 3: formulario de huésped ────────────────────────────────────────
  const [guestForm, setGuestForm] = useState<GuestForm>(() => ({
    ...EMPTY_FORM,
    country: t('defaultCountry'),
  }));
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);
  /** true cuando el usuario intentó enviar y debe mostrar errores en campos de acompañante */
  const [submitAttempted, setSubmitAttempted] = useState(false);
  /** Acompañantes declarados por el titular en el checkout (excluyendo al titular) */
  const [additionalGuests, setAdditionalGuests] = useState<AdditionalGuest[]>(() =>
    Array.from({ length: Math.max(0, guestCount - 1) }, () => ({
      id: Math.random().toString(36).slice(2),
      fullName: '',
      document: '',
    }))
  );
  /** Foto del documento del titular (se convierte a base64 y se envía al crear la reserva) */
  const [documentPhoto, setDocumentPhoto] = useState<File | null>(null);
  /** Foto del documento del acompañante — obligatoria cuando guestCount > 1 */
  const [companionDocumentPhoto, setCompanionDocumentPhoto] = useState<File | null>(null);
  /** Aceptación de términos — verificada en handleReserve antes de crear la reserva */
  const [termsAccepted, setTermsAccepted] = useState(false);

  // ── Cupón de descuento ───────────────────────────────────────────────────
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);

  // ── Paso 4: pago ─────────────────────────────────────────────────────────
  const [booking, setBooking] = useState<CreatedBooking | null>(null);
  const [paymentDone, setPaymentDone] = useState(false);
  const [paySuccessOpen, setPaySuccessOpen] = useState(true);
  const [referralCopied, setReferralCopied] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  // ── Ref para scroll suave al contenido del paso (evitar saltar al hero) ──
  const stepContentRef = useRef<HTMLDivElement>(null);
  /** Número de secuencia para cancelar llamadas a la API del mini-calendario
   *  que llegan fuera de orden (race condition al cambiar fechas rápidamente). */
  const miniCalSeq = useRef(0);
  const referralCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (referralCopiedTimerRef.current) { clearTimeout(referralCopiedTimerRef.current); } }, []);
  /** Desplaza suavemente hasta el bloque de contenido del paso activo,
   *  sin volver al hero. delay pequeño para que React haya renderizado. */
  const scrollToContent = useCallback(() => {
    setTimeout(() => {
      stepContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }, []);

  // ── Cálculos derivados ───────────────────────────────────────────────────
  const nights =
    checkIn && checkOut
      ? Math.round((parseDs(checkOut).getTime() - parseDs(checkIn).getTime()) / 86400000)
      : 0;

  // ── API: carga de apartamentos disponibles ───────────────────────────────
  const loadApartments = useCallback(
    async (cin: string, cout: string, guests: number) => {
      setIsLoadingApartments(true);
      setError(null);
      try {
        const res = await availabilityAPI.checkApartments({ checkIn: cin, checkOut: cout, guests });
        setApartments(res?.data?.apartments ?? []);
      } catch (err) {
        setError(handleAPIError(err, locale));
      } finally {
        setIsLoadingApartments(false);
      }
    },
    [locale],
  );

  // ── Manejadores de paso ──────────────────────────────────────────────────
  const handleDatesContinue = () => {
    if (!checkIn || !checkOut) {
      return;
    }
    setStep(2);
    loadApartments(checkIn, checkOut, guestCount);
    scrollToContent();
  };

  const handleMiniCalendarApply = useCallback(
    async (range: { checkIn: Date; checkOut: Date }) => {
      const seq = ++miniCalSeq.current;   // captura la secuencia de esta llamada
      const ds = (d: Date) =>
        [
          d.getFullYear(),
          String(d.getMonth() + 1).padStart(2, '0'),
          String(d.getDate()).padStart(2, '0'),
        ].join('-');
      const newCin = ds(range.checkIn);
      const newCout = ds(range.checkOut);
      setCheckIn(newCin);
      setCheckOut(newCout);
      // No deseleccionamos: si el apartamento sigue disponible en las nuevas
      // fechas lo mantenemos seleccionado para que "Continuar" siga visible.
      setIsLoadingApartments(true);
      setError(null);
      try {
        const res = await availabilityAPI.checkApartments({ checkIn: newCin, checkOut: newCout, guests: guestCount });
        if (seq !== miniCalSeq.current) { return; }
        const apts: ApartmentAvailability[] = res?.data?.apartments ?? [];
        setApartments(apts);
        setSelectedApartment((prev) => {
          if (!prev) {return null;}
          const updated = apts.find((a) => a.id === prev.id);
          // Mantener el apt seleccionado aunque ya no esté disponible —
          // el selector muestra la vista "bloqueado + alternativas".
          // Si el API no devuelve el apartamento en la respuesta, conservamos
          // el objeto anterior en lugar de borrar la selección silenciosamente.
          return updated ?? prev;
        });
      } catch (err) {
        if (seq !== miniCalSeq.current) { return; }  // llamada obsoleta — descartar
        setError(handleAPIError(err, locale));
        setSelectedApartment(null);
      } finally {
        if (seq === miniCalSeq.current) {
          setIsLoadingApartments(false);
        }
      }
    },
    [locale, guestCount],
  );

  /** Valida el formulario y crea la reserva vía API. */
  const handleReserve = async () => {
    // Marcar todos los campos como tocados para mostrar errores en el form
    setTouched({
      fullName: true,
      email: true,
      confirmEmail: true,
      phone: true,
      document: true,
      arrivalTime: true,
    });
    setSubmitAttempted(true);
    if (!selectedApartment || !checkIn || !checkOut) {
      return;
    }

    // Validación local (espeja la lógica de ApartmentGuestForm)
    const emailOk = isEmailFmt(guestForm.email);
    const confirmEmailOk = emailOk && guestForm.confirmEmail === guestForm.email;
    const phoneDigits = guestForm.phone.replace(/\D/g, '');
    const phoneOk = phoneDigits.length >= 10;
    const cpfHasLetter = /[a-zA-Z]/.test(guestForm.document);
    const cpfDigits = guestForm.document.replace(/\D/g, '');
    const cpfOk = cpfHasLetter ? guestForm.document.trim().length >= 5 : cpfDigits.length === 11 ? validateCPF(cpfDigits) : false;
    const companionPhotoOk = guestCount <= 1 || !!companionDocumentPhoto;
    // Validar que cada acompañante tenga nombre y documento válido
    const companionsOk = additionalGuests.every((g) => {
      if (!g.fullName.trim()) { return false; }
      if (/[a-zA-Z]/.test(g.document)) { return g.document.trim().length >= 5; }  // pasaporte: mínimo 5 chars
      const digits = g.document.replace(/\D/g, '');
      return digits.length === 11 && validateCPF(digits);     // CPF completo y válido
    });
    const canReserve = !!(
      guestForm.fullName.trim() &&
      emailOk &&
      confirmEmailOk &&
      phoneOk &&
      cpfOk &&
      guestForm.arrivalTime &&
      documentPhoto &&
      termsAccepted &&
      companionPhotoOk &&
      companionsOk
    );
    if (!canReserve) {
      setError(t('formIncomplete'));
      scrollToContent();
      return;
    }

    setIsCreatingBooking(true);
    setError(null);
    try {
      // Convierte un File a data URL base64
      const toBase64 = (file: File): Promise<string> =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Error al leer la foto del documento'));
          reader.readAsDataURL(file);
        });

      // Foto del titular
      const documentPhotoBase64 = documentPhoto ? await toBase64(documentPhoto) : undefined;
      // Foto del acompañante (si hay uno)
      const companionPhotoBase64 = companionDocumentPhoto ? await toBase64(companionDocumentPhoto) : undefined;

      const nameParts = guestForm.fullName.trim().split(/\s+/);
      const firstName = nameParts[0] ?? guestForm.fullName.trim();
      // '' cuando el huésped tiene un solo nombre; el backend une con trim()
      // → fullName correcto en vez de duplicar el firstName ("João João").
      const lastName = nameParts.slice(1).join(' ');
      const res = await bookingAPI.createApartment({
        checkIn,
        checkOut,
        rooms: [{ roomId: selectedApartment.id, bedsCount: guestCount }],
        guest: {
          firstName,
          lastName,
          email: guestForm.email,
          phone: guestForm.phone,
          country: guestForm.country,
          document: guestForm.document,
          ...(documentPhotoBase64 ? { documentPhotoBase64 } : {}),
        },
        // Acompañantes declarados en el checkout (booking_guests)
        additionalGuests: additionalGuests.map((g, idx) => ({
          fullName: g.fullName,
          document: g.document,
          documentType: /[a-zA-Z]/.test(g.document) ? 'passaporte' : 'CPF',
          // Adjunta la foto del acompañante solo al primer acompañante (máx. 1)
          ...(idx === 0 && companionPhotoBase64 ? { documentPhotoBase64: companionPhotoBase64 } : {}),
        })),
        arrivalTime: guestForm.arrivalTime || undefined,
        specialRequests: guestForm.specialRequests.trim() || undefined,
        language: locale === 'pt' || locale === 'es' ? locale : 'en',
        source: 'web',
        ...(appliedCoupon ? { offerCode: appliedCoupon.code } : {}),
      });
      const b = res?.data?.booking;
      if (!b?.id) {
        throw new Error('No se recibió ID de reserva del servidor');
      }
      if (b.confirmationToken) {
        try { sessionStorage.setItem(`ct_${b.id}`, b.confirmationToken); } catch {}
      }
      if (b.pricing?.total == null || b.payment?.depositAmount == null) {
        throw new Error('El servidor no devolvió el precio de la reserva');
      }
      setBooking({
        id: b.id,
        confirmationNumber: b.confirmationNumber,
        pendingExpiresAt: b.pendingExpiresAt ?? null,
        total: b.pricing.total,
        deposit: b.payment.depositAmount,
        remaining: b.pricing.remaining ?? (b.pricing.total - b.payment.depositAmount),
        checkIn,
        referralCode: b.referralCode ?? null,
      });
      setPaySuccessOpen(true);
      setStep(4);
      scrollToContent();
    } catch (err) {
      setError(handleAPIError(err, locale));
    } finally {
      setIsCreatingBooking(false);
    }
  };

  /** Cambia el número de huéspedes y sincroniza la lista de acompañantes.
   *  Al subir a 2 se añade una fila vacía; al bajar a 1 se limpia la lista
   *  y se descarta la foto del acompañante. En el paso 2 relanza el fetch de
   *  apartamentos con el nuevo número para que fitsGuests sea correcto. */
  const handleGuestCountChange = useCallback((n: number) => {
    setGuestCount(n);
    setAdditionalGuests((prev) => {
      const needed = Math.max(0, n - 1);
      if (prev.length < needed) {
        const toAdd = Array.from({ length: needed - prev.length }, () => ({
          id: Math.random().toString(36).slice(2),
          fullName: '',
          document: '',
        }));
        return [...prev, ...toAdd];
      }
      return prev.slice(0, needed);
    });
    if (n <= 1) {
      setCompanionDocumentPhoto(null);
    }
    if (step === 2 && checkIn && checkOut) {
      loadApartments(checkIn, checkOut, n);
    }
  }, [step, checkIn, checkOut, loadApartments]);

  const goBack = () => {
    setError(null);
    if (step === 2) {
      setStep(1);
    } else if (step === 3) {
      setSubmitAttempted(false);
      setStep(2);
    } else if (step === 4) {
      // Cancel the pending_payment booking before going back so it doesn't
      // block availability or create a duplicate when the guest re-submits.
      if (booking?.id) {
        const bookingId = booking.id;
        let token: string | null = null;
        try { token = sessionStorage.getItem(`ct_${bookingId}`); } catch {}
        if (token) {
          bookingAPI.abandon(bookingId, token).catch(() => {
            // Fire-and-forget: the booking will expire on its own if this fails.
          });
        }
      }
      setBooking(null);
      setPaymentDone(false);
      setPaySuccessOpen(false);
      setIsExpired(false);
      setStep(3);
    }
    scrollToContent();
  };

  // ── Indicador de pasos ───────────────────────────────────────────────────
  const STEP_LABELS: { n: Step; label: string }[] = [
    { n: 1, label: t('stepDates') },
    { n: 2, label: t('stepApartment') },
    { n: 3, label: t('stepSummary') },
    { n: 4, label: t('stepPayment') },
  ];

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={styles.root}>
      {/* Hero */}
      <div className={styles.hero}>
<div className={styles.heroLocation}>{t('heroLocation')}</div>
        <h1 className={styles.heroBrand}>
          Lapa Casa<span>{t('heroApartmentsWord')}</span>
        </h1>
        <p className={styles.heroSub}>{t('heroSubtitle')}</p>
      </div>

      <div className={styles.section}>
        {step > 1 && (
          <button type="button" className={styles.backTop} onClick={goBack}>
            ← {tc('back')}
          </button>
        )}

        {/* Barra de progreso */}
        <div className={styles.steps}>
          {STEP_LABELS.map((s, i) => (
            <React.Fragment key={s.n}>
              {i > 0 && <div className={styles.stepConnector} />}
              <div className={styles.stepItem}>
                <span
                  className={`${styles.stepBadge} ${
                    step > s.n ? styles.stepBadgeDone : step === s.n ? styles.stepBadgeActive : ''
                  }`}
                >
                  {step > s.n ? '✓' : s.n}
                </span>
                <span
                  className={`${styles.stepLabel} ${step === s.n ? styles.stepLabelActive : ''}`}
                >
                  {s.label}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        {/* Avisos generales */}
        <div className={styles.notices}>
          <div className={styles.noticesTitle}>
            <AlertTriangle size={15} strokeWidth={2.2} /> {t('noticesTitle')}
          </div>
          <div className={styles.noticesGrid}>
            <div className={styles.noticeItem}>
              <span className={styles.noticeIcon}>
                <KeyRound size={16} />
              </span>
              <span>{t.rich('noticeCheckin', { b: (chunks) => <strong>{chunks}</strong> })}</span>
            </div>
            <div className={styles.noticeItem}>
              <span className={styles.noticeIcon}>
                <DoorOpen size={16} />
              </span>
              <span>{t.rich('noticeCheckout', { b: (chunks) => <strong>{chunks}</strong> })}</span>
            </div>
            <div className={styles.noticeItem}>
              <span className={styles.noticeIcon}>
                <FileText size={16} />
              </span>
              <span>{t.rich('noticeDocument', { b: (chunks) => <strong>{chunks}</strong> })}</span>
            </div>
            <div className={styles.noticeItem}>
              <span className={styles.noticeIcon}>
                <Ban size={16} />
              </span>
              <span>{t.rich('noticeAge', { b: (chunks) => <strong>{chunks}</strong> })}</span>
            </div>
            <div className={styles.noticeItem}>
              <span className={styles.noticeIcon}>
                <CigaretteOff size={16} />
              </span>
              <span>{t.rich('noticeSmoking', { b: (chunks) => <strong>{chunks}</strong> })}</span>
            </div>
            <div className={styles.noticeItem}>
              <span className={styles.noticeIcon}>
                <Users size={16} />
              </span>
              <span>{t.rich('noticeCapacity', { b: (chunks) => <strong>{chunks}</strong> })}</span>
            </div>
          </div>
        </div>

        {/* Anchor de scroll: scrollToContent() apunta aquí (no al hero) */}
        <div ref={stepContentRef} style={{ scrollMarginTop: '1.5rem' }} />

        {/* ── Paso 1: Fechas ──────────────────────────────────────────────── */}
        {step === 1 && (
          <ApartmentDateStep
            locale={locale}
            checkIn={checkIn}
            checkOut={checkOut}
            onDatesChange={(cin, cout) => {
              setCheckIn(cin);
              setCheckOut(cout);
              setSelectedApartment(null);
            }}
            onContinue={handleDatesContinue}
          />
        )}

        {/* ── Paso 2: Selector de apartamento ─────────────────────────────── */}
        {step === 2 && (
          <ApartmentSelectorStep
            locale={locale}
            checkIn={checkIn ?? ''}
            checkOut={checkOut ?? ''}
            nights={nights}
            guestCount={guestCount}
            maxGuests={maxAptGuests}
            onGuestCountChange={handleGuestCountChange}
            apartments={apartments}
            isLoading={isLoadingApartments}
            selectedApartment={selectedApartment}
            onSelect={setSelectedApartment}
            onDeselect={() => setSelectedApartment(null)}
            onApplyDates={handleMiniCalendarApply}
            onBack={goBack}
            onContinue={() => {
              setStep(3);
              scrollToContent();
            }}
          />
        )}

        {/* ── Paso 3: Resumen + formulario de huésped ──────────────────────── */}
        {step === 3 && selectedApartment && (
          <ApartmentGuestForm
            locale={locale}
            checkIn={checkIn ?? ''}
            checkOut={checkOut ?? ''}
            nights={nights}
            guestCount={guestCount}
            checkinTimes={checkinTimes}
            onGuestCountChange={handleGuestCountChange}
            selectedApartment={selectedApartment}
            guestForm={guestForm}
            touched={touched}
            isCreatingBooking={isCreatingBooking}
            onFieldChange={(field, value) => setGuestForm((f) => ({ ...f, [field]: value }))}
            onFieldBlur={(field) => setTouched((tt) => ({ ...tt, [field]: true }))}
            onReserve={handleReserve}
            onBack={goBack}
            additionalGuests={additionalGuests}
            onAdditionalGuestsChange={setAdditionalGuests}
            appliedCoupon={appliedCoupon}
            onCouponApply={(coupon) => setAppliedCoupon(coupon)}
            onCouponRemove={() => setAppliedCoupon(null)}
            onValidateCoupon={async (code) => {
              const res = await offersAPI.validate(code, selectedApartment.id, checkIn ?? '', checkOut ?? '');
              return res?.data;
            }}
            documentPhoto={documentPhoto}
            onDocumentPhotoChange={setDocumentPhoto}
            companionDocumentPhoto={companionDocumentPhoto}
            onCompanionDocumentPhotoChange={setCompanionDocumentPhoto}
            termsAccepted={termsAccepted}
            onTermsAcceptedChange={setTermsAccepted}
            submitAttempted={submitAttempted}
          />
        )}

        {/* ── Paso 4: Pago (Stripe / Mercado Pago PIX) ─────────────────────── */}
        {step === 4 && booking && (
          <div>
            {paymentDone ? (
              <Modal
                open={paySuccessOpen}
                onClose={() => setPaySuccessOpen(false)}
                size="sm"
              >
                <ModalBody>
                  <div className={styles.paySuccess}>
                    <div className={styles.paySuccessIcon}>
                      <CheckCircle2 size={48} strokeWidth={1.6} />
                    </div>
                    <div className={styles.paySuccessTitle}>{t('paymentReceived')}</div>
                    <div className={styles.paySuccessRef}>{booking.confirmationNumber}</div>
                    <div className={styles.paySuccessMsg}>
                      {t('paymentSuccessLine1')}
                      <br />
                      {t('paymentSuccessLine2')}
                      <br />
                      <span className={styles.inlineIconText}>
                        <Mail size={14} /> {t('paymentSuccessLine3')}
                      </span>
                    </div>
                    {booking.referralCode && (
                      <div style={{ marginTop: '1.25rem', textAlign: 'left', width: '100%' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '.4rem',
                            fontSize: '.8rem',
                            fontWeight: 600,
                            marginBottom: '.35rem',
                          }}
                        >
                          <Gift size={14} /> {t('referralTitle')}
                        </div>
                        <p
                          style={{
                            fontSize: '.78rem',
                            color: 'var(--fg-muted)',
                            margin: '0 0 .6rem',
                          }}
                        >
                          {t('referralBody')}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.75rem' }}>
                          <code
                            style={{
                              flex: 1,
                              fontFamily: 'monospace',
                              fontSize: '.9rem',
                              fontWeight: 700,
                              letterSpacing: '.04em',
                              background: 'var(--bg-subtle)',
                              border: '1px solid var(--border)',
                              borderRadius: '8px',
                              padding: '.5rem .7rem',
                            }}
                          >
                            {booking.referralCode}
                          </code>
                          <button
                            type="button"
                            className={styles.cardBtn}
                            style={{ width: 'auto', marginTop: 0, whiteSpace: 'nowrap' }}
                            onClick={() => {
                              navigator.clipboard
                                .writeText(booking.referralCode ?? '')
                                .catch(() => {});
                              setReferralCopied(true);
                              referralCopiedTimerRef.current = setTimeout(() => setReferralCopied(false), 3000);
                            }}
                          >
                            {referralCopied ? (
                              <>
                                <Check size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '.3em' }} />
                                {t('referralCopied')}
                              </>
                            ) : (
                              t('referralCopy')
                            )}
                          </button>
                        </div>
                        {/* Botones de compartir */}
                        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                          <a
                            href={`https://wa.me/?text=${encodeURIComponent(t('referralShareMsg', { code: booking.referralCode ?? '' }))}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '.4rem',
                              padding: '.4rem .9rem',
                              borderRadius: '20px',
                              background: '#25D366',
                              color: '#fff',
                              fontSize: '.78rem',
                              fontWeight: 600,
                              textDecoration: 'none',
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                            {t('referralShareWhatsapp')}
                          </a>
                          <a
                            href={`mailto:?subject=${encodeURIComponent(t('referralShareSubject'))}&body=${encodeURIComponent(t('referralShareBody', { code: booking.referralCode ?? '' }))}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '.4rem',
                              padding: '.4rem .9rem',
                              borderRadius: '20px',
                              background: 'var(--bg-subtle)',
                              border: '1px solid var(--border)',
                              color: 'var(--fg)',
                              fontSize: '.78rem',
                              fontWeight: 600,
                              textDecoration: 'none',
                            }}
                          >
                            <Mail size={13} />
                            {t('referralShareEmail')}
                          </a>
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      className={styles.cardBtn}
                      style={{ marginTop: '1.5rem', width: '100%' }}
                      onClick={() => setPaySuccessOpen(false)}
                    >
                      {tc('close')}
                    </button>
                  </div>
                </ModalBody>
              </Modal>
            ) : isExpired ? (
              <>
                <div className={styles.errorBanner}>
                  {t('reservationExpired')}
                </div>
                <div className={styles.actions} style={{ marginTop: '1rem' }}>
                  <button type="button" className={styles.btnBack} onClick={goBack}>
                    ← {t('backToStep', { n: 3, label: t('stepSummary') })}
                  </button>
                </div>
              </>
            ) : (
              <>
                {booking.pendingExpiresAt && (
                  <PaymentCountdown
                    expiresAt={booking.pendingExpiresAt}
                    onExpire={() => setIsExpired(true)}
                    locale={locale}
                    className={styles.warnBox}
                  />
                )}
                <PaymentProcessor
                  reservationId={booking.id}
                  totalAmount={booking.total}
                  depositAmount={booking.deposit}
                  remainingAmount={booking.remaining}
                  checkInDate={booking.checkIn}
                  locale={locale}
                  onSuccess={() => setPaymentDone(true)}
                  paymentContext="apartment"
                />
                <div className={styles.actions} style={{ marginTop: '1.5rem' }}>
                  <button type="button" className={styles.btnBack} onClick={goBack}>
                    ← {t('backToStep', { n: 3, label: t('stepSummary') })}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
