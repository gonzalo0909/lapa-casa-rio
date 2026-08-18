"use client"

import { useMemo, useState } from "react"
import {
  BedDouble,
  Users,
  Sparkles,
  QrCode,
  CreditCard,
  CheckCircle2,
  MessageCircle,
  ShieldCheck,
} from "lucide-react"
import { Stepper, Counter, Field, inputClass } from "./wizard-ui"
import { RangeCalendar } from "./range-calendar"

const STEPS = ["Fechas", "Camas", "Datos", "Pago"]
const BASE_PRICE = 85 // R$ por cama por noche

const ROOMS = [
  { id: "c1", name: "Cuarto 1 · Mixto", available: 12, kind: "Compartido mixto" },
  { id: "c3", name: "Cuarto 3 · Mixto", available: 7, kind: "Compartido mixto" },
  { id: "c4", name: "Cuarto 4 · Mixto", available: 7, kind: "Compartido mixto" },
  { id: "c6", name: "Cuarto 6 · Femenino", available: 7, kind: "Compartido femenino" },
]

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)

const fmtDate = (d: Date) =>
  d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })

export function HostelEngine() {
  const [step, setStep] = useState(1)
  const [checkIn, setCheckIn] = useState<Date | null>(null)
  const [checkOut, setCheckOut] = useState<Date | null>(null)
  const [beds, setBeds] = useState<Record<string, number>>({})
  const [form, setForm] = useState({ name: "", email: "", phone: "", country: "BR", doc: "", arrival: "" })
  const [payMethod, setPayMethod] = useState<"pix" | "card">("pix")
  const [confirmed, setConfirmed] = useState(false)
  const [toast, setToast] = useState("")

  const totalBeds = useMemo(() => Object.values(beds).reduce((a, b) => a + b, 0), [beds])
  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0
    return Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000)
  }, [checkIn, checkOut])

  const price = useMemo(() => {
    if (!nights || !totalBeds) return null
    const subtotal = BASE_PRICE * totalBeds * nights
    const disc = totalBeds >= 15 ? 0.2 : totalBeds >= 10 ? 0.15 : totalBeds >= 7 ? 0.1 : 0
    const discAmt = subtotal * disc
    const total = subtotal - discAmt
    return { subtotal, disc, discAmt, total, deposit: total * 0.3 }
  }, [nights, totalBeds])

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(""), 3000)
  }

  function next() {
    if (step === 1) {
      if (!checkIn) return flash("Elige la fecha de check-in")
      if (!checkOut) return flash("Elige la fecha de check-out")
    }
    if (step === 2 && totalBeds === 0) return flash("Selecciona al menos una cama")
    if (step === 3) {
      if (form.name.trim().length < 3) return flash("Ingresa tu nombre completo")
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return flash("Ingresa un email válido")
      if (form.phone.replace(/\D/g, "").length < 10) return flash("Ingresa un teléfono válido")
    }
    setStep((s) => Math.min(4, s + 1))
  }

  if (confirmed && price) {
    return <SuccessPanel price={price} payMethod={payMethod} onReset={() => window.location.reload()} />
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      {/* Header de marca */}
      <div className="bg-primary px-6 py-5 text-primary-foreground">
        <h2 className="font-serif text-2xl">Lapa Casa Hostel</h2>
        <p className="text-sm text-primary-foreground/70">Santa Teresa · Rio de Janeiro</p>
      </div>

      <div className="p-6">
        <Stepper steps={STEPS} current={step} />

        {toast && (
          <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {toast}
          </div>
        )}

        <div className="mt-6">
          {step === 1 && (
            <div>
              <h3 className="mb-1 font-serif text-xl">¿Cuándo vienes?</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Selecciona tu fecha de llegada y de salida en el calendario.
              </p>
              <RangeCalendar
                checkIn={checkIn}
                checkOut={checkOut}
                onSelect={(ci, co) => {
                  setCheckIn(ci)
                  setCheckOut(co)
                }}
              />
              {checkIn && checkOut && (
                <p className="mt-4 text-sm text-foreground">
                  <span className="font-semibold">{nights}</span> {nights === 1 ? "noche" : "noches"} ·{" "}
                  {fmtDate(checkIn)} → {fmtDate(checkOut)}
                </p>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <h3 className="mb-1 font-serif text-xl">Elige tus camas</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Descuentos automáticos para grupos: 10% (7+), 15% (10+), 20% (15+).
              </p>
              <div className="space-y-3">
                {ROOMS.map((room) => (
                  <div
                    key={room.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background/50 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <BedDouble className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="font-medium text-foreground">{room.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {room.kind} · {room.available} camas disponibles
                        </p>
                      </div>
                    </div>
                    <Counter
                      value={beds[room.id] ?? 0}
                      min={0}
                      max={room.available}
                      label="cama"
                      onChange={(v) => setBeds((b) => ({ ...b, [room.id]: v }))}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-primary/5 px-4 py-3 text-sm text-foreground">
                <Users className="h-4 w-4 text-primary" />
                {totalBeds} {totalBeds === 1 ? "cama seleccionada" : "camas seleccionadas"}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h3 className="mb-1 font-serif text-xl">Tus datos</h3>
              <p className="mb-4 text-sm text-muted-foreground">Necesarios para confirmar tu reserva.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Nombre completo">
                    <input
                      className={inputClass}
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Ej: María González"
                    />
                  </Field>
                </div>
                <Field label="Email">
                  <input
                    type="email"
                    className={inputClass}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="tu@email.com"
                  />
                </Field>
                <Field label="Teléfono / WhatsApp">
                  <input
                    className={inputClass}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+55 21 99999-9999"
                  />
                </Field>
                <Field label="País">
                  <select
                    className={inputClass}
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                  >
                    <option value="BR">Brasil</option>
                    <option value="AR">Argentina</option>
                    <option value="US">Estados Unidos</option>
                    <option value="OT">Otro</option>
                  </select>
                </Field>
                <Field label={form.country === "BR" ? "CPF" : "Documento / Pasaporte"}>
                  <input
                    className={inputClass}
                    value={form.doc}
                    onChange={(e) => setForm({ ...form, doc: e.target.value })}
                    placeholder={form.country === "BR" ? "000.000.000-00" : "Número de documento"}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Hora estimada de llegada">
                    <input
                      type="time"
                      className={inputClass}
                      value={form.arrival}
                      onChange={(e) => setForm({ ...form, arrival: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {step === 4 && price && (
            <div>
              <h3 className="mb-1 font-serif text-xl">Resumen y pago</h3>
              <p className="mb-4 text-sm text-muted-foreground">Revisa tu reserva antes de confirmar.</p>

              <div className="rounded-2xl border border-border bg-background/50 p-4">
                <Row label="Check-in" value={checkIn ? fmtDate(checkIn) : "—"} />
                <Row label="Check-out" value={checkOut ? fmtDate(checkOut) : "—"} />
                <Row label="Noches" value={String(nights)} />
                <Row label="Camas" value={String(totalBeds)} />
                <div className="my-3 h-px bg-border" />
                <Row label="Subtotal" value={fmtMoney(price.subtotal)} />
                {price.disc > 0 && (
                  <Row
                    label={`Descuento grupo (${price.disc * 100}%)`}
                    value={`− ${fmtMoney(price.discAmt)}`}
                    accent
                  />
                )}
                <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
                  <span className="font-serif text-lg">Total</span>
                  <span className="font-serif text-lg text-primary">{fmtMoney(price.total)}</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-center">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Depósito ahora</p>
                  <p className="mt-1 font-serif text-xl text-primary">{fmtMoney(price.deposit)}</p>
                  <p className="text-xs text-muted-foreground">30%</p>
                </div>
                <div className="rounded-2xl border border-border p-4 text-center">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Al llegar</p>
                  <p className="mt-1 font-serif text-xl text-foreground">{fmtMoney(price.total - price.deposit)}</p>
                  <p className="text-xs text-muted-foreground">70% · check-in</p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-xl bg-accent/10 px-4 py-3 text-sm text-foreground">
                <Sparkles className="h-4 w-4 text-accent" />
                Reservando directo ahorras <strong className="mx-1">{fmtMoney(price.total * 0.15)}</strong> vs. otras
                plataformas.
              </div>

              <div className="mt-4 space-y-2">
                {(["pix", "card"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPayMethod(m)}
                    className={[
                      "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                      payMethod === m ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                    ].join(" ")}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {m === "pix" ? <QrCode className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-semibold text-foreground">
                        {m === "pix" ? "PIX" : "Tarjeta de crédito"}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Depósito {fmtMoney(price.deposit)} ahora
                      </span>
                    </span>
                    {m === "pix" && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        Aprobación instantánea
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setConfirmed(true)}
                className="mt-5 w-full rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground transition-colors hover:bg-foliage-soft"
              >
                Confirmar reserva
              </button>
              <a
                href="https://wa.me/5521977157530"
                target="_blank"
                rel="noreferrer"
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <MessageCircle className="h-4 w-4" />
                Reservar por WhatsApp
              </a>
            </div>
          )}
        </div>

        {/* Footer navegación */}
        <div className="mt-6 flex items-center justify-between gap-4 border-t border-border pt-5">
          <div>
            {price ? (
              <>
                <p className="font-serif text-lg text-foreground">{fmtMoney(price.total)}</p>
                <p className="text-xs text-muted-foreground">
                  {totalBeds} camas · {nights} noches
                </p>
              </>
            ) : (
              <>
                <p className="font-serif text-lg text-foreground">{fmtMoney(BASE_PRICE)}/noche</p>
                <p className="text-xs text-muted-foreground">por cama · precio base</p>
              </>
            )}
          </div>
          <div className="flex gap-2">
            {step > 1 && (
              <button
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                Atrás
              </button>
            )}
            {step < 4 && (
              <button
                onClick={next}
                className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-foliage-soft"
              >
                Continuar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={accent ? "font-medium text-accent" : "font-medium text-foreground"}>{value}</span>
    </div>
  )
}

function SuccessPanel({
  price,
  payMethod,
  onReset,
}: {
  price: { deposit: number }
  payMethod: "pix" | "card"
  onReset: () => void
}) {
  const code = "LCH-" + Math.random().toString(36).slice(2, 8).toUpperCase()
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CheckCircle2 className="h-9 w-9" />
      </span>
      <h2 className="mt-5 font-serif text-2xl">¡Reserva confirmada!</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Guarda tu código de reserva. Te enviamos los detalles por email.
      </p>
      <p className="mt-4 inline-block rounded-lg bg-primary/5 px-4 py-2 font-mono text-lg font-semibold tracking-wider text-primary">
        {code}
      </p>

      <div className="mx-auto mt-6 max-w-xs rounded-2xl border border-border bg-background/50 p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {payMethod === "pix" ? "Paga el depósito por PIX" : "Depósito con tarjeta"}
        </p>
        {payMethod === "pix" ? (
          <span className="mx-auto mt-3 flex h-28 w-28 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <QrCode className="h-16 w-16" />
          </span>
        ) : (
          <span className="mx-auto mt-3 flex h-28 w-28 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CreditCard className="h-16 w-16" />
          </span>
        )}
        <p className="mt-3 font-serif text-xl text-foreground">{fmtMoney(price.deposit)}</p>
        <p className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Pago seguro
        </p>
      </div>

      <button
        onClick={onReset}
        className="mt-6 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition-colors hover:bg-foliage-soft"
      >
        Nueva reserva
      </button>
    </div>
  )
}
