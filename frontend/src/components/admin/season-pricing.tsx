// lapa-casa-hostel/frontend/src/components/admin/season-pricing.tsx

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { api, handleAPIError } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

/**
 * SeasonPricing
 *
 * Visualiza y permite editar los multiplicadores de precio por temporada.
 * Llama a GET /admin/pricing/seasons y PATCH /admin/pricing/seasons.
 * Los cambios se persisten en el backend; el frontend solo muestra los
 * valores actuales y permite ajustarlos.
 *
 * @component
 */

interface SeasonConfig {
  high: number;
  medium: number;
  low: number;
  carnival: number;
}

const SEASON_META = [
  { key: 'carnival' as const, emoji: '🎭', color: 'text-pink-600' },
  { key: 'high' as const, emoji: '☀️', color: 'text-red-600' },
  { key: 'medium' as const, emoji: '🌤️', color: 'text-blue-600' },
  { key: 'low' as const, emoji: '🌙', color: 'text-green-600' },
] as const;

const LABEL_KEY: Record<string, string> = {
  high: 'highSeason',
  medium: 'mediumSeason',
  low: 'lowSeason',
  carnival: 'carnival',
};

export function SeasonPricing({ locale }: { locale: string }) {
  const t = useTranslations('admin');
  const [config, setConfig] = useState<SeasonConfig>({
    high: 1.5,
    medium: 1.0,
    low: 0.85,
    carnival: 2.0,
  });
  const [draft, setDraft] = useState<SeasonConfig>(config);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await api.get('/admin/pricing/seasons', { token: token ?? undefined });
      const data: SeasonConfig = res.data ?? config;
      setConfig(data);
      setDraft(data);
    } catch {
      // Usa os defaults se o endpoint não existir ainda
    } finally {
      setIsLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const token = localStorage.getItem('token');
      await api.patch('/admin/pricing/seasons', draft, { token: token ?? undefined });
      setConfig(draft);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(handleAPIError(err, locale as any));
    } finally {
      setIsSaving(false);
    }
  };

  const isDirty = JSON.stringify(draft) !== JSON.stringify(config);

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
        <h2 className="text-xl font-bold text-foreground">{t('seasonPricing')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('seasonPricingDesc')}</p>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {success && (
        <Alert variant="success">✓ {t('saveChanges')} OK</Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SEASON_META.map(({ key, emoji, color }) => (
          <div key={key} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{emoji}</span>
              <div>
                <p className={`font-semibold ${color}`}>{t(LABEL_KEY[key] as any)}</p>
                <p className="text-xs text-muted-foreground">{t('multiplier')}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0.5}
                max={3.0}
                step={0.05}
                value={draft[key]}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, [key]: parseFloat(e.target.value) }))
                }
                className="flex-1 accent-primary"
              />
              <span className="w-12 text-right font-mono font-bold text-lg text-foreground">
                {draft[key].toFixed(2)}×
              </span>
            </div>

            {/* Precio ejemplo para base R$60/cama/noche */}
            <p className="text-xs text-muted-foreground mt-2">
              Base R$60 → <strong>R${(60 * draft[key]).toFixed(0)}</strong>/cama/noche
            </p>
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={!isDirty || isSaving}
        className="px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {isSaving ? '...' : t('saveChanges')}
      </button>
    </div>
  );
}
