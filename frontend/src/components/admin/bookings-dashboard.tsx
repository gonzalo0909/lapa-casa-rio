// lapa-casa-hostel/frontend/src/components/admin/bookings-dashboard.tsx

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { api, handleAPIError } from '@/lib/api';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Alert } from '@/components/ui/alert';

/**
 * BookingsDashboard
 *
 * Muestra los check-ins/check-outs de hoy y las próximas reservas (7 días).
 * Llama a GET /admin/bookings/today y GET /admin/bookings/upcoming.
 *
 * @component
 */

interface Booking {
  id: string;
  confirmationNumber: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  bedsCount: number;
  roomNames: string[];
  status: string;
  nights: number;
}

interface DashboardData {
  checkIns: Booking[];
  checkOuts: Booking[];
  upcoming: Booking[];
  occupancyToday: number;
  totalBeds: number;
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  'checked-in': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'checked-out': 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? STATUS_COLORS.pending;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}

function BookingRow({ b, locale }: { b: Booking; locale: string }) {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString(locale === 'pt' ? 'pt-BR' : locale, {
      day: '2-digit', month: 'short',
    });

  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="min-w-0">
        <p className="font-medium text-foreground truncate">{b.guestName}</p>
        <p className="text-xs text-muted-foreground">
          {fmt(b.checkIn)} → {fmt(b.checkOut)} · {b.bedsCount} camas
          {b.roomNames.length > 0 && ` · ${b.roomNames.join(', ')}`}
        </p>
      </div>
      <div className="flex items-center gap-3 ml-4 shrink-0">
        <StatusBadge status={b.status} />
        <span className="text-xs text-muted-foreground font-mono">{b.confirmationNumber}</span>
      </div>
    </div>
  );
}

export function BookingsDashboard({ locale }: { locale: string }) {
  const t = useTranslations('admin');
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const [todayRes, upcomingRes] = await Promise.all([
        api.get('/admin/bookings/today', { token: token ?? undefined }),
        api.get('/admin/bookings/upcoming?days=7', { token: token ?? undefined }),
      ]);
      setData({
        checkIns: todayRes.data?.checkIns ?? [],
        checkOuts: todayRes.data?.checkOuts ?? [],
        occupancyToday: todayRes.data?.occupancyToday ?? 0,
        totalBeds: todayRes.data?.totalBeds ?? 45,
        upcoming: upcomingRes.data?.bookings ?? [],
      });
    } catch (err) {
      setError(handleAPIError(err, locale as any));
    } finally {
      setIsLoading(false);
    }
  }, [locale]);

  useEffect(() => { load(); }, [load]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  const d = data!;
  const occupancyPct = d.totalBeds > 0
    ? Math.round((d.occupancyToday / d.totalBeds) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard label={t('todayCheckins')} value={d.checkIns.length} icon="🛬" />
        <KpiCard label={t('todayCheckouts')} value={d.checkOuts.length} icon="🛫" />
        <KpiCard label={t('upcomingBookings')} value={d.upcoming.length} icon="📅" />
        <KpiCard
          label={t('occupancyRate')}
          value={`${occupancyPct}%`}
          icon="🛏️"
          sub={`${d.occupancyToday}/${d.totalBeds}`}
        />
      </div>

      {/* Check-ins de hoy */}
      <Section title={`🛬 ${t('todayCheckins')}`}>
        {d.checkIns.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4">{t('noBookings')}</p>
        ) : (
          d.checkIns.map((b) => <BookingRow key={b.id} b={b} locale={locale} />)
        )}
      </Section>

      {/* Check-outs de hoy */}
      <Section title={`🛫 ${t('todayCheckouts')}`}>
        {d.checkOuts.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4">{t('noBookings')}</p>
        ) : (
          d.checkOuts.map((b) => <BookingRow key={b.id} b={b} locale={locale} />)
        )}
      </Section>

      {/* Próximas reservas */}
      <Section title={`📅 ${t('upcomingBookings')} (7 días)`}>
        {d.upcoming.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4">{t('noBookings')}</p>
        ) : (
          d.upcoming.map((b) => <BookingRow key={b.id} b={b} locale={locale} />)
        )}
      </Section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  sub,
}: {
  label: string;
  value: string | number;
  icon: string;
  sub?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{icon}</span>
        <p className="text-xs text-muted-foreground leading-tight">{label}</p>
      </div>
      <p className="text-2xl font-display font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="font-semibold text-foreground mb-3">{title}</h3>
      {children}
    </div>
  );
}
