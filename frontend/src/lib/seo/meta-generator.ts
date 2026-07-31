// lapa-casa-hostel/frontend/src/lib/seo/meta-generator.ts

/**
 * SEO Meta Generator Library
 * 
 * Dynamic SEO meta tag generation for Lapa Casa Hostel pages.
 * Creates optimized titles, descriptions, and structured data.
 * 
 * @module lib/seo/meta-generator
 */

/**
 * Meta data interface
 */
interface MetaData {
  title: string;
  description: string;
  keywords: string[];
  ogImage?: string;
  canonical?: string;
}

/**
 * Page type for meta generation
 */
type PageType = 'home' | 'booking' | 'room' | 'about' | 'contact' | 'confirmation';

/**
 * Base site information
 */
const SITE_INFO = {
  name: 'Lapa Casa Hostel',
  tagline: 'Group Accommodation in Santa Teresa, Rio',
  description: 'Premium hostel in Santa Teresa specializing in group bookings. 45 beds, 4 rooms. Perfect for international groups and corporate events.',
  baseUrl: 'https://lapacasahostel.com'
} as const;

/**
 * Generate page title with proper formatting
 * 
 * @param pageTitle - Specific page title
 * @param includeSiteName - Whether to include site name
 * @returns Formatted title
 * 
 * @example
 * ```ts
 * generateTitle('Book Your Stay') // Returns: "Book Your Stay | Lapa Casa Hostel"
 * generateTitle('Home', false) // Returns: "Lapa Casa Hostel - Group Accommodation"
 * ```
 */
export function generateTitle(pageTitle?: string, includeSiteName: boolean = true): string {
  if (!pageTitle) {
    return `${SITE_INFO.name} - ${SITE_INFO.tagline}`;
  }

  return includeSiteName
    ? `${pageTitle} | ${SITE_INFO.name}`
    : pageTitle;
}

/**
 * Generate meta description with character limit
 * 
 * @param description - Page description
 * @param maxLength - Maximum character length
 * @returns Truncated description
 * 
 * @example
 * ```ts
 * generateDescription('Long description...', 160);
 * ```
 */
export function generateDescription(description: string, maxLength: number = 160): string {
  if (description.length <= maxLength) {
    return description;
  }

  return description.substring(0, maxLength - 3).trim() + '...';
}

/**
 * Generate keywords array from page content
 * 
 * @param baseKeywords - Base keywords
 * @param additionalKeywords - Additional page-specific keywords
 * @returns Combined keywords array
 * 
 * @example
 * ```ts
 * generateKeywords(['hostel'], ['booking', 'groups']);
 * ```
 */
export function generateKeywords(
  baseKeywords: string[] = [],
  additionalKeywords: string[] = []
): string[] {
  const defaultKeywords = [
    'lapa casa hostel',
    'hostel rio de janeiro',
    'santa teresa accommodation',
    'group booking',
    'hostel groups'
  ];

  return [...new Set([...defaultKeywords, ...baseKeywords, ...additionalKeywords])];
}

/**
 * Generate Open Graph image URL
 * 
 * @param imagePath - Relative image path
 * @returns Full image URL
 * 
 * @example
 * ```ts
 * generateOGImage('/images/room.jpg');
 * // Returns: "https://lapacasahostel.com/images/room.jpg"
 * ```
 */
export function generateOGImage(imagePath?: string): string {
  const defaultImage = '/images/og-default.jpg';
  const image = imagePath || defaultImage;
  
  return image.startsWith('http')
    ? image
    : `${SITE_INFO.baseUrl}${image}`;
}

/**
 * Generate canonical URL
 * 
 * @param path - Page path
 * @returns Canonical URL
 * 
 * @example
 * ```ts
 * generateCanonicalURL('/booking');
 * // Returns: "https://lapacasahostel.com/booking"
 * ```
 */
export function generateCanonicalURL(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_INFO.baseUrl}${cleanPath}`;
}

/**
 * Generate complete meta data for page type
 * 
 * @param pageType - Type of page
 * @param customData - Custom meta data overrides
 * @returns Complete meta data object
 * 
 * @example
 * ```ts
 * const meta = generatePageMeta('booking', {
 *   title: 'Custom Booking Title'
 * });
 * ```
 */
export function generatePageMeta(
  pageType: PageType,
  customData?: Partial<MetaData>
): MetaData {
  const baseMeta = getBaseMetaForPageType(pageType);

  return {
    ...baseMeta,
    ...customData,
    keywords: customData?.keywords
      ? generateKeywords(baseMeta.keywords, customData.keywords)
      : baseMeta.keywords
  };
}

/**
 * Get base meta data for specific page type
 * 
 * @param pageType - Type of page
 * @returns Base meta data
 */
function getBaseMetaForPageType(pageType: PageType): MetaData {
  const metaTemplates: Record<PageType, MetaData> = {
    home: {
      title: 'Group Accommodation in Santa Teresa',
      description: 'Premium hostel specializing in group bookings. 45 beds across 4 rooms. Located in Santa Teresa, Rio de Janeiro. Perfect for international groups, corporate events, and backpackers.',
      keywords: ['group hostel', 'santa teresa', 'corporate accommodation', 'rio de janeiro'],
      ogImage: '/images/hostel-exterior.jpg',
      canonical: '/'
    },
    booking: {
      title: 'Book Your Group Stay',
      description: 'Reserve beds at Lapa Casa Hostel with instant confirmation. Group discounts up to 20%. Flexible cancellation policy. Best rates guaranteed.',
      keywords: ['hostel booking', 'group reservation', 'book hostel rio', 'instant confirmation'],
      ogImage: '/images/booking-page.jpg',
      canonical: '/booking'
    },
    room: {
      title: 'Our Rooms & Dormitories',
      description: 'Explore our 4 spacious dormitories: Mixto 12A (12 beds), Mixto 12B (12 beds), Mixto 7 (7 beds), and Flexible 7 (7 beds). Modern amenities included.',
      keywords: ['hostel rooms', 'dormitory', 'shared accommodation', 'hostel beds'],
      ogImage: '/images/rooms-overview.jpg',
      canonical: '/rooms'
    },
    about: {
      title: 'About Lapa Casa Hostel',
      description: 'Learn about our family-run hostel in Santa Teresa. Since 2010, we specialize in creating memorable experiences for group travelers in Rio de Janeiro.',
      keywords: ['about hostel', 'hostel history', 'family hostel', 'santa teresa history'],
      ogImage: '/images/about-us.jpg',
      canonical: '/about'
    },
    contact: {
      title: 'Contact Us',
      description: 'Get in touch with Lapa Casa Hostel. Located at Rua Silvio Romero 22, Santa Teresa, Rio de Janeiro. Quick response guaranteed within 24 hours.',
      keywords: ['contact hostel', 'hostel address', 'hostel phone', 'hostel email'],
      ogImage: '/images/location.jpg',
      canonical: '/contact'
    },
    confirmation: {
      title: 'Booking Confirmed',
      description: 'Your booking at Lapa Casa Hostel has been confirmed. Check your email for booking details and check-in information.',
      keywords: ['booking confirmation', 'reservation confirmed'],
      ogImage: '/images/confirmation.jpg',
      canonical: '/confirmation'
    }
  };

  return metaTemplates[pageType];
}

/**
 * Generate room-specific meta data
 * 
 * @param roomName - Room name
 * @param roomDetails - Room details
 * @returns Room meta data
 * 
 * @example
 * ```ts
 * const meta = generateRoomMeta('Mixto 12A', {
 *   capacity: 12,
 *   price: 60,
 *   type: 'mixed'
 * });
 * ```
 */
export function generateRoomMeta(
  roomName: string,
  roomDetails: {
    capacity: number;
    price: number;
    type: string;
    amenities?: string[];
  }
): MetaData {
  const { capacity, price, type, amenities = [] } = roomDetails;

  return {
    title: `${roomName} - ${capacity} Bed ${type === 'mixed' ? 'Mixed' : 'Female'} Dormitory`,
    description: `Book ${roomName} at Lapa Casa Hostel. ${capacity}-bed ${type} dormitory from R$${price}/night. ${amenities.length > 0 ? `Amenities: ${amenities.join(', ')}.` : ''} Group discounts available.`,
    keywords: [
      roomName.toLowerCase(),
      `${capacity} bed dormitory`,
      `${type} dormitory`,
      'hostel room rio'
    ],
    ogImage: `/images/rooms/${roomName.toLowerCase().replace(/\s+/g, '-')}.jpg`,
    canonical: `/rooms/${roomName.toLowerCase().replace(/\s+/g, '-')}`
  };
}

/**
 * Generate booking confirmation meta data
 * 
 * @param bookingId - Booking ID
 * @param guestName - Guest name
 * @returns Confirmation meta data
 */
export function generateConfirmationMeta(
  bookingId: string,
  guestName: string
): MetaData {
  return {
    title: 'Booking Confirmed - Thank You!',
    description: `Thank you ${guestName}! Your booking (ID: ${bookingId}) at Lapa Casa Hostel has been confirmed. Check your email for details.`,
    keywords: ['booking confirmed', 'reservation success'],
    ogImage: '/images/confirmation-success.jpg',
    canonical: `/confirmation/${bookingId}`
  };
}

/**
 * Generate breadcrumb structured data
 * 
 * @param breadcrumbs - Breadcrumb items
 * @returns Structured data object
 * 
 * @example
 * ```ts
 * const breadcrumb = generateBreadcrumb([
 *   { name: 'Home', url: '/' },
 *   { name: 'Rooms', url: '/rooms' }
 * ]);
 * ```
 */
export function generateBreadcrumb(
  breadcrumbs: Array<{ name: string; url: string }>
): Record<string, any> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${SITE_INFO.baseUrl}${item.url}`
    }))
  };
}

/**
 * Generate FAQ structured data
 * 
 * @param faqs - FAQ items
 * @returns Structured data object
 */
export function generateFAQSchema(
  faqs: Array<{ question: string; answer: string }>
): Record<string, any> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  };
}
