// lapa-casa-hostel/frontend/src/components/booking/apartment-engine.tsx
//
// Motor de reservas de Apartamentos: código real, conectado al backend real,
// con el mismo diseño y las mismas funciones del prototipo LCACOPIA
// (docs/mralapagon/lcacopia.html). Vive en /apartamentos, la página a la
// que navega la ventana "Apartamentos" del home.
//
// Dos ajustes deliberados frente al prototipo, ambos porque el prototipo
// simulaba algo que el backend real no hace (ver PR):
//  1. El "10% de desconto no PIX" de LCACOPIA no existe en el backend real
//     -- se omite en vez de prometer un descuento que no se aplica al cobrar.
//  2. El Paso 4 (Pagamento) usa el componente de pago real ya existente en
//     el sitio (PaymentProcessor: Stripe real + Mercado Pago PIX real, con
//     QR/código Pix real) en vez del QR decorativo y los botones
//     "simular pago" del prototipo.

'use client';

import React, { useCallback, useMemo, useState } from 'react';
import styles from './apartment-engine.module.css';
import { ApartmentCard } from './apartment-card';
import { PaymentCountdown } from '../payment/payment-countdown';
import { PaymentProcessor } from '../payment/payment-processor';
import { availabilityAPI, bookingAPI, handleAPIError } from '@/lib/api';
import { seasonForDateStr, SEASONS, CARNAVAL_MULTIPLIER, CARNAVAL_MIN_NIGHTS } from '@/lib/apartment-seasons';
import type { ApartmentAvailability } from '@/types/global';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const CHECKIN_TIMES = ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'];

type Step = 1 | 2 | 3 | 4;

function toDs(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function parseDs(s: string): Date {
  const [y, m, d] = s.split('-') as [string, string, string];
  return new Date(Number(y), Number(m) - 1, Number(d));
}
function fmtDate(ds: string | null): string {
  if (!ds) { return ''; }
  const d = parseDs(ds);
  return String(d.getDate()).padStart(2, '0') + ' ' + (MONTHS[d.getMonth()] ?? '').slice(0, 3) + ' ' + d.getFullYear();
}
function todayDs(): string {
  return toDs(new Date());
}

function validateCPF(raw: string): boolean {
  const cpf = raw.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) { return false; }
  let s = 0;
  for (let i = 0; i < 9; i++) { s += parseInt(cpf[i] ?? '0', 10) * (10 - i); }
  let d = (s * 10) % 11; if (d >= 10) { d = 0; }
  if (d !== parseInt(cpf[9] ?? '0', 10)) { return false; }
  s = 0;
  for (let i = 0; i < 10; i++) { s += parseInt(cpf[i] ?? '0', 10) * (11 - i); }
  d = (s * 10) % 11; if (d >= 10) { d = 0; }
  return d === parseInt(cpf[10] ?? '0', 10);
}
function formatCPF(v: string): string {
  const digits = v.replace(/\D/g, '').slice(0, 11);
  if (digits.length > 9) { return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`; }
  if (digits.length > 6) { return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`; }
  if (digits.length > 3) { return `${digits.slice(0, 3)}.${digits.slice(3)}`; }
  return digits;
}
function isEmailFmt(v: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/.test(v) && !v.includes('..') && v.indexOf('@') > 0;
}
function formatBRPhone(raw: string): string {
  const clean = raw.replace(/[^\d+]/g, '');
  const digits = clean.replace(/\D/g, '');
  if (digits.length <= 2) { return clean; }
  if (digits.startsWith('55') || clean.startsWith('+55')) {
    const d = digits.startsWith('55') ? digits.slice(2) : digits;
    let fmt = '+55 ';
    if (d.length > 0) { fmt += '(' + d.slice(0, 2) + ')'; }
    if (d.length > 2) { fmt += ' ' + d.slice(2, 7); }
    if (d.length > 7) { fmt += '-' + d.slice(7, 11); }
    return fmt;
  }
  return clean.slice(0, 18);
}

function rankApartments(apartments: ApartmentAvailability[], guestCount: number) {
  const fits = (a: ApartmentAvailability) => a.available && a.capacity >= guestCount;
  const tooSmall = (a: ApartmentAvailability) => a.available && a.capacity < guestCount;
  return [
    ...apartments.filter(fits).map((apt) => ({ apt, disabledReason: undefined as 'unavailable' | 'too-small' | undefined })),
    ...apartments.filter(tooSmall).map((apt) => ({ apt, disabledReason: 'too-small' as const })),
    ...apartments.filter((a) => !a.available).map((apt) => ({ apt, disabledReason: 'unavailable' as const })),
  ];
}

interface GuestForm {
  fullName: string;
  email: string;
  confirmEmail: string;
  phone: string;
  country: string;
  document: string;
  arrivalTime: string;
  specialRequests: string;
}
const EMPTY_FORM: GuestForm = { fullName: '', email: '', confirmEmail: '', phone: '', country: 'Brasil', document: '', arrivalTime: '', specialRequests: '' };

interface CreatedBooking {
  id: string;
  confirmationNumber: string;
  pendingExpiresAt: string | null;
  total: number;
  deposit: number;
  remaining: number;
  checkIn: string;
}

interface ApartmentEngineProps {
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
}

export const ApartmentEngine: React.FC<ApartmentEngineProps> = ({ locale = 'pt' }) => {
  const [step, setStep] = useState<Step>(1);

  // ── Step 1: fechas ──────────────────────────────────────────────
  const [guestCount, setGuestCount] = useState(2);
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [hoverDs, setHoverDs] = useState<string | null>(null);
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // ── Step 2: apartamentos ─────────────────────────────────────────
  const [apartments, setApartments] = useState<ApartmentAvailability[]>([]);
  const [isLoadingApartments, setIsLoadingApartments] = useState(false);
  const [selectedApartment, setSelectedApartment] = useState<ApartmentAvailability | null>(null);

  // ── Step 3: resumo + huésped ──────────────────────────────────────
  const [guestForm, setGuestForm] = useState<GuestForm>(EMPTY_FORM);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [cancelOpen, setCancelOpen] = useState(false);
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);

  // ── Step 4: pagamento ─────────────────────────────────────────────
  const [booking, setBooking] = useState<CreatedBooking | null>(null);
  const [paymentDone, setPaymentDone] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const nights = checkIn && checkOut
    ? Math.round((parseDs(checkOut).getTime() - parseDs(checkIn).getTime()) / 86400000)
    : 0;

  // ── Calendario (paso 1) ────────────────────────────────────────────
  const loadApartments = useCallback(async (cin: string, cout: string) => {
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
  }, [locale]);

  const handleDayClick = (ds: string) => {
    if (ds < todayDs()) { return; }
    if (!checkIn || (checkIn && checkOut)) {
      setCheckIn(ds);
      setCheckOut(null);
    } else if (ds <= checkIn) {
      setCheckIn(ds);
    } else {
      setCheckOut(ds);
    }
    setHoverDs(null);
    setSelectedApartment(null);
  };

  const goPrevMonth = () => {
    setViewMonth((m) => {
      if (m === 0) { setViewYear((y) => y - 1); return 11; }
      return m - 1;
    });
  };
  const goNextMonth = () => {
    setViewMonth((m) => {
      if (m === 11) { setViewYear((y) => y + 1); return 0; }
      return m + 1;
    });
  };

  const seasonHint = checkIn ? seasonForDateStr(checkIn) : null;
  const minNightsWarn = !!(seasonHint && nights > 0 && nights < seasonHint.minNights);

  function renderMonth(y: number, m: number) {
    const dim = new Date(y, m + 1, 0).getDate();
    const fdow = new Date(y, m, 1).getDay();
    const startDs = checkIn;
    const endDs = checkOut || (checkIn && hoverDs && hoverDs > checkIn ? hoverDs : null);
    const hasEnd = !!(startDs && endDs);
    const today_ = todayDs();
    const cells: React.ReactNode[] = [];
    for (let i = 0; i < fdow; i++) {
      cells.push(<div key={'e' + i} className={`${styles.dayCell} ${styles.dayCellEmpty}`} />);
    }
    for (let d = 1; d <= dim; d++) {
      const s = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const past = s < today_;
      const isToday = s === today_;
      const isCin = s === startDs;
      const isCout = s === checkOut;
      const inRng = hasEnd && s > (startDs as string) && s < (endDs as string);
      const isHov = !!(!checkOut && checkIn && hoverDs && s === hoverDs && hoverDs > checkIn);
      const season = !past ? seasonForDateStr(s) : null;
      let cls = styles.dayCell;
      if (past) { cls += ` ${styles.dayCellPast}`; }
      else if (season?.name === 'alta') { cls += ` ${styles.dayCellAlta}`; }
      else if (season?.name === 'baixa') { cls += ` ${styles.dayCellBaixa}`; }
      if (isCin) { cls += ` ${styles.dayCellSelStart}${hasEnd ? ` ${styles.dayCellHasEnd}` : ''}`; }
      if (isCout) { cls += ` ${styles.dayCellSelEnd}`; }
      if (inRng) { cls += ` ${styles.dayCellInRange}`; }
      if (isHov) { cls += ` ${styles.dayCellHov}`; }
      cells.push(
        <button
          key={s}
          type="button"
          className={cls}
          disabled={past}
          onClick={() => handleDayClick(s)}
          onMouseEnter={() => !past && setHoverDs(s)}
        >
          <span className={styles.dayNum}>{d}</span>
          {isToday && <span className={styles.todayDot} />}
        </button>
      );
    }
    return (
      <div className={styles.calMonth}>
        <div className={styles.monthTitle}>{MONTHS[m]} {y}</div>
        <div className={styles.wdayHeaders}>{WDAYS.map((w) => <span key={w} className={styles.wday}>{w}</span>)}</div>
        <div className={styles.dayCells} onMouseLeave={() => setHoverDs(null)}>{cells}</div>
      </div>
    );
  }

  const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
  const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
  const prevDisabled = viewYear < today.getFullYear() || (viewYear === today.getFullYear() && viewMonth <= today.getMonth());

  const handleDatesContinue = () => {
    if (!checkIn || !checkOut) { return; }
    setStep(2);
    loadApartments(checkIn, checkOut);
  };

  // ── Paso 2 ──────────────────────────────────────────────────────
  const rankedApartments = useMemo(() => rankApartments(apartments, guestCount), [apartments, guestCount]);
  const availableCount = apartments.filter((a) => a.available && a.capacity >= guestCount).length;
  const gridSeasonType = apartments[0]?.seasonType;
  const gridSeasonMultiplier = apartments[0]?.seasonMultiplier;

  const handleMiniCalendarApply = useCallback((range: { checkIn: Date; checkOut: Date }) => {
    const newCin = toDs(range.checkIn);
    const newCout = toDs(range.checkOut);
    setCheckIn(newCin);
    setCheckOut(newCout);
    setSelectedApartment(null);
    loadApartments(newCin, newCout);
  }, [loadApartments]);

  // ── Paso 3 ──────────────────────────────────────────────────────
  const emailOk = guestForm.email ? isEmailFmt(guestForm.email) : null;
  const confirmEmailOk = guestForm.confirmEmail ? (isEmailFmt(guestForm.email) && guestForm.confirmEmail === guestForm.email) : null;
  const phoneDigits = guestForm.phone.replace(/\D/g, '');
  const phoneOk = guestForm.phone ? phoneDigits.length >= 10 : null;
  const cpfHasLetter = /[a-zA-Z]/.test(guestForm.document);
  const cpfDigits = guestForm.document.replace(/\D/g, '');
  const cpfOk = !guestForm.document ? null : cpfHasLetter ? true : cpfDigits.length === 11 ? validateCPF(cpfDigits) : null;

  const updateField = (field: keyof GuestForm, value: string) => {
    setGuestForm((f) => ({ ...f, [field]: value }));
  };

  const totalPrice = selectedApartment?.priceTotal ?? 0;
  const otaPrice = Math.round(totalPrice * 1.15);
  const otaSaving = otaPrice - totalPrice;
  const depositAmount = selectedApartment?.depositAmount ?? 0;
  const depositPct = totalPrice > 0 ? Math.round((depositAmount / totalPrice) * 100) : 0;
  const isCarnaval = selectedApartment?.seasonType === 'carnaval';

  const canReserve = !!(
    guestForm.fullName.trim() &&
    emailOk && confirmEmailOk && phoneOk &&
    (cpfOk === true) &&
    guestForm.arrivalTime
  );

  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '';
  const whatsappMsg = selectedApartment
    ? encodeURIComponent(`Olá! Gostaria de reservar:\n• Apartamento: ${selectedApartment.name}\n• Check-in: ${fmtDate(checkIn)}\n• Check-out: ${fmtDate(checkOut)}\n• ${nights} noites\n• Total: R$ ${totalPrice.toLocaleString('pt-BR')}`)
    : '';

  const handleReserve = async () => {
    setTouched({ fullName: true, email: true, confirmEmail: true, phone: true, document: true, arrivalTime: true });
    if (!canReserve || !selectedApartment || !checkIn || !checkOut) { return; }
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
        specialRequests: guestForm.specialRequests || undefined,
        arrivalTime: guestForm.arrivalTime,
        language: locale === 'de' || locale === 'fr' ? 'en' : locale,
        source: 'web',
        guestGender: 'mixed',
      });
      const b = res?.data?.booking;
      if (!b?.id) { throw new Error('No se recibió ID de reserva del servidor'); }
      setBooking({
        id: b.id,
        confirmationNumber: b.confirmationNumber,
        pendingExpiresAt: b.pendingExpiresAt ?? null,
        total: b.pricing?.total ?? totalPrice,
        deposit: b.payment?.depositAmount ?? depositAmount,
        remaining: b.pricing?.remaining ?? (totalPrice - depositAmount),
        checkIn,
      });
      setStep(4);
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const STEP_LABELS: { n: Step; label: string }[] = [
    { n: 1, label: 'Datas' }, { n: 2, label: 'Apartamento' }, { n: 3, label: 'Resumo' }, { n: 4, label: 'Pagamento' },
  ];

  return (
    <div className={styles.root}>
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroLocation}>Santa Teresa · Rio de Janeiro</div>
        <div className={styles.heroBrand}>LAPA CASA <span>Apartamentos</span></div>
        <p className={styles.heroSub}>Unidades privativas no coração do Rio — reserve direto, sem intermediários</p>
      </div>

      <div className={styles.section}>
        {step > 1 && (
          <button type="button" className={styles.backTop} onClick={goBack}>← Voltar</button>
        )}

        {/* Steps */}
        <div className={styles.steps}>
          {STEP_LABELS.map((s, i) => (
            <React.Fragment key={s.n}>
              {i > 0 && <div className={styles.stepConnector} />}
              <div className={styles.stepItem}>
                <span className={`${styles.stepBadge} ${step > s.n ? styles.stepBadgeDone : step === s.n ? styles.stepBadgeActive : ''}`}>
                  {step > s.n ? '✓' : s.n}
                </span>
                <span className={`${styles.stepLabel} ${step === s.n ? styles.stepLabelActive : ''}`}>{s.label}</span>
              </div>
            </React.Fragment>
          ))}
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        {/* Notices */}
        <div className={styles.notices}>
          <div className={styles.noticesTitle}>⚠️ Informações importantes</div>
          <div className={styles.noticesGrid}>
            <div className={styles.noticeItem}><span className={styles.noticeIcon}>🔑</span><span>Check-in (entrada): <strong>14h às 22h</strong> — para chegar antes, reserve também o dia anterior</span></div>
            <div className={styles.noticeItem}><span className={styles.noticeIcon}>🚪</span><span>Check-out (saída): até as <strong>12h</strong> — para sair mais tarde, prefira reservar mais um dia</span></div>
            <div className={styles.noticeItem}><span className={styles.noticeIcon}>📄</span><span>Envio de foto do documento <strong>obrigatório</strong>, sem exceção</span></div>
            <div className={styles.noticeItem}><span className={styles.noticeIcon}>🔞</span><span>Somente para <strong>maiores de 18 anos</strong></span></div>
            <div className={styles.noticeItem}><span className={styles.noticeIcon}>🚭</span><span><strong>Proibido fumar</strong> no apartamento e nas dependências do prédio</span></div>
          </div>
        </div>

        {/* PASO 1: Datas */}
        {step === 1 && (
          <div>
            <div className={styles.guestCounterWrap}>
              <div className={styles.guestCounterLabel}>
                {guestCount} hóspede{guestCount !== 1 ? 's' : ''}
                <small>Filtra apartamentos por capacidade</small>
              </div>
              <div className={styles.guestCounterBtns}>
                <button type="button" className={styles.gcntBtn} disabled={guestCount <= 1} onClick={() => setGuestCount((c) => Math.max(1, c - 1))}>−</button>
                <span className={styles.gcntVal}>{guestCount}</span>
                <button type="button" className={styles.gcntBtn} disabled={guestCount >= 4} onClick={() => setGuestCount((c) => Math.min(4, c + 1))}>+</button>
              </div>
            </div>

            <div className={styles.seasonLegend}>
              <span className={`${styles.seasonChip} ${styles.seasonChipCarnaval}`}>🎊 Carnaval ×{CARNAVAL_MULTIPLIER.toFixed(1)}</span>
              <span className={`${styles.seasonChip} ${styles.seasonChipAlta}`}>☀️ Alta ×{SEASONS.alta.multiplier.toFixed(1)}</span>
              <span className={`${styles.seasonChip} ${styles.seasonChipMedia}`}>— Média ×{SEASONS.media.multiplier.toFixed(1)}</span>
              <span className={`${styles.seasonChip} ${styles.seasonChipBaixa}`}>🌿 Baixa ×{SEASONS.baixa.multiplier.toFixed(1)}</span>
            </div>

            <div className={styles.calWrapper}>
              <button type="button" className={styles.calNav} disabled={prevDisabled} onClick={goPrevMonth}>‹</button>
              <div className={styles.calMonths}>
                {renderMonth(viewYear, viewMonth)}
                {renderMonth(nextY, nextM)}
              </div>
              <button type="button" className={styles.calNav} onClick={goNextMonth}>›</button>
            </div>

            {minNightsWarn && seasonHint && (
              <div className={styles.carnivalWarn}>
                📅 <strong>{seasonHint.label}:</strong> estadia mínima de <strong>{seasonHint.minNights} noites</strong>. O Carnaval (temporada dinâmica) pode exigir {CARNAVAL_MIN_NIGHTS} noites — a disponibilidade real se confirma no próximo passo.
              </div>
            )}

            <div className={styles.actions} style={{ marginTop: '1.25rem' }}>
              <div className={`${styles.dateInfo} ${!checkIn ? styles.dateInfoHint : ''}`}>
                {!checkIn ? 'Selecione a data de entrada' : !checkOut ? (
                  <><strong>Entrada:</strong> {fmtDate(checkIn)} — selecione a saída</>
                ) : (
                  <><strong>{fmtDate(checkIn)}</strong> → <strong>{fmtDate(checkOut)}</strong> · <strong>{nights}</strong> noite{nights !== 1 ? 's' : ''}</>
                )}
              </div>
              <button
                type="button"
                className={`${styles.btnContinue} ${checkIn && checkOut ? styles.btnContinueActive : ''}`}
                onClick={handleDatesContinue}
                disabled={!checkIn || !checkOut}
              >
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* PASO 2: Apartamentos */}
        {step === 2 && (
          <div>
            {isLoadingApartments ? (
              <div className={styles.spinnerWrap}>Carregando…</div>
            ) : (
              <>
                <div className={styles.aptHeader}>
                  <div className={styles.datePill}>
                    <strong>{fmtDate(checkIn)}</strong> → <strong>{fmtDate(checkOut)}</strong> · {nights} noite{nights !== 1 ? 's' : ''}
                    {gridSeasonType && gridSeasonType !== 'media' && gridSeasonMultiplier !== 1 && (
                      <span className={`${styles.cardSeasonBadge} ${gridSeasonType === 'carnaval' ? styles.badgeCarnaval : gridSeasonType === 'alta' ? styles.badgeAlta : styles.badgeBaixa}`}>
                        {gridSeasonType === 'carnaval' ? '🎊 Carnaval' : gridSeasonType === 'alta' ? '☀️ Alta' : '🌿 Baixa'}
                      </span>
                    )}
                  </div>
                  <h2>Escolha seu apartamento</h2>
                  <p>{availableCount} apartamento{availableCount !== 1 ? 's' : ''} disponíve{availableCount !== 1 ? 'is' : 'l'} para {guestCount} hóspede{guestCount !== 1 ? 's' : ''}</p>
                </div>

                <div className={styles.aptGrid}>
                  {rankedApartments.map(({ apt, disabledReason }) => (
                    <ApartmentCard
                      key={apt.id}
                      apartment={apt}
                      nights={nights}
                      selected={selectedApartment?.id === apt.id}
                      onSelect={setSelectedApartment}
                      disabledReason={disabledReason}
                      globalCheckIn={parseDs(checkIn as string)}
                      globalCheckOut={parseDs(checkOut as string)}
                      onApplyDates={handleMiniCalendarApply}
                    />
                  ))}
                </div>

                <div className={styles.actions}>
                  <button type="button" className={styles.btnBack} onClick={goBack}>← Voltar</button>
                </div>
              </>
            )}

            {selectedApartment && (
              <div className={styles.stickyBar}>
                <div className={styles.stickyBarInfo}>
                  <strong>{selectedApartment.name}</strong> · R$ <strong style={{ color: 'var(--accent)' }}>{selectedApartment.priceTotal.toLocaleString('pt-BR')}</strong>
                </div>
                <button type="button" className={styles.stickyBarBtn} onClick={() => { setStep(3); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                  Continuar →
                </button>
              </div>
            )}
          </div>
        )}

        {/* PASO 3: Resumo + huésped */}
        {step === 3 && selectedApartment && (
          <div>
            <div className={styles.otaBanner}>
              🏷️ Reservando direto você paga <strong>R$ {otaSaving.toLocaleString('pt-BR')} a menos</strong> do que pelo Booking.com ou Airbnb — sem taxas de intermediário.
            </div>

            <div className={styles.summaryCard}>
              <h3>Resumo da reserva</h3>
              <div className={styles.summaryRows}>
                <div className={styles.summaryRow}><span>Apartamento</span><span className={styles.summaryRowBold}>{selectedApartment.name}</span></div>
                <div className={styles.summaryRow}><span>Hóspedes</span><span>{guestCount} hóspede{guestCount !== 1 ? 's' : ''}</span></div>
                <div className={styles.summaryRow}><span>Check-in</span><span>{fmtDate(checkIn)}</span></div>
                <div className={styles.summaryRow}><span>Check-out</span><span>{fmtDate(checkOut)}</span></div>
                <div className={styles.summaryRow}><span>Noites</span><span>{nights}</span></div>
                {selectedApartment.seasonType !== 'media' && (
                  <div className={styles.summaryRow}>
                    <span>Temporada</span>
                    <span className={styles.summaryRowBold}>
                      {selectedApartment.seasonType === 'carnaval' ? '🎊 Carnaval' : selectedApartment.seasonType === 'alta' ? '☀️ Alta' : '🌿 Baixa'} ×{selectedApartment.seasonMultiplier}
                    </span>
                  </div>
                )}
                <div className={`${styles.summaryRow} ${styles.totalRow}`}><span>Total</span><span className={styles.totalPrice}>R$ {totalPrice.toLocaleString('pt-BR')}</span></div>
              </div>
            </div>

            <div className={styles.addrTeaser}>
              <div className={styles.addrIcon}>📍</div>
              <div>
                <div className={styles.addrLabel}>Localização</div>
                <div className={styles.addrNeighborhood}>Rio de Janeiro, Brasil</div>
                <div className={styles.addrNote}>O endereço exato é enviado por e-mail após a confirmação do pagamento</div>
              </div>
            </div>

            <div className={styles.guestForm}>
              <h3>Dados do hóspede</h3>
              <div className={styles.formGrid}>
                <div className={styles.formField}>
                  <label htmlFor="apt-guest-name">Nome completo <span className={styles.req}>*</span></label>
                  <input
                    id="apt-guest-name"
                    type="text" placeholder="Seu nome completo" value={guestForm.fullName}
                    onChange={(e) => updateField('fullName', e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, fullName: true }))}
                    className={touched.fullName && !guestForm.fullName.trim() ? styles.inputInvalid : ''}
                  />
                </div>
                <div className={styles.formField}>
                  <label htmlFor="apt-guest-email">E-mail <span className={styles.req}>*</span></label>
                  <input
                    id="apt-guest-email"
                    type="email" placeholder="seu@email.com" autoComplete="off" value={guestForm.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                    onPaste={(e) => e.preventDefault()}
                    onCut={(e) => e.preventDefault()}
                    className={emailOk === true ? styles.inputValid : touched.email && emailOk === false ? styles.inputInvalid : ''}
                  />
                  {touched.email && guestForm.email && (
                    <span className={`${styles.feedback} ${emailOk ? styles.feedbackOk : styles.feedbackErr}`}>
                      {emailOk ? '✓ E-mail válido' : '✗ Formato inválido — ex: nome@dominio.com'}
                    </span>
                  )}
                </div>
                <div className={styles.formField}>
                  <label htmlFor="apt-guest-email-confirm">Confirmar e-mail <span className={styles.req}>*</span> <span style={{ fontSize: '.65rem', fontWeight: 400, color: 'var(--fg-muted)' }}>(digite manualmente)</span></label>
                  <input
                    id="apt-guest-email-confirm"
                    type="email" placeholder="Repita o e-mail" autoComplete="off" value={guestForm.confirmEmail}
                    onChange={(e) => updateField('confirmEmail', e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, confirmEmail: true }))}
                    onPaste={(e) => e.preventDefault()}
                    onCut={(e) => e.preventDefault()}
                    className={confirmEmailOk === true ? styles.inputValid : touched.confirmEmail && confirmEmailOk === false ? styles.inputInvalid : ''}
                  />
                  {touched.confirmEmail && guestForm.confirmEmail && (
                    <span className={`${styles.feedback} ${confirmEmailOk ? styles.feedbackOk : styles.feedbackErr}`}>
                      {confirmEmailOk ? '✓ E-mails coincidem' : '✗ E-mails não coincidem'}
                    </span>
                  )}
                </div>
                <div className={styles.formField}>
                  <label htmlFor="apt-guest-phone">Telefone / WhatsApp <span className={styles.req}>*</span></label>
                  <input
                    id="apt-guest-phone"
                    type="tel" placeholder="+55 21 9 9999-9999" autoComplete="tel" maxLength={20} inputMode="numeric"
                    value={guestForm.phone}
                    onChange={(e) => updateField('phone', formatBRPhone(e.target.value))}
                    onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                    className={phoneOk === true ? styles.inputValid : touched.phone && phoneOk === false ? styles.inputInvalid : ''}
                  />
                  {touched.phone && guestForm.phone && (
                    <span className={`${styles.feedback} ${phoneOk ? styles.feedbackOk : styles.feedbackErr}`}>
                      {phoneOk ? '✓ Telefone válido' : '✗ Número muito curto — inclua DDD e número completo'}
                    </span>
                  )}
                </div>
                <div className={styles.formField}>
                  <label htmlFor="apt-guest-country">País <span className={styles.req}>*</span></label>
                  <input id="apt-guest-country" type="text" placeholder="Brasil" value={guestForm.country} onChange={(e) => updateField('country', e.target.value)} />
                </div>
                <div className={styles.formField}>
                  <label htmlFor="apt-guest-document">Documento (CPF / Passaporte) <span className={styles.req}>*</span></label>
                  <input
                    id="apt-guest-document"
                    type="text" placeholder="000.000.000-00" maxLength={14} autoComplete="off"
                    value={guestForm.document}
                    onChange={(e) => updateField('document', /[a-zA-Z]/.test(e.target.value) ? e.target.value : formatCPF(e.target.value))}
                    onBlur={() => setTouched((t) => ({ ...t, document: true }))}
                    className={cpfOk === true ? styles.inputValid : touched.document && cpfOk === false ? styles.inputInvalid : ''}
                  />
                  {touched.document && guestForm.document && (
                    <span className={`${styles.feedback} ${cpfOk ? styles.feedbackOk : styles.feedbackErr}`}>
                      {cpfHasLetter ? '✓ Passaporte aceito' : cpfDigits.length === 11 ? (cpfOk ? '✓ CPF válido' : '✗ CPF inválido — verifique o número') : ''}
                    </span>
                  )}
                </div>
                <div className={styles.formField}>
                  <label htmlFor="apt-guest-arrival">Horário de chegada <span className={styles.req}>*</span></label>
                  <select
                    id="apt-guest-arrival"
                    value={guestForm.arrivalTime}
                    onChange={(e) => updateField('arrivalTime', e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, arrivalTime: true }))}
                    className={touched.arrivalTime && !guestForm.arrivalTime ? styles.inputInvalid : ''}
                  >
                    <option value="" disabled>Selecione (14h–22h)</option>
                    {CHECKIN_TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {touched.arrivalTime && guestForm.arrivalTime && (
                    <span className={`${styles.feedback} ${styles.feedbackOk}`}>✓ Horário selecionado</span>
                  )}
                </div>
                <div className={`${styles.formField} ${styles.formFieldFull}`}>
                  <label htmlFor="apt-guest-requests">Solicitações especiais <span className={styles.opt}>(opcional)</span></label>
                  <textarea
                    id="apt-guest-requests"
                    placeholder="Alguma preferência ou necessidade especial?"
                    value={guestForm.specialRequests}
                    onChange={(e) => updateField('specialRequests', e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.rulesConfirm}>
                <div className={styles.rulesConfirmTitle}>⚠️ Ao confirmar, você declara estar ciente de que:</div>
                <div className={styles.rulesConfirmList}>
                  <div className={styles.rulesConfirmItem}><span>🔑</span><span>Check-in (entrada): das <strong>14h às 22h</strong>. Se precisar chegar mais cedo, o ideal é reservar também o dia anterior.</span></div>
                  <div className={styles.rulesConfirmItem}><span>🚪</span><span>Check-out (saída): até as <strong>12h</strong>. Para sair mais tarde, prefira reservar mais um dia.</span></div>
                  <div className={styles.rulesConfirmItem}><span>📄</span><span>O envio de foto do documento de identificação é <strong>obrigatório</strong> antes do check-in, sem exceção.</span></div>
                  <div className={styles.rulesConfirmItem}><span>🔞</span><span>As unidades são destinadas exclusivamente a <strong>maiores de 18 anos</strong>.</span></div>
                  <div className={styles.rulesConfirmItem}><span>🚭</span><span>É <strong>proibido fumar</strong> no apartamento e em qualquer dependência do prédio.</span></div>
                </div>
              </div>

              <div className={styles.paymentNote}>
                <div className={styles.paymentNoteTitle}>💳 Para confirmar sua reserva</div>
                <div className={styles.depositPill}>🔒 Depósito de {depositPct}%{isCarnaval ? ' (Carnaval)' : ''} — restante pago no check-in</div>
                <div className={styles.paymentMethods}>
                  <div className={`${styles.paymentMethod} ${styles.paymentMethodPix}`}>
                    <span className={styles.pmIcon}>⚡</span>
                    <div>
                      <div className={styles.pmName}>PIX</div>
                      <div className={styles.pmDetail}>Depósito: <strong>R$ {depositAmount.toLocaleString('pt-BR')}</strong> · confirmação imediata</div>
                    </div>
                    <span className={`${styles.pmTag} ${styles.pmTagRecommended}`}>⚡ Aprovação imediata</span>
                  </div>
                  <div className={`${styles.paymentMethod} ${styles.paymentMethodCard}`}>
                    <span className={styles.pmIcon}>💳</span>
                    <div>
                      <div className={styles.pmName}>Cartão de crédito</div>
                      <div className={styles.pmDetail}>Depósito: R$ {depositAmount.toLocaleString('pt-BR')}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.cancelPolicy}>
                <button type="button" className={styles.cancelPolicyHeader} onClick={() => setCancelOpen((v) => !v)}>
                  <span className={styles.cancelPolicyTitle}>🔄 Política de cancelamento</span>
                  <span className={`${styles.cancelPolicyChevron} ${cancelOpen ? styles.cancelPolicyChevronOpen : ''}`}>▼</span>
                </button>
                {cancelOpen && (
                  <div className={styles.cancelPolicyBody}>
                    <div className={styles.cancelRows}>
                      <div className={styles.cancelRow}><span className={`${styles.cancelBadge} ${styles.cancelBadgeGreen}`}>✓ Gratuito</span><span>Cancelamento com mais de <strong>7 dias</strong> de antecedência — reembolso integral</span></div>
                      <div className={styles.cancelRow}><span className={`${styles.cancelBadge} ${styles.cancelBadgeAmber}`}>50%</span><span>Cancelamento entre <strong>2 e 7 dias</strong> antes do check-in — reembolso de 50%</span></div>
                      <div className={styles.cancelRow}><span className={`${styles.cancelBadge} ${styles.cancelBadgeRed}`}>✗ Sem reembolso</span><span>Cancelamento com menos de <strong>48h</strong> ou no-show</span></div>
                    </div>
                  </div>
                )}
              </div>

              <button type="button" className={styles.btnReserve} onClick={handleReserve} disabled={isCreatingBooking}>
                {isCreatingBooking ? 'Criando reserva…' : 'Confirmar e ir para pagamento →'}
              </button>
              {whatsappNumber && (
                <a className={styles.btnWhatsapp} href={`https://wa.me/${whatsappNumber}?text=${whatsappMsg}`} target="_blank" rel="noopener noreferrer">
                  💬 Confirmar via WhatsApp
                </a>
              )}
            </div>

            <div className={styles.actions}>
              <button type="button" className={styles.btnBack} onClick={goBack}>← Voltar ao passo 2 (Apartamentos)</button>
            </div>
          </div>
        )}

        {/* PASO 4: Pagamento (real -- Stripe/Mercado Pago) */}
        {step === 4 && booking && (
          <div>
            {paymentDone ? (
              <div className={styles.paySuccess}>
                <div className={styles.paySuccessIcon}>✅</div>
                <div className={styles.paySuccessTitle}>Pagamento recebido!</div>
                <div className={styles.paySuccessRef}>{booking.confirmationNumber}</div>
                <div className={styles.paySuccessMsg}>
                  Sua reserva está confirmada.<br />Você receberá a confirmação por e-mail em breve.
                  <br />📩 Verifique sua caixa de entrada — incluindo spam
                </div>
              </div>
            ) : (
              <>
                {booking.pendingExpiresAt && (
                  <PaymentCountdown expiresAt={booking.pendingExpiresAt} locale={locale} className={styles.carnivalWarn} />
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
                  <button type="button" className={styles.btnBack} onClick={goBack}>← Voltar ao passo 3 (Resumo)</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
