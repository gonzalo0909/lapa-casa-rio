// lapa-casa-hostel/frontend/src/components/booking/property-selector-hero.tsx

'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

interface PropertySelectorHeroProps {
  onSelectApartments: () => void;
}

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' } as const;

// Paleta tomada tal cual de la maqueta (Santa Teresa: paper/foliage/azulejo/cream).
// Fija por ahora -- no responde a light/dark del resto del sitio. Se ajusta después.
const COLORS = {
  bg: '#12160F',
  surface: '#191E14',
  line: '#333A2B',
  ink: '#EDE8D8',
  inkSoft: '#B7AF9A',
  azulejo: '#1F4F68',
  azulejo2: '#3A87AC',
  cream: '#F4EEDA',
};

/**
 * PropertySelectorHero
 *
 * Nav + hero de la home, apartamentos únicamente. El motor de reservas de
 * hostel no vive en esta rama (ver mrh1308), así que no queda ningún panel
 * ni referencia a "Hostel" acá -- solo el CTA que lleva al motor de
 * apartamentos.
 */
export const PropertySelectorHero: React.FC<PropertySelectorHeroProps> = ({ onSelectApartments }) => {
  const t = useTranslations('propertySelector');

  return (
    <div style={{ background: COLORS.bg, color: COLORS.ink }}>
      {/* ── Nav ─────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-20 flex items-center justify-between gap-4 px-6 py-4 flex-wrap"
        style={{ background: COLORS.bg, borderBottom: `1px solid ${COLORS.line}` }}
      >
        <span style={{ ...serif, fontSize: '1.15rem' }}>Lapa Casa</span>
        <button
          type="button"
          onClick={onSelectApartments}
          className="px-4 py-2 rounded-full text-sm font-semibold transition-colors"
          style={{ border: `1px solid ${COLORS.line}`, background: COLORS.surface, color: COLORS.inkSoft }}
        >
          {t('navCta')}
        </button>
      </div>

      {/* ── Hero ────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 pt-10 pb-14 text-center">
        <p className="text-sm mb-3" style={{ color: COLORS.inkSoft }}>
          {t('eyebrow')}
        </p>
        <h1 className="text-3xl sm:text-4xl mb-4 leading-tight" style={serif}>
          {t('title')}
        </h1>
        <p className="text-base max-w-xl mx-auto mb-8" style={{ color: COLORS.inkSoft }}>
          {t('subtitle')}
        </p>

        <button
          type="button"
          onClick={onSelectApartments}
          className="group relative overflow-hidden rounded-2xl text-left inline-flex items-end p-6 w-full max-w-md mx-auto transition-transform hover:-translate-y-1"
          style={{
            background: `linear-gradient(155deg, ${COLORS.azulejo} 0%, ${COLORS.azulejo2} 100%)`,
            color: COLORS.cream,
            minHeight: '220px',
          }}
        >
          <span className="absolute inset-0 opacity-50 group-hover:opacity-75 transition-opacity pointer-events-none">
            <WindowsPattern />
          </span>
          <span className="relative z-10">
            <span className="block text-xl font-bold mb-1" style={serif}>{t('apartmentsTitle')}</span>
            <span className="inline-flex items-center gap-2 text-sm font-semibold border-b border-transparent group-hover:border-current pb-0.5">
              {t('cta')} →
            </span>
          </span>
        </button>
      </div>
    </div>
  );
};

/* ── helpers ─────────────────────────────────────────────────── */

function WindowsPattern() {
  return (
    <svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" className="w-full h-full" aria-hidden="true">
      <defs>
        <pattern id="psh-windows" width="56" height="56" patternUnits="userSpaceOnUse">
          <rect x="8" y="8" width="34" height="34" rx="5" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <line x1="25" y1="8" x2="25" y2="42" stroke="currentColor" strokeWidth="1" opacity="0.6" />
          <line x1="8" y1="25" x2="42" y2="25" stroke="currentColor" strokeWidth="1" opacity="0.6" />
        </pattern>
      </defs>
      <rect width="400" height="400" fill="url(#psh-windows)" />
    </svg>
  );
}
