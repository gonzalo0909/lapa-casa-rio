"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { BedDouble, Home, MapPin, ArrowRight } from "lucide-react"

interface PropertySelectorHeroProps {
  onSelectHostel: () => void
  onSelectApartments: () => void
}

export function PropertySelectorHero({ onSelectHostel, onSelectApartments }: PropertySelectorHeroProps) {
  const pathname = usePathname()
  // Extract locale from path: /es, /pt, /en, /fr, /de
  const localeMatch = pathname.match(/^\/([a-z]{2})\b/)
  const locale = localeMatch ? localeMatch[1] : 'pt'

  return (
    <div className="min-h-screen bg-[#12160f] text-cream">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#12160f]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="font-serif text-2xl tracking-tight text-cream">Lapa Casa</span>
            <span className="hidden text-xs uppercase tracking-[0.2em] text-cream/50 sm:inline">Rio de Janeiro</span>
          </div>
          <nav className="flex gap-2">
            <button
              onClick={onSelectHostel}
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-cream/70 transition-colors hover:border-white/40 hover:text-cream"
            >
              Hostel
            </button>
            <button
              onClick={onSelectApartments}
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-cream/70 transition-colors hover:border-white/40 hover:text-cream"
            >
              Apartamentos
            </button>
            <a
              href={`/${locale}/parceiros`}
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-cream/70 transition-colors hover:border-white/40 hover:text-cream"
            >
              Parceiros
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-6xl px-6 pb-20 pt-14 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-1.5 text-xs uppercase tracking-[0.18em] text-cream/60">
          <MapPin className="h-3.5 w-3.5 text-gold" />
          Rio de Janeiro
        </div>
        <h1 className="mx-auto max-w-3xl text-balance font-serif text-4xl leading-tight sm:text-6xl">
          Tu lugar en Rio de Janeiro
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-cream/70">
          Dos experiencias, dos reservas independientes. Elige la energía compartida del hostel o la privacidad de un
          apartamento propio.
        </p>

        <div className="mx-auto mt-12 grid max-w-4xl gap-5 sm:grid-cols-2">
          <PropertyPanel
            title="Hostel"
            location="Rio de Janeiro"
            description="Camas en cuartos compartidos y privados. Ideal para grupos, mochileros y viajeros sociales."
            cta="Reservar cama"
            icon={<BedDouble className="h-6 w-6" />}
            tone="foliage"
            pattern="beds"
            onClick={onSelectHostel}
          />
          <PropertyPanel
            title="Apartamentos"
            location="Rio de Janeiro"
            description="Espacios privados con cocina en distintos puntos de la ciudad, para parejas y familias."
            cta="Reservar apartamento"
            icon={<Home className="h-6 w-6" />}
            tone="azulejo"
            pattern="windows"
            onClick={onSelectApartments}
          />
        </div>

        <p className="mt-8 text-sm text-cream/50">
          Reserva directa · Mejor precio garantizado · Sin comisiones de plataformas
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
  onClick,
}: {
  title: string
  location: string
  description: string
  cta: string
  icon: React.ReactNode
  tone: "foliage" | "azulejo"
  pattern: "beds" | "windows"
  onClick: () => void
}) {
  const bg =
    tone === "foliage"
      ? "linear-gradient(155deg, #295e48 0%, #327560 100%)"
      : "linear-gradient(155deg, #1f4f68 0%, #3a87ac 100%)"

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex min-h-[320px] flex-col justify-end overflow-hidden rounded-3xl p-7 text-left text-cream transition-transform duration-300 hover:-translate-y-1"
      style={{ background: bg }}
    >
      <span className="pointer-events-none absolute inset-0 text-cream opacity-40 transition-opacity duration-300 group-hover:opacity-70">
        {pattern === "beds" ? <BedsPattern /> : <WindowsPattern />}
      </span>
      <span className="relative z-10">
        <span className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cream/15 text-cream backdrop-blur">
          {icon}
        </span>
        <span className="block font-serif text-3xl">{title}</span>
        <span className="mt-1 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-cream/70">
          <MapPin className="h-3 w-3" />
          {location}
        </span>
        <span className="mt-2 block max-w-[26ch] text-sm leading-relaxed text-cream/85">{description}</span>
        <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold">
          {cta}
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </span>
      </span>
    </button>
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
