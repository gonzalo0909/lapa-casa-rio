'use client';
// frontend/src/components/booking/hostel-engine-lazy.tsx
//
// `next/dynamic` sin `ssr:false` en una Server Component (hostel/page.tsx)
// no separa nada de verdad: Next igual necesita renderizar el motor durante
// el SSR de esa página, así que su JS termina en el mismo chunk que el
// resto de la página de todos modos (idea #28, roadmap.html -- se probó,
// el build no bajaba de tamaño). `ssr:false` sí lo saca del bundle
// inicial, pero Next no permite pasarlo directo en un Server Component --
// de ahí este wrapper cliente, que es lo único que la página importa.
//
// El motor no tiene contenido que valga indexar (fechas/precios se cargan
// contra la API igual), así que perder el SSR de esta parte puntual no
// afecta SEO -- el resto de la página (hero, FAQ, JSON-LD) sigue
// renderizado en el servidor sin cambios.

import dynamic from 'next/dynamic';

const HostelEngineImpl = dynamic(() => import('./hostel-engine').then((m) => m.HostelEngine), {
  ssr: false,
  loading: () => <div className="he-wrap" style={{ minHeight: '480px' }} />,
});

export function HostelEngine({ locale }: { locale?: string }) {
  return <HostelEngineImpl locale={locale} />;
}
