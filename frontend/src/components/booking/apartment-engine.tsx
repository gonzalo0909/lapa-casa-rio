// lapa-casa-hostel/frontend/src/components/booking/apartment-engine.tsx
//
// Orquestador del motor de reservas de Apartamentos.
// Gestiona el estado global entre pasos y delega cada paso a su componente:
//   Paso 1 → ApartmentDateStep
//   Paso 2 → ApartmentSelectorStep
//   Paso 3 → ApartmentGuestForm
//   Paso 4 → PaymentProcessor (inline, mínimo)
//
// Dos ajustes deliberados frente al prototipo LCACOPIA (ver PR original):
//  1. El "10% de desconto no PIX" no existe en el backend real — se omite.
//  2. El Paso 4 usa el componente de pago real (Stripe + Mercado Pago PIX).

'use client';

import React, { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, KeyRound, DoorOpen, FileText, Ban, CigaretteOff, CheckCircle2, Mail } from 'lucide-react';
import styles from './apartment-engine.module.css';
import { Modal, ModalBody } from '../ui/modal';
import { PaymentCountdown } from '../payment/payment-countdown';
import { PaymentProcessor } from '../payment/payment-processor';
import { availabilityAPI, bookingAPI, handleAPIError } from '@/lib/api';
import { ApartmentDateStep } from './apartment-date-step';
import { ApartmentSelectorStep } from './apartment-selector-step';
import { ApartmentGuestForm } from './apartment-guest-form';
import { parseDs } from './apartment-engine.utils';
import { isEmailFmt, validateCPF } from './apartment-engine.utils';
import type { ApartmentAvailability } from '@/types/global';
import type {
  Step,
  GuestForm,
  CreatedBooking,
  ApartmentEngineProps,
} from './apartment-engine.types';
import { EMPTY_FORM } from './apartment-engine.types';

export const ApartmentEngine: React.FC<ApartmentEngineProps> = ({ locale = 'pt' }) => {
  const t = useTranslations('apartments');
  const tc = useTranslations('common');

  // ── Navegación ───────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState<string | null>(null);

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

  // ── Paso 4: pago ─────────────────────────────────────────────────────────
  const [booking, setBooking] = useState<CreatedBooking | null>(null);
  const [paymentDone, setPaymentDone] = useState(false);
  const [paySuccessOpen, setPaySuccessOpen] = useState(true);
  const [isExpired, setIsExpired] = useState(false);

  // ── Ref para scroll suave al contenido del paso (evitar saltar al hero) ──
  const stepContentRef = useRef<HTMLDivElement>(null);
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
      ? Math.round(
          (parseDs(checkOut).getTime() - parseDs(checkIn).getTime()) / 86400000,
        )
      : 0;

  // ── API: carga de apartamentos disponibles ───────────────────────────────
  const loadApartments = useCallback(
    async (cin: string, cout: string) => {
      setIsLoadingApartments(true);
      setError(null);
      try {
        const res = await availabilityAPI.checkApartments({ checkIn: cin, checkOut: cout });
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
    if (!checkIn || !checkOut) { return; }
    setStep(2);
    loadApartments(checkIn, checkOut);
  };

  const handleMiniCalendarApply = useCallback(
    async (range: { checkIn: Date; checkOut: Date }) => {
      const ds = (d: Date) =>
        [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
      const newCin = ds(range.checkIn);
      const newCout = ds(range.checkOut);
      setCheckIn(newCin);
      setCheckOut(newCout);
      // No deseleccionamos: si el apartamento sigue disponible en las nuevas
      // fechas lo mantenemos seleccionado para que "Continuar" siga visible.
      setIsLoadingApartments(true);
      setError(null);
      try {
        const res = await availabilityAPI.checkApartments({ checkIn: newCin, checkOut: newCout });
        const apts: ApartmentAvailability[] = res?.data?.apartments ?? [];
        setApartments(apts);
        setSelectedApartment((prev) => {
          if (!prev) return null;
          const updated = apts.find((a) => a.id === prev.id);
          // Mantener el apt seleccionado aunque ya no esté disponible —
          // el selector muestra la vista "bloqueado + alternativas".
          return updated ?? null;
        });
      } catch (err) {
        setError(handleAPIError(err, locale));
        setSelectedApartment(null);
      } finally {
        setIsLoadingApartments(false);
      }
    },
    [locale],
  );

  /** Valida el formulario y crea la reserva vía API. */
  const handleReserve = async () => {
    // Marcar todos los campos como tocados para mostrar errores en el form
    setTouched({
      fullName: true, email: true, confirmEmail: true,
      phone: true, document: true, arrivalTime: true,
    });
    if (!selectedApartment || !checkIn || !checkOut) { return; }

    // Validación local (espeja la lógica de ApartmentGuestForm)
    const emailOk = isEmailFmt(guestForm.email);
    const confirmEmailOk = emailOk && guestForm.confirmEmail === guestForm.email;
    const phoneDigits = guestForm.phone.replace(/\D/g, '');
    const phoneOk = phoneDigits.length >= 10;
    const cpfHasLetter = /[a-zA-Z]/.test(guestForm.document);
    const cpfDigits = guestForm.document.replace(/\D/g, '');
    const cpfOk = cpfHasLetter
      ? true
      : cpfDigits.length === 11
        ? validateCPF(cpfDigits)
        : false;
    const canReserve =
      !!(guestForm.fullName.trim() && emailOk && confirmEmailOk && phoneOk && cpfOk && guestForm.arrivalTime);
    if (!canReserve) {
      setError(t('formIncomplete'));
      return;
    }
    setError(null);

    setIsCreatingBooking(true);
    setError(null);
    try {
      const nameParts = guestForm.fullName.trim().split(/\s+/);
      const firstName = nameParts[0] ?? guestForm.fullName.trim();
      const lastName = nameParts.slice(1).join(' ') || firstName;
      const res = await bookingAPI.create({
        checkIn,
        checkOut,
        rooms: [{ roomId: selectedApartment.id, bedsCount: 1 }],
        guest: {
          firstName,
          lastName,
          email: guestForm.email,
          phone: guestForm.phone,
          country: guestForm.country,
          document: guestForm.document,
        },
        // NOTA: no mandamos `arrivalTime` al backend directamente.
        // create-booking.ts transforma el valor con replace('-', ':00 – ') + ':00',
        // pensado para rangos tipo "14-16" → "14:00 – 16:00". Los horarios de
        // este selector son puntuales (ej. "14:30"), sin guión, así que la
        // transformación produciría "14:30:00" (roto). Lo armamos nosotros.
        specialRequests: [
          guestForm.arrivalTime ? `Horário de chegada: ${guestForm.arrivalTime}` : null,
          guestForm.specialRequests.trim() || null,
        ]
          .filter(Boolean)
          .join('\n') || undefined,
        language: locale === 'de' || locale === 'fr' ? 'en' : locale,
        source: 'web',
        guestGender: 'mixed',
      });
      const b = res?.data?.booking;
      if (!b?.id) { throw new Error('No se recibió ID de reserva del servidor'); }
      const totalPrice = selectedApartment.priceTotal;
      const depositAmount = selectedApartment.depositAmount;
      setBooking({
        id: b.id,
        confirmationNumber: b.confirmationNumber,
        pendingExpiresAt: b.pendingExpiresAt ?? null,
        total: b.pricing?.total ?? totalPrice,
        deposit: b.payment?.depositAmount ?? depositAmount,
        remaining: b.pricing?.remaining ?? totalPrice - depositAmount,
        checkIn,
      });
      setStep(4);
      scrollToContent();
    } catch (err) {
      setError(handleAPIError(err, locale));
    } finally {
      setIsCreatingBooking(false);
    }
  };

  const goBack = () => {
    setError(null);
    if (step === 2) { setStep(1); }
    else if (step === 3) { setStep(2); }
    else if (step === 4) { setStep(3); }
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
        <div className={styles.heroBrand}>
          Lapa Casa<span>{t('heroApartmentsWord')}</span>
        </div>
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
                    step > s.n
                      ? styles.stepBadgeDone
                      : step === s.n
                        ? styles.stepBadgeActive
                        : ''
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
              <span className={styles.noticeIcon}><KeyRound size={16} /></span>
              <span>{t.rich('noticeCheckin', { b: (chunks) => <strong>{chunks}</strong> })}</span>
            </div>
            <div className={styles.noticeItem}>
              <span className={styles.noticeIcon}><DoorOpen size={16} /></span>
              <span>{t.rich('noticeCheckout', { b: (chunks) => <strong>{chunks}</strong> })}</span>
            </div>
            <div className={styles.noticeItem}>
              <span className={styles.noticeIcon}><FileText size={16} /></span>
              <span>{t.rich('noticeDocument', { b: (chunks) => <strong>{chunks}</strong> })}</span>
            </div>
            <div className={styles.noticeItem}>
              <span className={styles.noticeIcon}><Ban size={16} /></span>
              <span>{t.rich('noticeAge', { b: (chunks) => <strong>{chunks}</strong> })}</span>
            </div>
            <div className={styles.noticeItem}>
              <span className={styles.noticeIcon}><CigaretteOff size={16} /></span>
              <span>{t.rich('noticeSmoking', { b: (chunks) => <strong>{chunks}</strong> })}</span>
            </div>
          </div>
        </div>

        {/* Anchor de scroll: scrollToContent() apunta aquí (no al hero) */}
        <div ref={stepContentRef} style={{ scrollMarginTop: '1.5rem' }} />

        {/* ── Paso 1: Fechas ──────────────────────────────────────────────── */}
        {step === 1 && (
          <ApartmentDateStep
            locale={locale}
            guestCount={guestCount}
            onGuestCountChange={setGuestCount}
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
            selectedApartment={selectedApartment}
            guestForm={guestForm}
            touched={touched}
            isCreatingBooking={isCreatingBooking}
            error={error}
            onFieldChange={(field, value) =>
              setGuestForm((f) => ({ ...f, [field]: value }))
            }
            onFieldBlur={(field) =>
              setTouched((tt) => ({ ...tt, [field]: true }))
            }
            onReserve={handleReserve}
            onBack={goBack}
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
                disableBackdropClick
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
                  </div>
                </ModalBody>
              </Modal>
            ) : isExpired ? (
              <div className={styles.errorBanner}>
                A reserva expirou — as datas não estão mais retidas. Volte a tentar a reserva.
              </div>
            ) : (
              <>
                {booking.pendingExpiresAt && (
                  <PaymentCountdown
                    expiresAt={booking.pendingExpiresAt}
                    onExpire={() => setIsExpired(true)}
                    locale={locale}
                    className={styles.carnivalWarn}
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
