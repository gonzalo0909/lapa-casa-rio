// lapa-casa-hostel/frontend/src/components/payment/payment-countdown.tsx

'use client';

import React, { useEffect, useState } from 'react';

/**
 * PaymentCountdown Component
 *
 * Cuenta regresiva real hasta `pending_expires_at` (reservations, ver
 * backend/src/services/booking-service.ts -- 5 minutos desde que se creó
 * la reserva). Cuando llega a cero, la cama se libera sola (worker de
 * limpieza de pendientes vencidos, ver database/migrations/0007_procedures.sql).
 *
 * @component
 */
interface PaymentCountdownProps {
  expiresAt: string;
  onExpire?: () => void;
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
  className?: string;
}

export const PaymentCountdown: React.FC<PaymentCountdownProps> = ({
  expiresAt,
  onExpire,
  locale = 'pt',
  className = ''
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    const expiryTime = new Date(expiresAt).getTime();
    const tick = () => {
      const remaining = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        onExpire?.();
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isExpired = secondsLeft === 0;
  const isUrgent = secondsLeft > 0 && secondsLeft <= 60;

  if (isExpired) {
    return (
      <div className={`p-4 rounded-lg border-2 bg-red-50 border-red-300 text-center ${className}`}>
        <p className="font-bold text-red-800">{T('expiredTitle', locale)}</p>
        <p className="text-sm text-red-700 mt-1">{T('expiredNote', locale)}</p>
      </div>
    );
  }

  return (
    <div
      className={`p-4 rounded-lg border-2 text-center transition-colors ${
        isUrgent ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-300'
      } ${className}`}
      role="timer"
      aria-live="polite"
    >
      <p className={`text-sm font-medium ${isUrgent ? 'text-red-800' : 'text-amber-800'}`}>
        {T('note', locale)}
      </p>
      <p className={`text-3xl font-bold tabular-nums mt-1 ${isUrgent ? 'text-red-700' : 'text-amber-700'}`}>
        {minutes}:{seconds.toString().padStart(2, '0')}
      </p>
    </div>
  );
};

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      note: 'Você tem este tempo para completar o pagamento antes que as camas sejam liberadas:',
      expiredTitle: 'Tempo esgotado',
      expiredNote: 'As camas desta reserva foram liberadas. Volte e faça a reserva novamente.'
    },
    es: {
      note: 'Tenés este tiempo para completar el pago antes de que se liberen las camas:',
      expiredTitle: 'Se acabó el tiempo',
      expiredNote: 'Las camas de esta reserva quedaron liberadas. Volvé a hacer la reserva de nuevo.'
    },
    en: {
      note: 'You have this much time to complete the payment before the beds are released:',
      expiredTitle: 'Time is up',
      expiredNote: 'The beds for this booking have been released. Please make the booking again.'
    },
    fr: {
      note: 'Vous avez ce temps pour finaliser le paiement avant que les lits ne soient libérés :',
      expiredTitle: 'Temps écoulé',
      expiredNote: 'Les lits de cette réservation ont été libérés. Veuillez refaire la réservation.'
    },
    de: {
      note: 'Sie haben diese Zeit, um die Zahlung abzuschließen, bevor die Betten freigegeben werden:',
      expiredTitle: 'Zeit abgelaufen',
      expiredNote: 'Die Betten dieser Buchung wurden freigegeben. Bitte buchen Sie erneut.'
    }
  };
  return t[locale]?.[key] || key;
}
