/** @type {import('next').NextConfig} */

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig = {
  // App Router experimental features
  experimental: {
    appDir: true,
    serverComponentsExternalPackages: ['@prisma/client'],
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },

  // TypeScript configuration
  typescript: {
    ignoreBuildErrors: false,
  },

  // ESLint configuration
  eslint: {
    ignoreDuringBuilds: false,
  },

  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    domains: [
      'lapacasahostel.com',
      'images.unsplash.com', // Para fotos de exemplo
      'res.cloudinary.com', // CDN para imagens
      'storage.googleapis.com', // Google Cloud Storage
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.lapacasahostel.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Internationalization
  i18n: {
    locales: ['pt', 'en', 'es'],
    defaultLocale: 'pt',
    localeDetection: true,
  },

  // Security headers
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
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },

  // Redirects for SEO
  async redirects() {
    return [
      {
        source: '/book',
        destination: '/pt/booking',
        permanent: true,
      },
      {
        source: '/reserva',
        destination: '/pt/booking',
        permanent: true,
      },
      {
        source: '/quartos',
        destination: '/pt/rooms',
        permanent: true,
      },
      {
        source: '/habitaciones',
        destination: '/es/rooms',
        permanent: true,
      },
    ];
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_APP_NAME: 'Lapa Casa Hostel',
    NEXT_PUBLIC_APP_DESCRIPTION: 'Channel Manager & Booking Engine',
    NEXT_PUBLIC_APP_URL: process.env.NODE_ENV === 'production' 
      ? 'https://lapacasahostel.com' 
      : 'http://localhost:3000',
    NEXT_PUBLIC_API_URL: process.env.NODE_ENV === 'production'
      ? 'https://api.lapacasahostel.com'
      : 'http://localhost:8000',
  },

  // Performance optimizations
  poweredByHeader: false,
  compress: true,
  generateEtags: true,

  // Output configuration for production
  output: 'standalone',
  
  // Webpack configuration
  webpack: (config, { dev, isServer }) => {
    // Bundle analyzer
    if (!dev && !isServer) {
      config.resolve.alias['@'] = __dirname;
    }

    // Optimize lodash imports
    config.resolve.alias = {
      ...config.resolve.alias,
      'lodash': 'lodash-es',
    };

    // Improve build performance
    if (!dev) {
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks.cacheGroups,
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: 10,
            chunks: 'all',
          },
          common: {
            name: 'common',
            minChunks: 2,
            priority: 5,
            chunks: 'all',
            enforce: true,
          },
        },
      };
    }

    return config;
  },

  // Runtime configuration
  serverRuntimeConfig: {
    // Will only be available on the server side
    mySecret: 'secret',
  },
  publicRuntimeConfig: {
    // Will be available on both server and client
    staticFolder: '/static',
  },

  // Experimental features for better performance
  swcMinify: true,
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{member}}',
    },
    'date-fns': {
      transform: 'date-fns/{{member}}',
    },
  },

  // PWA Configuration (using next-pwa)
  ...(process.env.NODE_ENV === 'production' && {
    pwa: {
      dest: 'public',
      register: true,
      skipWaiting: true,
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'google-fonts',
            expiration: {
              maxEntries: 4,
              maxAgeSeconds: 365 * 24 * 60 * 60, // 365 days
            },
          },
        },
        {
          urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'google-fonts-static',
            expiration: {
              maxEntries: 4,
              maxAgeSeconds: 365 * 24 * 60 * 60, // 365 days
            },
          },
        },
      ],
    },
  }),
};

module.exports = withBundleAnalyzer(nextConfig);
