'use client';

//
// Calendário do proprietário em tela própria: linha do tempo de todos os
// apartamentos (reservas, bloqueios, disponibilidade e preço), com edição de
// bloqueios. Dados: /owner/apartments + reservas e bloqueios de cada um.

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useOwnerAuth } from '@/lib/use-owner-auth';
import { ownerApartmentsAPI } from '@/lib/owner-api';
import { handleAPIError } from '@/lib/api';
import { OwnerNav } from '@/components/owner/owner-nav';
import { OwnerCalendarGrid, type CalendarApartment } from '@/components/owner/owner-calendar-grid';

const pad = (n: number) => String(n).padStart(2, '0');
const todayDs = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const monthStart = (ds: string) => `${ds.slice(0, 7)}-01`;
const daysInMonth = (ds: string) => new Date(Number(ds.slice(0, 4)), Number(ds.slice(5, 7)), 0).getDate();
const shiftMonth = (ds: string, delta: number) => {
  const d = new Date(Number(ds.slice(0, 4)), Number(ds.slice(5, 7)) - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
};

export default function OwnerCalendarPage() {
  const { profile, loading: authLoading } = useOwnerAuth();
  const [items, setItems] = useState<CalendarApartment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [start, setStart] = useState(monthStart(todayDs()));

  const load = useCallback(async () => {
    try {
      const aptRes = await ownerApartmentsAPI.list();
      const apartments = aptRes.data.apartments;
      const data = await Promise.all(
        apartments.map(async (apartment) => {
          const [b, k] = await Promise.all([
            ownerApartmentsAPI.listBookings(apartment.id),
            ownerApartmentsAPI.listBlocks(apartment.id),
          ]);
          // Datas só 'AAAA-MM-DD' (sem hora), para comparar com os dias do calendário
          const bookings = b.data.bookings.map((x) => ({ ...x, checkIn: x.checkIn.slice(0, 10), checkOut: x.checkOut.slice(0, 10) }));
          return { apartment, bookings, blocks: k.data };
        }),
      );
      setItems(data);
    } catch (err) {
      setError(handleAPIError(err, 'pt'));
    }
  }, []);

  useEffect(() => {
    if (!profile) {return;}
    void load();
  }, [profile, load]);

  const handleCreate = async (apartmentId: string, s: string, endExclusive: string) => {
    setError(null);
    try {
      await ownerApartmentsAPI.createBlock(apartmentId, {
        start_date: s,
        end_date: endExclusive,
        block_type: 'other',
        reason: 'Bloqueio do proprietário',
      });
      await load();
    } catch (err) {
      setError(handleAPIError(err, 'pt'));
    }
  };

  const handleDelete = async (_apartmentId: string, blockId: string) => {
    setError(null);
    try {
      await ownerApartmentsAPI.deleteBlock(blockId);
      await load();
    } catch (err) {
      setError(handleAPIError(err, 'pt'));
    }
  };

  if (authLoading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" text="Carregando..." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10">
      <OwnerNav fullName={profile.fullName} />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Calendário</h1>
          <p className="text-sm text-neutral-500">
            Reservas, bloqueios e disponibilidade dos seus apartamentos. Toque num dia livre para bloquear datas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setStart(shiftMonth(start, -1))}>‹ Mês</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setStart(monthStart(todayDs()))}>Hoje</Button>
          <input
            type="date"
            value={start}
            onChange={(e) => e.target.value && setStart(monthStart(e.target.value))}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm"
            aria-label="Ir para a data"
          />
          <Button type="button" variant="outline" size="sm" onClick={() => setStart(shiftMonth(start, 1))}>Mês ›</Button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-4 text-xs text-neutral-600">
        <span><span className="mr-1 inline-block h-3 w-3 rounded bg-blue-600 align-middle" />Reservado</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded bg-red-600 align-middle" />Bloqueado</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded border bg-green-50 align-middle" />Livre</span>
      </div>

      {error && (
        <Alert variant="danger" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!items && !error && <LoadingSpinner centered text="Carregando calendário..." />}
      {items && items.length === 0 && (
        <Alert variant="info">
          <AlertDescription>Nenhum apartamento vinculado à sua conta ainda.</AlertDescription>
        </Alert>
      )}
      {items && items.length > 0 && (
        <OwnerCalendarGrid
          items={items}
          startDate={start}
          days={daysInMonth(start)}
          onCreateBlock={handleCreate}
          onDeleteBlock={handleDelete}
        />
      )}
    </div>
  );
}
