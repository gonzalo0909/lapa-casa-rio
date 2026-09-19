'use client';
// frontend/src/components/booking/hostel-info-banner.tsx
// Banner de información importante — contenido en los archivos de mensajes JSON.

import React from 'react';
import { AlertTriangle, KeyRound, DoorOpen, FileText, Ban, CigaretteOff, Accessibility } from 'lucide-react';
import type { Lang } from './hostel-engine.types';
import { T } from './hostel-engine.types';

const ICONS = [KeyRound, DoorOpen, FileText, CigaretteOff, Ban, Accessibility];

/** Convierte "texto [[negrita]] más texto" en nodos React con <strong>. */
function parseBold(str: string): React.ReactNode {
  const parts = str.split(/\[\[|\]\]/);
  return parts.map((p, i) => i % 2 === 1 ? <strong key={i}>{p}</strong> : p);
}

interface HostelInfoBannerProps {
  lang: Lang;
}

export function HostelInfoBanner({ lang }: HostelInfoBannerProps) {
  const t = T[lang];
  const rules = [
    t.infoCheckin, t.infoCheckout, t.infoDoc, t.infoSmoke, t.infoAge, t.infoBunk,
  ];
  return (
    <div className="he-info-box">
      <div className="he-info-title">
        <AlertTriangle size={13} aria-hidden />
        {t.infoBannerTitle}
      </div>
      <div className="he-info-grid">
        {rules.map((text, i) => {
          const Icon = ICONS[i];
          return (
            <div key={i} className="he-info-item">
              <Icon size={14} aria-hidden />
              <span>{parseBold(text)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
