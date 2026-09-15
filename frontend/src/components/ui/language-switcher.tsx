'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import type { Locale } from '@/i18n';

const LOCALES: { code: Locale; flag: string; name: string }[] = [
  { code: 'pt', flag: '🇧🇷', name: 'Português' },
  { code: 'es', flag: '🇪🇸', name: 'Español' },
  { code: 'en', flag: '🇬🇧', name: 'English' },
  { code: 'fr', flag: '🇫🇷', name: 'Français' },
  { code: 'de', flag: '🇩🇪', name: 'Deutsch' },
  { code: 'it', flag: '🇮🇹', name: 'Italiano' },
];

interface LanguageSwitcherProps {
  currentLocale: Locale;
  className?: string;
}

export function LanguageSwitcher({ currentLocale, className = '' }: LanguageSwitcherProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) { document.addEventListener('mousedown', handleClickOutside); }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const buildPath = (locale: Locale) =>
    pathname.replace(/^\/[a-z]{2}\b/, `/${locale}`);

  // LOCALES always has entries; find always matches a valid Locale
  const current = LOCALES.find((l) => l.code === currentLocale) as (typeof LOCALES)[number];

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-cream/70 transition-colors hover:border-white/40 hover:text-cream"
      >
        <span aria-hidden="true">{current.flag}</span>
        <span>{current.code.toUpperCase()}</span>
        <span aria-hidden="true" className="text-[9px] opacity-50 ml-0.5">▾</span>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-full mt-1.5 z-30 min-w-[148px] rounded-xl border border-white/10 bg-[#1a1f17] py-1 shadow-xl"
        >
          {LOCALES.map((l) => (
            <li key={l.code} role="option" aria-selected={l.code === currentLocale}>
              <Link
                href={buildPath(l.code)}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 text-xs transition-colors hover:bg-white/5 ${
                  l.code === currentLocale
                    ? 'text-cream font-semibold'
                    : 'text-cream/60 hover:text-cream'
                }`}
              >
                <span aria-hidden="true">{l.flag}</span>
                <span>{l.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
