'use client';
// frontend/src/components/booking/apartment-engine-lazy.tsx
// Mismo motivo que hostel-engine-lazy.tsx -- ver ese archivo.

import dynamic from 'next/dynamic';
import type { ApartmentEngineProps } from './apartment-engine.types';

const ApartmentEngineImpl = dynamic(
  () => import('./apartment-engine').then((m) => m.ApartmentEngine),
  {
    ssr: false,
    loading: () => <div style={{ minHeight: '480px' }} />,
  },
);

export function ApartmentEngine({ locale }: ApartmentEngineProps) {
  return <ApartmentEngineImpl locale={locale} />;
}
