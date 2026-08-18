"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]
const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"]

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
function sameDay(a: Date | null, b: Date | null) {
  return !!a && !!b && a.getTime() === b.getTime()
}

export function RangeCalendar({
  checkIn,
  checkOut,
  onSelect,
}: {
  checkIn: Date | null
  checkOut: Date | null
  onSelect: (checkIn: Date | null, checkOut: Date | null) => void
}) {
  const today = startOfDay(new Date())
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [hover, setHover] = useState<Date | null>(null)

  const year = month.getFullYear()
  const m = month.getMonth()
  const firstWeekday = (new Date(year, m, 1).getDay() + 6) % 7 // lunes = 0
  const daysInMonth = new Date(year, m + 1, 0).getDate()

  const cells: (Date | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, m, d))

  function handleClick(day: Date) {
    if (day < today) return
    if (!checkIn || (checkIn && checkOut)) {
      onSelect(day, null)
    } else if (day > checkIn) {
      onSelect(checkIn, day)
    } else {
      onSelect(day, null)
    }
  }

  function inRange(day: Date) {
    const end = checkOut ?? hover
    if (!checkIn || !end) return false
    return day > checkIn && day < end
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          aria-label="Mes anterior"
          onClick={() => setMonth(new Date(year, m - 1, 1))}
          disabled={year === today.getFullYear() && m <= today.getMonth()}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="font-serif text-lg">
          {MONTHS[m]} {year}
        </span>
        <button
          type="button"
          aria-label="Mes siguiente"
          onClick={() => setMonth(new Date(year, m + 1, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground">
        {WEEKDAYS.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1" onMouseLeave={() => setHover(null)}>
        {cells.map((day, i) => {
          if (!day) return <span key={i} />
          const past = day < today
          const isCheckIn = sameDay(day, checkIn)
          const isCheckOut = sameDay(day, checkOut)
          const isEdge = isCheckIn || isCheckOut
          const between = inRange(day)
          return (
            <button
              key={i}
              type="button"
              disabled={past}
              onMouseEnter={() => setHover(day)}
              onClick={() => handleClick(day)}
              className={[
                "flex h-10 items-center justify-center rounded-lg text-sm transition-colors",
                past ? "cursor-not-allowed text-muted-foreground/40" : "text-foreground hover:bg-primary/10",
                between ? "bg-primary/10" : "",
                isEdge ? "bg-primary text-primary-foreground hover:bg-primary" : "",
              ].join(" ")}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
