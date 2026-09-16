'use client';
// frontend/src/components/booking/hostel-expired-panel.tsx
// Panel mostrado cuando el timer de 5 minutos post-reserva expira sin pago confirmado.

import React from 'react';
import { Clock } from 'lucide-react';
import type { Translations } from './hostel-engine.types';

interface HostelExpiredPanelProps {
  t: Translations;
  onTryAgain: () => void;
}

export function HostelExpiredPanel({ t, onTryAgain }: HostelExpiredPanelProps) {
  return (
    <div className="he-card">
      <div className="he-expired-panel">
        <div className="he-expired-icon">
          <Clock size={44} color="#C8870A" aria-hidden />
        </div>
        <div className="he-expired-title">{t.expiredTitle}</div>
        <div className="he-expired-sub">{t.expiredSub}</div>
        <button className="he-btn-confirm" onClick={onTryAgain}>{t.btnTryAgain}</button>
      </div>
    </div>
  );
}
