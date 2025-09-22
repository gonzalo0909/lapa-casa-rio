// src/components/seo/json-ld.tsx
'use client';

import { useTranslations } from 'next-intl';

interface JsonLdProps {
  type: 'organization' | 'lodgingBusiness' | 'product' | 'event' | 'breadcrumb' | 'faq';
  data?: any;
}

export default function JsonLd({ type, data = {} }: JsonLdProps) {
  const t = useTranslations('seo');
  
  const baseUrl = 'https://lapacasahostel.com';
  
  const generateSchema = () => {
    switch (type) {
      case 'organization':
        return {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Lapa Casa Hostel',
          alternateName: 'Lapa Casa',
          url: baseUrl,
          logo: `${baseUrl}/images/logo-full.png`,
          image: `${baseUrl}/images/og-default.jpg`,
          description: t('organizationDescription'),
          contactPoint: [
            {
              '@type': 'ContactPoint',
              telephone: '+55-21-9999-9999',
              contactType: 'customer service',
              areaServed: 'BR',
              availableLanguage: ['Portuguese', 'English', 'Spanish'],
              contactOption: 'TollFree',
            },
            {
              '@type': 'ContactPoint',
              email: 'reservas@lapacasahostel.com',
              contactType: 'reservations',
              areaServed: 'BR',
              availableLanguage: ['Portuguese', 'English', 'Spanish'],
            },
          ],
          address: {
            '@type': 'PostalAddress',
            streetAddress: 'Rua Silvio Romero 22',
            addressLocality: 'Santa Teresa',
            addressRegion: 'Rio de Janeiro',
            postalCode: '20241-000',
            addressCountry: 'BR',
          },
          geo: {
            '@type': 'GeoCoordinates',
            latitude: -22.9068,
            longitude: -43.1729,
          },
          sameAs: [
            'https://www.facebook.com/lapacasahostel',
            'https://www.instagram.com/lapacasahostel',
            'https://www.tripadvisor.com/Hotel_Review-g303506-d123456-Reviews-Lapa_Casa_Hostel-Rio_de_Janeiro.html',
            'https://www.hostelworld.com/hostels/Rio-de-Janeiro/Lapa-Casa-Hostel',
            'https://www.booking.com/hotel/br/lapa-casa-hostel.html',
          ],
          founder: {
            '@type': 'Person',
            name: 'Proprietário Lapa Casa',
          },
          foundingDate: '2020',
          numberOfEmployees: '5-10',
          ...data,
        };

      case 'lodgingBusiness':
        return {
          '@context': 'https://schema.org',
          '@type': 'LodgingBusiness',
          '@id': `${baseUrl}/#lodging`,
          name: 'Lapa Casa Hostel',
          description: t('lodgingDescription'),
          url: baseUrl,
          image: [
            `${baseUrl}/images/rooms/room-gallery-1.jpg`,
            `${baseUrl}/images/rooms/room-gallery-2.jpg`,
            `${baseUrl}/images/common-areas/lounge.jpg`,
            `${baseUrl}/images/exterior/facade.jpg`,
          ],
          priceRange: 'R$ 60 - R$ 120',
          currenciesAccepted: 'BRL',
          paymentAccepted: ['Credit Card', 'Debit Card', 'PIX', 'Cash'],
          telephone: '+55-21-9999-9999',
          email: 'reservas@lapacasahostel.com',
          address: {
            '@type': 'PostalAddress',
            streetAddress: 'Rua Silvio Romero 22',
            addressLocality: 'Santa Teresa',
            addressRegion: 'RJ',
            postalCode: '20241-000',
            addressCountry: 'BR',
          },
          geo: {
            '@type': 'GeoCoordinates',
            latitude: -22.9068,
            longitude: -43.1729,
          },
          openingHours: [
            'Mo-Su 00:00-24:00',
          ],
          checkinTime: '14:00',
          checkoutTime: '11:00',
          petsAllowed: false,
          smokingAllowed: false,
          numberOfRooms: 4,
          maximumAttendeeCapacity: 45,
          amenityFeature: [
            {
              '@type': 'LocationFeatureSpecification',
              name: 'Free WiFi',
              value: true,
            },
            {
              '@type': 'LocationFeatureSpecification',
              name: 'Shared Kitchen',
              value: true,
            },
            {
              '@type': 'LocationFeatureSpecification',
              name: 'Laundry Facilities',
              value: true,
            },
            {
              '@type': 'LocationFeatureSpecification',
              name: 'Common Area',
              value: true,
            },
            {
              '@type': 'LocationFeatureSpecification',
              name: 'Luggage Storage',
              value: true,
            },
            {
              '@type': 'LocationFeatureSpecification',
              name: 'Group Bookings',
              value: true,
            },
          ],
          starRating: {
            '@type': 'Rating',
            ratingValue: 4.5,
            bestRating: 5,
            worstRating: 1,
          },
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: 4.5,
            reviewCount: 150,
            bestRating: 5,
            worstRating: 1,
          },
          review: [
            {
              '@type': 'Review',
              author: {
                '@type': 'Person',
                name: 'Carlos Silva',
              },
              datePublished: '2024-01-15',
              reviewBody: 'Excelente hostel para grupos! Equipe muito atenciosa e localização perfeita em Santa Teresa.',
              reviewRating: {
                '@type': 'Rating',
                ratingValue: 5,
                bestRating: 5,
              },
            },
            {
              '@type': 'Review',
              author: {
                '@type': 'Person',
                name: 'María González',
              },
              datePublished: '2024-02-20',
              reviewBody: 'Perfect location for groups visiting Rio. Clean facilities and great staff!',
              reviewRating: {
                '@type': 'Rating',
                ratingValue: 5,
                bestRating: 5,
              },
            },
          ],
          ...data,
        };

      case 'product':
        return {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: data.roomName || 'Dormitório Compartilhado',
          description: data.roomDescription || 'Cama em dormitório compartilhado no Lapa Casa Hostel',
          image: data.roomImage || `${baseUrl}/images/rooms/default-room.jpg`,
          brand: {
            '@type': 'Brand',
            name: 'Lapa Casa Hostel',
          },
          offers: {
            '@type': 'Offer',
            price: data.price || '60.00',
            priceCurrency: 'BRL',
            priceValidUntil: data.priceValidUntil || '2024-12-31',
            availability: 'https://schema.org/InStock',
            url: `${baseUrl}/booking`,
            seller: {
              '@type': 'Organization',
              name: 'Lapa Casa Hostel',
            },
          },
          category: 'Accommodation',
          additionalProperty: [
            {
              '@type': 'PropertyValue',
              name: 'Room Type',
              value: data.roomType || 'Shared Dormitory',
            },
            {
              '@type': 'PropertyValue',
              name: 'Capacity',
              value: data.capacity || '12 beds',
            },
            {
              '@type': 'PropertyValue',
              name: 'Check-in',
              value: '14:00',
            },
            {
              '@type': 'PropertyValue',
              name: 'Check-out',
              value: '11:00',
            },
          ],
          ...data,
        };

      case 'event':
        return {
          '@context': 'https://schema.org',
          '@type': 'Event',
          name: data.eventName || 'Group Booking Event',
          description: data.eventDescription || 'Reserva para grupo no Lapa Casa Hostel',
          startDate: data.checkIn,
          endDate: data.checkOut,
          location: {
            '@type': 'Place',
            name: 'Lapa Casa Hostel',
            address: {
              '@type': 'PostalAddress',
              streetAddress: 'Rua Silvio Romero 22',
              addressLocality: 'Santa Teresa',
              addressRegion: 'RJ',
              postalCode: '20241-000',
              addressCountry: 'BR',
            },
          },
          organizer: {
            '@type': 'Organization',
            name: 'Lapa Casa Hostel',
            url: baseUrl,
          },
          offers: {
            '@type': 'Offer',
            price: data.totalPrice || '0',
            priceCurrency: 'BRL',
            availability: 'https://schema.org/InStock',
            url: `${baseUrl}/booking`,
          },
          ...data,
        };

      case 'breadcrumb':
        return {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: data.breadcrumbs?.map((crumb: any, index: number) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: crumb.name,
            item: `${baseUrl}${crumb.url}`,
          })) || [],
        };

      case 'faq':
        return {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: data.faqs?.map((faq: any) => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: faq.answer,
            },
          })) || [],
        };

      default:
        return {};
    }
  };

  const schema = generateSchema();

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema, null, 2),
      }}
    />
  );
}
