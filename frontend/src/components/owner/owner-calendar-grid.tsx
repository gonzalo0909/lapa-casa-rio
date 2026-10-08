'use client';

//
// Calendário em linha do tempo (estilo Airbnb/Booking) de todos os apartamentos
// do proprietário: um bloco por apartamento, dias em colunas, com a linha
// "Estado" (reservado / bloqueado / disponível) e a linha de preço.
// Edição: toque num primeiro e num último dia livres e depois em "Bloquear";
// toque num bloqueio para removê-lo; toque numa reserva para ver os dados.
// Convenção do backend: bloqueio e reserva ocupam [início, fim).

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Apartment, ApartmentBlock, OwnerBooking } from '@/lib/owner-api';
import { apartmentLabel } from '@/lib/utils';

export interface CalendarApartment {
  apartment: Apartment;
  bookings: OwnerBooking[];
  blocks: ApartmentBlock[];
}

interface Props {
  items: CalendarApartment[];
  startDate: string; // YYYY-MM-DD, primeiro dia exibido
  days: number;
  onCreateBlock: (apartmentId: string, start: string, endExclusive: string) => Promise<void>;
  onDeleteBlock: (apartmentId: string, blockId: string) => Promise<void>;
}

const COL_W = 56;
const LABEL_W = 190;
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const pad = (n: number) => String(n).padStart(2, '0');
const toDs = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// Reservas importadas por iCal sin nombre real de huésped ("booking (iCal)"): son
// fechas que la plataforma tiene cerradas, no una reserva con datos del huésped.
const isIcalPlaceholder = (b: OwnerBooking) => /\(iCal\)\s*$/i.test(b.guestName);
const displayName = (b: OwnerBooking) =>
  isIcalPlaceholder(b) ? `${b.guestName.replace(/\s*\(iCal\)\s*$/i, '')} · datas fechadas (iCal)` : b.guestName;

export const addDays = (ds: string, n: number) => {
  const d = new Date(`${ds}T12:00:00`);
  d.setDate(d.getDate() + n);
  return toDs(d);
};
const br = (ds: string) => new Date(`${ds}T12:00:00`).toLocaleDateString('pt-BR');
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

type Seg =
  | { kind: 'free'; day: string }
  | { kind: 'booked'; span: number; booking: OwnerBooking }
  | { kind: 'blocked'; span: number; block: ApartmentBlock };

export function OwnerCalendarGrid({ items, startDate, days, onCreateBlock, onDeleteBlock }: Props) {
  const today = toDs(new Date());
  const dayList = useMemo(() => Array.from({ length: days }, (_, i) => addDays(startDate, i)), [startDate, days]);

  const [sel, setSel] = useState<{ aptId: string; start: string; end: string | null } | null>(null);
  const [info, setInfo] = useState<
    | { aptId: string; type: 'block'; block: ApartmentBlock }
    | { aptId: string; type: 'booking'; booking: OwnerBooking }
    | null
  >(null);
  const [busy, setBusy] = useState(false);

  // Cabeçalho de meses (agrupa dias consecutivos do mesmo mês)
  const monthGroups = useMemo(() => {
    const groups: { label: string; span: number }[] = [];
    dayList.forEach((ds) => {
      const label = `${MONTHS[Number(ds.slice(5, 7)) - 1]} ${ds.slice(0, 4)}`;
      const last = groups[groups.length - 1];
      if (last && last.label === label) {last.span += 1;} else {groups.push({ label, span: 1 });}
    });
    return groups;
  }, [dayList]);

  const buildSegments = (it: CalendarApartment): Seg[] => {
    const active = it.bookings.filter((b) => b.status !== 'cancelled' && b.status !== 'expired');
    const segs: Seg[] = [];
    let i = 0;
    while (i < dayList.length) {
      const ds = dayList[i]!;
      const bk = active.find((b) => b.checkIn <= ds && ds < b.checkOut);
      const bl = !bk ? it.blocks.find((b) => b.start_date <= ds && ds < b.end_date) : undefined;
      if (bk || bl) {
        let span = 1;
        while (i + span < dayList.length) {
          const next = dayList[i + span]!;
          const same = bk ? bk.checkIn <= next && next < bk.checkOut : bl!.start_date <= next && next < bl!.end_date;
          if (!same) {break;}
          span += 1;
        }
        segs.push(bk ? { kind: 'booked', span, booking: bk } : { kind: 'blocked', span, block: bl! });
        i += span;
      } else {
        segs.push({ kind: 'free', day: ds });
        i += 1;
      }
    }
    return segs;
  };

  const rangeHasConflict = (it: CalendarApartment, from: string, to: string) => {
    const active = it.bookings.filter((b) => b.status !== 'cancelled' && b.status !== 'expired');
    let d = from;
    while (d <= to) {
      if (active.some((b) => b.checkIn <= d && d < b.checkOut)) {return true;}
      if (it.blocks.some((b) => b.start_date <= d && d < b.end_date)) {return true;}
      d = addDays(d, 1);
    }
    return false;
  };

  const clickFree = (it: CalendarApartment, ds: string) => {
    if (ds < today) {return;}
    setInfo(null);
    if (!sel || sel.aptId !== it.apartment.id || sel.end) {
      setSel({ aptId: it.apartment.id, start: ds, end: null });
    } else if (ds < sel.start || rangeHasConflict(it, sel.start, ds)) {
      setSel({ aptId: it.apartment.id, start: ds, end: null });
    } else {
      setSel({ ...sel, end: ds });
    }
  };

  const confirm = async () => {
    if (!sel) {return;}
    setBusy(true);
    try {
      await onCreateBlock(sel.aptId, sel.start, addDays(sel.end ?? sel.start, 1));
      setSel(null);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (aptId: string, blockId: string) => {
    setBusy(true);
    try {
      await onDeleteBlock(aptId, blockId);
      setInfo(null);
    } finally {
      setBusy(false);
    }
  };

  const gridCols = `repeat(${days}, ${COL_W}px)`;
  const totalW = LABEL_W + days * COL_W;

  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <div style={{ minWidth: totalW }}>
        {/* Cabeçalho */}
        <div className="flex border-b bg-neutral-50">
          <div style={{ width: LABEL_W }} className="sticky left-0 z-10 shrink-0 border-r bg-neutral-50" />
          <div>
            <div className="grid text-xs font-semibold text-neutral-600" style={{ gridTemplateColumns: gridCols }}>
              {monthGroups.map((g, i) => (
                <div key={i} style={{ gridColumn: `span ${g.span}` }} className="border-r px-2 py-1 capitalize">{g.label}</div>
              ))}
            </div>
            <div className="grid text-center text-[11px]" style={{ gridTemplateColumns: gridCols }}>
              {dayList.map((ds) => {
                const wd = new Date(`${ds}T12:00:00`).getDay();
                const weekend = wd === 0 || wd === 6;
                return (
                  <div key={ds} className={`border-r py-1 ${weekend ? 'font-bold text-neutral-900' : 'text-neutral-500'} ${ds === today ? 'bg-yellow-100' : ''}`}>
                    <div>{WEEKDAYS[wd]}</div>
                    <div className="text-sm">{ds.slice(8)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {items.map((it) => {
          const segs = buildSegments(it);
          const apt = it.apartment;
          const occupied = (ds: string) =>
            it.bookings.some((b) => b.status !== 'cancelled' && b.status !== 'expired' && b.checkIn <= ds && ds < b.checkOut) ||
            it.blocks.some((b) => b.start_date <= ds && ds < b.end_date);
          return (
            <div key={apt.id} className="border-b last:border-b-0">
              <div className="flex">
                <div style={{ width: LABEL_W }} className="sticky left-0 z-10 shrink-0 border-r bg-white p-2">
                  <p className="text-sm font-semibold leading-tight">{apt.name}</p>
                  <p className="text-xs text-neutral-500">{apartmentLabel(apt)} · {apt.capacity} hóspedes</p>
                  <p className="text-xs text-neutral-500">Preço base {brl(Number(apt.base_price))}</p>
                </div>
                <div>
                  {/* Linha de estado */}
                  <div className="grid" style={{ gridTemplateColumns: gridCols }}>
                    {segs.map((s, idx) => {
                      if (s.kind === 'free') {
                        const inSel = sel && sel.aptId === apt.id && s.day >= sel.start && s.day <= (sel.end ?? sel.start);
                        const past = s.day < today;
                        return (
                          <button
                            key={`${apt.id}-f-${s.day}`}
                            type="button"
                            disabled={past}
                            onClick={() => clickFree(it, s.day)}
                            className={`h-10 border-r border-t text-[11px] transition-colors ${
                              inSel ? 'bg-neutral-900 font-semibold text-white'
                                : past ? 'bg-neutral-50 text-neutral-300'
                                  : 'bg-green-50 text-green-700 hover:bg-green-100'
                            }`}
                          >
                            {inSel ? '•' : past ? '' : 'Livre'}
                          </button>
                        );
                      }
                      if (s.kind === 'booked') {
                        return (
                          <button
                            key={`${apt.id}-b-${idx}`}
                            type="button"
                            style={{ gridColumn: `span ${s.span}` }}
                            onClick={() => { setSel(null); setInfo({ aptId: apt.id, type: 'booking', booking: s.booking }); }}
                            className="h-10 truncate border-r border-t bg-blue-600 px-2 text-left text-xs font-medium text-white hover:bg-blue-700"
                            title={`${displayName(s.booking)} (${br(s.booking.checkIn)} → ${br(s.booking.checkOut)})`}
                          >
                            {displayName(s.booking)}
                          </button>
                        );
                      }
                      return (
                        <button
                          key={`${apt.id}-k-${idx}`}
                          type="button"
                          style={{ gridColumn: `span ${s.span}` }}
                          onClick={() => { setSel(null); setInfo({ aptId: apt.id, type: 'block', block: s.block }); }}
                          className="h-10 truncate border-r border-t bg-red-600 px-2 text-left text-xs font-medium text-white hover:bg-red-700"
                          title={s.block.reason ?? 'Bloqueado'}
                        >
                          {s.block.reason ?? 'Bloqueado'}
                        </button>
                      );
                    })}
                  </div>
                  {/* Linha de preço */}
                  <div className="grid" style={{ gridTemplateColumns: gridCols }}>
                    {dayList.map((ds) => (
                      <div
                        key={ds}
                        className={`border-r border-t py-1 text-center text-[11px] ${occupied(ds) ? 'bg-red-100 text-neutral-400' : 'text-neutral-700'}`}
                      >
                        {brl(Number(apt.base_price))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Barras de ação deste apartamento */}
              {sel && sel.aptId === apt.id && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-neutral-100 p-3 text-sm">
                  <span>
                    {sel.end
                      ? <>Bloquear <strong>{br(sel.start)}</strong> até <strong>{br(sel.end)}</strong></>
                      : <>Início: <strong>{br(sel.start)}</strong>. Toque no último dia, ou bloqueie só este dia.</>}
                  </span>
                  <span className="flex gap-2">
                    <Button type="button" size="sm" disabled={busy} onClick={confirm}>{busy ? 'Bloqueando...' : 'Bloquear'}</Button>
                    <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setSel(null)}>Cancelar</Button>
                  </span>
                </div>
              )}
              {info && info.aptId === apt.id && info.type === 'block' && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-red-50 p-3 text-sm">
                  <span>
                    Bloqueado de <strong>{br(info.block.start_date)}</strong> até <strong>{br(addDays(info.block.end_date, -1))}</strong>
                    {info.block.reason ? ` — ${info.block.reason}` : ''}
                  </span>
                  <span className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => remove(apt.id, info.block.id)}>{busy ? 'Removendo...' : 'Remover bloqueio'}</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setInfo(null)}>Fechar</Button>
                  </span>
                </div>
              )}
              {info && info.aptId === apt.id && info.type === 'booking' && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-blue-50 p-3 text-sm">
                  <span>
                    Reserva <strong>#{info.booking.reservationNumber}</strong> — {displayName(info.booking)}<br />
                    {isIcalPlaceholder(info.booking) && <span className="text-xs text-neutral-600">Importada do calendário da plataforma, sem dados de hóspede. Se não for uma reserva real, avise a equipe pelo chat para removê-la.<br /></span>}
                    {br(info.booking.checkIn)} → {br(info.booking.checkOut)} · {brl(info.booking.finalPrice)}
                  </span>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setInfo(null)}>Fechar</Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
