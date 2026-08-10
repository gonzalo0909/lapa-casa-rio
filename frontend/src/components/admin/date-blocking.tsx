// lapa-casa-hostel/frontend/src/components/admin/date-blocking.tsx

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { api, handleAPIError } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

/**
 * DateBlocking
 *
 * Permite bloquear/desbloquear fechas por habitación para mantenimiento o eventos privados.
 *
 * API real (blocked-dates.routes.ts):
 *   GET  /admin/blocked-dates
 *     → {blocks: [{id, roomTypeId, roomName, startDate, endDate, blockType, reason, notes}]}
 *   POST /admin/blocked-dates
 *     ← {roomTypeId, startDate, endDate, blockType, reason?, notes?}
 *   DELETE /admin/blocked-dates/:id   (id = UUID del bloqueo, NO la fecha)
 *
 * @component
 */

interface RoomBlock {
  id: string;
  roomTypeId: string;
  roomName: string;
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
  blockType: string;
  reason: string | null;
  notes: string | null;
}

interface RoomType {
  id: string;
  name: string;
  type: string;
}

const BCP47: Record<string, string> = {
  pt: 'pt-BR', es: 'es-ES', en: 'en-US', fr: 'fr-FR', de: 'de-DE',
};

function formatDate(d: string, locale: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString(BCP47[locale] ?? 'en-US', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

/** Fecha mínima = mañana */
function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Fecha por defecto para endDate = overmorgen */
function dayAfterTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d.toISOString().slice(0, 10);
}

const BLOCK_TYPES = ['maintenance', 'owner', 'seasonal', 'other'] as const;
type BlockType = typeof BLOCK_TYPES[number];

const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  maintenance: '🔧 Manutenção',
  owner: '🏠 Reserva do proprietário',
  seasonal: '📅 Sazonalidade',
  other: '📝 Outro',
};

export function DateBlocking({ locale }: { locale: string }) {
  const t = useTranslations('admin');

  // State: lista de bloqueos
  const [blocks, setBlocks] = useState<RoomBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // State: rooms disponibles
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [roomsError, setRoomsError] = useState(false);

  // Formulario
  const [selectedRoomId, setSelectedRoomId] = useState<string>('all');
  const [startDate, setStartDate] = useState(tomorrow());
  const [endDate, setEndDate] = useState(dayAfterTomorrow());
  const [blockType, setBlockType] = useState<BlockType>('maintenance');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const token = useCallback(() => localStorage.getItem('token'), []);

  const loadRooms = useCallback(async () => {
    try {
      const res = await api.get('/rooms');
      const raw = (res.data?.rooms ?? []) as Array<{id: string; name: string; type: string}>;
      setRooms(raw.map((r) => ({ id: r.id, name: r.name, type: r.type })));
    } catch {
      setRoomsError(true);
    }
  }, []);

  const loadBlocks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/admin/blocked-dates', { token: token() ?? undefined });
      setBlocks(res.data?.blocks ?? []);
    } catch (err) {
      // El endpoint puede no tener datos aún en modo prueba — no es fatal
      setBlocks([]);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadRooms();
    loadBlocks();
  }, [loadRooms, loadBlocks]);

  // Si la fecha de inicio cambia y queda después del fin, ajusta el fin
  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (val >= endDate) {
      const next = new Date(val + 'T12:00:00');
      next.setDate(next.getDate() + 1);
      setEndDate(next.toISOString().slice(0, 10));
    }
  };

  const handleBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return;
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    const roomIds = selectedRoomId === 'all'
      ? rooms.map((r) => r.id)
      : [selectedRoomId];

    if (roomIds.length === 0) {
      setError('Nenhuma habitação disponível para bloquear.');
      setIsSubmitting(false);
      return;
    }

    try {
      await Promise.all(
        roomIds.map((roomTypeId) =>
          api.post(
            '/admin/blocked-dates',
            { roomTypeId, startDate, endDate, blockType, reason: reason || undefined, notes: notes || undefined },
            { token: token() ?? undefined }
          )
        )
      );

      const roomLabel = selectedRoomId === 'all'
        ? 'todas as habitações'
        : rooms.find((r) => r.id === selectedRoomId)?.name ?? selectedRoomId;

      setSuccess(`✓ Bloqueado: ${roomLabel} — ${formatDate(startDate, locale)} a ${formatDate(endDate, locale)}`);
      setReason('');
      setNotes('');
      await loadBlocks();
    } catch (err) {
      setError(handleAPIError(err, locale as any));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnblock = async (block: RoomBlock) => {
    const label = `${block.roomName}: ${formatDate(block.startDate, locale)} – ${formatDate(block.endDate, locale)}`;
    if (!confirm(`${t('unblockDate')}: ${label}?`)) return;
    setError(null);
    try {
      await api.delete(`/admin/blocked-dates/${block.id}`, { token: token() ?? undefined });
      await loadBlocks();
    } catch (err) {
      setError(handleAPIError(err, locale as any));
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">{t('blockDates')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('blockDatesDesc')}</p>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* Formulario de bloqueo */}
      <form
        onSubmit={handleBlock}
        className="bg-card border border-border rounded-xl p-5 space-y-4"
      >
        <h3 className="font-semibold text-foreground">🔒 {t('blockDate')}</h3>

        {roomsError && (
          <p className="text-xs text-destructive">
            Não foi possível carregar as habitações. Verifique a autenticação.
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Habitação */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-foreground mb-1">
              Habitação
            </label>
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">🏠 Todas as habitações</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Data início */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Data início
            </label>
            <input
              type="date"
              value={startDate}
              min={tomorrow()}
              onChange={(e) => handleStartDateChange(e.target.value)}
              required
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Data fim */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Data fim
            </label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Tipo de bloqueio */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t('reason')}
            </label>
            <select
              value={blockType}
              onChange={(e) => setBlockType(e.target.value as BlockType)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {BLOCK_TYPES.map((bt) => (
                <option key={bt} value={bt}>{BLOCK_TYPE_LABELS[bt]}</option>
              ))}
            </select>
          </div>

          {/* Motivo libre */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Descrição (opcional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Reforma do banheiro..."
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !startDate || !endDate}
          className="px-5 py-2 bg-destructive text-destructive-foreground font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity text-sm"
        >
          {isSubmitting
            ? '...'
            : selectedRoomId === 'all'
            ? `🔒 Bloquear todas as habitações`
            : `🔒 ${t('blockDate')}`}
        </button>
      </form>

      {/* Lista de bloqueos */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-foreground mb-3">
          {t('blockedDates')} ({blocks.length})
        </h3>

        {blocks.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('noBlockedDates')}</p>
        ) : (
          <div className="space-y-2">
            {[...blocks]
              .sort((a, b) => a.startDate.localeCompare(b.startDate))
              .map((block) => (
                <div
                  key={block.id}
                  className="flex items-start justify-between py-2 border-b border-border last:border-0 gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground text-sm truncate">
                      {block.roomName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(block.startDate, locale)} → {formatDate(block.endDate, locale)}
                    </p>
                    {(block.reason || block.blockType) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {BLOCK_TYPE_LABELS[block.blockType as BlockType] ?? block.blockType}
                        {block.reason ? ` — ${block.reason}` : ''}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleUnblock(block)}
                    className="text-xs text-destructive hover:underline shrink-0"
                  >
                    {t('unblockDate')}
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
