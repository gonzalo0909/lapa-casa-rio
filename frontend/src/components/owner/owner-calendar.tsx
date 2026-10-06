'use client';

//
// Calendário do apartamento (painel do proprietário): mostra reservas e
// bloqueios e permite bloquear/liberar datas tocando nos dias.
//   - dia livre: toque no primeiro e no último dia para bloquear o período
//   - dia bloqueado: toque para ver o bloqueio e removê-lo
//   - dia reservado: toque para ver os dados da reserva (não editável)
// Convenção do backend: bloqueio e reserva ocupam [início, fim) -- o dia do
// fim (check-out) fica livre.

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ApartmentBlock, OwnerBooking } from '@/lib/owner-api';

interface OwnerCalendarProps {
  blocks: ApartmentBlock[];
  bookings: OwnerBooking[];
  onCreateBlock: (start: string, endExclusive: string) => Promise<void>;
  onDeleteBlock: (blockId: string) => Promise<void>;
}

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const pad = (n: number) => String(n).padStart(2, '0');
const toDs = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (ds: string, n: number) => {
  const d = new Date(`${ds}T12:00:00`);
  d.setDate(d.getDate() + n);
  return toDs(d);
};
const br = (ds: string) => new Date(`${ds}T12:00:00`).toLocaleDateString('pt-BR');

export function OwnerCalendar({ blocks, bookings, onCreateBlock, onDeleteBlock }: OwnerCalendarProps) {
  const now = new Date();
  const today = toDs(now);
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ type: 'block'; block: ApartmentBlock } | { type: 'booking'; booking: OwnerBooking } | null>(null);
  const [busy, setBusy] = useState(false);

  const activeBookings = useMemo(
    () => bookings.filter((b) => b.status !== 'cancelled' && b.status !== 'expired'),
    [bookings],
  );

  const bookingAt = (ds: string) => activeBookings.find((b) => b.checkIn <= ds && ds < b.checkOut);
  const blockAt = (ds: string) => blocks.find((b) => b.start_date <= ds && ds < b.end_date);

  const shift = (delta: number) =>
    setView(({ y, m }) => {
      const t = y * 12 + m + delta;
      return { y: Math.floor(t / 12), m: t % 12 };
    });

  const handleDay = (ds: string) => {
    const bk = bookingAt(ds);
    if (bk) {
      setRangeStart(null); setRangeEnd(null);
      setSelected({ type: 'booking', booking: bk });
      return;
    }
    const bl = blockAt(ds);
    if (bl) {
      setRangeStart(null); setRangeEnd(null);
      setSelected({ type: 'block', block: bl });
      return;
    }
    if (ds < today) {return;}
    setSelected(null);
    if (!rangeStart || rangeEnd) {
      setRangeStart(ds);
      setRangeEnd(null);
    } else if (ds < rangeStart) {
      setRangeStart(ds);
    } else {
      // O período não pode atravessar reservas nem outros bloqueios
      let d = rangeStart;
      while (d <= ds) {
        if (bookingAt(d) || blockAt(d)) {
          setRangeStart(ds);
          return;
        }
        d = addDays(d, 1);
      }
      setRangeEnd(ds);
    }
  };

  const confirmBlock = async () => {
    if (!rangeStart) {return;}
    setBusy(true);
    try {
      await onCreateBlock(rangeStart, addDays(rangeEnd ?? rangeStart, 1));
      setRangeStart(null);
      setRangeEnd(null);
    } finally {
      setBusy(false);
    }
  };

  const removeBlock = async (id: string) => {
    setBusy(true);
    try {
      await onDeleteBlock(id);
      setSelected(null);
    } finally {
      setBusy(false);
    }
  };

  const first = new Date(view.y, view.m, 1);
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: first.getDay() }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${view.y}-${pad(view.m + 1)}-${pad(i + 1)}`),
  ];

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} className="rounded-md px-3 py-1 text-lg hover:bg-neutral-100" aria-label="Mês anterior">‹</button>
        <span className="text-sm font-semibold">{MONTHS[view.m]} {view.y}</span>
        <button type="button" onClick={() => shift(1)} className="rounded-md px-3 py-1 text-lg hover:bg-neutral-100" aria-label="Próximo mês">›</button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="py-1 font-medium text-neutral-500">{w}</span>
        ))}
        {cells.map((ds, i) => {
          if (!ds) {return <span key={`e${i}`} />;}
          const bk = bookingAt(ds);
          const bl = blockAt(ds);
          const inRange = rangeStart && ds >= rangeStart && ds <= (rangeEnd ?? rangeStart);
          const past = ds < today;
          let cls = 'rounded-md border py-2 text-sm transition-colors ';
          if (bk) {cls += 'border-blue-300 bg-blue-100 text-blue-900 hover:bg-blue-200';}
          else if (bl) {cls += 'border-red-300 bg-red-100 text-red-800 hover:bg-red-200';}
          else if (inRange) {cls += 'border-neutral-900 bg-neutral-900 text-white';}
          else if (past) {cls += 'border-transparent text-neutral-300';}
          else {cls += 'border-neutral-200 bg-white hover:bg-neutral-50';}
          return (
            <button
              key={ds}
              type="button"
              disabled={past && !bk && !bl}
              onClick={() => handleDay(ds)}
              className={cls}
              title={bk ? `Reserva ${bk.reservationNumber} — ${bk.guestName}` : bl ? `Bloqueado${bl.reason ? `: ${bl.reason}` : ''}` : undefined}
            >
              {Number(ds.slice(8))}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-neutral-600">
        <span><span className="mr-1 inline-block h-3 w-3 rounded border border-blue-300 bg-blue-100 align-middle" />Reservado</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded border border-red-300 bg-red-100 align-middle" />Bloqueado</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded border border-neutral-200 bg-white align-middle" />Livre</span>
      </div>

      {!rangeStart && !selected && (
        <p className="mt-3 text-xs text-neutral-500">
          Para bloquear, toque no primeiro e no último dia. Toque num dia bloqueado para removê-lo.
        </p>
      )}

      {rangeStart && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-neutral-100 p-3 text-sm">
          <span>
            {rangeEnd
              ? <>Bloquear de <strong>{br(rangeStart)}</strong> até <strong>{br(rangeEnd)}</strong></>
              : <>Início: <strong>{br(rangeStart)}</strong>. Toque no último dia (ou confirme só este dia).</>}
          </span>
          <span className="flex gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={confirmBlock}>{busy ? 'Bloqueando...' : 'Bloquear'}</Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => { setRangeStart(null); setRangeEnd(null); }}>Cancelar</Button>
          </span>
        </div>
      )}

      {selected?.type === 'block' && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-red-50 p-3 text-sm">
          <span>
            Bloqueado de <strong>{br(selected.block.start_date)}</strong> até <strong>{br(addDays(selected.block.end_date, -1))}</strong>
            {selected.block.reason ? ` — ${selected.block.reason}` : ''}
          </span>
          <span className="flex gap-2">
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => removeBlock(selected.block.id)}>{busy ? 'Removendo...' : 'Remover bloqueio'}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(null)}>Fechar</Button>
          </span>
        </div>
      )}

      {selected?.type === 'booking' && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-blue-50 p-3 text-sm">
          <span>
            Reserva <strong>#{selected.booking.reservationNumber}</strong> — {selected.booking.guestName}<br />
            {br(selected.booking.checkIn)} → {br(selected.booking.checkOut)}
          </span>
          <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(null)}>Fechar</Button>
        </div>
      )}
    </div>
  );
}
