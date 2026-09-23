"use client"

import type React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { BedDouble, Home, MapPin, ArrowRight } from "lucide-react"
import { LanguageSwitcher } from "@/components/ui/language-switcher"
import type { Locale } from "@/i18n"

export function PropertySelectorHero() {
  const pathname = usePathname()
  const t = useTranslations('propertySelector')

  // Extract locale from path: /es, /pt, /en, /fr, /de, /it
  const localeMatch = pathname.match(/^\/([a-z]{2})\b/)
  const locale = (localeMatch ? localeMatch[1] : 'pt') as Locale

  // Auditoría 17 secciones, sección 11: antes esto navegaba solo con
  // router.push() en un onClick -- las 2 páginas de mayor prioridad del
  // sitio (/hostel, /apartamentos) quedaban sin ningún <a href> crawleable
  // desde la home. Ahora son <Link> reales (siguen siendo transición
  // client-side, pero emiten <a href> real en el HTML).
  const hostelHref = `/${locale}/hostel`
  const apartmentsHref = `/${locale}/apartamentos`

  return (
    <div className="bg-[#12160f] text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#12160f]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="font-serif text-xl tracking-tight text-foreground">Lapa Casa Rio</span>
            <span className="hidden text-xs uppercase tracking-[0.2em] text-foreground/50 sm:inline">Rio de Janeiro</span>
          </div>
          <nav className="flex flex-wrap items-center gap-1.5">
            <Link
              href={hostelHref}
              className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:border-white/40 hover:text-foreground"
            >
              {t('navHostel')}
            </Link>
            <Link
              href={apartmentsHref}
              className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:border-white/40 hover:text-foreground"
            >
              {t('navApartments')}
            </Link>
            <a
              href={`/${locale}/parceiros`}
              className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:border-white/40 hover:text-foreground"
            >
              {t('navPartners')}
            </a>
            <a
              href={`/${locale}/guardavolumes`}
              className="hidden sm:inline-flex rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:border-white/40 hover:text-foreground"
            >
              {t('navLuggage')}
            </a>
            <LanguageSwitcher currentLocale={locale} />
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-6xl px-6 pb-8 pt-8 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-foreground/60">
          <MapPin className="h-3 w-3 text-primary" />
          Rio de Janeiro
        </div>
        <h1 className="mx-auto max-w-2xl text-balance font-serif text-3xl leading-tight sm:text-4xl">
          {t('heroTitle')}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-pretty text-sm leading-relaxed text-foreground/60 hidden sm:block">
          {t('heroSubtitle')}
        </p>

        <div className="mx-auto mt-6 grid max-w-4xl gap-4 sm:grid-cols-2">
          <PropertyPanel
            title={t('hostelTitle')}
            location="Rio de Janeiro"
            description={t('hostelDesc')}
            cta={t('hostelCta')}
            icon={<BedDouble className="h-5 w-5" />}
            tone="foliage"
            pattern="santa-teresa"
            href={hostelHref}
          />
          <PropertyPanel
            title={t('apartmentsTitle')}
            location="Rio de Janeiro"
            description={t('apartmentsDesc')}
            cta={t('apartmentsCta')}
            icon={<Home className="h-5 w-5" />}
            tone="azulejo"
            pattern="windows"
            href={apartmentsHref}
          />
        </div>

        <p className="mt-5 text-xs text-foreground/40">
          {t('directBooking')}
        </p>
      </main>
    </div>
  )
}

function PropertyPanel({
  title,
  location,
  description,
  cta,
  icon,
  tone,
  pattern,
  href,
}: {
  title: string
  location: string
  description: string
  cta: string
  icon: React.ReactNode
  tone: "foliage" | "azulejo"
  pattern: "beds" | "windows" | "santa-teresa"
  href: string
}) {
  const bg =
    tone === "foliage"
      ? "linear-gradient(155deg, #295e48 0%, #327560 100%)"
      : "linear-gradient(155deg, #1f4f68 0%, #3a87ac 100%)"

  return (
    <Link
      href={href}
      className="group relative flex min-h-[180px] flex-col items-center justify-center overflow-hidden rounded-2xl p-5 text-center text-foreground transition-transform duration-300 hover:-translate-y-1"
      style={{ background: bg }}
    >
      <span className="pointer-events-none absolute inset-0 text-foreground opacity-40 transition-opacity duration-300 group-hover:opacity-70">
        {pattern === "beds" ? <BedsPattern /> : pattern === "windows" ? <WindowsPattern /> : <SantaTeresaScene />}
      </span>
      <span className="relative z-10">
        <span className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/15 text-foreground backdrop-blur">
          {icon}
        </span>
        <span className="block font-serif text-2xl">{title}</span>
        <span className="mt-0.5 inline-flex items-center gap-1 text-xs uppercase tracking-[0.15em] text-foreground/70">
          <MapPin className="h-2.5 w-2.5" />
          {location}
        </span>
        <span className="mt-1.5 block max-w-[28ch] text-sm leading-snug text-foreground/85">{description}</span>
        <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold">
          {cta}
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </span>
      </span>
    </Link>
  )
}

function BedsPattern() {
  return (
    <svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden="true">
      <defs>
        <pattern id="psh-beds" width="72" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
          <rect x="4" y="8" width="52" height="22" rx="5" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <line x1="4" y1="16" x2="56" y2="16" stroke="currentColor" strokeWidth="1" opacity="0.6" />
        </pattern>
      </defs>
      <rect width="400" height="400" fill="url(#psh-beds)" />
    </svg>
  )
}

function WindowsPattern() {
  return (
    <svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden="true">
      <defs>
        <pattern id="psh-windows" width="56" height="56" patternUnits="userSpaceOnUse">
          <rect x="8" y="8" width="34" height="34" rx="5" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <line x1="25" y1="8" x2="25" y2="42" stroke="currentColor" strokeWidth="1" opacity="0.6" />
          <line x1="8" y1="25" x2="42" y2="25" stroke="currentColor" strokeWidth="1" opacity="0.6" />
        </pattern>
      </defs>
      <rect width="400" height="400" fill="url(#psh-windows)" />
    </svg>
  )
}

// Ilustración de línea (no foto): colina de Santa Teresa con casas coloniales
// y los Arcos da Lapa. Mismo estilo de trazo fino que BedsPattern/WindowsPattern.
function SantaTeresaScene() {
  return (
    <svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden="true">
      {/* Colina */}
      <path
        d="M0 210 Q 90 160 190 195 T 400 175 V 400 H 0 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      {/* Casas en la colina */}
      <g stroke="currentColor" strokeWidth="1.2" fill="none">
        <path d="M40 195 h34 v26 h-34 z M40 195 l17 -14 l17 14" />
        <rect x="49" y="205" width="8" height="10" opacity="0.6" />
        <path d="M108 178 h30 v24 h-30 z M108 178 l15 -13 l15 13" />
        <rect x="116" y="188" width="7" height="9" opacity="0.6" />
        <path d="M178 190 h36 v28 h-36 z M178 190 l18 -15 l18 15" />
        <rect x="188" y="201" width="8" height="10" opacity="0.6" />
        <path d="M252 172 h30 v24 h-30 z M252 172 l15 -13 l15 13" />
        <rect x="260" y="182" width="7" height="9" opacity="0.6" />
        <path d="M312 188 h34 v26 h-34 z M312 188 l17 -14 l17 14" />
        <rect x="321" y="198" width="8" height="10" opacity="0.6" />
      </g>
      {/* Fiação do bonde */}
      <path d="M0 168 Q 200 130 400 168" stroke="currentColor" strokeWidth="1" opacity="0.55" fill="none" />
      {/* Arcos da Lapa */}
      <g stroke="currentColor" strokeWidth="1.4" fill="none" opacity="0.85">
        {Array.from({ length: 6 }, (_, i) => 30 + i * 58).map((cx) => (
          <path key={cx} d={`M${cx} 320 v-46 a20 20 0 0 1 40 0 v46`} />
        ))}
        <line x1="10" y1="320" x2="390" y2="320" strokeWidth="1.6" />
      </g>
    </svg>
  )
}
