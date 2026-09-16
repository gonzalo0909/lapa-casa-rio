'use client';
// frontend/src/components/booking/hostel-group-panel.tsx
// Panel mostrado tras generar el link de pago grupal: un solo botón para
// compartirlo por WhatsApp y otro para que el titular reserve su propia
// cama. Sin link crudo en pantalla ni botones de más -- el titular ya lo
// tiene en el chat de WhatsApp que se le abre.

import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { Translations } from './hostel-engine.types';
import { fmtMoney } from './hostel-engine.utils';

interface HostelGroupPanelProps {
  t: Translations;
  totalBeds: number;
  groupResNum: string;
  groupWaUrl: string;
  groupAmountPerBed: number;
  onBookOwnBed: () => void;
}

export function HostelGroupPanel({
  t, totalBeds, groupResNum, groupWaUrl, groupAmountPerBed, onBookOwnBed,
}: HostelGroupPanelProps) {
  return (
    <div className="he-card">
      <div className="he-glink-panel">
        <div className="he-success-check">
          <CheckCircle2 size={28} color="#1E5E40" aria-hidden />
        </div>
        {groupResNum && <div className="he-glink-code">{groupResNum}</div>}
        <div className="he-glink-title">{t.gpTitle}</div>
        <div className="he-glink-desc">{t.gpDesc}</div>

        <div className="he-glink-btns">
          <a href={groupWaUrl} target="_blank" rel="noopener noreferrer" className="he-glink-wa">
            {t.gpShareWa}
          </a>
        </div>

        <div className="he-glink-meta">
          {groupAmountPerBed > 0 && (
            <>{totalBeds} {totalBeds === 1 ? t.tBed : t.tBeds} · {fmtMoney(groupAmountPerBed)} {t.tBed.toLowerCase()}<br /></>
          )}
          {t.gpExpire}
        </div>

        <button
          className="he-btn-confirm"
          style={{ marginTop: '1.25rem' }}
          onClick={onBookOwnBed}
        >
          {t.btnBookOwnBed}
        </button>
      </div>
    </div>
  );
}
