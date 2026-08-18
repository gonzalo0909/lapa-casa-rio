"use client"

import React, { useState } from "react"
import { BedDouble, Home } from "lucide-react"

const TABS = [
  { label: "Hostel", icon: BedDouble },
  { label: "Apartamentos", icon: Home },
]

interface PropertyTabsProps {
  /** Exactamente dos hijos: [<HostelEngine>, <ApartmentEngine>] */
  children: [React.ReactNode, React.ReactNode]
  /** Tab activo al montar. 0 = Hostel, 1 = Apartamentos. Default: 0. */
  defaultTab?: 0 | 1
  /** Locale (no usado en UI — reservado para compatibilidad con pages). */
  locale?: string
}

export function PropertyTabs({ children, defaultTab = 0, locale: _locale }: PropertyTabsProps) {
  const [active, setActive] = useState<0 | 1>(defaultTab)

  return (
    <>
      <nav
        role="tablist"
        aria-label="Motor de reservas"
        className="mx-auto flex max-w-md items-center gap-1 rounded-full border border-border bg-card p-1"
      >
        {TABS.map((tab, i) => {
          const Icon = tab.icon
          const isActive = active === i
          return (
            <button
              key={tab.label}
              role="tab"
              aria-selected={isActive}
              aria-controls={`pt-panel-${i}`}
              onClick={() => setActive(i as 0 | 1)}
              className={[
                "flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </nav>

      {children.map((child, i) => (
        <div
          key={i}
          id={`pt-panel-${i}`}
          role="tabpanel"
          aria-hidden={active !== i}
          style={{ display: active === i ? "block" : "none" }}
        >
          {child}
        </div>
      ))}
    </>
  )
}
