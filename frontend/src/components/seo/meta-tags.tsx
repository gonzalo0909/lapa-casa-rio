// lapa-casa-hostel/frontend/src/components/seo/meta-tags.tsx

/**
 * Meta Tags Component
 * 
 * Comprehensive SEO meta tags generator for Lapa Casa Hostel.
 * Handles Open Graph, Twitter Cards, canonical URLs, and multi-language support.
 * 
 * @module components/seo/meta-tags
 * @requires next/head
 * @requires next-intl
 */

import Head from 'next/head';
import { useTranslations, useLocale } from 'next-intl';

/**
 * Meta tags configuration interface
 */
interface MetaTagsProps {
  /** Page title (will be appended with site name) */
  title?: string;
  /** Meta description for search engines */
  description?: string;
  /** Canonical URL for the page */
  canonicalUrl?: string;
  /** Open Graph image URL */
  ogImage?: string;
  /** Open Graph type (website, article, etc.) */
  ogType?: 'website' | 'article' | 'product' | 'profile';
  /** Twitter card type */
  twitterCard?: 'summary' | 'summary_large_image' | 'app' | 'player';
  /** Additional keywords for SEO */
  keywords?: string[];
  /** Article published date (ISO format) */
  publishedTime?: string;
  /** Article modified date (ISO format) */
  modifiedTime?: string;
  /** Author name */
  author?: string;
  /** Prevent search engine indexing */
  noindex?: boolean;
  /** Prevent following links */
  nofollow?: boolean;
  /** Structured data JSON-LD (will be stringified) */
  jsonLd?: Record<string, any>;
  /** Alternative language URLs */
  alternateUrls?: {
    locale: string;
    url: string;
  }[];
}

/**
 * Default SEO configuration for Lapa Casa Hostel
 */
const DEFAULT_SEO = {
  siteName: 'Lapa Casa Hostel',
  defaultTitle: 'Lapa Casa Hostel - Group Accommodation in Santa Teresa, Rio',
  defaultDescription: 'Premium hostel in Santa Teresa, Rio de Janeiro. Specializing in group bookings with 45 beds across 4 rooms. Perfect for international groups, corporate events, and travelers.',
  baseUrl: 'https://lapacasahostel.com',
  defaultImage: '/images/og-default.jpg',
  twitterHandle: '@lapacasahostel',
  facebookAppId: '1234567890',
  locale: {
    pt: 'pt_BR',
    en: 'en_US',
    es: 'es_ES'
  }
} as const;

/**
 * Default keywords for Lapa Casa Hostel
 */
const DEFAULT_KEYWORDS = [
  'hostel rio de janeiro',
  'santa teresa accommodation',
  'group booking hostel',
  'lapa casa hostel',
  'hostel groups rio',
  'corporate accommodation rio',
  'backpacker hostel',
  'budget accommodation rio'
];

/**
 * MetaTags Component
 * 
 * Generates comprehensive SEO meta tags for each page.
 * Automatically handles internationalization and Open Graph tags.
 * 
 * @example
 * ```tsx
 * <MetaTags
 *   title="Book Your Stay"
 *   description="Reserve beds at Lapa Casa Hostel with instant confirmation"
 *   canonicalUrl="/booking"
 *   ogImage="/images/booking-page.jpg"
 * />
 * ```
 */
export function MetaTags({
  title,
  description,
  canonicalUrl,
  ogImage,
  ogType = 'website',
  twitterCard = 'summary_large_image',
  keywords = [],
  publishedTime,
  modifiedTime,
  author,
  noindex = false,
  nofollow = false,
  jsonLd,
  alternateUrls = []
}: MetaTagsProps) {
  const t = useTranslations('seo');
  const locale = useLocale();

  const fullTitle = title 
    ? `${title} | ${DEFAULT_SEO.siteName}`
    : DEFAULT_SEO.defaultTitle;

  const metaDescription = description || DEFAULT_SEO.defaultDescription;

  const fullCanonicalUrl = canonicalUrl
    ? `${DEFAULT_SEO.baseUrl}${canonicalUrl}`
    : DEFAULT_SEO.baseUrl;

  const fullOgImage = ogImage
    ? (ogImage.startsWith('http') ? ogImage : `${DEFAULT_SEO.baseUrl}${ogImage}`)
    : `${DEFAULT_SEO.baseUrl}${DEFAULT_SEO.defaultImage}`;

  const allKeywords = [...DEFAULT_KEYWORDS, ...keywords];

  const robotsContent = [
    noindex ? 'noindex' : 'index',
    nofollow ? 'nofollow' : 'follow'
  ].join(', ');

  const ogLocale = DEFAULT_SEO.locale[locale as keyof typeof DEFAULT_SEO.locale] || DEFAULT_SEO.locale.en;

  const alternates = alternateUrls.length > 0
    ? alternateUrls
    : [
        { locale: 'pt', url: `${DEFAULT_SEO.baseUrl}/pt${canonicalUrl || ''}` },
        { locale: 'en', url: `${DEFAULT_SEO.baseUrl}/en${canonicalUrl || ''}` },
        { locale: 'es', url: `${DEFAULT_SEO.baseUrl}/es${canonicalUrl || ''}` }
      ];

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={metaDescription} />
      <meta name="keywords" content={allKeywords.join(', ')} />
      <meta name="robots" content={robotsContent} />
      {author && <meta name="author" content={author} />}

      <link rel="canonical" href={fullCanonicalUrl} />

      {alternates.map((alt) => (
        <link
          key={alt.locale}
          rel="alternate"
          hrefLang={alt.locale}
          href={alt.url}
        />
      ))}
      <link rel="alternate" hrefLang="x-default" href={fullCanonicalUrl} />

      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content={DEFAULT_SEO.siteName} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:url" content={fullCanonicalUrl} />
      <meta property="og:image" content={fullOgImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={title || DEFAULT_SEO.siteName} />
      <meta property="og:locale" content={ogLocale} />
      {DEFAULT_SEO.facebookAppId && (
        <meta property="fb:app_id" content={DEFAULT_SEO.facebookAppId} />
      )}

      {ogType === 'article' && (
        <>
          {publishedTime && (
            <meta property="article:published_time" content={publishedTime} />
          )}
          {modifiedTime && (
            <meta property="article:modified_time" content={modifiedTime} />
          )}
          {author && <meta property="article:author" content={author} />}
        </>
      )}

      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:site" content={DEFAULT_SEO.twitterHandle} />
      <meta name="twitter:creator" content={DEFAULT_SEO.twitterHandle} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={fullOgImage} />
      <meta name="twitter:image:alt" content={title || DEFAULT_SEO.siteName} />

      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
      <meta name="theme-color" content="#0EA5E9" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content={DEFAULT_SEO.siteName} />

      <meta name="geo.region" content="BR-RJ" />
      <meta name="geo.placename" content="Santa Teresa, Rio de Janeiro" />
      <meta name="geo.position" content="-22.9145;-43.1852" />
      <meta name="ICBM" content="-22.9145, -43.1852" />

      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd)
          }}
        />
      )}

      <link rel="icon" type="image/x-icon" href="/favicon.ico" />
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      <link rel="manifest" href="/manifest.json" />

      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://www.google-analytics.com" />
      <link rel="dns-prefetch" href="https://js.stripe.com" />
      <link rel="dns-prefetch" href="https://sdk.mercadopago.com" />

      <meta name="google-site-verification" content="your-google-verification-code" />
      <meta name="facebook-domain-verification" content="your-fb-verification-code" />
    </Head>
  );
}

/**
 * Hook to generate page-specific meta tags
 * 
 * @example
 * ```tsx
 * const { renderMetaTags } = usePageMeta();
 * 
 * return (
 *   <>
 *     {renderMetaTags({
 *       title: 'Booking',
 *       description: 'Book your group stay'
 *     })}
 *   </>
 * );
 * ```
 */
export function usePageMeta() {
  const locale = useLocale();

  const renderMetaTags = (props: MetaTagsProps) => {
    return <MetaTags {...props} />;
  };

  return {
    renderMetaTags,
    locale,
    baseUrl: DEFAULT_SEO.baseUrl
  };
}

/**
 * Predefined meta configurations for common pages
 */
export const PAGE_METAS = {
  home: {
    title: 'Group Accommodation in Santa Teresa',
    description: 'Premium hostel specializing in group bookings. 45 beds, 4 rooms. Perfect for international groups and corporate events in Rio de Janeiro.',
    keywords: ['group hostel rio', 'santa teresa hostel', 'corporate accommodation']
  },
  booking: {
    title: 'Book Your Group Stay',
    description: 'Reserve beds at Lapa Casa Hostel with instant confirmation. Group discounts available. Flexible cancellation policy.',
    keywords: ['hostel booking', 'group reservation', 'book hostel rio']
  },
  rooms: {
    title: 'Our Rooms & Dormitories',
    description: 'Explore our 4 spacious dormitories: Mixto 12A, Mixto 12B, Mixto 7, and Flexible 7. All rooms with modern amenities.',
    keywords: ['hostel rooms', 'dormitory', 'shared accommodation']
  },
  about: {
    title: 'About Lapa Casa Hostel',
    description: 'Learn about our hostel in the heart of Santa Teresa. Family-run business focused on creating memorable experiences for groups.',
    keywords: ['about hostel', 'santa teresa', 'hostel history']
  },
  contact: {
    title: 'Contact Us',
    description: 'Get in touch with Lapa Casa Hostel. Located at Rua Silvio Romero 22, Santa Teresa, Rio de Janeiro. Quick response guaranteed.',
    keywords: ['contact hostel', 'hostel address', 'hostel phone']
  }
} as const;

export default MetaTags;
