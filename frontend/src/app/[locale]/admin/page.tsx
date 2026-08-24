// lapa-casa-hostel/frontend/src/app/[locale]/admin/page.tsx

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { BookingsDashboard } from '@/components/admin/bookings-dashboard';
import { SeasonPricing } from '@/components/admin/season-pricing';
import { DateBlocking } from '@/components/admin/date-blocking';
import ICalSettings from '@/components/admin/ical-settings';
import { ApartmentOffers } from '@/components/admin/apartment-offers';
import { ApartmentPhotos } from '@/components/admin/apartment-photos';
import { api, handleAPIError } from '@/lib/api';

/**
 * Admin page — /[locale]/admin
 *
 * Panel de administración con 4 pestañas:
 *   Dashboard  — check-ins/outs del día y próximas reservas
 *   Precios    — multiplicadores por temporada
 *   Bloqueios  — bloqueo manual de fechas
 *   iCal       — sincronización de calendarios con OTAs
 *
 * Autenticación: token JWT en localStorage['token'].
 * Login vía POST /admin/login (admin-auth.routes.ts, requiere ADMIN_PASSWORD_HASH en backend).
 */

type Tab = 'dashboard' | 'pricing' | 'blocking' | 'ical' | 'offers' | 'photos';

export default function AdminPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  const t = useTranslations('admin');

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  // Login form state
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Check localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsLoggedIn(!!token);
  }, []);

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      // POST /api/v1/admin/login → {success, data: {token, refreshToken, expiresIn}}
      const res = await api.post('/admin/login', { password });
      const token = res.data?.token as string | undefined;
      if (!token) { throw new Error('Token não recebido'); }
      localStorage.setItem('token', token);
      setPassword('');
      setIsLoggedIn(true);
    } catch (err) {
      setLoginError(handleAPIError(err, locale as any));
    } finally {
      setIsLoggingIn(false);
    }
  }, [password, locale]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setActiveTab('dashboard');
  }, []);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'dashboard', label: t('dashboard'), icon: '📊' },
    { id: 'pricing', label: t('pricing'), icon: '💰' },
    { id: 'offers', label: 'Ofertas', icon: '🏷️' },
    { id: 'blocking', label: t('dateBlocking'), icon: '🔒' },
    { id: 'ical', label: t('ical'), icon: '📅' },
    { id: 'photos', label: 'Fotos', icon: '🖼️' },
  ];

  // ── Login screen ──────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-2">
              Lapa Casa
</p>
            <h1 className="text-2xl font-display font-bold text-foreground">Admin</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Acesso restrito — insira a senha de administrador
            </p>
          </div>

          <form
            onSubmit={handleLogin}
            className="bg-card border border-border rounded-xl p-6 space-y-4"
          >
            {loginError && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">
                {loginError}
              </div>
            )}

            <div>
              {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
              <label htmlFor="admin-password" className="block text-sm font-medium text-foreground mb-1.5">
                Senha
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn || !password}
              className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity text-sm"
            >
              {isLoggingIn ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-4">
            A senha é definida em <code className="font-mono">ADMIN_PASSWORD_HASH</code> no Render.
          </p>
        </div>
      </div>
    );
  }

  // ── Admin panel ───────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">
            Lapa Casa
          </p>
          <h1 className="text-2xl font-display font-bold text-foreground">Admin</h1>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-muted-foreground hover:text-destructive transition-colors"
        >
          Sair →
        </button>
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
        {activeTab === 'offers' && <ApartmentOffers locale={locale} />}
        {activeTab === 'blocking' && <DateBlocking locale={locale} />}
        {activeTab === 'ical' && <ICalSettings />}
        {activeTab === 'photos' && <ApartmentPhotos />}
      </div>
    </div>
  );
}
