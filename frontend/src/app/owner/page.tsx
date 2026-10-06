'use client';

//
// Painel principal: lista os apartamentos do dono logado
// (GET /owner/apartments -- já filtrado por ownerId no backend).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useOwnerAuth } from '@/lib/use-owner-auth';
import { ownerApartmentsAPI, type Apartment } from '@/lib/owner-api';
import { handleAPIError } from '@/lib/api';
import { OwnerNav } from '@/components/owner/owner-nav';

export default function OwnerDashboardPage() {
  const { profile, loading: authLoading } = useOwnerAuth();
  const [apartments, setApartments] = useState<Apartment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCapacity, setNewCapacity] = useState('2');
  const [newPrice, setNewPrice] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await ownerApartmentsAPI.create({
        name: newName.trim(),
        capacity: parseInt(newCapacity, 10),
        base_price: parseFloat(newPrice),
      });
      router.push(`/owner/apartments/${res.data.id}`);
    } catch (err) {
      setError(handleAPIError(err, 'pt'));
      setCreating(false);
    }
  };

  useEffect(() => {
    if (!profile) {return;}
    ownerApartmentsAPI
      .list()
      .then((res) => setApartments(res.data.apartments))
      .catch((err) => setError(handleAPIError(err, 'pt')));
  }, [profile]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" text="Carregando..." />
      </div>
    );
  }

  if (!profile) {return null;}

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <OwnerNav fullName={profile.fullName} />
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Olá, {profile.fullName}</h1>
          <p className="text-sm text-gray-500">{profile.email}</p>
        </div>
      </div>

      {error && (
        <Alert variant="danger" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!apartments && !error && (
        <LoadingSpinner centered text="Carregando apartamentos..." />
      )}

      {apartments && apartments.length === 0 && (
        <Alert variant="info">
          <AlertDescription>
            Nenhum apartamento vinculado à sua conta ainda.
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-4">
        {!showNew ? (
          <Button type="button" variant="outline" onClick={() => setShowNew(true)}>
            + Adicionar apartamento
          </Button>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle size="sm">Novo apartamento</CardTitle>
              <CardDescription>
                Depois de criar, complete fotos e dados e envie para análise. O apartamento só aparece no site após ser aprovado.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleCreate} className="flex flex-col gap-3 px-6 pb-6">
              <Input label="Nome do apartamento" value={newName} onChange={(e) => setNewName(e.target.value)} required />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Capacidade (hóspedes)" type="number" min={1} max={20} value={newCapacity} onChange={(e) => setNewCapacity(e.target.value)} required />
                <Input label="Preço base por noite (R$)" type="number" min={1} step="0.01" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} required />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={creating || !newName.trim() || !newPrice}>
                  {creating ? 'Criando...' : 'Criar e continuar'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowNew(false)} disabled={creating}>
                  Cancelar
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {apartments?.map((apt) => (
          <Card key={apt.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle size="sm">{apt.name}</CardTitle>
                  <CardDescription>
                    {apt.code} · {apt.capacity} hóspedes
                    {apt.neighborhood ? ` · ${apt.neighborhood}` : ''}
                  </CardDescription>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link
                    href={`/owner/apartments/${apt.id}/bookings`}
                    className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Reservas
                  </Link>
                  <Link
                    href={`/owner/apartments/${apt.id}`}
                    className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                  >
                    Editar
                  </Link>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
