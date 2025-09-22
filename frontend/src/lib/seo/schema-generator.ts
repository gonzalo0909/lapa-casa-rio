// src/lib/seo/schema-generator.ts

interface BusinessInfo {
  name: string;
  description: string;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  geo: {
    latitude: number;
    longitude: number;
  };
  contact: {
    phone: string;
    email: string;
  };
  social: string[];
  hours: string[];
  priceRange: string;
}

interface RoomSchema {
  id: string;
  name: string;
  description: string;
  capacity: number;
  type: string;
  price: number;
  amenities: string[];
  images: string[];
}

interface BookingSchema {
  id: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  roomId: string;
  beds: number;
  totalPrice: number;
  status: string;
}

const baseUrl = 'https://lapacasahostel.com';

const businessInfo: BusinessInfo = {
  name: 'Lapa Casa Hostel',
  description: 'Hostel especializado em grupos grandes com 45 camas em 4 habitações no coração de Santa Teresa, Rio de Janeiro.',
  address: {
    street: 'Rua Silvio Romero 22',
    city: 'Santa Teresa',
    state: 'Rio de Janeiro',
    postalCode: '20241-000',
    country: 'BR',
  },
  geo: {
    latitude: -22.9068,
    longitude: -43.1729,
  },
  contact: {
    phone: '+55-21-9999-9999',
    email: 'reservas@lapacasahostel.com',
  },
  social: [
    'https://www.facebook.com/lapacasahostel',
    'https://www.instagram.com/lapacasahostel',
    'https://www.tripadvisor.com/Hotel_Review-g303506-d123456-Reviews-Lapa_Casa_Hostel-Rio_de_Janeiro.html',
  ],
  hours: ['Mo-Su 00:00-24:00'],
  priceRange: 'R$ 60 - R$ 120',
};

export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${baseUrl}/#organization`,
    name: businessInfo.name,
    url: baseUrl,
    logo: `${baseUrl}/images/logo-full.png`,
    image: `${baseUrl}/images/og-default.jpg`,
    description: businessInfo.description,
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: businessInfo.contact.phone,
        contactType: 'customer service',
        areaServed: businessInfo.address.country,
        availableLanguage: ['Portuguese', 'English', 'Spanish'],
        contactOption: 'TollFree',
      },
      {
        '@type': 'ContactPoint',
        email: businessInfo.contact.email,
        contactType: 'reservations',
        areaServed: businessInfo.address.country,
        availableLanguage: ['Portuguese', 'English', 'Spanish'],
      },
    ],
    address: {
      '@type': 'PostalAddress',
      streetAddress: businessInfo.address.street,
      addressLocality: businessInfo.address.city,
      addressRegion: businessInfo.address.state,
      postalCode: businessInfo.address.postalCode,
      addressCountry: businessInfo.address.country,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: businessInfo.geo.latitude,
      longitude: businessInfo.geo.longitude,
    },
    sameAs: businessInfo.social,
    founder: {
      '@type': 'Person',
      name: 'Proprietário Lapa Casa',
    },
    foundingDate: '2020',
    numberOfEmployees: '5-10',
  };
}

export function generateLodgingBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    '@id': `${baseUrl}/#lodging`,
    name: businessInfo.name,
    description: businessInfo.description,
    url: baseUrl,
    image: [
      `${baseUrl}/images/rooms/room-gallery-1.jpg`,
      `${baseUrl}/images/rooms/room-gallery-2.jpg`,
      `${baseUrl}/images/common-areas/lounge.jpg`,
      `${baseUrl}/images/exterior/facade.jpg`,
    ],
    priceRange: businessInfo.priceRange,
    currenciesAccepted: 'BRL',
    paymentAccepted: ['Credit Card', 'Debit Card', 'PIX', 'Cash'],
    telephone: businessInfo.contact.phone,
    email: businessInfo.contact.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: businessInfo.address.street,
      addressLocality: businessInfo.address.city,
      addressRegion: businessInfo.address.state,
      postalCode: businessInfo.address.postalCode,
      addressCountry: businessInfo.address.country,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: businessInfo.geo.latitude,
      longitude: businessInfo.geo.longitude,
    },
    openingHours: businessInfo.hours,
    checkinTime: '14:00',
    checkoutTime: '11:00',
    petsAllowed: false,
    smokingAllowed: false,
    numberOfRooms: 4,
    maximumAttendeeCapacity: 45,
    amenityFeature: [
      { '@type': 'LocationFeatureSpecification', name: 'Free WiFi', value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Shared Kitchen', value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Laundry Facilities', value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Common Area', value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Luggage Storage', value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Group Bookings', value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Security Lockers', value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Air Conditioning', value: true },
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
    review: generateSampleReviews(),
  };
}

export function generateRoomSchema(room: RoomSchema) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${baseUrl}/rooms/${room.id}#room`,
    name: room.name,
    description: room.description,
    image: room.images,
    category: 'Accommodation',
    brand: {
      '@type': 'Brand',
      name: businessInfo.name,
    },
    offers: {
      '@type': 'Offer',
      price: room.price.toString(),
      priceCurrency: 'BRL',
      priceValidUntil: '2024-12-31',
      availability: 'https://schema.org/InStock',
      url: `${baseUrl}/booking?room=${room.id}`,
      seller: {
        '@type': 'Organization',
        name: businessInfo.name,
      },
    },
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'Check-out', value: '11:00' },
    ],
    amenityFeature: room.amenities.map(amenity => ({
      '@type': 'LocationFeatureSpecification',
      name: amenity,
      value: true,
    })),
  };
}

export function generateBookingSchema(booking: BookingSchema) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LodgingReservation',
    '@id': `${baseUrl}/booking/${booking.id}#reservation`,
    reservationNumber: booking.id,
    reservationStatus: getReservationStatus(booking.status),
    underName: {
      '@type': 'Person',
      name: booking.guestName,
    },
    reservationFor: {
      '@type': 'LodgingBusiness',
      name: businessInfo.name,
      address: {
        '@type': 'PostalAddress',
        streetAddress: businessInfo.address.street,
        addressLocality: businessInfo.address.city,
        addressRegion: businessInfo.address.state,
        postalCode: businessInfo.address.postalCode,
        addressCountry: businessInfo.address.country,
      },
    },
    checkinTime: booking.checkIn,
    checkoutTime: booking.checkOut,
    numAdults: booking.beds,
    totalPrice: {
      '@type': 'PriceSpecification',
      price: booking.totalPrice,
      priceCurrency: 'BRL',
    },
    programMembershipUsed: {
      '@type': 'ProgramMembership',
      program: 'Group Discount',
    },
  };
}

export function generateWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${baseUrl}/#website`,
    url: baseUrl,
    name: businessInfo.name,
    description: businessInfo.description,
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
  };
}

export function generateBreadcrumbSchema(breadcrumbs: Array<{name: string, url: string}>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: `${baseUrl}${crumb.url}`,
    })),
  };
}

export function generateFAQSchema(faqs: Array<{question: string, answer: string}>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

export function generateLocalBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${baseUrl}/#localbusiness`,
    name: businessInfo.name,
    image: `${baseUrl}/images/exterior/facade.jpg`,
    telephone: businessInfo.contact.phone,
    email: businessInfo.contact.email,
    url: baseUrl,
    address: {
      '@type': 'PostalAddress',
      streetAddress: businessInfo.address.street,
      addressLocality: businessInfo.address.city,
      addressRegion: businessInfo.address.state,
      postalCode: businessInfo.address.postalCode,
      addressCountry: businessInfo.address.country,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: businessInfo.geo.latitude,
      longitude: businessInfo.geo.longitude,
    },
    openingHours: businessInfo.hours,
    priceRange: businessInfo.priceRange,
    paymentAccepted: ['Credit Card', 'Debit Card', 'PIX'],
    currenciesAccepted: 'BRL',
    hasMap: `https://www.google.com/maps/place/${businessInfo.geo.latitude},${businessInfo.geo.longitude}`,
  };
}

export function generateServiceSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${baseUrl}/booking#service`,
    name: 'Reserva de Grupos Lapa Casa Hostel',
    description: 'Serviço de reserva online especializado em grupos grandes com descuentos progressivos',
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
    serviceType: 'Group Accommodation',
    category: 'Hospitality',
  };
}

export function generateEventSchema(eventData: {
  name: string;
  checkIn: string;
  checkOut: string;
  totalPrice: number;
  beds: number;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: eventData.name,
    startDate: eventData.checkIn,
    endDate: eventData.checkOut,
    location: {
      '@type': 'Place',
      name: businessInfo.name,
      address: {
        '@type': 'PostalAddress',
        streetAddress: businessInfo.address.street,
        addressLocality: businessInfo.address.city,
        addressRegion: businessInfo.address.state,
        postalCode: businessInfo.address.postalCode,
        addressCountry: businessInfo.address.country,
      },
    },
    organizer: {
      '@id': `${baseUrl}/#organization`,
    },
    offers: {
      '@type': 'Offer',
      price: eventData.totalPrice.toString(),
      priceCurrency: 'BRL',
      url: `${baseUrl}/booking`,
    },
    maximumAttendeeCapacity: eventData.beds,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
  };
}

// Helper functions
function getReservationStatus(status: string) {
  const statusMap: Record<string, string> = {
    'PENDING': 'https://schema.org/ReservationPending',
    'CONFIRMED': 'https://schema.org/ReservationConfirmed',
    'CANCELLED': 'https://schema.org/ReservationCancelled',
    'PAYMENT_FAILED': 'https://schema.org/ReservationPending',
  };
  return statusMap[status] || 'https://schema.org/ReservationPending';
}

function generateSampleReviews() {
  return [
    {
      '@type': 'Review',
      author: {
        '@type': 'Person',
        name: 'Carlos Silva',
      },
      datePublished: '2024-01-15',
      reviewBody: 'Excelente hostel para grupos! Equipe muito atenciosa e localização perfeita em Santa Teresa. Os dormitórios são limpos e confortáveis.',
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
      reviewBody: 'Perfect location for groups visiting Rio. Clean facilities, great staff, and excellent group discounts!',
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
        name: 'João Santos',
      },
      datePublished: '2024-03-10',
      reviewBody: 'Ficamos em grupo de 15 pessoas e foi perfeito. Cozinha compartilhada bem equipada e área comum agradável.',
      reviewRating: {
        '@type': 'Rating',
        ratingValue: 4,
        bestRating: 5,
      },
    },
  ];
}

// Predefined room schemas for Lapa Casa Hostel
export const lapaCasaRooms: RoomSchema[] = [
  {
    id: 'room_mixto_12a',
    name: 'Mixto 12A',
    description: 'Dormitório compartilhado mixto com 12 camas, perfeito para grupos grandes que buscam economia e socialização.',
    capacity: 12,
    type: 'Mixed Dormitory',
    price: 60,
    amenities: ['Free WiFi', 'Air Conditioning', 'Security Lockers', 'Shared Bathroom'],
    images: [`${baseUrl}/images/rooms/mixto-12a-1.jpg`, `${baseUrl}/images/rooms/mixto-12a-2.jpg`],
  },
  {
    id: 'room_mixto_12b',
    name: 'Mixto 12B',
    description: 'Dormitório compartilhado mixto com 12 camas, ideal para grupos que procuram conforto e bom custo-benefício.',
    capacity: 12,
    type: 'Mixed Dormitory',
    price: 60,
    amenities: ['Free WiFi', 'Air Conditioning', 'Security Lockers', 'Shared Bathroom'],
    images: [`${baseUrl}/images/rooms/mixto-12b-1.jpg`, `${baseUrl}/images/rooms/mixto-12b-2.jpg`],
  },
  {
    id: 'room_mixto_7',
    name: 'Mixto 7',
    description: 'Dormitório compartilhado mixto com 7 camas, perfeito para grupos médios que valorizam mais privacidade.',
    capacity: 7,
    type: 'Mixed Dormitory',
    price: 60,
    amenities: ['Free WiFi', 'Air Conditioning', 'Security Lockers', 'Shared Bathroom'],
    images: [`${baseUrl}/images/rooms/mixto-7-1.jpg`, `${baseUrl}/images/rooms/mixto-7-2.jpg`],
  },
  {
    id: 'room_flexible_7',
    name: 'Flexible 7',
    description: 'Dormitório flexível com 7 camas, configurado como feminino por padrão, convertendo-se em mixto conforme demanda.',
    capacity: 7,
    type: 'Flexible Dormitory',
    price: 60,
    amenities: ['Free WiFi', 'Air Conditioning', 'Security Lockers', 'Shared Bathroom', 'Flexible Configuration'],
    images: [`${baseUrl}/images/rooms/flexible-7-1.jpg`, `${baseUrl}/images/rooms/flexible-7-2.jpg`],
  },
];

// Default FAQs for Lapa Casa Hostel
export const defaultFAQs = [
  {
    question: 'Qual o horário de check-in e check-out?',
    answer: 'Check-in: 14:00 | Check-out: 11:00. Check-in antecipado e check-out tardio podem ser solicitados conforme disponibilidade.',
  },
  {
    question: 'Vocês oferecem desconto para grupos?',
    answer: 'Sim! Oferecemos descuentos progressivos: 10% para 7-15 pessoas, 15% para 16-25 pessoas, e 20% para 26+ pessoas.',
  },
  {
    question: 'Como funciona a habitação flexível?',
    answer: 'A habitação Flexible 7 é configurada como feminina por padrão, mas converte-se automaticamente em mixta 48h antes da chegada se não houver reservas femininas.',
  },
  {
    question: 'Quais formas de pagamento vocês aceitam?',
    answer: 'Aceitamos cartões de crédito/débito via Stripe, PIX via Mercado Pago, e transferência bancária. Cobramos 30% de sinal e o restante 7 dias antes do check-in.',
  },
  {
    question: 'O hostel fica em que região do Rio?',
    answer: 'Estamos localizado em Santa Teresa, um dos bairros mais charmosos do Rio, próximo ao centro e com fácil acesso aos principais pontos turísticos.',
  },
];Room Type', value: room.type },
      { '@type': 'PropertyValue', name: 'Capacity', value: `${room.capacity} beds` },
      { '@type': 'PropertyValue', name: 'Check-in', value: '14:00' },
      { '@type': 'PropertyValue', name: '
