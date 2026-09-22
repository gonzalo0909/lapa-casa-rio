'use client';
// frontend/src/components/booking/hostel-photo-gallery.tsx
// Step 2 — Fotos reales dos quartos e banheiros, com lightbox simples.

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { BookingLocale } from '@/types/global';
import { T } from './hostel-engine.types';

const PHOTOS = [
  { src: '/img/hostel/quarto-beliches-multiplos.jpg', alt: 'Quarto compartilhado com beliches' },
  { src: '/img/hostel/quarto-beliche-1.jpg', alt: 'Beliche com roupa de cama' },
  { src: '/img/hostel/quarto-beliche-2.jpg', alt: 'Beliche perto da janela' },
  { src: '/img/hostel/banheiro-cabine.jpg', alt: 'Cabine do banheiro' },
  { src: '/img/hostel/banheiro-vaso.jpg', alt: 'Vaso sanitário do banheiro' },
  { src: '/img/hostel/banheiro-chuveiros.jpg', alt: 'Box dos chuveiros' },
  { src: '/img/hostel/banheiro-pia.jpg', alt: 'Pia do banheiro' },
] as const;

interface HostelPhotoGalleryProps {
  lang: BookingLocale;
}

export function HostelPhotoGallery({ lang }: HostelPhotoGalleryProps) {
  const t = T[lang];
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const close = () => setOpenIndex(null);
  const prev = () => setOpenIndex((i) => (i === null ? null : (i - 1 + PHOTOS.length) % PHOTOS.length));
  const next = () => setOpenIndex((i) => (i === null ? null : (i + 1) % PHOTOS.length));

  return (
    <div className="he-photos">
      <div className="he-photos-title">{t.photosTitle}</div>
      <div className="he-photos-strip">
        {PHOTOS.map((photo, i) => (
          <button
            key={photo.src}
            type="button"
            className="he-photo-thumb"
            onClick={() => setOpenIndex(i)}
            aria-label={photo.alt}
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="120px"
              className="object-cover"
            />
          </button>
        ))}
      </div>

      {openIndex !== null && PHOTOS[openIndex] && typeof document !== 'undefined' && createPortal(
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- backdrop click-to-close is a convenience on top of the close button and Escape key below, not the only way to dismiss
        <div
          className="he-photo-lightbox"
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          onClick={(e) => { if (e.target === e.currentTarget) { close(); } }}
          onKeyDown={(e) => { if (e.key === 'Escape') { close(); } }}
        >
          <button
            type="button"
            className="he-photo-lb-close"
            onClick={close}
            aria-label="Close"
          >
            <X size={20} />
          </button>
          <button
            type="button"
            className="he-photo-lb-nav he-photo-lb-prev"
            onClick={(e) => { e.stopPropagation(); prev(); }}
            aria-label="Previous"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="he-photo-lb-img">
            <Image
              src={PHOTOS[openIndex].src}
              alt={PHOTOS[openIndex].alt}
              fill
              sizes="90vw"
              className="object-contain"
            />
          </div>
          <button
            type="button"
            className="he-photo-lb-nav he-photo-lb-next"
            onClick={(e) => { e.stopPropagation(); next(); }}
            aria-label="Next"
          >
            <ChevronRight size={24} />
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}
