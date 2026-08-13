// lapa-casa-hostel/frontend/src/components/booking/property-selector-hero.tsx

'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

interface PropertySelectorHeroProps {
  activeTab: 0 | 1;
  onSelect: (tab: 0 | 1) => void;
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
  foliage: '#295E48',
  foliage2: '#327560',
  azulejo: '#1F4F68',
  azulejo2: '#3A87AC',
  cream: '#F4EEDA',
};

/**
 * PropertySelectorHero
 *
 * Primer paso de "convertir la maqueta en real": el nav + hero con los dos
 * paneles Hostel/Apartamentos, calcado del artefacto de referencia. Elegir
 * un panel (o un pill del nav) mueve la pestaña activa de PropertyTabs y
 * scrollea al motor de reservas real -- todavía no trae la agenda de
 * eventos ni el mapa de la maqueta, eso queda para una próxima pasada.
 */
export const PropertySelectorHero: React.FC<PropertySelectorHeroProps> = ({ activeTab, onSelect }) => {
  const t = useTranslations('propertySelector');

  return (
    <div style={{ background: COLORS.bg, color: COLORS.ink }}>
      {/* ── Nav ─────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-20 flex items-center justify-between gap-4 px-6 py-4 flex-wrap"
        style={{ background: COLORS.bg, borderBottom: `1px solid ${COLORS.line}` }}
      >
        <span style={{ ...serif, fontSize: '1.15rem' }}>Lapa Casa</span>
        <nav className="flex gap-2">
          <NavPill label={t('hostelTitle')} active={activeTab === 0} activeColor={COLORS.foliage} onClick={() => onSelect(0)} />
          <NavPill label={t('apartmentsTitle')} active={activeTab === 1} activeColor={COLORS.azulejo2} onClick={() => onSelect(1)} />
        </nav>
      </div>

      {/* ── Hero ────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 pt-10 pb-14 text-center">
        <p className="text-sm mb-3" style={{ color: COLORS.inkSoft }}>
          Una marca, dos formas de quedarte
        </p>
        <h1 className="text-3xl sm:text-4xl mb-8 leading-tight" style={serif}>
          {t('title')}
        </h1>

        <div className="flex flex-col sm:flex-row justify-center gap-4 max-w-3xl mx-auto">
          <PropertyPanel
            title={t('hostelTitle')}
            description={t('hostelDesc')}
            cta={t('hostelCta')}
            gradient={`linear-gradient(155deg, ${COLORS.foliage} 0%, ${COLORS.foliage2} 100%)`}
            pattern="beds"
            onClick={() => onSelect(0)}
          />
          <PropertyPanel
            title={t('apartmentsTitle')}
            description={t('apartmentsDesc')}
            cta={t('apartmentsCta')}
            gradient={`linear-gradient(155deg, ${COLORS.azulejo} 0%, ${COLORS.azulejo2} 100%)`}
            pattern="windows"
            onClick={() => onSelect(1)}
          />
        </div>

        <p className="text-sm mt-6" style={{ color: COLORS.inkSoft }}>
          {t('note')}
        </p>
      </div>
    </div>
  );
};

/* ── helpers ─────────────────────────────────────────────────── */

function NavPill({
  label,
  active,
  activeColor,
  onClick,
}: {
  label: string;
  active: boolean;
  activeColor: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-2 rounded-full text-sm font-semibold transition-colors"
      style={{
        border: `1px solid ${active ? 'transparent' : COLORS.line}`,
        background: active ? activeColor : COLORS.surface,
        color: active ? COLORS.cream : COLORS.inkSoft,
      }}
    >
      {label}
    </button>
  );
}

function PropertyPanel({
  title,
  description,
  cta,
  gradient,
  pattern,
  onClick,
}: {
  title: string;
  description: string;
  cta: string;
  gradient: string;
  pattern: 'beds' | 'windows';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl text-left flex-1 min-w-0 flex items-end p-6 transition-transform hover:-translate-y-1"
      style={{ background: gradient, color: COLORS.cream, minHeight: '340px' }}
    >
      <span className="absolute inset-0 opacity-50 group-hover:opacity-75 transition-opacity pointer-events-none">
        {pattern === 'beds' ? <BedsPattern /> : <WindowsPattern />}
      </span>
      <span className="relative z-10 max-w-[24ch]">
        <span className="block text-xl font-bold mb-1" style={serif}>{title}</span>
        <span className="block text-sm opacity-90 mb-4">{description}</span>
        <span className="inline-flex items-center gap-2 text-sm font-semibold border-b border-transparent group-hover:border-current pb-0.5">
          {cta} →
        </span>
      </span>
    </button>
  );
}

function BedsPattern() {
  return (
    <svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" className="w-full h-full" aria-hidden="true">
      <defs>
        <pattern id="psh-beds" width="72" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
          <rect x="4" y="8" width="52" height="22" rx="5" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <line x1="4" y1="16" x2="56" y2="16" stroke="currentColor" strokeWidth="1" opacity="0.6" />
        </pattern>
      </defs>
      <rect width="400" height="400" fill="url(#psh-beds)" />
    </svg>
  );
}

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
