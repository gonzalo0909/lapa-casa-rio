// lapa-casa-hostel/frontend/src/components/gallery/guest-gallery.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { photosAPI, handleAPIError } from '@/lib/api';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Alert } from '@/components/ui/alert';
import type { GuestPhoto } from '@/types/global';

/**
 * GuestGallery Component
 *
 * "Bitácora de viajantes": galería pública de fotos de huéspedes,
 * curada por el dueño desde /admin/photos.html -- no hay carga pública,
 * así que no requiere moderación de contenido anónimo.
 *
 * @component
 */
interface GuestGalleryProps {
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
}

export const GuestGallery: React.FC<GuestGalleryProps> = ({ locale = 'pt' }) => {
  const [photos, setPhotos] = useState<GuestPhoto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    photosAPI
      .list()
      .then((response) => setPhotos(response.data.photos))
      .catch((err) => setError(handleAPIError(err, locale)));
  }, [locale]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{T('title', locale)}</h1>
        <p className="text-gray-600">{T('subtitle', locale)}</p>
      </div>

      {error && (
        <Alert variant="danger" className="mb-6">
          {error}
        </Alert>
      )}

      {!photos && !error && (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {photos && photos.length === 0 && (
        <p className="text-center text-gray-500 py-16">{T('empty', locale)}</p>
      )}

      {photos && photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {photos.map((photo) => (
            <figure key={photo.id} className="rounded-lg overflow-hidden border border-gray-200 bg-white">
              <img
                src={photo.image_url}
                alt={photo.caption || photo.guest_name || ''}
                className="w-full h-40 object-cover"
                loading="lazy"
              />
              {(photo.guest_name || photo.caption) && (
                <figcaption className="p-3 text-xs">
                  {photo.guest_name && (
                    <p className="font-semibold text-gray-900">
                      {photo.guest_name}
                      {photo.guest_country ? ` · ${photo.guest_country}` : ''}
                    </p>
                  )}
                  {photo.caption && <p className="text-gray-600 mt-1">{photo.caption}</p>}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}
    </div>
  );
};

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      title: 'Bitácora de Viajantes',
      subtitle: 'Momentos de quem já se hospedou no Lapa Casa Hostel',
      empty: 'Em breve, fotos dos nossos hóspedes por aqui.',
    },
    es: {
      title: 'Bitácora de Viajantes',
      subtitle: 'Momentos de quienes ya se hospedaron en Lapa Casa Hostel',
      empty: 'Pronto vas a ver acá fotos de nuestros huéspedes.',
    },
    en: {
      title: 'Travelers\' Logbook',
      subtitle: 'Moments from guests who\'ve stayed at Lapa Casa Hostel',
      empty: 'Guest photos coming soon.',
    },
    fr: {
      title: 'Carnet de Voyageurs',
      subtitle: 'Des moments partagés par nos hôtes au Lapa Casa Hostel',
      empty: 'Bientôt, des photos de nos hôtes ici.',
    },
    de: {
      title: 'Reisetagebuch',
      subtitle: 'Momente von Gästen, die im Lapa Casa Hostel übernachtet haben',
      empty: 'Bald gibt es hier Fotos unserer Gäste.',
    },
  };
  return t[locale]?.[key] || key;
}
