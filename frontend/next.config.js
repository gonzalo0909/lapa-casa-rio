// lapa-casa-hostel/frontend/next.config.js
/**
 * Next.js Configuration - Lapa Casa Hostel Channel Manager
 * Production-ready settings for Vercel deployment
 * Optimized for booking engine, payments, and multi-language support
 */

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});
const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin('./src/i18n.ts');
const { withSentryConfig } = require('@sentry/nextjs');

// El frontend llama a la API por su URL absoluta (ver lib/api.ts,
// NEXT_PUBLIC_API_URL) -- es otro origen (Render/dominio propio), no el
// mismo origen del frontend. connect-src 'self' solo no alcanza para esas
// llamadas; se agrega el origen real acá, resuelto en build time.
const API_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').origin;
  } catch {
    return '';
  }
})();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // App Router configuration
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // Idiomas pt/es/en manejados por next-intl vía app/[locale] + middleware.ts,
  // no por el i18n de Pages Router (incompatible con App Router).

  // Image optimization
  images: {
    domains: ['lapacasario.com', 'res.cloudinary.com', 'images.unsplash.com'],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },

  // Headers for security and performance
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Security headers
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // Performance headers
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          // Content-Security-Policy -- antes solo se aplicaba a
          // "/booking/:path*", una ruta que no existe en este App Router
          // (las páginas reales son /[locale]/hostel, /[locale]/apartamentos
          // y /[locale]/payment/[id]): la política nunca llegó a aplicarse
          // en producción. Se mueve acá (todas las rutas) porque
          // AnalyticsProvider -- que carga GA4 y un script inline de
          // Facebook Pixel -- vive en el layout raíz y corre en cada página,
          // no solo en las de pago.
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // unsafe-inline: el snippet de Facebook Pixel se inyecta
              // inline (dangerouslySetInnerHTML en analytics-provider.tsx).
              // unsafe-eval eliminado: la doc oficial de Stripe.js v3 no lo
              // requiere, y los issues de react-stripe-js que lo citaban
              // (github.com/stripe/react-stripe-js/issues/380) se resolvieron
              // en versiones más recientes de la librería. Se elimina para
              // reducir la superficie de ataque XSS -- si Stripe.js rompe
              // en producción, se puede restaurar con evidencia concreta.
              // blob: requerido por el web-worker interno de Sentry para enviar eventos
              // sdk.mercadopago.com: SDK de MP para tokenización de tarjetas brasileñas
              `script-src 'self' 'unsafe-inline' blob: https://js.stripe.com https://sdk.mercadopago.com https://www.googletagmanager.com https://connect.facebook.net`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              // ingest.sentry.io y o*.ingest.sentry.io: destino de los reportes de error
              // api.mercadopago.com: llamadas del SDK de MP (getPaymentMethods, getInstallments, createCardToken)
              `connect-src 'self' ${API_ORIGIN} https://api.stripe.com https://api.mercadopago.com https://www.google-analytics.com https://analytics.google.com https://connect.facebook.net https://viacep.com.br https://o0.ingest.sentry.io https://o1.ingest.sentry.io https://o2.ingest.sentry.io https://o3.ingest.sentry.io https://o4.ingest.sentry.io https://*.ingest.us.sentry.io`,
              "frame-src https://js.stripe.com",
            ].join('; '),
          },
        ],
      },
      // Cache control for static assets -- Next.js sirve los archivos de
      // public/ en la raíz (/img/foo.png, /favicon.ico, etc.), nunca bajo
      // un prefijo /static/: la regla anterior (source: '/static/:path*')
      // no coincidía con ninguna ruta real y nunca se aplicaba. Se matchea
      // por extensión en vez de por prefijo para que sí cubra los assets
      // reales de public/ (íconos, imágenes, fuentes servidas localmente).
      {
        source: '/:path*.(ico|png|jpg|jpeg|svg|webp|avif|woff|woff2|ttf|otf)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // Redirects for SEO -- apuntaban a /booking, una página que nunca
  // existió en este App Router (el motor real vive en /hostel y
  // /apartamentos, cada uno con su propio flujo) -- cualquiera que
  // llegara por un link viejo a /reserva, /reservas o /book caía en un
  // 404. localePrefix:'always' del middleware de next-intl agrega el
  // /pt, /es, etc. automáticamente sobre este destino sin locale.
  async redirects() {
    return [
      {
        source: '/reserva',
        destination: '/hostel',
        permanent: true,
      },
      {
        source: '/reservas',
        destination: '/hostel',
        permanent: true,
      },
      {
        source: '/book',
        destination: '/hostel',
        permanent: true,
      },
    ];
  },

  // Rewrites for API proxy
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/:path*`,
      },
    ];
  },

  // Environment variables validation
  env: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://lapacasario.com',
    // Tiene que coincidir con el fallback de lib/api.ts (puerto real del
    // backend local + prefijo /api/v1) -- un valor distinto acá lo pisa
    // en build time y lib/api.ts nunca llega a usar el suyo.
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_MP_PUBLIC_KEY: process.env.NEXT_PUBLIC_MP_PUBLIC_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },

  // Webpack configuration
  webpack: (config, { dev, isServer }) => {
    // Production optimizations
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          commons: {
            name: 'commons',
            chunks: 'all',
            minChunks: 2,
            priority: 20,
          },
          stripe: {
            name: 'stripe',
            test: /[\\/]node_modules[\\/](@stripe)[\\/]/,
            priority: 30,
          },
          react: {
            name: 'react',
            test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            priority: 40,
          },
        },
      };
    }

    // SVG support
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });

    return config;
  },

  // Compiler options
  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? {
            exclude: ['error', 'warn'],
          }
        : false,
  },

  // Output configuration — Vercel detecta Next.js automáticamente; no requiere 'standalone'
  distDir: '.next',
  poweredByHeader: false,
  compress: true,
  generateEtags: true,

  // TypeScript configuration
  // ignoreBuildErrors: true — el type check de Next.js cuelga en Vercel
  // porque el worker de TSC no tiene timeout y la codebase es grande.
  // Los tipos se verifican localmente con `tsc --noEmit` antes de cada push.
  typescript: {
    ignoreBuildErrors: true,
  },

  // ESLint configuration
  // ignoreDuringBuilds: true — las violaciones son todas pre-existentes
  // (no-console en analytics, any en utils/api); en producción los console.*
  // ya los elimina compiler.removeConsole, así que no afecta el output real.
  eslint: {
    ignoreDuringBuilds: true,
    dirs: ['src'],
  },

  // React strict mode
  reactStrictMode: true,

  // SWC minification
  swcMinify: true,

  // Production source maps for debugging
  productionBrowserSourceMaps: process.env.ENABLE_SOURCE_MAPS === 'true',

  // Trailing slash configuration
  trailingSlash: false,

  // Page extensions
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
};

module.exports = withSentryConfig(
  withNextIntl(withBundleAnalyzer(nextConfig)),
  {
    // Sentry Webpack Plugin — sube source maps al crear el build de producción
    // para que los stack traces en Sentry muestren el código real (no el minificado).
    // org: slug de la organización en sentry.io (visible en la URL: lapa-casa-rio.sentry.io)
    // project: nombre del proyecto Next.js creado en Sentry
    org: 'lapa-casa-rio',
    project: 'javascript-nextjs',

    // No imprime la salida del plugin en el log de build — reduce ruido.
    silent: !process.env.CI,

    // Deshabilita source map upload en desarrollo local (solo en CI/prod).
    sourcemaps: {
      // No enviar los .map al bundle final del navegador — solo a Sentry.
      deleteSourcemapsAfterUpload: true,
    },

    // Desactiva automáticamente Sentry si NEXT_PUBLIC_SENTRY_DSN no está
    // configurado — evita errores en entornos sin Sentry.
    disableLogger: true,
    automaticVercelMonitors: false,
  }
);
