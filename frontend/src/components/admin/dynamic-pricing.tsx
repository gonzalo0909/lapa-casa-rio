// lapa-casa-hostel/frontend/src/components/admin/dynamic-pricing.tsx
// Panel de precios dinámicos para el admin.
// Permite editar la configuración del bot, gestionar eventos de precios,
// ver el calendario de precios calculados y consultar eventos en Río.

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface DPConfig {
  occ_tier_low_pct: number;
  occ_tier_mid_pct: number;
  occ_tier_high_pct: number;
  occ_tier_vhigh_pct: number;
  occ_adj_low: number;
  occ_adj_mid: number;
  occ_adj_high: number;
  occ_adj_vhigh: number;
  occ_adj_max: number;
  prox_tier_far: number;
  prox_tier_mid: number;
  prox_tier_near: number;
  prox_tier_close: number;
  prox_adj_far: number;
  prox_adj_mid: number;
  prox_adj_near: number;
  prox_adj_close: number;
  prox_adj_lastmin: number;
  dow_adj_weekday: number;
  dow_adj_weekend: number;
  price_min_brl: number;
  price_max_brl: number;
  horizon_days: number;
}

interface PricingEvent {
  id: string;
  name: string;
  date_from: string;
  date_to: string;
  adjustment_pct: number;
  applies_to: 'all' | 'hostel' | 'apartment';
  is_active: boolean;
  notes?: string;
}

interface PriceCacheEntry {
  target_date: string;
  property_type: 'hostel' | 'apartment';
  base_price: number;
  final_price: number;
  occ_factor: number;
  prox_factor: number;
  dow_factor: number;
  event_factor: number;
  event_name?: string;
  occupancy_pct?: number;
}

interface RioEvent {
  name: string;
  date: string;
  venue?: string;
  url?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtBRL = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

const pct = (n: number) =>
  `${n >= 0 ? '+' : ''}${Number(n).toFixed(1)}%`;

// ── Sub-paneles ────────────────────────────────────────────────────────────────

type Section = 'config' | 'events' | 'calendar' | 'rio';

// ── Componente principal ──────────────────────────────────────────────────────

export function DynamicPricing() {
  const [section, setSection] = useState<Section>('config');
  const [config, setConfig] = useState<DPConfig | null>(null);
  const [events, setEvents] = useState<PricingEvent[]>([]);
  const [calendar, setCalendar] = useState<PriceCacheEntry[]>([]);
  const [rioEvents, setRioEvents] = useState<RioEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [runResult, setRunResult] = useState<{ processed: number; errors: number } | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Carga inicial ────────────────────────────────────────────────────────

  const loadConfig = useCallback(async () => {
    const res = await api.get('/admin/dynamic-pricing/config');
    setConfig(res.data as DPConfig);
  }, []);

  const loadEvents = useCallback(async () => {
    const res = await api.get('/admin/dynamic-pricing/events');
    setEvents(res.data as PricingEvent[]);
  }, []);

  const loadCalendar = useCallback(async () => {
    const res = await api.get('/admin/dynamic-pricing/calendar?days=90');
    setCalendar(res.data as PriceCacheEntry[]);
  }, []);

  const loadRioEvents = useCallback(async () => {
    const res = await api.get('/admin/dynamic-pricing/rio-events');
    setRioEvents(res.data as RioEvent[]);
  }, []);

  useEffect(() => {
    loadConfig().catch(() => {});
    loadEvents().catch(() => {});
  }, [loadConfig, loadEvents]);

  useEffect(() => {
    if (section === 'calendar') loadCalendar().catch(() => {});
    if (section === 'rio') loadRioEvents().catch(() => {});
  }, [section, loadCalendar, loadRioEvents]);

  // ── Guardar config ───────────────────────────────────────────────────────

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setLoading(true); setSaveMsg(null); setErrorMsg(null);
    try {
      await api.put('/admin/dynamic-pricing/config', config);
      setSaveMsg('Configuración guardada ✓');
    } catch {
      setErrorMsg('Error al guardar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const setField = (key: keyof DPConfig, val: number) =>
    setConfig(c => c ? { ...c, [key]: val } : c);

  // ── Ejecutar bot ─────────────────────────────────────────────────────────

  const handleRunBot = async () => {
    setLoading(true); setRunResult(null); setErrorMsg(null);
    try {
      const res = await api.post('/admin/dynamic-pricing/run', {});
      setRunResult(res.data as { processed: number; errors: number });
      await loadCalendar();
    } catch {
      setErrorMsg('Error al ejecutar el bot');
    } finally {
      setLoading(false);
    }
  };

  // ── Secciones ────────────────────────────────────────────────────────────

  const sections: { id: Section; label: string; icon: string }[] = [
    { id: 'config', label: 'Reglas del bot', icon: '⚙️' },
    { id: 'events', label: 'Eventos', icon: '🎉' },
    { id: 'calendar', label: 'Calendario', icon: '📅' },
    { id: 'rio', label: 'Radar Río', icon: '🌊' },
  ];

  return (
    <div className="space-y-6">
      {/* Header con botón ejecutar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Precios Dinámicos</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Bot nightly 02:00 UTC · hostel y apartamentos
          </p>
        </div>
        <button
          onClick={handleRunBot}
          disabled={loading}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? 'Calculando...' : '▶ Ejecutar bot ahora'}
        </button>
      </div>

      {/* Resultado del bot */}
      {runResult && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 text-sm text-green-800 dark:text-green-300">
          ✓ Bot completado — {runResult.processed} fechas calculadas
          {runResult.errors > 0 && `, ${runResult.errors} errores`}
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
          {errorMsg}
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-xl overflow-x-auto">
        {sections.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              section === id
                ? 'bg-card shadow text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ── Config ─────────────────────────────────────────────────────── */}
      {section === 'config' && config && (
        <form onSubmit={handleSaveConfig} className="space-y-6">

          {saveMsg && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 text-sm text-green-700 dark:text-green-300">
              {saveMsg}
            </div>
          )}

          {/* Ocupación */}
          <ConfigCard title="Ajuste por ocupación" description="Qué % de ajuste aplicar según cuántas camas están reservadas">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {([
                ['< Bajo', 'occ_tier_low_pct', 'occ_adj_low'],
                ['< Medio', 'occ_tier_mid_pct', 'occ_adj_mid'],
                ['< Alto', 'occ_tier_high_pct', 'occ_adj_high'],
                ['< Muy alto', 'occ_tier_vhigh_pct', 'occ_adj_vhigh'],
              ] as [string, keyof DPConfig, keyof DPConfig][]).map(([label, tierKey, adjKey]) => (
                <div key={label} className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
                  <NumField label="Límite (%)" value={config[tierKey] as number} onChange={v => setField(tierKey, v)} />
                  <NumField label="Ajuste (%)" value={config[adjKey] as number} onChange={v => setField(adjKey, v)} signed />
                </div>
              ))}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">≥ Máx</p>
                <NumField label="Ajuste (%)" value={config.occ_adj_max} onChange={v => setField('occ_adj_max', v)} signed />
              </div>
            </div>
          </ConfigCard>

          {/* Proximidad */}
          <ConfigCard title="Ajuste por proximidad" description="Early-bird descuenta, last-minute sube precio">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {([
                ['> Lejano', 'prox_tier_far', 'prox_adj_far'],
                ['> Medio', 'prox_tier_mid', 'prox_adj_mid'],
                ['> Cercano', 'prox_tier_near', 'prox_adj_near'],
                ['> Próximo', 'prox_tier_close', 'prox_adj_close'],
              ] as [string, keyof DPConfig, keyof DPConfig][]).map(([label, tierKey, adjKey]) => (
                <div key={label} className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
                  <NumField label="Días" value={config[tierKey] as number} onChange={v => setField(tierKey, v)} />
                  <NumField label="Ajuste (%)" value={config[adjKey] as number} onChange={v => setField(adjKey, v)} signed />
                </div>
              ))}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Last-min</p>
                <NumField label="Ajuste (%)" value={config.prox_adj_lastmin} onChange={v => setField('prox_adj_lastmin', v)} signed />
              </div>
            </div>
          </ConfigCard>

          {/* Día de semana */}
          <ConfigCard title="Ajuste por día de semana" description="Viernes, sábado y domingo son fin de semana">
            <div className="grid grid-cols-2 gap-4 max-w-xs">
              <NumField label="Lun–Jue (%)" value={config.dow_adj_weekday} onChange={v => setField('dow_adj_weekday', v)} signed />
              <NumField label="Vie–Dom (%)" value={config.dow_adj_weekend} onChange={v => setField('dow_adj_weekend', v)} signed />
            </div>
          </ConfigCard>

          {/* Límites y horizonte */}
          <ConfigCard title="Límites de precio y horizonte" description="El precio final se clampea entre mínimo y máximo">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-lg">
              <NumField label="Mínimo (R$)" value={config.price_min_brl} onChange={v => setField('price_min_brl', v)} />
              <NumField label="Máximo (R$)" value={config.price_max_brl} onChange={v => setField('price_max_brl', v)} />
              <NumField label="Horizonte (días)" value={config.horizon_days} onChange={v => setField('horizon_days', v)} />
            </div>
          </ConfigCard>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? 'Guardando...' : 'Guardar configuración'}
            </button>
          </div>
        </form>
      )}

      {/* ── Eventos ────────────────────────────────────────────────────────── */}
      {section === 'events' && (
        <EventsPanel events={events} onRefresh={loadEvents} />
      )}

      {/* ── Calendario ─────────────────────────────────────────────────────── */}
      {section === 'calendar' && (
        <CalendarPanel calendar={calendar} onRefresh={() => { loadCalendar().catch(() => {}); }} />
      )}

      {/* ── Radar Río ──────────────────────────────────────────────────────── */}
      {section === 'rio' && (
        <RioPanel events={rioEvents} onRefresh={() => { loadRioEvents().catch(() => {}); }} />
      )}
    </div>
  );
}

// ── ConfigCard ────────────────────────────────────────────────────────────────

function ConfigCard({ title, description, children }: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      {children}
    </div>
  );
}

// ── NumField ──────────────────────────────────────────────────────────────────

function NumField({ label, value, onChange, signed }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  signed?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      <input
        type="number"
        value={value}
        step={signed ? '0.01' : '1'}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

// ── EventsPanel ───────────────────────────────────────────────────────────────

function EventsPanel({ events, onRefresh }: {
  events: PricingEvent[];
  onRefresh: () => void;
}) {
  const emptyForm = {
    name: '', date_from: '', date_to: '',
    adjustment_pct: 0, applies_to: 'all' as 'all' | 'hostel' | 'apartment',
    is_active: true, notes: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      if (editing) {
        await api.put(`/admin/dynamic-pricing/events/${editing}`, form);
      } else {
        await api.post('/admin/dynamic-pricing/events', form);
      }
      setForm(emptyForm);
      setEditing(null);
      onRefresh();
    } catch {
      setError('Error al guardar el evento');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (ev: PricingEvent) => {
    setEditing(ev.id);
    setForm({
      name: ev.name,
      date_from: ev.date_from,
      date_to: ev.date_to,
      adjustment_pct: ev.adjustment_pct,
      applies_to: ev.applies_to,
      is_active: ev.is_active,
      notes: ev.notes ?? '',
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este evento?')) return;
    setLoading(true);
    try {
      await api.delete(`/admin/dynamic-pricing/events/${id}`);
      onRefresh();
    } catch {
      setError('Error al eliminar el evento');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (ev: PricingEvent) => {
    setLoading(true);
    try {
      await api.put(`/admin/dynamic-pricing/events/${ev.id}`, { ...ev, is_active: !ev.is_active });
      onRefresh();
    } catch {
      setError('Error al cambiar el estado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Formulario */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-foreground">
          {editing ? 'Editar evento' : 'Nuevo evento de precio'}
        </h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Nombre del evento</label>
              <input
                type="text"
                required
                placeholder="Ej: Rock in Rio 2027"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Desde</label>
                <input
                  type="date"
                  required
                  value={form.date_from}
                  onChange={e => setForm(f => ({ ...f, date_from: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Hasta</label>
                <input
                  type="date"
                  required
                  value={form.date_to}
                  onChange={e => setForm(f => ({ ...f, date_to: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Ajuste de precio (%)</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="Ej: 50 = +50%, -10 = descuento"
                value={form.adjustment_pct}
                onChange={e => setForm(f => ({ ...f, adjustment_pct: parseFloat(e.target.value) || 0 }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Aplica a</label>
              <select
                value={form.applies_to}
                onChange={e => setForm(f => ({ ...f, applies_to: e.target.value as any }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">Todo (hostel + apartamentos)</option>
                <option value="hostel">Solo hostel</option>
                <option value="apartment">Solo apartamentos</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">Notas (opcional)</label>
              <input
                type="text"
                placeholder="Ej: Confirmar fechas oficiales"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? 'Guardando...' : editing ? 'Actualizar' : 'Crear evento'}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => { setEditing(null); setForm(emptyForm); }}
                className="px-5 py-2 border border-border text-sm rounded-lg hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Lista de eventos */}
      <div className="space-y-3">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No hay eventos configurados</p>
        ) : events.map(ev => (
          <div
            key={ev.id}
            className={`bg-card border rounded-xl p-4 flex items-start justify-between gap-4 ${
              ev.is_active ? 'border-border' : 'border-border opacity-50'
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-foreground truncate">{ev.name}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  ev.adjustment_pct > 0
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                }`}>
                  {pct(ev.adjustment_pct)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {ev.date_from} → {ev.date_to} · {ev.applies_to === 'all' ? 'hostel + aptos' : ev.applies_to}
              </p>
              {ev.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{ev.notes}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleToggle(ev)}
                disabled={loading}
                className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                  ev.is_active
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {ev.is_active ? 'Activo' : 'Inactivo'}
              </button>
              <button
                onClick={() => handleEdit(ev)}
                className="text-xs px-2 py-1 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                Editar
              </button>
              <button
                onClick={() => handleDelete(ev.id)}
                disabled={loading}
                className="text-xs px-2 py-1 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CalendarPanel ─────────────────────────────────────────────────────────────

function CalendarPanel({ calendar, onRefresh }: {
  calendar: PriceCacheEntry[];
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState<'all' | 'hostel' | 'apartment'>('all');

  const filtered = filter === 'all' ? calendar : calendar.filter(e => e.property_type === filter);

  // Agrupar por fecha para mostrar hostel y apartamento juntos
  const byDate = filtered.reduce<Record<string, PriceCacheEntry[]>>((acc, e) => {
    acc[e.target_date] = [...(acc[e.target_date] ?? []), e];
    return acc;
  }, {});

  const dates = Object.keys(byDate).sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-muted p-1 rounded-lg">
          {(['all', 'hostel', 'apartment'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                filter === f ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'hostel' ? 'Hostel' : 'Apartamentos'}
            </button>
          ))}
        </div>
        <button
          onClick={onRefresh}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ↺ Actualizar
        </button>
        {calendar.length === 0 && (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            Sin datos — ejecuta el bot primero
          </span>
        )}
      </div>

      {dates.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No hay precios calculados para el período
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2.5 pr-4 font-semibold text-foreground">Fecha</th>
                <th className="text-left py-2.5 pr-4 font-semibold text-foreground">Tipo</th>
                <th className="text-right py-2.5 pr-4 font-semibold text-foreground">Base</th>
                <th className="text-right py-2.5 pr-4 font-semibold text-foreground">Final</th>
                <th className="text-right py-2.5 pr-4 font-semibold text-foreground">Ocup.</th>
                <th className="text-right py-2.5 pr-4 font-semibold text-foreground">f.Ocup</th>
                <th className="text-right py-2.5 pr-4 font-semibold text-foreground">f.Prox</th>
                <th className="text-right py-2.5 pr-4 font-semibold text-foreground">f.DoW</th>
                <th className="text-left py-2.5 font-semibold text-foreground">Evento</th>
              </tr>
            </thead>
            <tbody>
              {dates.map(date =>
                byDate[date].map(e => (
                  <tr key={`${date}-${e.property_type}`} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-2 pr-4 text-foreground font-mono text-xs">{date}</td>
                    <td className="py-2 pr-4">
                      <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${
                        e.property_type === 'hostel'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      }`}>
                        {e.property_type === 'hostel' ? 'Hostel' : 'Apto'}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right text-muted-foreground">{fmtBRL(e.base_price)}</td>
                    <td className="py-2 pr-4 text-right font-bold text-foreground">{fmtBRL(e.final_price)}</td>
                    <td className="py-2 pr-4 text-right text-muted-foreground">
                      {e.occupancy_pct != null ? `${e.occupancy_pct}%` : '—'}
                    </td>
                    <td className="py-2 pr-4 text-right text-xs text-muted-foreground">{Number(e.occ_factor).toFixed(3)}</td>
                    <td className="py-2 pr-4 text-right text-xs text-muted-foreground">{Number(e.prox_factor).toFixed(3)}</td>
                    <td className="py-2 pr-4 text-right text-xs text-muted-foreground">{Number(e.dow_factor).toFixed(3)}</td>
                    <td className="py-2 text-xs text-muted-foreground">{e.event_name ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── RioPanel ──────────────────────────────────────────────────────────────────

function RioPanel({ events, onRefresh }: {
  events: RioEvent[];
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Radar de eventos en Río</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Vía Sympla API · fallback a lista curada si la API no responde
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 border border-border rounded-lg"
        >
          ↺ Actualizar
        </button>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Cargando eventos...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {events.map((ev, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-foreground text-sm leading-snug">{ev.name}</p>
                {ev.url && (
                  <a
                    href={ev.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline shrink-0"
                  >
                    Ver →
                  </a>
                )}
              </div>
              <p className="text-xs text-muted-foreground">📅 {ev.date}</p>
              {ev.venue && <p className="text-xs text-muted-foreground">📍 {ev.venue}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
        <p className="font-semibold mb-1">💡 ¿Ves un evento relevante?</p>
        <p className="text-xs">
          Ve a la pestaña <strong>Eventos</strong> y créalo manualmente con el ajuste de precio que corresponda.
          El bot lo aplicará en el próximo cálculo.
        </p>
      </div>
    </div>
  );
}
