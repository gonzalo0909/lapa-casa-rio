// src/lib/seo/meta-generator.ts
import type { Metadata } from 'next';

interface MetaGeneratorProps {
  title?: string;
  description?: string;
  keywords?: string[];
  path?: string;
  locale?: 'pt' | 'en' | 'es';
  type?: 'website' | 'article' | 'product';
  price?: string;
  images?: string[];
  noIndex?: boolean;
  canonical?: string;
}

interface RoomMetaData {
  roomId: string;
  roomName: string;
  capacity: number;
  price: string;
  type: 'mixed' | 'female' | 'flexible';
  description: string;
  amenities: string[];
}

const baseUrl = 'https://lapacasahostel.com';

const seoDefaults = {
  pt: {
    siteName: 'Lapa Casa Hostel',
    defaultTitle: 'Lapa Casa Hostel - Especialista em Grupos | Santa Teresa Rio',
    defaultDescription: 'Hostel especializado em grupos grandes com 45 camas em 4 habitações. Descontos até 20% para grupos. Localizado no coração de Santa Teresa, Rio de Janeiro.',
    keywords: [
      'hostel rio de janeiro',
      'santa teresa hostel', 
      'lapa casa hostel',
      'reserva grupos',
      'hostel grupos grandes',
      'accommodation rio',
      'backpacker rio',
      'group booking',
      'hostel descuentos',
      'hostel barato rio',
      'dormitorio compartilhado',
      'reservas diretas',
    ],
  },
  en: {
    siteName: 'Lapa Casa Hostel',
    defaultTitle: 'Lapa Casa Hostel - Group Specialist | Santa Teresa Rio',
    defaultDescription: 'Hostel specialized in large groups with 45 beds in 4 rooms. Up to 20% discounts for groups. Located in the heart of Santa Teresa, Rio de Janeiro.',
    keywords: [
      'hostel rio de janeiro',
      'santa teresa hostel',
      'lapa casa hostel', 
      'group bookings',
      'large group accommodation',
      'rio hostel',
      'backpacker rio',
      'group discounts',
      'cheap hostel rio',
      'shared dormitory',
      'direct bookings',
    ],
  },
  es: {
    siteName: 'Lapa Casa Hostel',
    defaultTitle: 'Lapa Casa Hostel - Especialista en Grupos | Santa Teresa Rio',
    defaultDescription: 'Hostel especializado en grupos grandes con 45 camas en 4 habitaciones. Descuentos hasta 20% para grupos. Ubicado en el corazón de Santa Teresa, Rio de Janeiro.',
    keywords: [
      'hostel rio de janeiro',
      'santa teresa hostel',
      'lapa casa hostel',
      'reservas grupos',
      'hostel grupos grandes', 
      'accommodation rio',
      'backpacker rio',
      'reservas grupos',
      'hostel descuentos',
      'hostel barato rio',
      'dormitorio compartido',
      'reservas directas',
    ],
  },
};

export function generatePageMeta({
  title,
  description,
  keywords = [],
  path = '/',
  locale = 'pt',
  type = 'website',
  price,
  images = [],
  noIndex = false,
  canonical,
}: MetaGeneratorProps): Metadata {
  const seo = seoDefaults[locale];
  const currentUrl = `${baseUrl}${path}`;
  const canonicalUrl = canonical || currentUrl;
  
  // Generar título optimizado
  const finalTitle = title 
    ? `${title} | ${seo.siteName}`
    : seo.defaultTitle;

  // Generar descripción optimizada
  const finalDescription = description || seo.defaultDescription;

  // Combinar keywords
  const allKeywords = [...seo.keywords, ...keywords];

  // Generar imágenes optimizadas
  const defaultImages = [`${baseUrl}/images/og-default.jpg`];
  const finalImages = images.length > 0 ? images : defaultImages;

  // URLs alternos para idiomas
  const alternates = {
    canonical: canonicalUrl,
    languages: {
      'pt': path.replace(/^\/(en|es)/, ''),
      'en': `/en${path.replace(/^\/(en|es)/, '')}`,
      'es': `/es${path.replace(/^\/(en|es)/, '')}`,
    },
  };

  return {
    title: finalTitle,
    description: finalDescription,
    keywords: allKeywords.join(', '),
    robots: noIndex ? 'noindex,nofollow' : 'index,follow',
    alternates,
    openGraph: {
      type,
      title: finalTitle,
      description: finalDescription,
      url: currentUrl,
      siteName: seo.siteName,
      images: finalImages.map(image => ({
        url: image,
        width: 1200,
        height: 630,
        alt: finalTitle,
      })),
      locale: locale === 'pt' ? 'pt_BR' : locale === 'en' ? 'en_US' : 'es_ES',
    },
    twitter: {
      card: 'summary_large_image',
      site: '@lapacasahostel',
      creator: '@lapacasahostel',
      title: finalTitle,
      description: finalDescription,
      images: finalImages,
    },
    verification: {
      google: 'your-google-verification-code',
      yandex: 'your-yandex-verification-code',
    },
    other: {
      'geo.region': 'BR-RJ',
      'geo.placename': 'Santa Teresa, Rio de Janeiro',
      'geo.position': '-22.9068;-43.1729',
      'ICBM': '-22.9068, -43.1729',
      'price-range': price || 'R$ 60 - R$ 120',
      'capacity': '45 beds',
      'check-in': '14:00',
      'check-out': '11:00',
      'property-type': 'hostel',
    },
  };
}

export function generateRoomMeta(roomData: RoomMetaData, locale: 'pt' | 'en' | 'es' = 'pt'): Metadata {
  const seo = seoDefaults[locale];
  
  const roomTypeLabels = {
    pt: {
      mixed: 'Mixto',
      female: 'Feminino',
      flexible: 'Flexível',
    },
    en: {
      mixed: 'Mixed',
      female: 'Female',
      flexible: 'Flexible',
    },
    es: {
      mixed: 'Mixto',
      female: 'Femenino',
      flexible: 'Flexible',
    },
  };

  const roomLabel = roomTypeLabels[locale][roomData.type];
  
  const title = locale === 'pt'
    ? `${roomData.roomName} - ${roomLabel} ${roomData.capacity} Camas | ${roomData.price}/noite`
    : locale === 'en'
    ? `${roomData.roomName} - ${roomLabel} ${roomData.capacity} Beds | ${roomData.price}/night`
    : `${roomData.roomName} - ${roomLabel} ${roomData.capacity} Camas | ${roomData.price}/noche`;

  const description = locale === 'pt'
    ? `Reserve ${roomData.roomName} com ${roomData.capacity} camas por apenas ${roomData.price} por noite. ${roomData.description} Localizado em Santa Teresa, Rio de Janeiro.`
    : locale === 'en' 
    ? `Book ${roomData.roomName} with ${roomData.capacity} beds for just ${roomData.price} per night. ${roomData.description} Located in Santa Teresa, Rio de Janeiro.`
    : `Reserva ${roomData.roomName} con ${roomData.capacity} camas por solo ${roomData.price} por noche. ${roomData.description} Ubicado en Santa Teresa, Rio de Janeiro.`;

  const roomKeywords = [
    roomData.roomName.toLowerCase(),
    `${roomData.type} dormitory`,
    `${roomData.capacity} beds`,
    roomData.price,
    ...roomData.amenities.map(a => a.toLowerCase()),
  ];

  return generatePageMeta({
    title,
    description,
    keywords: roomKeywords,
    path: `/rooms/${roomData.roomId}`,
    locale,
    type: 'product',
    price: roomData.price,
    images: [
      `${baseUrl}/images/rooms/${roomData.roomId}-1.jpg`,
      `${baseUrl}/images/rooms/${roomData.roomId}-2.jpg`,
    ],
  });
}

export function generateBookingMeta(
  step: 'dates' | 'rooms' | 'guests' | 'payment' | 'confirmation',
  locale: 'pt' | 'en' | 'es' = 'pt',
  data?: any
): Metadata {
  const seo = seoDefaults[locale];
  
  const stepTitles = {
    pt: {
      dates: 'Selecionar Datas - Reserva Online',
      rooms: 'Escolher Habitação - Reserva Online', 
      guests: 'Dados dos Hóspedes - Reserva Online',
      payment: 'Pagamento Seguro - Finalizar Reserva',
      confirmation: 'Reserva Confirmada - Obrigado!',
    },
    en: {
      dates: 'Select Dates - Online Booking',
      rooms: 'Choose Room - Online Booking',
      guests: 'Guest Details - Online Booking', 
      payment: 'Secure Payment - Complete Booking',
      confirmation: 'Booking Confirmed - Thank You!',
    },
    es: {
      dates: 'Seleccionar Fechas - Reserva Online',
      rooms: 'Elegir Habitación - Reserva Online',
      guests: 'Datos de Huéspedes - Reserva Online',
      payment: 'Pago Seguro - Finalizar Reserva', 
      confirmation: 'Reserva Confirmada - ¡Gracias!',
    },
  };

  const stepDescriptions = {
    pt: {
      dates: 'Escolha suas datas de check-in e check-out para ver disponibilidade e preços com desconto para grupos.',
      rooms: 'Selecione a melhor habitação para seu grupo com preços especiais e disponibilidade em tempo real.',
      guests: 'Preencha os dados dos hóspedes para finalizar sua reserva no Lapa Casa Hostel.',
      payment: 'Finalize sua reserva com pagamento 100% seguro via Stripe ou PIX. Sem taxas extras.',
      confirmation: 'Sua reserva foi confirmada! Detalhes enviados por email. Bem-vindo ao Lapa Casa Hostel!',
    },
    en: {
      dates: 'Choose your check-in and check-out dates to see availability and group discount prices.',
      rooms: 'Select the best room for your group with special rates and real-time availability.',
      guests: 'Fill in guest details to complete your Lapa Casa Hostel booking.',
      payment: 'Complete your booking with 100% secure payment via Stripe or PIX. No extra fees.',
      confirmation: 'Your booking is confirmed! Details sent by email. Welcome to Lapa Casa Hostel!',
    },
    es: {
      dates: 'Elige tus fechas de entrada y salida para ver disponibilidad y precios con descuento para grupos.',
      rooms: 'Selecciona la mejor habitación para tu grupo con tarifas especiales y disponibilidad en tiempo real.',
      guests: 'Completa los datos de los huéspedes para finalizar tu reserva en Lapa Casa Hostel.',
      payment: 'Finaliza tu reserva con pago 100% seguro vía Stripe o PIX. Sin comisiones extras.',
      confirmation: '¡Tu reserva está confirmada! Detalles enviados por email. ¡Bienvenido a Lapa Casa Hostel!',
    },
  };

  const title = stepTitles[locale][step];
  const description = stepDescriptions[locale][step];

  // Para confirmation, não indexar
  const noIndex = step === 'confirmation' || step === 'payment';

  return generatePageMeta({
    title,
    description,
    path: `/booking${step !== 'dates' ? `/${step}` : ''}`,
    locale,
    type: 'website',
    noIndex,
    keywords: ['reserva online', 'booking', 'grupo', 'desconto', 'santa teresa'],
  });
}

export function generateErrorMeta(
  errorCode: 404 | 500,
  locale: 'pt' | 'en' | 'es' = 'pt'
): Metadata {
  const errorTitles = {
    pt: {
      404: 'Página Não Encontrada - Lapa Casa Hostel',
      500: 'Erro do Servidor - Lapa Casa Hostel',
    },
    en: {
      404: 'Page Not Found - Lapa Casa Hostel',
      500: 'Server Error - Lapa Casa Hostel', 
    },
    es: {
      404: 'Página No Encontrada - Lapa Casa Hostel',
      500: 'Error del Servidor - Lapa Casa Hostel',
    },
  };

  const errorDescriptions = {
    pt: {
      404: 'A página que você procura não foi encontrada. Visite nossa página inicial para fazer sua reserva.',
      500: 'Ocorreu um erro temporário. Tente novamente em alguns momentos ou entre em contato conosco.',
    },
    en: {
      404: 'The page you are looking for was not found. Visit our homepage to make your booking.',
      500: 'A temporary error occurred. Please try again in a few moments or contact us.',
    },
    es: {
      404: 'La página que buscas no fue encontrada. Visita nuestra página principal para hacer tu reserva.',
      500: 'Ocurrió un error temporal. Intenta nuevamente en unos momentos o contáctanos.',
    },
  };

  return generatePageMeta({
    title: errorTitles[locale][errorCode],
    description: errorDescriptions[locale][errorCode],
    locale,
    noIndex: true,
  });
}
