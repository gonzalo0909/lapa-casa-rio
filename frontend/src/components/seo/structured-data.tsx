// src/components/seo/structured-data.tsx
'use client';

import { usePathname } from 'next/navigation';

interface StructuredDataProps {
  type: 'homepage' | 'booking' | 'room' | 'contact' | 'about';
  data?: any;
}

export default function StructuredData({ type, data = {} }: StructuredDataProps) {
  const pathname = usePathname();
  const baseUrl = 'https://lapacasahostel.com';
  const currentUrl = `${baseUrl}${pathname}`;

  const generateStructuredData = () => {
    const baseSchemas = [];

    // Schema base da organização (sempre presente)
    const organizationSchema = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${baseUrl}/#organization`,
      name: 'Lapa Casa Hostel',
      url: baseUrl,
      logo: `${baseUrl}/images/logo-full.png`,
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: '+55-21-9999-9999',
        contactType: 'customer service',
        email: 'reservas@lapacasahostel.com',
      },
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Rua Silvio Romero 22',
        addressLocality: 'Santa Teresa',
        addressRegion: 'RJ',
        postalCode: '20241-000',
        addressCountry: 'BR',
      },
      sameAs: [
        'https://www.facebook.com/lapacasahostel',
        'https://www.instagram.com/lapacasahostel',
      ],
    };

    // Schema base do negócio de hospedagem
    const lodgingBusinessSchema = {
      '@context': 'https://schema.org',
      '@type': 'LodgingBusiness',
      '@id': `${baseUrl}/#lodging`,
      name: 'Lapa Casa Hostel',
      description: 'Hostel especializado em grupos grandes com 45 camas em 4 habitações no coração de Santa Teresa, Rio de Janeiro.',
      url: baseUrl,
      priceRange: 'R$ 60 - R$ 120',
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
      checkinTime: '14:00',
      checkoutTime: '11:00',
      numberOfRooms: 4,
      maximumAttendeeCapacity: 45,
      amenityFeature: [
        { '@type': 'LocationFeatureSpecification', name: 'Free WiFi', value: true },
        { '@type': 'LocationFeatureSpecification', name: 'Shared Kitchen', value: true },
        { '@type': 'LocationFeatureSpecification', name: 'Laundry Facilities', value: true },
        { '@type': 'LocationFeatureSpecification', name: 'Common Area', value: true },
        { '@type': 'LocationFeatureSpecification', name: 'Group Bookings', value: true },
      ],
      starRating: {
        '@type': 'Rating',
        ratingValue: 4.5,
        bestRating: 5,
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: 4.5,
        reviewCount: 150,
        bestRating: 5,
      },
    };

    // Adicionar schemas base
    baseSchemas.push(organizationSchema, lodgingBusinessSchema);

    // Schemas específicos por tipo de página
    switch (type) {
      case 'homepage':
        // WebSite schema para homepage
        baseSchemas.push({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          '@id': `${baseUrl}/#website`,
          url: baseUrl,
          name: 'Lapa Casa Hostel',
          description: 'Hostel especializado em grupos grandes em Santa Teresa, Rio de Janeiro',
          publisher: {
            '@id': `${baseUrl}/#organization`,
          },
          potentialAction: [
            {
              '@type': 'SearchAction',
              target: {
                '@type': 'EntryPoint',
                urlTemplate: `${baseUrl}/search?q={search_term_string}`,
              },
              'query-input': 'required name=search_term_string',
            },
            {
              '@type': 'ReserveAction',
              target: {
                '@type': 'EntryPoint',
                urlTemplate: `${baseUrl}/booking`,
              },
              result: {
                '@type': 'LodgingReservation',
              },
            },
          ],
        });

        // BreadcrumbList para navegação
        baseSchemas.push({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Início',
              item: baseUrl,
            },
          ],
        });
        break;

      case 'booking':
        // Service schema para o serviço de reservas
        baseSchemas.push({
          '@context': 'https://schema.org',
          '@type': 'Service',
          '@id': `${baseUrl}/booking#service`,
          name: 'Reserva de Grupos Lapa Casa Hostel',
          description: 'Serviço de reserva online especializado em grupos grandes com descontos progressivos',
          provider: {
            '@id': `${baseUrl}/#organization`,
          },
          areaServed: 'Rio de Janeiro',
          availableChannel: {
            '@type': 'ServiceChannel',
            serviceUrl: `${baseUrl}/booking`,
            serviceType: 'Online Booking',
          },
          offers: {
            '@type': 'Offer',
            price: '60.00',
            priceCurrency: 'BRL',
            priceSpecification: {
              '@type': 'CompoundPriceSpecification',
              price: '60.00',
              priceCurrency: 'BRL',
              priceType: 'Starting Price',
            },
          },
        });

        // Breadcrumbs para booking
        baseSchemas.push({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Início',
              item: baseUrl,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Reservar',
              item: `${baseUrl}/booking`,
            },
          ],
        });

        // FAQ schema se tiver dados de FAQ
        if (data.faqs?.length > 0) {
          baseSchemas.push({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: data.faqs.map((faq: any) => ({
              '@type': 'Question',
              name: faq.question,
              acceptedAnswer: {
                '@type': 'Answer',
                text: faq.answer,
              },
            })),
          });
        }
        break;

      case 'room':
        // Product schema para cada habitação
        const roomData = {
          roomName: data.roomName || 'Habitação Compartilhada',
          roomDescription: data.roomDescription || 'Cama em dormitório compartilhado',
          capacity: data.capacity || 12,
          price: data.price || '60.00',
          roomType: data.roomType || 'Mixed',
          amenities: data.amenities || [],
        };

        baseSchemas.push({
          '@context': 'https://schema.org',
          '@type': 'Product',
          '@id': `${currentUrl}#room`,
          name: roomData.roomName,
          description: roomData.roomDescription,
          image: data.images || [`${baseUrl}/images/rooms/${data.roomId || 'default'}.jpg`],
          category: 'Accommodation',
          brand: {
            '@type': 'Brand',
            name: 'Lapa Casa Hostel',
          },
          offers: {
            '@type': 'Offer',
            price: roomData.price,
            priceCurrency: 'BRL',
            availability: 'https://schema.org/InStock',
            priceValidUntil: '2024-12-31',
            url: `${baseUrl}/booking?room=${data.roomId || ''}`,
            seller: {
              '@id': `${baseUrl}/#organization`,
            },
          },
          additionalProperty: [
            {
              '@type': 'PropertyValue',
              name: 'Room Type',
              value: roomData.roomType,
            },
            {
              '@type': 'PropertyValue',
              name: 'Capacity',
              value: `${roomData.capacity} beds`,
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
          amenityFeature: roomData.amenities.map((amenity: string) => ({
            '@type': 'LocationFeatureSpecification',
            name: amenity,
            value: true,
          })),
        });

        // Breadcrumbs para habitação
        baseSchemas.push({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Início',
              item: baseUrl,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Habitações',
              item: `${baseUrl}/rooms`,
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: roomData.roomName,
              item: currentUrl,
            },
          ],
        });
        break;

      case 'contact':
        // ContactPage schema
        baseSchemas.push({
          '@context': 'https://schema.org',
          '@type': 'ContactPage',
          '@id': `${currentUrl}#contactpage`,
          name: 'Contato - Lapa Casa Hostel',
          description: 'Entre em contato conosco para reservas, dúvidas ou informações sobre grupos',
          mainEntity: {
            '@id': `${baseUrl}/#organization`,
          },
        });

        // Breadcrumbs para contato
        baseSchemas.push({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Início',
              item: baseUrl,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Contato',
              item: `${baseUrl}/contact`,
            },
          ],
        });
        break;

      case 'about':
        // AboutPage schema
        baseSchemas.push({
          '@context': 'https://schema.org',
          '@type': 'AboutPage',
          '@id': `${currentUrl}#aboutpage`,
          name: 'Sobre Nós - Lapa Casa Hostel',
          description: 'Conheça a história e filosofia do Lapa Casa Hostel, especialista em grupos em Santa Teresa',
          mainEntity: {
            '@id': `${baseUrl}/#organization`,
          },
        });

        // Breadcrumbs para sobre
        baseSchemas.push({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Início',
              item: baseUrl,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Sobre Nós',
              item: `${baseUrl}/about`,
            },
          ],
        });
        break;
    }

    // LocalBusiness adicional para SEO local
    baseSchemas.push({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      '@id': `${baseUrl}/#localbusiness`,
      name: 'Lapa Casa Hostel',
      image: `${baseUrl}/images/exterior/facade.jpg`,
      telephone: '+55-21-9999-9999',
      email: 'reservas@lapacasahostel.com',
      url: baseUrl,
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
      priceRange: 'R$ 60 - R$ 120',
      paymentAccepted: ['Credit Card', 'Debit Card', 'PIX'],
      currenciesAccepted: 'BRL',
    });

    // Event schema se houver dados de evento/reserva
    if (data.event) {
      baseSchemas.push({
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: data.event.name || 'Reserva de Grupo',
        startDate: data.event.checkIn,
        endDate: data.event.checkOut,
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
          '@id': `${baseUrl}/#organization`,
        },
        offers: {
          '@type': 'Offer',
          price: data.event.totalPrice || '0',
          priceCurrency: 'BRL',
          url: `${baseUrl}/booking`,
        },
      });
    }

    return baseSchemas;
  };

  const schemas = generateStructuredData();

  return (
    <>
      {schemas.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(schema, null, 2),
          }}
        />
      ))}
    </>
  );
}
