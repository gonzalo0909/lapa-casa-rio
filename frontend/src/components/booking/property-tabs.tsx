'use client';
// frontend/src/components/booking/property-tabs.tsx
//
// Barra de tabs que monta AMBOS motores simultáneamente y los alterna con
// display:none — estado de formulario preservado al cambiar de tab (Opción A).
//
// Uso en /hostel     → defaultTab=0 (Hostel activo)
// Uso en /apartamentos → defaultTab=1 (Apartamentos activo)

import React, { useState } from 'react';

// ─── Labels por idioma ────────────────────────────────
const LABELS: Record<string, { hostel: string; apartments: string }> = {
  pt: { hostel: 'Hostel',      apartments: 'Apartamentos' },
  es: { hostel: 'Hostel',      apartments: 'Apartamentos' },
  en: { hostel: 'Hostel',      apartments: 'Apartments'   },
};

// ─── Inline CSS ───────────────────────────────────────
const CSS = `
.pt-bar{
  display:flex;
  background:#1E3A5F;
  width:100%;
  padding:0 1.5rem;
  box-sizing:border-box;
}
.pt-tab{
  display:flex;
  align-items:center;
  gap:.4rem;
  padding:.75rem 1.25rem .7rem;
  font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;
  font-size:.78rem;
  font-weight:700;
  letter-spacing:.05em;
  text-transform:uppercase;
  color:rgba(255,255,255,.5);
  background:none;
  border:none;
  border-bottom:2px solid transparent;
  cursor:pointer;
  transition:color .15s, border-color .15s;
  white-space:nowrap;
}
.pt-tab:hover{color:rgba(255,255,255,.8)}
.pt-tab.active{color:#fff;border-bottom-color:#C8870A}
.pt-tab-icon{font-size:1rem;line-height:1}
`;

// ─── Props ────────────────────────────────────────────
interface PropertyTabsProps {
  /** Locale para labels (pt | es | en). Default: 'pt'. */
  locale?: string;
  /** Tab activo al montar. 0 = Hostel, 1 = Apartamentos. Default: 0. */
  defaultTab?: 0 | 1;
  /** Exactamente dos hijos: [<HostelEngine>, <ApartmentEngine>] */
  children: [React.ReactNode, React.ReactNode];
}

// ─── Component ────────────────────────────────────────
export function PropertyTabs({
  locale = 'pt',
  defaultTab = 0,
  children,
}: PropertyTabsProps) {
  const [active, setActive] = useState<0 | 1>(defaultTab);

  const lang  = LABELS[locale] ?? LABELS.pt;
  const tabs  = [
    { icon: '🛏️', label: lang.hostel      },
    { icon: '🏠', label: lang.apartments  },
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Barra de tabs */}
      <nav className="pt-bar" role="tablist" aria-label="Motor de reservas">
        {tabs.map((tab, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={active === i}
            aria-controls={`pt-panel-${i}`}
            className={`pt-tab${active === i ? ' active' : ''}`}
            onClick={() => setActive(i as 0 | 1)}
          >
            <span className="pt-tab-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Paneles — siempre montados; show/hide con visibility para no perder estado */}
      {children.map((child, i) => (
        <div
          key={i}
          id={`pt-panel-${i}`}
          role="tabpanel"
          aria-hidden={active !== i}
          style={{ display: active === i ? 'block' : 'none' }}
        >
          {child}
        </div>
      ))}
    </>
  );
}
