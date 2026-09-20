'use client';
// Wizard state: step navigation, calendar, rooms/beds, form, group fields.

import { useState, useCallback, useEffect } from 'react';
import type { BookingLocale } from '@/types/global';
import {
  type RoomDef, type FormState, type FormErrors, type FieldFeedback,
  type Translations, DEFAULT_ROOMS, OVERFLOW_PAIRS,
} from './hostel-engine.types';
import type { AppliedCoupon } from './hostel-guest-form';
import { getSeason, validateCPF } from './hostel-engine.utils';
import { availabilityAPI } from '@/lib/api';

export function useHostelWizard(lang: BookingLocale, t: Translations) {
  const [step, setStep]             = useState(1);
  const [calMonth, setCalMonth]     = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [checkIn, setCheckIn]       = useState<Date | null>(null);
  const [checkOut, setCheckOut]     = useState<Date | null>(null);
  const [hoverDate, setHoverDate]   = useState<Date | null>(null);
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [beds, setBeds]             = useState<Record<string, number>>({ cuarto1: 0, cuarto3: 0, cuarto4: 0, cuarto5: 0, cuarto6: 0 });
  const [revealed, setRevealed]     = useState<Record<string, boolean>>({ cuarto3: false, cuarto5: false });
  const [rooms, setRooms]           = useState<RoomDef[]>(DEFAULT_ROOMS);
  const [roomsLoaded, setRoomsLoaded] = useState(false);
  const [toast, setToast]           = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [gpName, setGpName]         = useState('');
  const [gpEmail, setGpEmail]       = useState('');

  const [form, setForm] = useState<FormState>({
    name: '', email: '', email2: '', phone: '', country: 'BR',
    doc: '', arrival: '', requests: '', docPhotoBase64: '', restrictionAccepted: false,
  });
  const [formErrors, setFormErrors]     = useState<FormErrors>({});
  const [docFeedback, setDocFeedback]   = useState<FieldFeedback | null>(null);
  const [emailFb, setEmailFb]           = useState<FieldFeedback | null>(null);
  const [phoneFb, setPhoneFb]           = useState<FieldFeedback | null>(null);

  const totalBeds    = Object.values(beds).reduce((s, n) => s + n, 0);
  const visibleRooms = rooms.filter((r) => {
    if (r.id === 'cuarto3') return !!revealed['cuarto3'];
    if (r.id === 'cuarto5') return !!revealed['cuarto5'];
    return true;
  });

  // Fetch room availability when dates change
  useEffect(() => {
    if (!checkIn || !checkOut) return;
    setRoomsLoaded(false);
    const ci = checkIn.toISOString().slice(0, 10);
    const co = checkOut.toISOString().slice(0, 10);
    availabilityAPI
      .check({ checkIn: ci, checkOut: co, beds: 1 })
      .then((res) => {
        const apiRooms: any[] = res.data?.rooms || [];
        if (!apiRooms.length) { showToast(t.tErrAvail); return; }
        setRooms(
          DEFAULT_ROOMS.map((dr) => {
            const match = apiRooms.find((ar: any) => ar.code === dr.code);
            if (!match) return dr;
            return { ...dr, realId: match.roomId, available: match.availableBeds ?? dr.available, price: match.basePrice };
          }),
        );
        setRoomsLoaded(true);
      })
      .catch(() => showToast(t.tErrAvail));
  }, [checkIn, checkOut]);

  const scrollToCard = useCallback(() => {
    setTimeout(() => {
      const el = document.querySelector('.he-steps') as HTMLElement | null;
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }, []);

  const handleCalClick = useCallback((date: Date) => {
    if (!checkIn || (checkIn && checkOut) || date < checkIn) {
      setCheckIn(date); setCheckOut(null); setSelectingEnd(true);
    } else {
      setCheckOut(date); setSelectingEnd(false); setHoverDate(null);
    }
  }, [checkIn, checkOut]);

  const handleMonthChange = useCallback((delta: number) => {
    setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }, []);

  const changeBeds = useCallback((id: string, delta: number) => {
    const cur  = beds[id] ?? 0;
    const room = rooms.find((r) => r.id === id)!;
    const newBeds = { ...beds };
    const rev     = { ...revealed };

    if (delta > 0) {
      if (cur < room.available) {
        newBeds[id] = cur + 1;
      } else {
        const pair = OVERFLOW_PAIRS.find((p) => p.primary === id);
        if (pair && !rev[pair.overflow]) { rev[pair.overflow] = true; }
      }
    } else {
      newBeds[id] = Math.max(0, cur - 1);
    }

    // Colapsar overflow si el cuarto principal baja de su capacidad
    for (const { primary, overflow } of OVERFLOW_PAIRS) {
      const r = rooms.find((r) => r.id === primary);
      if ((newBeds[primary] ?? 0) < (r?.available ?? 0)) {
        rev[overflow] = false;
        newBeds[overflow] = 0;
      }
    }
    // Colapsar overflow cuando el huésped lo baja manualmente a 0
    const overflowPair = OVERFLOW_PAIRS.find((p) => p.overflow === id);
    if (overflowPair && delta < 0 && (newBeds[id] ?? 0) === 0) { rev[id] = false; }

    setBeds(newBeds);
    setRevealed(rev);
  }, [rooms, beds, revealed]);

  const handleFormChange = useCallback((patch: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...patch }));
  }, []);

  const handleFormErrors = useCallback((patch: Partial<FormErrors>) => {
    setFormErrors((fe) => ({ ...fe, ...patch }));
  }, []);

  const validateForm = useCallback((): boolean => {
    const isBR    = form.country === 'BR';
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
    const email2Ok = emailOk && form.email2 === form.email;
    const digits  = form.doc.replace(/\D/g, '');
    const docOk   = isBR ? digits.length === 11 && validateCPF(digits) : form.doc.trim().length > 4;

    const errs: FormErrors = {};
    if (form.name.trim().length <= 2)                  { errs.name       = t.errName; }
    if (!emailOk)                                       { errs.email      = t.errEmail; }
    if (!email2Ok)                                      { errs.email2     = t.errEmail2; }
    if (form.phone.replace(/\D/g, '').length < 10)     { errs.phone      = t.errPhone; }
    if (!form.country)                                  { errs.country    = t.errCountry; }
    if (!docOk)                                        { errs.doc        = isBR ? t.errCPF : t.errDocForeign; }
    if (!form.arrival)                                  { errs.arrival    = t.errArrival; }
    if (!form.docPhotoBase64)                           { errs.docPhoto   = t.errDocPhoto; }
    if (!form.restrictionAccepted)                      { errs.restriction = t.errRestriction; }

    setFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      const firstKey = Object.keys(errs)[0] ?? '';
      const fieldMap: Record<string, string> = {
        name: 'he-f-name', email: 'he-f-email', email2: 'he-f-email2',
        phone: 'he-f-phone', country: 'he-f-country', doc: 'he-f-doc',
        arrival: 'he-f-arrival', docPhoto: 'he-f-doc-photo', restriction: 'he-f-restriction',
      };
      const el = document.getElementById(fieldMap[firstKey] ?? '');
      if (el) {
        setTimeout(() => { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => el.focus(), 350); }, 60);
      }
      return false;
    }
    return true;
  }, [form, t]);

  const goNext = useCallback(() => {
    if (step === 1) {
      if (!checkIn)  { showToast(t.tToastCheckin);  scrollToCard(); return; }
      if (!checkOut) { showToast(t.tToastCheckout); scrollToCard(); return; }
      const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000);
      const s = getSeason(checkIn);
      if (s.minNights > 1 && nights < s.minNights) {
        showToast(`${s.label}: ${t.tToastMinNights} ${s.minNights} ${t.tToastNights}`);
        scrollToCard(); return;
      }
      setStep(2);
    } else if (step === 2) {
      if (totalBeds === 0) { showToast(t.tToastBeds); scrollToCard(); return; }
      setStep(3);
    } else if (step === 3) {
      if (!validateForm()) return;
      setStep(4);
    }
    scrollToCard();
  }, [step, checkIn, checkOut, totalBeds, t, showToast, validateForm, scrollToCard]);

  return {
    step, setStep, calMonth, checkIn, checkOut, hoverDate, setHoverDate,
    selectingEnd, beds, revealed, rooms, roomsLoaded, toast, cancelOpen, setCancelOpen,
    appliedCoupon, setAppliedCoupon, gpName, setGpName, gpEmail, setGpEmail,
    form, setForm, formErrors, docFeedback, setDocFeedback,
    emailFb, setEmailFb, phoneFb, setPhoneFb,
    totalBeds, visibleRooms,
    handleCalClick, handleMonthChange, changeBeds,
    showToast, scrollToCard, handleFormChange, handleFormErrors, validateForm, goNext,
  };
}
