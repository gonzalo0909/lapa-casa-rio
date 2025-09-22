// src/lib/seo/sitemap-generator.ts
import { MetadataRoute } from 'next';

interface SitemapUrl {
  url: string;
  lastModified?: string | Date;
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

interface SitemapSection {
  name: string;
  urls: SitemapUrl[];
  enabled: boolean;
}

const baseUrl = 'https://lapacasahostel.com';

// Configuración de páginas estáticas
const staticPages = [
  {
    path: '/',
    changeFrequency: 'daily' as const,
    priority: 1.0,
    localized: true,
  },
  {
    path: '/booking',
    changeFrequency: 'daily' as const,
    priority: 0.9,
    localized: true,
  },
  {
    path: '/rooms',
    changeFrequency: 'weekly' as const,
    priority: 0.8,
    localized: true,
  },
  {
    path: '/about',
    changeFrequency: 'monthly' as const,
    priority: 0.6,
    localized: true,
  },
  {
    path: '/contact',
    changeFrequency: 'monthly' as const,
    priority: 0.5,
    localized: true,
  },
  {
    path: '/gallery',
    changeFrequency: 'monthly' as const,
    priority: 0.4,
    localized: false,
  },
  {
    path: '/privacy-policy',
    changeFrequency: 'yearly' as const,
    priority: 0.3,
    localized: true,
  },
  {
    path: '/terms-of-service',
    changeFrequency: 'yearly' as const,
    priority: 0.3,
    localized: true,
  },
];

// Configuración de habitaciones
const roomPages = [
  {
    id: 'mixto-12a',
    name: 'Mixto 12A',
    lastModified: '2024-01-15',
  },
  {
    id: 'mixto-12b',
    name: 'Mixto 12B',
    lastModified: '2024-01-15',
  },
  {
    id: 'mixto-7',
    name: 'Mixto 7',
    lastModified: '2024-01-15',
  },
  {
    id: 'flexible-7',
    name: 'Flexible 7',
    lastModified: '2024-01-15',
  },
];

// Páginas de contenido/blog
const contentPages = [
  {
    path: '/santa-teresa-guide',
    title: 'Guía Completa de Santa Teresa',
    lastModified: '2024-02-01',
    changeFrequency: 'monthly' as const,
    priority: 0.4,
  },
  {
    path: '/group-booking-guide',
    title: 'Guía para Reservas de Grupos',
    lastModified: '2024-02-01',
    changeFrequency: 'monthly' as const,
    priority: 0.4,
  },
  {
    path: '/rio-travel-tips',
    title: 'Tips para Viajar en Rio',
    lastModified: '2024-02-15',
    changeFrequency: 'monthly' as const,
    priority: 0.3,
  },
  {
    path: '/carnival-accommodation',
    title: 'Hospedaje para Carnaval',
    lastModified: '2024-01-20',
    changeFrequency: 'yearly' as const,
    priority: 0.5,
  },
];

// Idiomas soportados
const supportedLocales = ['pt', 'en', 'es'];
const defaultLocale = 'pt';

export function generateFullSitemap(): MetadataRoute.Sitemap {
  const sitemap: MetadataRoute.Sitemap = [];
  const currentDate = new Date().toISOString();

  // Páginas estáticas con localización
  staticPages.forEach(page => {
    if (page.localized) {
      // Página por defecto (portugués)
      sitemap.push({
        url: `${baseUrl}${page.path}`,
        lastModified: currentDate,
        changeFrequency: page.changeFrequency,
        priority: page.priority,
      });

      // Versiones en otros idiomas
      supportedLocales.forEach(locale => {
        if (locale !== defaultLocale) {
          sitemap.push({
            url: `${baseUrl}/${locale}${page.path}`,
            lastModified: currentDate,
            changeFrequency: page.changeFrequency,
            priority: page.priority * 0.9, // Prioridad ligeramente menor para otros idiomas
          });
        }
      });
    } else {
      // Página sin localización
      sitemap.push({
        url: `${baseUrl}${page.path}`,
        lastModified: currentDate,
        changeFrequency: page.changeFrequency,
        priority: page.priority,
      });
    }
  });

  // Páginas de habitaciones
  roomPages.forEach(room => {
    // Página por defecto
    sitemap.push({
      url: `${baseUrl}/rooms/${room.id}`,
      lastModified: room.lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    });

    // Versiones en otros idiomas
    supportedLocales.forEach(locale => {
      if (locale !== defaultLocale) {
        sitemap.push({
          url: `${baseUrl}/${locale}/rooms/${room.id}`,
          lastModified: room.lastModified,
          changeFrequency: 'monthly',
          priority: 0.65,
        });
      }
    });
  });

  // Páginas de contenido
  contentPages.forEach(content => {
    sitemap.push({
      url: `${baseUrl}${content.path}`,
      lastModified: content.lastModified,
      changeFrequency: content.changeFrequency,
      priority: content.priority,
    });

    // Versiones en otros idiomas para contenido importante
    if (content.priority >= 0.4) {
      supportedLocales.forEach(locale => {
        if (locale !== defaultLocale) {
          sitemap.push({
            url: `${baseUrl}/${locale}${content.path}`,
            lastModified: content.lastModified,
            changeFrequency: content.changeFrequency,
            priority: content.priority * 0.9,
          });
        }
      });
    }
  });

  return sitemap;
}

export function generateSitemapBySection(): Record<string, MetadataRoute.Sitemap> {
  const sections: Record<string, MetadataRoute.Sitemap> = {};
  const currentDate = new Date().toISOString();

  // Sitemap principal
  sections.main = [];
  staticPages
    .filter(page => page.priority >= 0.5)
    .forEach(page => {
      sections.main.push({
        url: `${baseUrl}${page.path}`,
        lastModified: currentDate,
        changeFrequency: page.changeFrequency,
        priority: page.priority,
      });
    });

  // Sitemap de habitaciones
  sections.rooms = [];
  roomPages.forEach(room => {
    supportedLocales.forEach(locale => {
      const path = locale === defaultLocale ? '' : `/${locale}`;
      sections.rooms.push({
        url: `${baseUrl}${path}/rooms/${room.id}`,
        lastModified: room.lastModified,
        changeFrequency: 'monthly',
        priority: 0.7,
      });
    });
  });

  // Sitemap de contenido
  sections.content = [];
  contentPages.forEach(content => {
    sections.content.push({
      url: `${baseUrl}${content.path}`,
      lastModified: content.lastModified,
      changeFrequency: content.changeFrequency,
      priority: content.priority,
    });
  });

  return sections;
}

export function generateSitemapIndex(): string {
  const currentDate = new Date().toISOString();
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${baseUrl}/sitemap-main.xml</loc>
    <lastmod>${currentDate}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-rooms.xml</loc>
    <lastmod>${currentDate}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-content.xml</loc>
    <lastmod>${currentDate}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-images.xml</loc>
    <lastmod>${currentDate}</lastmod>
  </sitemap>
</sitemapindex>`;
}

export function generateImageSitemap(): string {
  const currentDate = new Date().toISOString();
  
  const imageGroups = [
    {
      url: `${baseUrl}/`,
      images: [
        { loc: `${baseUrl}/images/hero/main-hero.jpg`, caption: 'Lapa Casa Hostel - Exterior' },
        { loc: `${baseUrl}/images/hero/group-photo.jpg`, caption: 'Grupo de huéspedes felices' },
      ],
    },
    {
      url: `${baseUrl}/rooms`,
      images: [
        { loc: `${baseUrl}/images/rooms/overview.jpg`, caption: 'Habitaciones Lapa Casa Hostel' },
      ],
    },
    ...roomPages.map(room => ({
      url: `${baseUrl}/rooms/${room.id}`,
      images: [
        { loc: `${baseUrl}/images/rooms/${room.id}-1.jpg`, caption: `${room.name} - Vista principal` },
        { loc: `${baseUrl}/images/rooms/${room.id}-2.jpg`, caption: `${room.name} - Vista interior` },
        { loc: `${baseUrl}/images/rooms/${room.id}-3.jpg`, caption: `${room.name} - Detalles` },
      ],
    })),
    {
      url: `${baseUrl}/gallery`,
      images: [
        { loc: `${baseUrl}/images/gallery/common-area-1.jpg`, caption: 'Área común' },
        { loc: `${baseUrl}/images/gallery/kitchen.jpg`, caption: 'Cocina compartida' },
        { loc: `${baseUrl}/images/gallery/terrace.jpg`, caption: 'Terraza con vista' },
        { loc: `${baseUrl}/images/gallery/breakfast.jpg`, caption: 'Área de desayuno' },
      ],
    },
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`;

  imageGroups.forEach(group => {
    xml += `
  <url>
    <loc>${group.url}</loc>
    <lastmod>${currentDate}</lastmod>`;
    
    group.images.forEach(image => {
      xml += `
    <image:image>
      <image:loc>${image.loc}</image:loc>
      <image:caption>${image.caption}</image:caption>
    </image:image>`;
    });
    
    xml += `
  </url>`;
  });

  xml += `
</urlset>`;

  return xml;
}

export function generateRobotsTxt(): string {
  return `User-agent: *
Allow: /

# Disallow admin and private areas
Disallow: /admin
Disallow: /api
Disallow: /dashboard
Disallow: /private
Disallow: /.well-known
Disallow: /checkout
Disallow: /payment
Disallow: /booking-confirmation
Disallow: /_next
Disallow: /static

# Allow important crawlers
User-agent: Googlebot
Allow: /
Disallow: /admin
Disallow: /api
Disallow: /dashboard
Disallow: /private

User-agent: bingbot
Allow: /
Disallow: /admin
Disallow: /api
Disallow: /dashboard
Disallow: /private

# Crawl delay for less important bots
User-agent: *
Crawl-delay: 1

# Sitemap locations
Sitemap: ${baseUrl}/sitemap.xml
Sitemap: ${baseUrl}/sitemap-index.xml
Sitemap: ${baseUrl}/sitemap-images.xml

# Host directive
Host: ${baseUrl}`;
}

export function validateSitemapUrls(sitemap: MetadataRoute.Sitemap): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seenUrls = new Set<string>();

  sitemap.forEach((entry, index) => {
    // Verificar URL duplicada
    if (seenUrls.has(entry.url)) {
      errors.push(`URL duplicada en índice ${index}: ${entry.url}`);
    }
    seenUrls.add(entry.url);

    // Verificar formato de URL
    try {
      new URL(entry.url);
    } catch {
      errors.push(`URL inválida en índice ${index}: ${entry.url}`);
    }

    // Verificar prioridad
    if (entry.priority !== undefined && (entry.priority < 0 || entry.priority > 1)) {
      errors.push(`Prioridad inválida en índice ${index}: ${entry.priority}`);
    }

    // Advertencias para optimización
    if (!entry.lastModified) {
      warnings.push(`lastModified faltante para: ${entry.url}`);
    }

    if (!entry.changeFrequency) {
      warnings.push(`changeFrequency faltante para: ${entry.url}`);
    }

    if (entry.priority === undefined) {
      warnings.push(`priority faltante para: ${entry.url}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function generateSitemapStats(sitemap: MetadataRoute.Sitemap) {
  const stats = {
    totalUrls: sitemap.length,
    byPriority: {} as Record<string, number>,
    byChangeFrequency: {} as Record<string, number>,
    byLocale: {} as Record<string, number>,
    lastModified: {
      newest: '',
      oldest: '',
    },
  };

  sitemap.forEach(entry => {
    // Stats por prioridad
    const priority = entry.priority?.toString() || 'undefined';
    stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;

    // Stats por frecuencia de cambio
    const freq = entry.changeFrequency || 'undefined';
    stats.byChangeFrequency[freq] = (stats.byChangeFrequency[freq] || 0) + 1;

    // Stats por locale
    const url = new URL(entry.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const locale = supportedLocales.includes(pathParts[0]) ? pathParts[0] : defaultLocale;
    stats.byLocale[locale] = (stats.byLocale[locale] || 0) + 1;

    // Fechas de modificación
    if (entry.lastModified) {
      const date = entry.lastModified.toString();
      if (!stats.lastModified.newest || date > stats.lastModified.newest) {
        stats.lastModified.newest = date;
      }
      if (!stats.lastModified.oldest || date < stats.lastModified.oldest) {
        stats.lastModified.oldest = date;
      }
    }
  });

  return stats;
}
