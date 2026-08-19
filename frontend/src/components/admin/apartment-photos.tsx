// lapa-casa-hostel/frontend/src/components/admin/apartment-photos.tsx
//
// Gestión de fotos por apartamento (galería con upload, set-primary y borrado).

'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/lib/api';

interface ApartmentPhoto {
  id: string;
  image_url: string;
  display_order: number;
  is_primary: boolean;
  alt_text: string | null;
}

interface Apartment {
  id: string;
  code: string;
  name: string;
  capacity: number;
  photo_count: number;
  primary_photo: string | null;
}

export const ApartmentPhotos: React.FC = () => {
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [selected, setSelected] = useState<Apartment | null>(null);
  const [photos, setPhotos] = useState<ApartmentPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const showMsg = (text: string, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3500);
  };

  const loadApartments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/room-types');
      setApartments(res.data.data?.apartments ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPhotos = useCallback(async (apt: Apartment) => {
    const res = await api.get(`/admin/room-types/${apt.id}/photos`);
    setPhotos(res.data.data?.photos ?? []);
  }, []);

  useEffect(() => { loadApartments(); }, [loadApartments]);

  const selectApt = async (apt: Apartment) => {
    setSelected(apt);
    await loadPhotos(apt);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !fileRef.current?.files?.length) return;
    const formData = new FormData();
    formData.append('photo', fileRef.current.files[0]!);
    setUploading(true);
    try {
      await api.post(`/admin/room-types/${selected.id}/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showMsg('Foto subida');
      if (fileRef.current) fileRef.current.value = '';
      await loadPhotos(selected);
      await loadApartments();
    } catch {
      showMsg('Error al subir la foto', false);
    } finally {
      setUploading(false);
    }
  };

  const setPrimary = async (photoId: string) => {
    if (!selected) return;
    try {
      await api.patch(`/admin/room-types/photos/${photoId}`, { isPrimary: true });
      showMsg('Foto principal actualizada');
      await loadPhotos(selected);
    } catch {
      showMsg('Error', false);
    }
  };

  const deletePhoto = async (photoId: string) => {
    if (!selected || !confirm('¿Eliminar esta foto?')) return;
    try {
      await api.delete(`/admin/room-types/photos/${photoId}`);
      showMsg('Foto eliminada');
      await loadPhotos(selected);
      await loadApartments();
    } catch {
      showMsg('Error al eliminar', false);
    }
  };

  return (
    <div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 400, marginBottom: '1.25rem' }}>
        Fotos de apartamentos
      </h2>

      {msg && (
        <div style={{
          padding: '.65rem 1rem', borderRadius: 8, marginBottom: '1rem', fontSize: '.85rem',
          background: msg.ok ? '#ecfdf5' : '#fef2f2',
          color: msg.ok ? '#065f46' : '#991b1b',
          border: `1px solid ${msg.ok ? '#6ee7b7' : '#fca5a5'}`,
        }}>
          {msg.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '260px 1fr' : '1fr', gap: '1.5rem' }}>

        {/* Lista de apartamentos */}
        <div>
          <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#888', marginBottom: '.6rem' }}>
            Apartamentos
          </div>
          {loading ? (
            <p style={{ fontSize: '.85rem', color: '#888' }}>Cargando…</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
              {apartments.map(apt => (
                <button
                  key={apt.id}
                  type="button"
                  onClick={() => selectApt(apt)}
                  style={{
                    textAlign: 'left', padding: '.55rem .75rem', border: '1.5px solid',
                    borderColor: selected?.id === apt.id ? '#2c5f8a' : '#ddd',
                    borderRadius: 8, background: selected?.id === apt.id ? '#eff6ff' : '#fff',
                    cursor: 'pointer', fontSize: '.84rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <span>
                    <span style={{ fontWeight: 600 }}>{apt.name}</span>
                    <span style={{ fontSize: '.72rem', color: '#888', display: 'block' }}>{apt.code} · {apt.capacity} huésp.</span>
                  </span>
                  <span style={{
                    fontSize: '.7rem', fontWeight: 700, padding: '.1rem .45rem', borderRadius: 999,
                    background: apt.photo_count > 0 ? '#dcfce7' : '#f1f5f9',
                    color: apt.photo_count > 0 ? '#166534' : '#64748b',
                  }}>
                    {apt.photo_count} foto{apt.photo_count !== 1 ? 's' : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Panel de fotos del apartamento seleccionado */}
        {selected && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{selected.name}</h3>
              <button
                type="button"
                onClick={() => { setSelected(null); setPhotos([]); }}
                style={{ fontSize: '.78rem', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ← Volver
              </button>
            </div>

            {/* Upload */}
            <form onSubmit={handleUpload} style={{ display: 'flex', gap: '.6rem', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                required
                style={{ fontSize: '.84rem', flex: 1, minWidth: 180 }}
              />
              <button
                type="submit"
                disabled={uploading}
                style={{
                  padding: '.5rem 1.1rem', borderRadius: 7, border: 'none',
                  background: '#2c5f8a', color: '#fff', fontSize: '.84rem',
                  cursor: uploading ? 'not-allowed' : 'pointer', fontWeight: 600,
                  opacity: uploading ? .7 : 1,
                }}
              >
                {uploading ? 'Subiendo…' : '+ Subir foto'}
              </button>
            </form>

            {/* Galería */}
            {photos.length === 0 ? (
              <p style={{ fontSize: '.85rem', color: '#888', fontStyle: 'italic' }}>
                Sin fotos. Subí la primera usando el formulario de arriba.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
                {photos.map(photo => (
                  <div
                    key={photo.id}
                    style={{
                      border: `2px solid ${photo.is_primary ? '#2c5f8a' : '#e5e7eb'}`,
                      borderRadius: 10, overflow: 'hidden', background: '#f9fafb',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.image_url}
                      alt={photo.alt_text ?? 'Foto apartamento'}
                      style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }}
                    />
                    <div style={{ padding: '.5rem .6rem', display: 'flex', gap: '.4rem', justifyContent: 'space-between', alignItems: 'center' }}>
                      {photo.is_primary ? (
                        <span style={{ fontSize: '.68rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                          ★ Principal
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPrimary(photo.id)}
                          style={{ fontSize: '.7rem', color: '#2c5f8a', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                        >
                          Hacer principal
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deletePhoto(photo.id)}
                        style={{ fontSize: '.7rem', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
