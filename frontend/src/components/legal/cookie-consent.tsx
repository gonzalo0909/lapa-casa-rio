'use client';
// lapa-casa-hostel/frontend/src/components/legal/cookie-consent.tsx
//
// Sección 14 auditoría de 17 secciones: GA4 y Facebook Pixel se cargaban
// incondicionalmente en analytics-provider.tsx apenas las env vars
// estaban configuradas -- sin ningún gate de consentimiento (riesgo
// LGPD/GDPR real). Este componente guarda la elección del usuario
// (localStorage, por dispositivo) y expone el estado vía contexto para
// que AnalyticsProvider decida si cargar los scripts de tracking.

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'lch_cookie_consent';

type ConsentStatus = 'accepted' | 'rejected';

interface CookieConsentContextValue {
  /** null = todavía no decidió (banner visible) */
  status: ConsentStatus | null;
  accept: () => void;
  reject: () => void;
}

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

function readStoredConsent(): ConsentStatus | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'accepted' || stored === 'rejected' ? stored : null;
  } catch {
    // localStorage puede no estar disponible (modo privado, permisos) --
    // se trata igual que "no decidió todavía", el banner simplemente
    // vuelve a aparecer en esa sesión.
    return null;
  }
}

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ConsentStatus | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setStatus(readStoredConsent());
    setHydrated(true);
  }, []);

  const accept = useCallback(() => {
    setStatus('accepted');
    try { localStorage.setItem(STORAGE_KEY, 'accepted'); } catch { /* ver readStoredConsent */ }
  }, []);

  const reject = useCallback(() => {
    setStatus('rejected');
    try { localStorage.setItem(STORAGE_KEY, 'rejected'); } catch { /* ver readStoredConsent */ }
  }, []);

  return (
    <CookieConsentContext.Provider value={{ status, accept, reject }}>
      {children}
      {/* hydrated evita el flash del banner en el render inicial del servidor,
          donde localStorage no existe todavía. */}
      {hydrated && status === null && <CookieConsentBanner onAccept={accept} onReject={reject} />}
    </CookieConsentContext.Provider>
  );
}

/** Estado de consentimiento -- usarlo, por ejemplo, para gatear analytics-provider.tsx. */
export function useCookieConsent(): CookieConsentContextValue {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) {
    throw new Error('useCookieConsent debe usarse dentro de <CookieConsentProvider>');
  }
  return ctx;
}

function CookieConsentBanner({ onAccept, onReject }: { onAccept: () => void; onReject: () => void }) {
  const t = useTranslations('cookieConsent');
  const locale = useLocale();
  const bannerRef = useRef<HTMLDivElement>(null);

  // El banner es fixed/bottom con z-index alto: mientras está visible, tapa
  // cualquier CTA que caiga en esa franja de la pantalla al hacer scroll
  // (ej. los botones PIX/Tarjeta y "Confirmar reserva" del paso 4 del
  // wizard del hostel, que NO tienen su propio footer fijo). Reservamos ese
  // mismo alto como padding-bottom del body para que siempre haya margen
  // de scroll suficiente para despejar el banner de cualquier botón.
  useEffect(() => {
    const el = bannerRef.current;
    if (!el) {return;}
    const applyPadding = () => { document.body.style.paddingBottom = `${el.offsetHeight}px`; };
    applyPadding();
    const ro = new ResizeObserver(applyPadding);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.body.style.paddingBottom = '';
    };
  }, []);

  return (
    <div
      ref={bannerRef}
      role="dialog"
      aria-live="polite"
      aria-label={t('title')}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/98 p-4 shadow-[0_-4px_24px_rgba(0,0,0,.15)] backdrop-blur-sm sm:p-5"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <p className="text-sm text-foreground">
          {t('message')}{' '}
          <Link href={`/${locale}/privacy`} className="underline underline-offset-2 hover:text-primary">
            {t('learnMore')}
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={onReject}>
            {t('reject')}
          </Button>
          <Button variant="default" size="sm" onClick={onAccept}>
            {t('accept')}
          </Button>
        </div>
      </div>
    </div>
  );
}
