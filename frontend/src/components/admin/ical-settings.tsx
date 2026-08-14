// lapa-casa-hostel/frontend/src/components/admin/ical-settings.tsx
//
// Reescrito contra el backend real (ventana 5).
// Correcciones respecto a la versión anterior:
//   - URL prefix /api/admin/ical/ → /api/v1/ical/
//   - Cuerpo de POST usa {channelCode, roomTypeId, url} (no "name"/"platform")
//   - Acceso a respuesta: response.data.feeds (no response.feeds)
//   - Rooms de /api/v1/rooms → response.data.rooms
//   - Sin endpoint de sync por feed — solo sync global POST /api/v1/ical/sync
//   - Sin endpoint /settings — el ciclo de sync (5 min) es fijo en BullMQ
//   - Plataformas: airbnb, hostelworld, booking, expedia (sin vrbo/custom)
//   - Export URL: /api/v1/ical/export/:roomTypeId

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, Trash2, RefreshCw, Download, Calendar, CheckCircle, AlertTriangle } from 'lucide-react';

// ─── Tipos internos ────────────────────────────────────────────────────────────

type ChannelCode = 'airbnb' | 'hostelworld' | 'booking' | 'expedia';

interface IcalFeedConfig {
  id: string;
  channelCode: ChannelCode;
  channelId: string;
  roomTypeId: string;
  url: string;
  isActive: boolean;
  createdAt: string;
}

interface Room {
  id: string;
  name: string;
  type: string;
  capacity: number;
  isFlexible: boolean;
}

interface SyncResult {
  totalFeeds: number;
  successfulFeeds: number;
  failedFeeds: number;
  totalImported: number;
  totalCancelled: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const PLATFORM_LABELS: Record<ChannelCode, string> = {
  airbnb:      'Airbnb',
  hostelworld: 'Hostelworld',
  booking:     'Booking.com',
  expedia:     'Expedia',
};

const PLATFORM_COLORS: Record<ChannelCode, string> = {
  airbnb:      'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  hostelworld: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  booking:     'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  expedia:     'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
};

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(options?.headers ?? {}) },
  });
  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new Error(body.error ?? body.message ?? `Error ${res.status}`);
  }
  return body.data as T;
}

// ─── Componente principal ──────────────────────────────────────────────────────

export default function ICalSettings() {
  const [feeds, setFeeds]       = useState<IcalFeedConfig[]>([]);
  const [rooms, setRooms]       = useState<Room[]>([]);
  const [loading, setLoading]   = useState(true);
  const [syncing, setSyncing]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'feeds' | 'export' | 'info'>('feeds');

  const [newFeed, setNewFeed] = useState({
    channelCode: 'airbnb' as ChannelCode,
    roomTypeId: '',
    url: '',
  });

  // ── Carga inicial ──

  const loadFeeds = useCallback(async () => {
    try {
      const data = await apiFetch<{ feeds: IcalFeedConfig[] }>('/api/v1/ical/feeds');
      setFeeds(data.feeds ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar feeds');
    }
  }, []);

  const loadRooms = useCallback(async () => {
    try {
      // /api/v1/rooms es público — no requiere token
      const data = await apiFetch<{ rooms: Room[] }>('/api/v1/rooms');
      setRooms(data.rooms ?? []);
    } catch {
      // Si no carga, el select estará vacío — no es bloqueante
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadFeeds(), loadRooms()]);
      setLoading(false);
    })();
  }, [loadFeeds, loadRooms]);

  // ── Acciones ──

  const addFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeed.roomTypeId || !newFeed.url) {
      setError('Seleccioná un cuarto y pegá la URL del feed');
      return;
    }
    try { new URL(newFeed.url); } catch {
      setError('La URL no es válida');
      return;
    }
    try {
      setError(null); setSuccess(null);
      await apiFetch('/api/v1/ical/import/config', {
        method: 'POST',
        body: JSON.stringify(newFeed),
      });
      setSuccess('Feed agregado');
      setNewFeed({ channelCode: 'airbnb', roomTypeId: '', url: '' });
      await loadFeeds();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al agregar feed');
    }
  };

  const removeFeed = async (feedId: string) => {
    if (!confirm('¿Eliminar este feed?')) return;
    try {
      setError(null);
      await apiFetch(`/api/v1/ical/feeds/${feedId}`, { method: 'DELETE' });
      setSuccess('Feed eliminado');
      await loadFeeds();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const toggleFeed = async (feedId: string, isActive: boolean) => {
    try {
      setError(null);
      await apiFetch(`/api/v1/ical/feeds/${feedId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      });
      setFeeds(prev => prev.map(f => f.id === feedId ? { ...f, isActive } : f));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar');
    }
  };

  // Sync global — el backend no tiene endpoint de sync por feed individual
  const syncAll = async () => {
    try {
      setSyncing(true); setError(null); setSuccess(null);
      const result = await apiFetch<SyncResult>('/api/v1/ical/sync', { method: 'POST' });
      setSuccess(
        `Sync completo: ${result.totalImported} reservas importadas, ` +
        `${result.totalCancelled} canceladas (${result.successfulFeeds}/${result.totalFeeds} feeds OK)`
      );
      await loadFeeds();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al sincronizar');
    } finally {
      setSyncing(false);
    }
  };

  const copyExportUrl = async (roomTypeId: string) => {
    const url = `${window.location.origin}/api/v1/ical/export/${roomTypeId}`;
    try {
      await navigator.clipboard.writeText(url);
      setSuccess('URL copiada al portapapeles');
    } catch {
      setError('No se pudo copiar la URL');
    }
  };

  // ── Stats ──

  const totalFeeds  = feeds.length;
  const activeFeeds = feeds.filter(f => f.isActive).length;

  // ── Helpers de UI ──

  const roomName = (roomTypeId: string) =>
    rooms.find(r => r.id === roomTypeId)?.name ?? roomTypeId.slice(0, 8) + '…';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">iCal</h2>
          <p className="text-sm text-muted-foreground">
            Sync automático cada 5 min · {activeFeeds}/{totalFeeds} feeds activos
          </p>
        </div>
        <button
          onClick={syncAll}
          disabled={syncing || totalFeeds === 0}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sync manual
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex gap-2 items-start p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex gap-2 items-start p-3 rounded-lg bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 text-sm border border-green-200 dark:border-green-800">
          <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Stat pills */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Feeds totales',  value: totalFeeds,  icon: Calendar },
          { label: 'Feeds activos',  value: activeFeeds, icon: CheckCircle },
          { label: 'Ciclo de sync',  value: '5 min',     icon: RefreshCw },
          { label: 'Habitaciones',   value: rooms.length, icon: Download },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">{label}</span>
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-xl overflow-x-auto">
        {([
          { id: 'feeds',  label: 'Import feeds' },
          { id: 'export', label: 'Exportar calendarios' },
          { id: 'info',   label: 'Info del sistema' },
        ] as const).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === id ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Import feeds ── */}
      {activeTab === 'feeds' && (
        <div className="space-y-6">

          {/* Add feed form */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-semibold mb-4">Agregar feed</h3>
            <form onSubmit={addFeed} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Plataforma</label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={newFeed.channelCode}
                    onChange={e => setNewFeed({ ...newFeed, channelCode: e.target.value as ChannelCode })}
                  >
                    {(Object.entries(PLATFORM_LABELS) as [ChannelCode, string][]).map(([code, label]) => (
                      <option key={code} value={code}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Habitación *</label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={newFeed.roomTypeId}
                    onChange={e => setNewFeed({ ...newFeed, roomTypeId: e.target.value })}
                    required
                  >
                    <option value="">Seleccionar habitación</option>
                    {rooms.map(room => (
                      <option key={room.id} value={room.id}>
                        {room.name} ({room.isFlexible ? 'flexible' : room.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-sm font-medium">URL del feed iCal *</label>
                  <input
                    type="url"
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="https://www.airbnb.com/calendar/ical/..."
                    value={newFeed.url}
                    onChange={e => setNewFeed({ ...newFeed, url: e.target.value })}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Pegá la URL de exportación iCal desde la plataforma OTA
                  </p>
                </div>
              </div>

              <button
                type="submit"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                <Plus className="h-4 w-4" />
                Agregar feed
              </button>
            </form>
          </div>

          {/* Feed list */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-semibold">Feeds configurados</h3>
            </div>
            {feeds.length === 0 ? (
              <div className="px-5 py-10 text-center text-muted-foreground text-sm">
                No hay feeds configurados. Agregá el primero arriba.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {feeds.map(feed => (
                  <li key={feed.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded ${PLATFORM_COLORS[feed.channelCode]}`}>
                          {PLATFORM_LABELS[feed.channelCode]}
                        </span>
                        <span className="text-sm font-medium text-foreground">
                          {roomName(feed.roomTypeId)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate max-w-[380px]">{feed.url}</p>
                      <p className="text-xs text-muted-foreground">
                        Creado: {new Date(feed.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Toggle activo/inactivo */}
                      <button
                        onClick={() => toggleFeed(feed.id, !feed.isActive)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          feed.isActive ? 'bg-primary' : 'bg-muted-foreground/30'
                        }`}
                        aria-label={feed.isActive ? 'Desactivar feed' : 'Activar feed'}
                      >
                        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                          feed.isActive ? 'translate-x-4' : 'translate-x-0.5'
                        }`} />
                      </button>
                      <span className="text-xs text-muted-foreground w-14">
                        {feed.isActive ? 'Activo' : 'Inactivo'}
                      </span>

                      <button
                        onClick={() => removeFeed(feed.id)}
                        className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        aria-label="Eliminar feed"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Exportar calendarios ── */}
      {activeTab === 'export' && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-semibold">Exportar calendarios</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Compartí estas URLs con las plataformas OTA para que importen tu disponibilidad
            </p>
          </div>
          {rooms.length === 0 ? (
            <div className="px-5 py-10 text-center text-muted-foreground text-sm">
              Sin habitaciones cargadas
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {rooms.map(room => {
                const url = `/api/v1/ical/export/${room.id}`;
                return (
                  <li key={room.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{room.name}</p>
                      <p className="text-xs text-muted-foreground mb-1">
                        {room.isFlexible ? 'flexible' : room.type} · {room.capacity} camas
                      </p>
                      <code className="text-xs bg-muted px-2 py-1 rounded block truncate">
                        {typeof window !== 'undefined' ? window.location.origin : ''}
                        {url}
                      </code>
                    </div>
                    <button
                      onClick={() => copyExportUrl(room.id)}
                      className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Copiar URL
                    </button>
                  </li>
                );
              })}
              <li className="px-5 py-4">
                <p className="text-sm font-medium mb-1">Feed combinado (todas las habitaciones)</p>
                <code className="text-xs bg-muted px-2 py-1 rounded block truncate">
                  {typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/ical/export
                </code>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/api/v1/ical/export`;
                    navigator.clipboard.writeText(url).then(() => setSuccess('URL copiada al portapapeles'));
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Copiar URL combinada
                </button>
              </li>
            </ul>
          )}
        </div>
      )}

      {/* ── Tab: Info del sistema ── */}
      {activeTab === 'info' && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <h3 className="font-semibold">Configuración del sync automático</h3>
            <p className="text-sm text-muted-foreground">
              El ciclo de sincronización es controlado por el worker BullMQ en el backend.
              No se puede cambiar desde la interfaz — requiere editar la configuración del servidor.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Intervalo de sync', value: 'Cada 5 minutos' },
                { label: 'Worker', value: 'ota-sync (BullMQ)' },
                { label: 'Canales iCal', value: 'Airbnb, Hostelworld' },
                { label: 'Canales webhook', value: 'Booking.com, Expedia' },
                { label: 'Anti-overbooking', value: 'Activo (4 capas)' },
                { label: 'Deduplicación', value: 'Por external_reservation_id + channel_id' },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                  <p className="text-sm font-medium">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-5 space-y-3">
            <h3 className="font-semibold">Flujo de cancelación por diff</h3>
            <p className="text-sm text-muted-foreground">
              Cuando una reserva desaparece del feed iCal (el huésped canceló en Airbnb o Hostelworld),
              el sistema la detecta en el próximo ciclo y la cancela automáticamente.
              Esta es la única forma de recibir cancelaciones de estos canales
              — no tienen API de webhooks.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
