"use client"

import { BedDouble, Home } from "lucide-react"

interface PropertyTabsProps {
  active: 0 | 1
  onChange: (tab: 0 | 1) => void
}

const TABS = [
  { label: "Hostel", icon: BedDouble },
  { label: "Apartamentos", icon: Home },
]

export function PropertyTabs({ active, onChange }: PropertyTabsProps) {
  return (
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
            onClick={() => onChange(i as 0 | 1)}
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
  )
}
