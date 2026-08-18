// components/payment/payment-countdown.tsx
// ENCHUFE TEMPORAL para el preview. Muestra un contador simple hasta expiresAt.

'use client';

import React, { useEffect, useState } from 'react';

interface PaymentCountdownProps {
  expiresAt: string;
  onExpire: () => void;
  locale: string;
  className?: string;
}

export const PaymentCountdown: React.FC<PaymentCountdownProps> = ({ expiresAt, onExpire, className }) => {
  const [remaining, setRemaining] = useState<number>(() =>
    Math.max(0, new Date(expiresAt).getTime() - Date.now()),
  );

  useEffect(() => {
    const id = setInterval(() => {
      const ms = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      setRemaining(ms);
      if (ms <= 0) { onExpire(); }
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onExpire]);

  const mm = String(Math.floor(remaining / 60000)).padStart(2, '0');
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');

  return (
    <div className={className}>
      ⏳ Reserva retida por {mm}:{ss} — completa el pago para confirmar.
    </div>
  );
};
