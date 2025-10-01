// lapa-casa-hostel/frontend/next.config.js
/**
 * Next.js Configuration - Lapa Casa Hostel Channel Manager
 * Production-ready settings for Vercel deployment
 * Optimized for booking engine, payments, and multi-language support
 */

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // App Router configuration
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // I18n configuration for PT/ES/EN
  i18n: {
    locales: ['pt', 'es', 'en'],
    defaultLocale: 'pt',
    localeDetection: true,
  },

  // Image optimization
  images: {
    domains: [
      'lapacasahostel.com',
      'res.cloudinary.com',
      'images.unsplash.com',
    ],
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
        ],
      },
      // CSP for payment security
      {
        source: '/booking/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://sdk.mercadopago.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://api.stripe.com https://api.mercadopago.com",
              "frame-src https://js.stripe.com https://www.mercadopago.com",
            ].join('; '),
          },
        ],
      },
      // Cache control for static assets
      {
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // Redirects for SEO
  async redirects() {
    return [
      {
        source: '/reserva',
        destination: '/booking',
        permanent: true,
      },
      {
        source: '/reservas',
        destination: '/booking',
        permanent: true,
      },
      {
        source: '/book',
        destination: '/booking',
        permanent: true,
      },
    ];
  },

  // Rewrites for API proxy
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/:path*`,
      },
    ];
  },

  // Environment variables validation
  env: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://lapacasahostel.com',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_MP_PUBLIC_KEY: process.env.NEXT_PUBLIC_MP_PUBLIC_KEY,
    NEXT_PUBLIC_GTM_ID: process.env.NEXT_PUBLIC_GTM_ID,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
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
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // Output configuration
  output: 'standalone',
  distDir: '.next',
  poweredByHeader: false,
  compress: true,
  generateEtags: true,

  // TypeScript configuration
  typescript: {
    ignoreBuildErrors: false,
  },

  // ESLint configuration
  eslint: {
    ignoreDuringBuilds: false,
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

module.exports = withBundleAnalyzer(nextConfig);
