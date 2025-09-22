// src/components/seo/meta-tags.tsx
'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';

interface MetaTagsProps {
  title?: string;
  description?: string;
  keywords?: string[];
  image?: string;
  type?: 'website' | 'article' | 'product';
  locale?: string;
  canonicalUrl?: string;
  noIndex?: boolean;
  structuredData?: object;
}

export default function MetaTags({
  title,
  description,
  keywords = [],
  image,
  type = 'website',
  locale = 'pt-BR',
  canonicalUrl,
  noIndex = false,
  structuredData,
}: MetaTagsProps) {
  const t = useTranslations('seo');
  const pathname = usePathname();
  
  const baseUrl = 'https://lapacasahostel.com';
  const currentUrl = canonicalUrl || `${baseUrl}${pathname}`;
  
  // SEO defaults específicos para Lapa Casa Hostel
  const defaultTitle = t('defaultTitle', {
    name: 'Lapa Casa Hostel',
    location: 'Santa Teresa Rio',
  });
  
  const defaultDescription = t('defaultDescription', {
    capacity: '45 camas',
    rooms: '4 habitaciones',
    specialty: 'grupos grandes',
    location: 'Santa Teresa, Rio de Janeiro',
  });

  const defaultKeywords = [
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
  ];

  const finalTitle = title || defaultTitle;
  const finalDescription = description || defaultDescription;
  const finalKeywords = [...defaultKeywords, ...keywords];
  const finalImage = image || `${baseUrl}/images/og-default.jpg`;

  // Generar alternate URLs para idiomas
  const alternateUrls = {
    'pt-BR': currentUrl.replace(/\/(en|es)\//, '/'),
    'en-US': currentUrl.replace(/\/(pt|es)\//, '/en/'),
    'es-ES': currentUrl.replace(/\/(pt|en)\//, '/es/'),
  };

  return (
    <>
      {/* Meta Tags Básicos */}
      <title>{finalTitle}</title>
      <meta name="description" content={finalDescription} />
      <meta name="keywords" content={finalKeywords.join(', ')} />
      
      {/* Robots & Indexing */}
      <meta name="robots" content={noIndex ? 'noindex,nofollow' : 'index,follow'} />
      <meta name="googlebot" content={noIndex ? 'noindex,nofollow' : 'index,follow'} />
      
      {/* Canonical URL */}
      <link rel="canonical" href={currentUrl} />
      
      {/* Alternate URLs para idiomas */}
      <link rel="alternate" hrefLang="pt-BR" href={alternateUrls['pt-BR']} />
      <link rel="alternate" hrefLang="en-US" href={alternateUrls['en-US']} />
      <link rel="alternate" hrefLang="es-ES" href={alternateUrls['es-ES']} />
      <link rel="alternate" hrefLang="x-default" href={alternateUrls['pt-BR']} />
      
      {/* Open Graph Meta Tags */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={finalTitle} />
      <meta property="og:description" content={finalDescription} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:image" content={finalImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={finalTitle} />
      <meta property="og:site_name" content="Lapa Casa Hostel" />
      <meta property="og:locale" content={locale} />
      
      {/* Facebook específico */}
      <meta property="fb:admins" content="lapacasahostel" />
      
      {/* Twitter Card Meta Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@lapacasahostel" />
      <meta name="twitter:creator" content="@lapacasahostel" />
      <meta name="twitter:title" content={finalTitle} />
      <meta name="twitter:description" content={finalDescription} />
      <meta name="twitter:image" content={finalImage} />
      <meta name="twitter:image:alt" content={finalTitle} />
      
      {/* Geo Tags para localización */}
      <meta name="geo.region" content="BR-RJ" />
      <meta name="geo.placename" content="Santa Teresa, Rio de Janeiro" />
      <meta name="geo.position" content="-22.9068;-43.1729" />
      <meta name="ICBM" content="-22.9068, -43.1729" />
      
      {/* Business/Contact Info */}
      <meta name="contact" content="reservas@lapacasahostel.com" />
      <meta name="author" content="Lapa Casa Hostel" />
      <meta name="reply-to" content="reservas@lapacasahostel.com" />
      <meta name="owner" content="Lapa Casa Hostel" />
      
      {/* Mobile & App */}
      <meta name="format-detection" content="telephone=yes" />
      <meta name="format-detection" content="address=yes" />
      <meta name="format-detection" content="email=yes" />
      
      {/* Apple específico */}
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="Lapa Casa Hostel" />
      
      {/* Booking/Business específico */}
      <meta name="booking-engine" content="custom" />
      <meta name="price-range" content="R$ 60-120" />
      <meta name="capacity" content="45 beds" />
      <meta name="check-in" content="14:00" />
      <meta name="check-out" content="11:00" />
      <meta name="property-type" content="hostel" />
      <meta name="target-audience" content="groups, backpackers, travelers" />
      
      {/* Performance & Security */}
      <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
      <meta name="referrer" content="strict-origin-when-cross-origin" />
      
      {/* Structured Data JSON-LD */}
      {structuredData && (
        <script 
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      )}
      
      {/* Preconnect para performance */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://js.stripe.com" />
      <link rel="preconnect" href="https://sdk.mercadopago.com" />
      
      {/* DNS Prefetch para APIs externas */}
      <link rel="dns-prefetch" href="//api.stripe.com" />
      <link rel="dns-prefetch" href="//api.mercadopago.com" />
      <link rel="dns-prefetch" href="//sheets.googleapis.com" />
    </>
  );
}
