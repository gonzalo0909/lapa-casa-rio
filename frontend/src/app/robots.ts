// src/app/robots.ts
import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://lapacasahostel.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/api',
          '/dashboard',
          '/private',
          '/.well-known',
          '/checkout',
          '/payment',
          '/booking-confirmation',
          '/_next',
          '/static',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: [
          '/admin',
          '/api',
          '/dashboard',
          '/private',
          '/checkout',
          '/payment',
          '/booking-confirmation',
        ],
      },
      {
        userAgent: 'bingbot',
        allow: '/',
        disallow: [
          '/admin',
          '/api',
          '/dashboard',
          '/private',
          '/checkout',
          '/payment',
          '/booking-confirmation',
        ],
      },
      {
        userAgent: 'facebookexternalhit',
        allow: '/',
        disallow: [
          '/admin',
          '/api',
          '/dashboard',
          '/private',
          '/checkout',
          '/payment',
          '/booking-confirmation',
        ],
      },
      {
        userAgent: 'Twitterbot',
        allow: '/',
        disallow: [
          '/admin',
          '/api',
          '/dashboard',
          '/private',
          '/checkout',
          '/payment',
          '/booking-confirmation',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
