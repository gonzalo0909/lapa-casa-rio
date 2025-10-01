// lapa-casa-hostel/frontend/src/components/seo/structured-data.tsx

/**
 * Structured Data Component
 * 
 * Generates JSON-LD structured data for Lapa Casa Hostel.
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
 * Organization structured data for Lapa Casa Hostel
 */
export const OrganizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Hostel',
  name: 'Lapa Casa Hostel',
  description: 'Premium hostel in Santa Teresa, Rio de Janeiro specializing in group bookings',
  url: 'https://lapacasahostel.com',
  logo: 'https://lapacasahostel.com/images/logo.png',
  image: 'https://lapacasahostel.com/images/hostel-exterior.jpg',
  telephone: '+55-21-XXXX-XXXX',
  email: 'info@lapacasahostel.com',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Rua Silvio Romero 22',
    addressLocality: 'Santa Teresa',
    addressRegion: 'RJ',
    postalCode: '20241-120',
    addressCountry: 'BR'
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: -22.9145,
    longitude: -43.1852
  },
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
    'https://www.facebook.com/lapacasahostel',
    'https://www.instagram.com/lapacasahostel',
    'https://www.booking.com/hotel/br/lapa-casa-hostel.html',
    'https://www.hostelworld.com/hostel/lapa-casa-hostel'
  ]
};

/**
 * LocalBusiness structured data
 */
export const LocalBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'LodgingBusiness',
  '@id': 'https://lapacasahostel.com/#organization',
  name: 'Lapa Casa Hostel',
  image: 'https://lapacasahostel.com/images/hostel-exterior.jpg',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Rua Silvio Romero 22',
    addressLocality: 'Santa Teresa',
    addressRegion: 'RJ',
    postalCode: '20241-120',
    addressCountry: 'BR'
  },
  telephone: '+55-21-XXXX-XXXX',
  priceRange: 'R$ 60-100',
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    reviewCount: '247',
    bestRating: '5',
    worstRating: '1'
  }
};

/**
 * Generate Product schema for room offerings
 */
export function generateRoomProductSchema(room: {
  id: string;
  name: string;
  capacity: number;
  basePrice: number;
  type: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${room.name} - Lapa Casa Hostel`,
    description: `${room.capacity}-bed ${room.type} dormitory in Santa Teresa, Rio de Janeiro`,
    image: `https://lapacasahostel.com/images/rooms/${room.id}.jpg`,
    brand: {
      '@type': 'Brand',
      name: 'Lapa Casa Hostel'
    },
    offers: {
      '@type': 'Offer',
      price: room.basePrice.toFixed(2),
      priceCurrency: 'BRL',
      availability: 'https://schema.org/InStock',
      url: `https://lapacasahostel.com/rooms/${room.id}`,
      priceValidUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.7',
      reviewCount: '89',
      bestRating: '5',
      worstRating: '1'
    }
  };
}

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
 * Generate BreadcrumbList schema
 */
export function generateBreadcrumbSchema(breadcrumbs: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `https://lapacasahostel.com${item.url}`
    }))
  };
}

/**
 * Generate Review schema
 */
export function generateReviewSchema(review: {
  author: string;
  rating: number;
  reviewBody: string;
  datePublished: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Review',
    itemReviewed: {
      '@type': 'Hostel',
      name: 'Lapa Casa Hostel'
    },
    author: {
      '@type': 'Person',
      name: review.author
    },
    reviewRating: {
      '@type': 'Rating',
      ratingValue: review.rating.toString(),
      bestRating: '5',
      worstRating: '1'
    },
    reviewBody: review.reviewBody,
    datePublished: review.datePublished
  };
}

/**
 * Generate Event schema for group bookings
 */
export function generateEventSchema(event: {
  name: string;
  startDate: string;
  endDate: string;
  location?: string;
  description?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.name,
    description: event.description || 'Group event at Lapa Casa Hostel',
    startDate: event.startDate,
    endDate: event.endDate,
    location: {
      '@type': 'Place',
      name: event.location || 'Lapa Casa Hostel',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Rua Silvio Romero 22',
        addressLocality: 'Santa Teresa',
        addressRegion: 'RJ',
        postalCode: '20241-120',
        addressCountry: 'BR'
      }
    },
    offers: {
      '@type': 'Offer',
      price: '60.00',
      priceCurrency: 'BRL',
      availability: 'https://schema.org/InStock',
      url: 'https://lapacasahostel.com/booking'
    }
  };
}

/**
 * Generate WebSite schema with search action
 */
export const WebSiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': 'https://lapacasahostel.com/#website',
  url: 'https://lapacasahostel.com',
  name: 'Lapa Casa Hostel',
  description: 'Premium hostel specializing in group bookings in Santa Teresa, Rio de Janeiro',
  publisher: {
    '@id': 'https://lapacasahostel.com/#organization'
  },
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://lapacasahostel.com/search?q={search_term_string}'
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

/**
 * MultipleStructuredData Component
 * 
 * Renders multiple JSON-LD structured data objects.
 * 
 * @example
 * ```tsx
 * <MultipleStructuredData 
 *   schemas={[OrganizationSchema, LocalBusinessSchema]} 
 * />
 * ```
 */
export function MultipleStructuredData({ schemas }: { schemas: Array<Record<string, any>> }) {
  return (
    <>
      {schemas.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(schema)
          }}
        />
      ))}
    </>
  );
}

/**
 * Hook to generate structured data dynamically
 * 
 * @example
 * ```tsx
 * const { getOrganizationSchema, getRoomSchema } = useStructuredData();
 * 
 * return (
 *   <StructuredData data={getOrganizationSchema()} />
 * );
 * ```
 */
export function useStructuredData() {
  const getOrganizationSchema = () => OrganizationSchema;
  
  const getLocalBusinessSchema = () => LocalBusinessSchema;
  
  const getWebSiteSchema = () => WebSiteSchema;
  
  const getRoomSchema = (room: Parameters<typeof generateRoomProductSchema>[0]) => {
    return generateRoomProductSchema(room);
  };
  
  const getFAQSchema = (faqs: Parameters<typeof generateFAQSchema>[0]) => {
    return generateFAQSchema(faqs);
  };
  
  const getBreadcrumbSchema = (breadcrumbs: Parameters<typeof generateBreadcrumbSchema>[0]) => {
    return generateBreadcrumbSchema(breadcrumbs);
  };
  
  const getReviewSchema = (review: Parameters<typeof generateReviewSchema>[0]) => {
    return generateReviewSchema(review);
  };
  
  const getEventSchema = (event: Parameters<typeof generateEventSchema>[0]) => {
    return generateEventSchema(event);
  };

  return {
    getOrganizationSchema,
    getLocalBusinessSchema,
    getWebSiteSchema,
    getRoomSchema,
    getFAQSchema,
    getBreadcrumbSchema,
    getReviewSchema,
    getEventSchema
  };
}

/**
 * Predefined structured data for common pages
 */
export const PAGE_SCHEMAS = {
  home: [OrganizationSchema, LocalBusinessSchema, WebSiteSchema],
  about: [OrganizationSchema, LocalBusinessSchema],
  contact: [OrganizationSchema, LocalBusinessSchema],
  rooms: [OrganizationSchema, LocalBusinessSchema]
} as const;

export default StructuredData;
