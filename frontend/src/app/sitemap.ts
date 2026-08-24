// lapa-casa-hostel/frontend/src/app/sitemap.ts
// Generates /sitemap.xml automatically via Next.js Metadata API.

import type { MetadataRoute } from 'next';
import { locales } from '@/i18n';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://lapacasa.com';

type ChangeFrequency = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const routes: Array<{
    path: string;
    changeFrequency: ChangeFrequency;
    priority: number;
    lastModified?: Date;
  }> = [
    { path: '',              changeFrequency: 'weekly',  priority: 1.0 },
    { path: '/hostel',       changeFrequency: 'weekly',  priority: 0.9 },
    { path: '/apartamentos', changeFrequency: 'weekly',  priority: 0.9 },
    { path: '/parceiros',    changeFrequency: 'monthly', priority: 0.6 },
  ];

  return locales.flatMap((locale) =>
    routes.map(({ path, changeFrequency, priority }) => ({
      url: `${SITE_URL}/${locale}${path}`,
      lastModified: now,
      changeFrequency,
      priority,
      alternates: {
        languages: Object.fromEntries(
          locales.map((l) => [l, `${SITE_URL}/${l}${path}`]),
        ),
      },
    })),
  );
}
