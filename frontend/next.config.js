// lapa-casa-hostel-frontend/next.config.js

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

const nextConfig = {
  // Configuración experimental
  experimental: {
    // Optimizaciones para el App Router
    appDir: true,
    serverComponentsExternalPackages: ['sharp'],
    optimizePackageImports: ['lucide-react', 'date-fns', 'lodash'],
  },

  // Configuración de imágenes
  images: {
    domains: [
      'localhost',
      'lapacasahostel.com',
      'images.unsplash.com',
      'via.placeholder.com',
      'picsum.photos'
    ],
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 86400, // 24 horas
  },

  // Configuración PWA
  pwa: {
    dest: 'public',
    register: true,
    skipWaiting: true,
    disable: process.env.NODE_ENV === 'development',
  },

  // Configuración de i18n
  i18n: {
    locales: ['pt', 'en', 'es'],
    defaultLocale: 'pt',
    localeDetection: true,
  },

  // Headers de seguridad
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },

  // Configuración de rewrites para API
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
      },
    ]
  },

  // Configuración de redirects
  async redirects() {
    return [
      {
        source: '/book',
        destination: '/booking',
        permanent: true,
      },
      {
        source: '/reserva',
        destination: '/booking',
        permanent: true,
      },
      {
        source: '/quartos',
        destination: '/rooms',
        permanent: true,
      },
    ]
  },

  // Configuración de compilación
  compiler: {
    // Eliminar console.log en producción
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // Configuración de optimización
  swcMinify: true,
  compress: true,
  poweredByHeader: false,
  generateEtags: true,

  // Variables de entorno públicas
  env: {
    SITE_NAME: process.env.NEXT_PUBLIC_SITE_NAME,
    SITE_DESCRIPTION: process.env.NEXT_PUBLIC_SITE_DESCRIPTION,
  },

  // Configuración de webpack
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Optimizaciones para bundle size
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname, 'src'),
    }

    // Configuración para análisis de bundles
    if (process.env.ANALYZE === 'true') {
      config.plugins.push(
        new webpack.DefinePlugin({
          'process.env.ANALYZE': JSON.stringify(true),
        })
      )
    }

    // Optimizar importaciones de librerías
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    }

    return config
  },

  // Configuración de output
  output: 'standalone',
  
  // Configuración de TypeScript
  typescript: {
    ignoreBuildErrors: false,
  },

  // Configuración de ESLint
  eslint: {
    ignoreDuringBuilds: false,
    dirs: ['src', 'pages', 'components', 'lib', 'hooks'],
  },

  // Configuración de dominio
  assetPrefix: process.env.NODE_ENV === 'production' 
    ? process.env.NEXT_PUBLIC_CDN_URL 
    : undefined,

  // Configuración de trailing slash
  trailingSlash: false,

  // Configuración de cache
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },

  // Configuración específica para hostel
  publicRuntimeConfig: {
    maxBedsPerBooking: process.env.NEXT_PUBLIC_MAX_BEDS_PER_BOOKING || '38',
    basePrice: process.env.NEXT_PUBLIC_BASE_PRICE || '60',
    whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
  },
}

module.exports = withBundleAnalyzer(nextConfig)
