// lapa-casa-hostel/frontend/src/components/landing/landing-section.tsx

'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { Locale } from '@/i18n';

/**
 * LandingSection
 *
 * Seção de apresentação do hostel exibida acima do motor de reservas.
 * Substitui o public/landing/index.html (HTML estático) integrando o
 * conteúdo diretamente no Next.js com i18n e design system unificado.
 *
 * @component
 */
interface LandingSectionProps {
  locale: Locale;
}

const OTA_LINKS = [
  { name: 'Booking.com', href: 'https://www.booking.com', color: '#003580' },
  { name: 'Airbnb', href: 'https://www.airbnb.com', color: '#FF5A5F' },
  { name: 'Hostelworld', href: 'https://www.hostelworld.com', color: '#F96600' },
  { name: 'Expedia', href: 'https://www.expedia.com', color: '#00355F' },
] as const;

export const LandingSection: React.FC<LandingSectionProps> = ({ locale: _locale }) => {
  const t = useTranslations('landing');

  const whatsappUrl = `https://wa.me/5521982779553`;

  const handleBookNow = () => {
    const el = document.getElementById('reservar');
    if (el) { el.scrollIntoView({ behavior: 'smooth' }); }
  };

  return (
    <div className="border-b border-border bg-background">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 py-14 text-center">
        <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">
          Lapa Casa Hostel
        </p>
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-3 leading-tight">
          {t('heroTitle')}
        </h1>
        <p className="text-muted-foreground text-lg mb-8">{t('heroSubtitle')}</p>

        <button
          onClick={handleBookNow}
          className="inline-flex items-center gap-2 px-7 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity text-base shadow-md"
        >
          {t('bookNow')} ↓
        </button>
      </div>

      {/* ── Stats ────────────────────────────────────────────── */}
      <div className="border-t border-border bg-muted/30">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-5">
            {t('sectionAbout')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard num={t('stats45')} label={t('statsLabel45')} />
            <StatCard num={t('stats5')} label={t('statsLabel5')} />
            <StatCard num={t('statsGroup')} label={t('statsLabelGroup')} />
          </div>
        </div>
      </div>

      {/* ── OTA links ────────────────────────────────────────── */}
      <div className="border-t border-border">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            {t('otaPlatforms')}
          </h2>
          <div className="flex flex-wrap gap-3">
            {OTA_LINKS.map(({ name, href }) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:border-primary hover:text-primary transition-colors bg-card"
              >
                {name}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ── Contato ──────────────────────────────────────────── */}
      <div className="border-t border-border">
        <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              {t('sectionContact')}
            </h2>
            <address className="not-italic text-sm text-muted-foreground leading-relaxed">
              {t('address')}
              <br />
              <a
                href="mailto:reservas@lapacasahostel.com"
                className="text-primary hover:underline"
              >
                reservas@lapacasahostel.com
              </a>
            </address>
          </div>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#25D366] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity text-sm whitespace-nowrap shadow"
          >
            <WhatsAppIcon /> {t('whatsapp')}
          </a>
        </div>
      </div>
    </div>
  );
};

/* ── helpers ─────────────────────────────────────────────────── */

function StatCard({ num, label }: { num: string; label: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <p className="text-3xl font-display font-bold text-primary">{num}</p>
      <p className="text-sm text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
