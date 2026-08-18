// lapa-casa-hostel/frontend/src/components/admin/apartment-offers.tsx
//
// Panel de gestión de ofertas y descuentos para apartamentos.
// CRUD completo sobre GET/POST/PUT/DELETE /admin/offers.

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { api, handleAPIError } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface Offer {
  id: string;
  code: string;
  label: string;
  discount_percent: number;
  apartment_ids: string[] | null;
  valid_from: string | null;
  valid_to: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface OfferFormState {
  code: string;
  label: string;
  discountPercent: string;
  validFrom: string;
  validTo: string;
  isActive: boolean;
}

const EMPTY_FORM: OfferFormState = {
  code: '',
  label: '',
  discountPercent: '',
  validFrom: '',
  validTo: '',
  isActive: true,
};

interface ApartmentOffersProps {
  locale: string;
}

export function ApartmentOffers({ locale }: ApartmentOffersProps) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<OfferFormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const flash = (msg: string, type: 'success' | 'error') => {
    if (type === 'success') { setSuccess(msg); setError(null); }
    else { setError(msg); setSuccess(null); }
    setTimeout(() => { setSuccess(null); setError(null); }, 4000);
  };

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/admin/offers');
      setOffers(res.data ?? []);
    } catch (err) {
      setError(handleAPIError(err, locale as any));
    } finally {
      setIsLoading(false);
    }
  }, [locale]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (offer: Offer) => {
    setEditingId(offer.id);
    setForm({
      code: offer.code,
      label: offer.label,
      discountPercent: String(offer.discount_percent),
      validFrom: offer.valid_from ?? '',
      validTo: offer.valid_to ?? '',
      isActive: offer.is_active,
    });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pct = parseFloat(form.discountPercent);
    if (!form.code.trim() || !form.label.trim()) {
      flash('Código y nombre son obligatorios', 'error');
      return;
    }
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      flash('El descuento debe ser un número entre 1 y 100', 'error');
      return;
    }

    const payload = {
      code: form.code.trim(),
      label: form.label.trim(),
      discountPercent: pct,
      validFrom: form.validFrom || null,
      validTo: form.validTo || null,
      isActive: form.isActive,
    };

    setIsSaving(true);
    try {
      if (editingId) {
        await api.put(`/admin/offers/${editingId}`, payload);
        flash('Oferta actualizada ✓', 'success');
      } else {
        await api.post('/admin/offers', payload);
        flash('Oferta creada ✓', 'success');
      }
      cancelForm();
      await load();
    } catch (err) {
      flash(handleAPIError(err, locale as any), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (offer: Offer) => {
    try {
      await api.put(`/admin/offers/${offer.id}`, { isActive: !offer.is_active });
      flash(`Oferta ${!offer.is_active ? 'activada' : 'desactivada'}`, 'success');
      await load();
    } catch (err) {
      flash(handleAPIError(err, locale as any), 'error');
    }
  };

  const handleDelete = async (offer: Offer) => {
    if (!confirm(`¿Eliminar la oferta "${offer.label}"? Esta acción no se puede deshacer.`)) return;
    setDeletingId(offer.id);
    try {
      await api.delete(`/admin/offers/${offer.id}`);
      flash('Oferta eliminada ✓', 'success');
      await load();
    } catch (err) {
      flash(handleAPIError(err, locale as any), 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const fmtDate = (d: string | null) => {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };

  const isActive = (offer: Offer) => {
    if (!offer.is_active) return false;
    const today = new Date().toISOString().slice(0, 10);
    if (offer.valid_from && today < offer.valid_from) return false;
    if (offer.valid_to && today > offer.valid_to) return false;
    return true;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Ofertas y descuentos</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Descuentos porcentuales para apartamentos con validez configurable.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
        >
          + Nueva oferta
        </button>
      </div>

      {/* Alerts */}
      {error && <Alert variant="danger">{error}</Alert>}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 text-sm rounded-lg px-4 py-3">
          {success}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-foreground mb-4">
            {editingId ? 'Editar oferta' : 'Nueva oferta'}
          </h3>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            {/* Código */}
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Código <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                disabled={!!editingId}
                placeholder="verano2026"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {editingId && (
                <p className="text-xs text-muted-foreground mt-1">El código no se puede cambiar.</p>
              )}
            </div>

            {/* Descuento % */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Descuento (%) <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="100"
                step="0.5"
                value={form.discountPercent}
                onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))}
                placeholder="10"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Nombre / label — ancho completo */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Nombre visible <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Oferta de verano — 10% off"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Desde */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Válida desde
              </label>
              <input
                type="date"
                value={form.validFrom}
                onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Hasta */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Válida hasta
              </label>
              <input
                type="date"
                value={form.validTo}
                onChange={(e) => setForm((f) => ({ ...f, validTo: e.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Activa toggle */}
            <div className="sm:col-span-2 flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={form.isActive}
                onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  form.isActive ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    form.isActive ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
              <span className="text-sm text-foreground">Activa</span>
            </div>

            {/* Actions */}
            <div className="sm:col-span-2 flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {isSaving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear oferta'}
              </button>
              <button
                type="button"
                onClick={cancelForm}
                className="px-5 py-2 border border-border text-sm font-medium text-muted-foreground rounded-lg hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : offers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No hay ofertas configuradas. Creá la primera con el botón de arriba.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Oferta</th>
                <th className="px-4 py-3 text-left font-medium">Descuento</th>
                <th className="px-4 py-3 text-left font-medium">Vigencia</th>
                <th className="px-4 py-3 text-left font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {offers.map((offer) => {
                const live = isActive(offer);
                return (
                  <tr key={offer.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{offer.label}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">{offer.code}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                        -{offer.discount_percent}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {offer.valid_from || offer.valid_to
                        ? `${fmtDate(offer.valid_from)} → ${fmtDate(offer.valid_to)}`
                        : 'Sin límite'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggle(offer)}
                        title={offer.is_active ? 'Desactivar' : 'Activar'}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          live
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                            : 'bg-muted text-muted-foreground hover:bg-muted/60'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                        {live ? 'Activa' : offer.is_active ? 'Fuera de vigencia' : 'Inactiva'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(offer)}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(offer)}
                          disabled={deletingId === offer.id}
                          className="text-xs text-destructive/70 hover:text-destructive transition-colors px-2 py-1 rounded hover:bg-destructive/10 disabled:opacity-50"
                        >
                          {deletingId === offer.id ? '…' : 'Eliminar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Los descuentos aplican a todos los apartamentos salvo que se configure por apartamento en una versión futura.
        El estado "Fuera de vigencia" indica que la oferta está marcada activa pero fuera del rango de fechas.
      </p>
    </div>
  );
}
