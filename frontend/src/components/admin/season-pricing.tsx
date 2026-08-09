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
 * Llama a:
 *   GET  /admin/pricing  → {ratePlans: [{season_type, multiplier, min_nights, description}], ...}
 *   PUT  /admin/pricing  → {seasonType: 'alta'|'media'|'baja'|'carnaval', multiplier}
 *
 * Los season_type en el backend son en español (alta/media/baja/carnaval).
 * El componente mapea entre las claves del front (high/medium/low/carnival) y las del backend.
 *
 * @component
 */

interface SeasonConfig {
  high: number;
  medium: number;
  low: number;
  carnival: number;
}

/** Mapeo clave-frontend → season_type del backend */
const SEASON_MAP: Record<keyof SeasonConfig, string> = {
  high: 'alta',
  medium: 'media',
  low: 'baja',
  carnival: 'carnaval',
};

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

const DEFAULT_CONFIG: SeasonConfig = { high: 1.5, medium: 1.0, low: 0.85, carnival: 2.0 };

export function SeasonPricing({ locale }: { locale: string }) {
  const t = useTranslations('admin');
  const [config, setConfig] = useState<SeasonConfig>(DEFAULT_CONFIG);
  const [draft, setDraft] = useState<SeasonConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      // GET /admin/pricing → ApiResponse<{ratePlans: [...], carnivalDates, groupDiscountTiers, cardSurchargePercent}>
      const res = await api.get('/admin/pricing', { token: token ?? undefined });
      const ratePlans = (res.data?.ratePlans ?? []) as Array<{
        season_type: string;
        multiplier: number;
        min_nights: number;
        description: string;
      }>;

      const find = (type: string, fallback: number) =>
        ratePlans.find((r) => r.season_type === type)?.multiplier ?? fallback;

      const cfg: SeasonConfig = {
        high: find('alta', DEFAULT_CONFIG.high),
        medium: find('media', DEFAULT_CONFIG.medium),
        low: find('baja', DEFAULT_CONFIG.low),
        carnival: find('carnaval', DEFAULT_CONFIG.carnival),
      };
      setConfig(cfg);
      setDraft(cfg);
    } catch {
      // Usa defaults si el endpoint no responde (modo prueba)
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
      // Guarda solo los valores que cambiaron, uno por uno (la API toma un season a la vez)
      const changed = (Object.keys(draft) as (keyof SeasonConfig)[]).filter(
        (k) => draft[k] !== config[k]
      );
      if (changed.length === 0) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
        return;
      }
      await Promise.all(
        changed.map((key) =>
          api.put(
            '/admin/pricing',
            { seasonType: SEASON_MAP[key], multiplier: draft[key] },
            { token: token ?? undefined }
          )
        )
      );
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
                <p className="text-xs text-muted-foreground">
                  {t('multiplier')} — backend: <code className="font-mono text-xs">{SEASON_MAP[key]}</code>
                </p>
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
