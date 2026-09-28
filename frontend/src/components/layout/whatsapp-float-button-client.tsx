'use client';

import { useCookieConsent } from '@/components/legal/cookie-consent';

interface WhatsAppFloatButtonClientProps {
  href: string;
  label: string;
}

// El banner de cookies (fixed inset-x-0 bottom-0) y este botón (fixed
// bottom-5 right-5) compiten por la misma esquina mientras el usuario
// no decidió sobre cookies -- se oculta en ese lapso para no taparlo,
// y vuelve a aparecer apenas acepta o rechaza.
export function WhatsAppFloatButtonClient({ href, label }: WhatsAppFloatButtonClientProps) {
  const { status } = useCookieConsent();
  if (status === null) { return null; }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-green-500 text-white text-sm font-semibold shadow-lg hover:bg-green-600 hover:shadow-xl transition-all"
    >
      <span aria-hidden="true">💬</span>
      <span className="hidden sm:inline">{label}</span>
    </a>
  );
}
