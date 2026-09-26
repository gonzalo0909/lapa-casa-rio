'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useOwnerAuth } from '@/lib/use-owner-auth';
import { ownerApartmentsAPI, type OwnerBooking, type Apartment } from '@/lib/owner-api';
import { handleAPIError } from '@/lib/api';
import { OwnerNav } from '@/components/owner/owner-nav';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  confirmed:                { label: 'Confirmada',       color: 'bg-green-100 text-green-800' },
  pending_payment:          { label: 'Aguardando pag.',  color: 'bg-amber-100 text-amber-800' },
  cancelled:                { label: 'Cancelada',        color: 'bg-red-100 text-red-700' },
  pending_ota_confirmation: { label: 'Pend. OTA',        color: 'bg-blue-100 text-blue-800' },
  checked_in:               { label: 'Check-in feito',   color: 'bg-teal-100 text-teal-800' },
  checked_out:              { label: 'Check-out feito',  color: 'bg-gray-100 text-gray-700' },
  no_show:                  { label: 'No-show',          color: 'bg-red-100 text-red-700' },
};

function fmt(dateStr: string): string {
  const [y, m, d] = dateStr.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function brl(val: number): string {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function nights(checkIn: string, checkOut: string): number {
  return Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000
  );
}

export default function OwnerApartmentBookingsPage() {
  const params = useParams<{ id: string }>();
  const { profile, loading: authLoading } = useOwnerAuth();
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [bookings, setBookings] = useState<OwnerBooking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile || !params.id) { return; }
    Promise.all([
      ownerApartmentsAPI.getById(params.id),
      ownerApartmentsAPI.listBookings(params.id),
    ])
      .then(([aptRes, bkRes]) => {
        setApartment(aptRes.data);
        setBookings(bkRes.data.bookings);
      })
      .catch((err) => setError(handleAPIError(err, 'pt')));
  }, [profile, params.id]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" text="Carregando..." />
      </div>
    );
  }
  if (!profile) { return null; }

  const active = bookings?.filter((b) => b.status !== 'cancelled') ?? [];
  const totalRevenue = active.reduce((s, b) => s + b.finalPrice, 0);
  const totalTransferred = active.reduce((s, b) => s + b.transferredToOwner, 0);
  const pendingTransfer = active.reduce((s, b) => s + (b.transferPending ? (b.finalPrice - b.transferredToOwner) : 0), 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <OwnerNav fullName={profile.fullName} />

      <div className="mb-6 flex items-center gap-3">
        <Link href={`/owner/apartments/${params.id}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← {apartment?.name ?? 'Apartamento'}
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-semibold">Reservas</h1>

      {error && (
        <Alert variant="danger" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!bookings && !error && <LoadingSpinner centered text="Carregando reservas..." />}

      {bookings && (
        <>
          {/* Resumen financiero */}
          <div className="mb-8 grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-gray-500">Receita total</p>
                <p className="mt-1 text-xl font-semibold">{brl(totalRevenue)}</p>
                <p className="text-xs text-gray-400">{active.length} reserva{active.length !== 1 ? 's' : ''}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-gray-500">Transferido ao proprietário</p>
                <p className="mt-1 text-xl font-semibold">{brl(totalTransferred)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-gray-500">Transferência pendente</p>
                <p className="mt-1 text-xl font-semibold">{brl(pendingTransfer)}</p>
              </CardContent>
            </Card>
          </div>

          {bookings.length === 0 && (
            <Alert variant="info">
              <AlertDescription>Nenhuma reserva encontrada para este apartamento.</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-3">
            {bookings.map((b) => {
              const st = STATUS_LABEL[b.status] ?? { label: b.status, color: 'bg-gray-100 text-gray-700' };
              const n = nights(b.checkIn, b.checkOut);
              const totalPaid = b.depositPaid + b.remainingPaid;
              return (
                <Card key={b.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle size="sm">#{b.reservationNumber}</CardTitle>
                        <p className="mt-0.5 text-sm text-gray-600">{b.guestName}</p>
                      </div>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                      <div>
                        <span className="text-gray-500">Check-in</span>
                        <p className="font-medium">{fmt(b.checkIn)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Check-out</span>
                        <p className="font-medium">{fmt(b.checkOut)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Noites</span>
                        <p className="font-medium">{n}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Total</span>
                        <p className="font-medium">{brl(b.finalPrice)}</p>
                      </div>
                    </div>

                    {b.status !== 'cancelled' && (
                      <div className="mt-3 flex flex-wrap gap-3 border-t pt-3 text-xs text-gray-500">
                        <span>Pago recebido: <strong className="text-gray-800">{brl(totalPaid)}</strong></span>
                        <span>·</span>
                        <span>Transferido: <strong className="text-gray-800">{brl(b.transferredToOwner)}</strong></span>
                        {b.transferPending && (
                          <>
                            <span>·</span>
                            <span className="text-amber-600 font-medium">Transferência pendente</span>
                          </>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
