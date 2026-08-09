// lapa-casa-hostel/frontend/src/app/[locale]/admin/page.tsx

'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { BookingsDashboard } from '@/components/admin/bookings-dashboard';
import { SeasonPricing } from '@/components/admin/season-pricing';
import { DateBlocking } from '@/components/admin/date-blocking';
import ICalSettings from '@/components/admin/ical-settings';

/**
 * Admin page — /[locale]/admin
 *
 * Panel de administración con 4 pestañas:
 *   Dashboard  — check-ins/outs del día y próximas reservas
 *   Precios    — multiplicadores por temporada
 *   Bloqueios  — bloqueo manual de fechas
 *   iCal       — sincronización de calendarios con OTAs
 *
 * La autenticación la maneja el backend (token en localStorage,
 * igual que ICalSettings). En producción agregar un middleware de
 * protección de ruta.
 */

type Tab = 'dashboard' | 'pricing' | 'blocking' | 'ical';

export default function AdminPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  const t = useTranslations('admin');
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'dashboard', label: t('dashboard'), icon: '📊' },
    { id: 'pricing', label: t('pricing'), icon: '💰' },
    { id: 'blocking', label: t('dateBlocking'), icon: '🔒' },
    { id: 'ical', label: t('ical'), icon: '📅' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">
          Lapa Casa Hostel
        </p>
        <h1 className="text-2xl font-display font-bold text-foreground">Admin</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 bg-muted p-1 rounded-xl w-full overflow-x-auto">
        {tabs.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === id
                ? 'bg-card shadow text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {activeTab === 'dashboard' && <BookingsDashboard locale={locale} />}
        {activeTab === 'pricing' && <SeasonPricing locale={locale} />}
        {activeTab === 'blocking' && <DateBlocking locale={locale} />}
        {activeTab === 'ical' && <ICalSettings />}
      </div>
    </div>
  );
}
