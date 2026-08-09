// lapa-casa-hostel/frontend/src/components/gallery/guest-gallery.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { photosAPI, handleAPIError } from '@/lib/api';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Alert } from '@/components/ui/alert';
import type { GuestPhoto } from '@/types/global';

/**
 * GuestGallery Component
 *
 * "Bitácora de viajantes": galería pública de fotos de hóspedes,
 * curada pelo dono via /admin/photos.html.
 * Usa next-intl para i18n.
 *
 * @component
 */
interface GuestGalleryProps {
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
}

export const GuestGallery: React.FC<GuestGalleryProps> = ({ locale = 'pt' }) => {
  const t = useTranslations('gallery');
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
        <h1 className="text-3xl font-bold text-foreground mb-2">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
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
        <p className="text-center text-muted-foreground py-16">{t('empty')}</p>
      )}

      {photos && photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {photos.map((photo) => (
            <figure
              key={photo.id}
              className="rounded-lg overflow-hidden border border-border bg-card"
            >
              <img
                src={photo.image_url}
                alt={photo.caption || photo.guest_name || ''}
                className="w-full h-40 object-cover"
                loading="lazy"
              />
              {(photo.guest_name || photo.caption) && (
                <figcaption className="p-3 text-xs">
                  {photo.guest_name && (
                    <p className="font-semibold text-foreground">
                      {photo.guest_name}
                      {photo.guest_country ? ` · ${photo.guest_country}` : ''}
                    </p>
                  )}
                  {photo.caption && (
                    <p className="text-muted-foreground mt-1">{photo.caption}</p>
                  )}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}
    </div>
  );
};
