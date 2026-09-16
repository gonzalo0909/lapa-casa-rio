// lapa-casa-hostel/frontend/src/app/robots.ts
// Generates /robots.txt automatically via Next.js Metadata API.

import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://lapacasario.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Auditoría 17 secciones, sección 11: /payment/[id] contiene IDs de
        // reserva reales -- ya lleva noindex propio (ver payment/[id]/page.tsx),
        // esto es defensa adicional para bots que no respeten ese meta tag.
        disallow: ['/admin/', '/api/', '/payment/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
