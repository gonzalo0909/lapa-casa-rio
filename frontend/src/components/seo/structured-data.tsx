// lapa-casa-hostel/frontend/src/components/seo/structured-data.tsx

/**
 * Structured Data Component
 * 
 * Generates JSON-LD structured data for Lapa Casa.
 * Improves search engine understanding and enables rich snippets.
 * 
 * @module components/seo/structured-data
 * @requires react
 */

import React from 'react';

/**
 * Base structured data interface
 */
interface StructuredDataProps {
  data: Record<string, any>;
}

/**
 * Coordenadas GPS únicas del hostel -- fuente de verdad compartida.
 * Antes había dos pares distintos (-22.9145/-43.1852 en OrganizationSchema
 * y grupos/page.tsx, -22.9167/-43.1931 en LocalBusinessSchema), ~800-900m
 * de diferencia entre sí para la misma dirección. Se unifica al valor de
 * LocalBusinessSchema (el bloque JSON-LD principal del sitio).
 */
export const HOSTEL_GEO = {
  '@type': 'GeoCoordinates' as const,
  latitude: -22.9167,
  longitude: -43.1931,
};

/**
 * Organization structured data for Lapa Casa
 */
export const OrganizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Hostel',
  name: 'Lapa Casa',
  description: 'Premium hostel in Santa Teresa, Rio de Janeiro specializing in group bookings',
  url: 'https://lapacasario.com',
  // /images/logo.png y /images/hostel-exterior.jpg no existen en public/
  // (404) -- no hay carpeta public/images/ en todo el proyecto. Se usan
  // los assets reales que sí existen.
  logo: 'https://lapacasario.com/android-chrome-512x512.png',
  image: 'https://lapacasario.com/og-image.jpg',
  telephone: '+55-21-97715-7530',
  email: 'lapalandiarj@gmail.com',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Rua Silvio Romero 22',
    addressLocality: 'Santa Teresa',
    addressRegion: 'RJ',
    postalCode: '20241-120',
    addressCountry: 'BR'
  },
  geo: HOSTEL_GEO,
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday'
      ],
      opens: '00:00',
      closes: '23:59'
    }
  ],
  priceRange: 'R$ 60-100',
  starRating: {
    '@type': 'Rating',
    ratingValue: '4.8',
    bestRating: '5',
    worstRating: '1'
  },
  amenityFeature: [
    {
      '@type': 'LocationFeatureSpecification',
      name: 'Free WiFi',
      value: true
    },
    {
      '@type': 'LocationFeatureSpecification',
      name: 'Kitchen Access',
      value: true
    },
    {
      '@type': 'LocationFeatureSpecification',
      name: 'Lockers',
      value: true
    },
    {
      '@type': 'LocationFeatureSpecification',
      name: 'Common Area',
      value: true
    }
  ],
  sameAs: [
    'https://www.facebook.com/lapacasa',
    'https://www.instagram.com/lapacasa',
    'https://www.booking.com/hotel/br/lapa-casa-hostel.html',
    'https://www.hostelworld.com/hostel/lapa-casa-hostel'
  ]
};

/**
 * LocalBusiness structured data
 *
 * Único bloque LodgingBusiness del sitio -- antes coexistía con un segundo
 * bloque inline (@type LodgingBusiness también) en app/[locale]/page.tsx,
 * duplicando la entidad para los motores de búsqueda. Se fusionan acá los
 * campos que solo tenía el bloque inline (geo, amenityFeature, hasMap,
 * containsPlace, description) y se elimina la duplicación.
 */
export const LocalBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'LodgingBusiness',
  '@id': 'https://lapacasario.com/#organization',
  name: 'Lapa Casa',
  description: 'Hostel boutique y apartamentos privados en Santa Teresa, Río de Janeiro. Reserva directa, mejor precio garantizado.',
  // /images/hostel-exterior.jpg no existe en public/ (404) -- se usa
  // /og-image.jpg, que sí existe y ya es la imagen OG real del sitio.
  image: 'https://lapacasario.com/og-image.jpg',
  url: 'https://lapacasario.com',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Rua Silvio Romero 22',
    addressLocality: 'Santa Teresa',
    addressRegion: 'RJ',
    postalCode: '20241-120',
    addressCountry: 'BR'
  },
  geo: HOSTEL_GEO,
  telephone: '+55-21-97715-7530',
  priceRange: 'R$ 60-100',
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    reviewCount: '247',
    bestRating: '5',
    worstRating: '1'
  },
  amenityFeature: [
    { '@type': 'LocationFeatureSpecification', name: 'Free WiFi', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Kitchen', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Private rooms', value: true }
  ],
  hasMap: 'https://maps.google.com/?q=Santa+Teresa+Rio+de+Janeiro',
  containsPlace: [
    {
      '@type': 'Room',
      name: 'Hostel Dormitório',
      description: 'Camas em dormitórios mistos e femininos com capacidade de 7 a 12 pessoas.'
    },
    {
      '@type': 'Apartment',
      name: 'Apartamentos privados',
      description: 'Apartamentos privativos com cozinha em Santa Teresa, Rio de Janeiro.'
    }
  ]
};

/**
 * Generate FAQPage schema
 */
export function generateFAQSchema(faqs: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  };
}

/**
 * Schema para la página de Apartamentos.
 * SIN dirección física — solo área de servicio "Rio de Janeiro".
 * Las direcciones de cada apartamento nunca aparecen en la web.
 */
export const ApartmentServiceSchema = {
  '@context': 'https://schema.org',
  '@type': 'LodgingBusiness',
  '@id': 'https://lapacasario.com/apartamentos#service',
  name: 'Lapa Casa Apartamentos',
  description: 'Apartamentos privados para aluguel temporário em diversas regiões do Rio de Janeiro',
  url: 'https://lapacasario.com/apartamentos',
  image: 'https://lapacasario.com/og-image.jpg',
  telephone: '+55-21-97715-7530',
  email: 'lapalandiarj@gmail.com',
  // Área de servicio amplia — sin dirección específica de ningún apartamento
  areaServed: {
    '@type': 'City',
    name: 'Rio de Janeiro',
    addressCountry: 'BR',
  },
  priceRange: 'R$$ - R$$$',
  sameAs: [
    'https://www.instagram.com/lapacasa',
  ],
};

/**
 * Speakable schema — para asistentes de voz (Google Assistant, Alexa).
 * Indica qué selectores CSS contienen el contenido más importante para ser leído.
 * AEO: los motores de IA también usan esto para identificar el resumen principal.
 */
export const SpeakableSchema = {
  '@context': 'https://schema.org',
  '@type':    'WebPage',
  name:       'Lapa Casa Rio',
  speakable:  {
    '@type':      'SpeakableSpecification',
    cssSelector:  ['h1', 'h2', '.speakable', '[data-speakable]'],
  },
  url: 'https://lapacasario.com',
};

/**
 * Generate WebSite schema with search action
 */
export const WebSiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': 'https://lapacasario.com/#website',
  url: 'https://lapacasario.com',
  name: 'Lapa Casa',
  description: 'Premium hostel specializing in group bookings in Santa Teresa, Rio de Janeiro',
  publisher: {
    '@id': 'https://lapacasario.com/#organization'
  },
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://lapacasario.com/search?q={search_term_string}'
    },
    'query-input': 'required name=search_term_string'
  }
};

/**
 * StructuredData Component
 * 
 * Renders JSON-LD structured data in the document head.
 * 
 * @example
 * ```tsx
 * <StructuredData data={OrganizationSchema} />
 * ```
 */
export function StructuredData({ data }: StructuredDataProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data)
      }}
    />
  );
}

// FIX (auditoría de 17 secciones, sección 5): se eliminaron
// MultipleStructuredData, useStructuredData, generateRoomProductSchema,
// generateBreadcrumbSchema, generateReviewSchema y generateEventSchema --
// 0 usos reales en todo el frontend (confirmado por grep), cada página
// arma su propio JSON-LD importando los schemas individuales directamente
// (ej. <StructuredData data={LocalBusinessSchema} />).

// FIX (auditoría 2026-08-30): se eliminó PAGE_SCHEMAS -- agrupación de
// ejemplo sin ningún import en el resto del frontend (cada página arma
// su propio JSON-LD importando los schemas individuales de arriba
// directamente, ej. LocalBusinessSchema).

export default StructuredData;
