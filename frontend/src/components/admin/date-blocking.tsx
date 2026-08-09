// lapa-casa-hostel/frontend/src/components/admin/date-blocking.tsx

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { api, handleAPIError } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

/**
 * DateBlocking
 *
 * Permite bloquear/desbloquear fechas para mantenimiento o eventos
 * privados. Llama a:
 *   GET  /admin/blocked-dates
 *   POST /admin/blocked-dates       { date, reason }
 *   DELETE /admin/blocked-dates/:date
 *
 * @component
 */

interface BlockedDate {
  date: string;   // YYYY-MM-DD
  reason: string;
}

const BCP47: Record<string, string> = {
  pt: 'pt-BR', es: 'es-ES', en: 'en-US', fr: 'fr-FR', de: 'de-DE',
};

function formatDate(d: string, locale: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString(BCP47[locale] ?? 'en-US', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

/** Fecha mínima = mañana */
function minDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function DateBlocking({ locale }: { locale: string }) {
  const t = useTranslations('admin');
  const [blocked, setBlocked] = useState<BlockedDate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Formulario
  const [newDate, setNewDate] = useState('');
  const [newReason, setNewReason] = useState('maintenance');
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await api.get('/admin/blocked-dates', { token: token ?? undefined });
      setBlocked(res.data?.dates ?? []);
    } catch {
      setBlocked([]); // El endpoint puede no existir aún; silencioso
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate) return;
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    const reason = newReason === 'other' ? customReason : t(newReason as any);

    try {
      const token = localStorage.getItem('token');
      await api.post('/admin/blocked-dates', { date: newDate, reason }, { token: token ?? undefined });
      setSuccess(`${formatDate(newDate, locale)} — ${reason}`);
      setNewDate('');
      await load();
    } catch (err) {
      setError(handleAPIError(err, locale as any));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnblock = async (date: string) => {
    if (!confirm(`${t('unblockDate')}: ${formatDate(date, locale)}?`)) return;
    setError(null);
    try {
      const token = localStorage.getItem('token');
      await api.delete(`/admin/blocked-dates/${date}`, { token: token ?? undefined });
      await load();
    } catch (err) {
      setError(handleAPIError(err, locale as any));
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">{t('blockDates')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('blockDatesDesc')}</p>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">✓ {t('blockDate')}: {success}</Alert>}

      {/* Formulario de bloqueo */}
      <form
        onSubmit={handleBlock}
        className="bg-card border border-border rounded-xl p-5 space-y-4"
      >
        <h3 className="font-semibold text-foreground">🔒 {t('blockDate')}</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Fecha
            </label>
            <input
              type="date"
              value={newDate}
              min={minDate()}
              onChange={(e) => setNewDate(e.target.value)}
              required
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t('reason')}
            </label>
            <select
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="maintenance">{t('maintenance')}</option>
              <option value="privateEvent">{t('privateEvent')}</option>
              <option value="other">{t('other')}</option>
            </select>
          </div>

          {newReason === 'other' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('other')}
              </label>
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="..."
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !newDate}
          className="px-5 py-2 bg-destructive text-destructive-foreground font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity text-sm"
        >
          {isSubmitting ? '...' : `🔒 ${t('blockDate')}`}
        </button>
      </form>

      {/* Lista de fechas bloqueadas */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-foreground mb-3">
          {t('blockedDates')} ({blocked.length})
        </h3>

        {blocked.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('noBlockedDates')}</p>
        ) : (
          <div className="space-y-2">
            {blocked
              .sort((a, b) => a.date.localeCompare(b.date))
              .map(({ date, reason }) => (
                <div
                  key={date}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div>
                    <p className="font-medium text-foreground text-sm">
                      {formatDate(date, locale)}
                    </p>
                    <p className="text-xs text-muted-foreground">{reason}</p>
                  </div>
                  <button
                    onClick={() => handleUnblock(date)}
                    className="text-xs text-destructive hover:underline"
                  >
                    {t('unblockDate')}
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
