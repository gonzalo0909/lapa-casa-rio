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
            <span className="font-serif text-3xl tracking-tight text-foreground">Lapa Casa Rio</span>
          </div>
          <nav className="flex flex-wrap items-center gap-2">
            <Link
              href={hostelHref}
              className="rounded-full border border-white/15 px-4 py-2 text-base font-medium text-foreground/70 transition-colors hover:border-white/40 hover:text-foreground"
            >
              {t('navHostel')}
            </Link>
            <Link
              href={apartmentsHref}
              className="rounded-full border border-white/15 px-4 py-2 text-base font-medium text-foreground/70 transition-colors hover:border-white/40 hover:text-foreground"
            >
              {t('navApartments')}
            </Link>
            <a
              href={`/${locale}/parceiros`}
              className="rounded-full border border-white/15 px-4 py-2 text-base font-medium text-foreground/70 transition-colors hover:border-white/40 hover:text-foreground"
            >
              {t('navPartners')}
            </a>
            <a
              href={`/${locale}/guardavolumes`}
              className="hidden sm:inline-flex rounded-full border border-white/15 px-4 py-2 text-base font-medium text-foreground/70 transition-colors hover:border-white/40 hover:text-foreground"
            >
              {t('navLuggage')}
            </a>
            <LanguageSwitcher currentLocale={locale} />
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-6xl px-6 pb-8 pt-8 text-center">
        <h1 className="mx-auto max-w-2xl text-balance font-serif text-4xl leading-tight sm:text-5xl">
          {t('heroTitle')}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-pretty text-lg leading-relaxed text-foreground/60 hidden sm:block">
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
            pattern="apartamentos"
            href={apartmentsHref}
          />
        </div>

        <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 px-3.5 py-1.5 text-[0.9rem] uppercase tracking-[0.18em] text-foreground/60">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          Rio de Janeiro
        </div>

        <p className="mt-4 text-[0.9rem] text-foreground/40">
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
  pattern: "santa-teresa" | "apartamentos"
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
      <span className="pointer-events-none absolute inset-0 opacity-90 transition-opacity duration-300 group-hover:opacity-100">
        {pattern === "santa-teresa" ? <SantaTeresaScene /> : <ApartmentScene />}
      </span>
      <span
        className={`pointer-events-none absolute inset-0 bg-gradient-to-t ${
          pattern === "santa-teresa"
            ? "from-black/65 via-black/30 to-black/30"
            : "from-black/80 via-black/50 to-black/50"
        }`}
      />
      <span className="relative z-10">
        <span className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/15 text-foreground backdrop-blur">
          {icon}
        </span>
        <span className="-mt-4 block font-serif text-5xl">{title}</span>
        <span className="mt-1.5 block max-w-[28ch] text-sm leading-snug text-foreground/85">{description}</span>
        <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold">
          {cta}
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </span>
        <span className="mt-1.5 flex items-center justify-center gap-1 text-xs uppercase tracking-[0.15em] text-foreground/70">
          <MapPin className="h-2.5 w-2.5" />
          {location}
        </span>
      </span>
    </Link>
  )
}

// Ilustración con color (no foto): atardecer sobre la colina de Santa Teresa,
// casas coloridas y los Arcos da Lapa. Dibujada a mano en SVG.
function SantaTeresaScene() {
  const houses: { x: number; y: number; w: number; h: number; wall: string; roof: string }[] = [
    { x: 24, y: 76, w: 30, h: 24, wall: "#E7B84C", roof: "#A8492E" },
    { x: 96, y: 68, w: 28, h: 22, wall: "#E6E1CE", roof: "#8B3A2B" },
    { x: 168, y: 80, w: 32, h: 26, wall: "#7FA9C4", roof: "#6E2E22" },
    { x: 242, y: 66, w: 28, h: 22, wall: "#D97A54", roof: "#5C2A20" },
    { x: 308, y: 78, w: 30, h: 24, wall: "#EFE7C9", roof: "#A8492E" },
  ]

  return (
    <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="psh-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F6C57B" />
          <stop offset="55%" stopColor="#E68A5C" />
          <stop offset="100%" stopColor="#8E4B63" />
        </linearGradient>
        <linearGradient id="psh-hill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2E5C42" />
          <stop offset="100%" stopColor="#1B3D2A" />
        </linearGradient>
      </defs>

      {/* Cielo */}
      <rect width="400" height="200" fill="url(#psh-sky)" />
      {/* Sol */}
      <circle cx="336" cy="34" r="20" fill="#FCE7A8" opacity="0.9" />

      {/* Fiação do bonde */}
      <path d="M0 42 Q 200 18 400 42" stroke="#3B2A22" strokeWidth="1.2" opacity="0.5" fill="none" />

      {/* Colina */}
      <path d="M0 100 Q 100 76 200 92 T 400 80 V200 H0 Z" fill="url(#psh-hill)" />

      {/* Casas coloridas */}
      {houses.map((h, i) => (
        <g key={i}>
          <rect x={h.x} y={h.y} width={h.w} height={h.h} fill={h.wall} stroke="#2A1B12" strokeWidth="1" />
          <path
            d={`M${h.x - 2} ${h.y} L${h.x + h.w / 2} ${h.y - 13} L${h.x + h.w + 2} ${h.y}`}
            fill={h.roof}
            stroke="#2A1B12"
            strokeWidth="1"
            strokeLinejoin="round"
          />
          <rect x={h.x + h.w / 2 - 4} y={h.y + h.h - 12} width="8" height="9" fill="#2A1B12" opacity="0.85" />
        </g>
      ))}

      {/* Arcos da Lapa */}
      <g fill="#E4D6AE" stroke="#8A6F3E" strokeWidth="1.2">
        {Array.from({ length: 6 }, (_, i) => 24 + i * 62).map((cx) => (
          <path key={cx} d={`M${cx} 200 V158 a18 18 0 0 1 36 0 V200 Z`} />
        ))}
      </g>
    </svg>
  )
}

// Ilustración con color (no foto): fachada de edificio de apartamentos al
// atardecer, con balcones, plantas y el Pan de Azúcar de fondo.
function ApartmentScene() {
  const windows: { x: number; y: number; lit: boolean; balcony: boolean }[] = []
  const cols = [46, 102, 158, 214, 270, 326]
  const rows = [88, 122, 156]
  rows.forEach((y, ri) => {
    cols.forEach((x, ci) => {
      windows.push({ x, y, lit: (ri + ci) % 3 !== 0, balcony: ri === rows.length - 1 })
    })
  })

  return (
    <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="psh-apt-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C88F4E" />
          <stop offset="45%" stopColor="#3E7690" />
          <stop offset="100%" stopColor="#122E44" />
        </linearGradient>
      </defs>

      {/* Cielo */}
      <rect width="400" height="200" fill="url(#psh-apt-sky)" />

      {/* Pan de Azúcar de fondo */}
      <path d="M300 130 Q325 62 352 130 Z" fill="#12283A" opacity="0.55" />
      <path d="M40 130 Q60 84 82 130 Z" fill="#12283A" opacity="0.4" />

      {/* Palmera */}
      <g stroke="#12283A" strokeWidth="2.5" opacity="0.7" fill="none" strokeLinecap="round">
        <path d="M362 200 V128" />
        <path d="M362 130 Q346 118 334 124" />
        <path d="M362 130 Q378 116 392 122" />
        <path d="M362 126 Q356 110 344 104" />
        <path d="M362 126 Q368 110 380 104" />
      </g>

      {/* Edificio */}
      <rect x="16" y="66" width="368" height="134" fill="#E9E2D1" stroke="#2A1B12" strokeWidth="1.2" />
      {/* Cenefa de azulejos */}
      <g>
        {Array.from({ length: 23 }, (_, i) => 18 + i * 16).map((x, i) => (
          <rect key={x} x={x} y="66" width="16" height="8" fill={i % 2 === 0 ? "#2E6F9E" : "#EFEAE0"} />
        ))}
      </g>

      {/* Ventanas + balcones */}
      {windows.map((w, i) => (
        <g key={i}>
          <rect
            x={w.x}
            y={w.y}
            width="34"
            height="26"
            fill={w.lit ? "#F6D877" : "#173248"}
            stroke="#2A1B12"
            strokeWidth="1"
          />
          <line x1={w.x + 17} y1={w.y} x2={w.x + 17} y2={w.y + 26} stroke="#2A1B12" strokeWidth="0.8" opacity="0.6" />
          {w.balcony && (
            <>
              <rect x={w.x - 3} y={w.y + 26} width="40" height="4" fill="#8A6F3E" />
              <circle cx={w.x + 8} cy={w.y + 24} r="4" fill="#3F7D4E" />
              <circle cx={w.x + 26} cy={w.y + 23} r="3.5" fill="#4E9660" />
            </>
          )}
        </g>
      ))}
    </svg>
  )
}
