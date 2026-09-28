# Lapa Casa Hostel - Frontend Channel Manager

Production-ready booking engine and channel manager frontend built with Next.js 14, TypeScript, and Tailwind CSS.

## 🏨 Project Overview

**Client:** Lapa Casa Hostel  
**Location:** Rua Silvio Romero 22, Santa Teresa, Rio de Janeiro  
**Capacity:** 45 beds in 4 rooms  
**Specialization:** Group bookings (7+ people)

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your keys

# Run development server
npm run dev

# Open browser
http://localhost:3000
```

## 📋 Prerequisites

- Node.js 20.0.0 or higher
- npm 10.0.0 or higher
- Stripe account (for international payments)
- Mercado Pago account (for Brazilian payments)

## 🏗️ Tech Stack

### Core Framework
- **Next.js 14** - React framework with App Router
- **TypeScript 5.5** - Type safety
- **Tailwind CSS 3.4** - Utility-first styling
- **React 18.3** - UI library

### State Management
- **Zustand 4.5** - Lightweight state management
- **React Hook Form 7.52** - Form handling
- **Zod 3.23** - Schema validation

### Payments Integration
- **Stripe Elements** - International card processing
- **Mercado Pago SDK** - Brazilian payments (PIX + cards)

### UI Components
- **Radix UI** - Accessible component primitives
- **Lucide React** - Icon library
- **React Day Picker** - Date selection
- **Recharts** - Analytics charts

### Internationalization
- **next-intl 3.17** - PT/ES/EN support

### Analytics
- **Google Analytics 4** - Product/ecommerce analytics
- **Facebook Pixel** - Marketing tracking
- Ambos gateados por el banner de consentimiento de cookies (`components/legal/cookie-consent.tsx`) -- no cargan hasta que el usuario acepta.

## 📁 Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx         # Root layout
│   │   ├── globals.css        # Global styles
│   │   ├── sitemap.ts         # SEO sitemap
│   │   └── robots.ts          # SEO robots
│   │
│   ├── components/
│   │   ├── ui/                # Base UI components (13-24)
│   │   ├── booking/           # Booking engine (25-44)
│   │   ├── payment/           # Payment system (45-54)
│   │   ├── seo/               # SEO components (55-56)
│   │   ├── analytics/         # Analytics (57)
│   │   └── forms/             # Form schemas (75)
│   │
│   ├── lib/                   # Utility libraries
│   │   ├── utils.ts           # General utilities
│   │   ├── pricing.ts         # Pricing calculations
│   │   ├── validations.ts     # Data validation
│   │   ├── api.ts             # API client
│   │   ├── analytics.ts       # Analytics helpers
│   │   ├── availability/      # Availability checker
│   │   └── seo/               # SEO utilities
│   │
│   ├── hooks/                 # Custom React hooks
│   │   ├── use-availability.ts
│   │   ├── use-booking-form.ts
│   │   ├── use-form-validation.ts
│   │   └── use-booking.ts
│   │
│   ├── stores/                # Zustand stores
│   │   ├── booking-store.ts
│   │   └── payment-store.ts
│   │
│   ├── types/                 # TypeScript types
│   │   └── global.ts
│   │
│   ├── constants/             # Configuration
│   │   └── config.ts
│   │
│   └── messages/              # i18n translations
│       └── pt.json
│
├── public/                    # Static assets
│   ├── favicon.ico
│   └── manifest.json
│
└── tests/                     # Test files
    └── frontend/

```

## 🛏️ Room Configuration

### MIXTO-12A (Room 1)
- **ID:** `room_mixto_12a`
- **Capacity:** 12 beds
- **Type:** Mixed dormitory
- **Base Price:** R$ 60.00/bed/night

### MIXTO-12B (Room 2)
- **ID:** `room_mixto_12b`
- **Capacity:** 12 beds
- **Type:** Mixed dormitory
- **Base Price:** R$ 60.00/bed/night

### MIXTO-7 (Room 3)
- **ID:** `room_mixto_7`
- **Capacity:** 7 beds
- **Type:** Mixed dormitory
- **Base Price:** R$ 60.00/bed/night

### FLEXIBLE-7 (Room 4)
- **ID:** `room_flexible_7`
- **Capacity:** 7 beds
- **Type:** Female (converts to mixed 48h before if no bookings)
- **Base Price:** R$ 60.00/bed/night
- **Special:** Auto-conversion logic

## 💰 Pricing System

### Group Discounts (Automatic)
```javascript
7-15 beds:  10% discount
16-25 beds: 15% discount
26+ beds:   20% discount
```

### Seasonal Multipliers
```javascript
High Season (Dec-Mar):    +50% (1.5x)
Medium Season (Apr-May):   base (1.0x)
Low Season (Jun-Sep):     -20% (0.8x)
Carnival (February):      +100% (2.0x, min 5 nights)
```

### Deposit Structure
- **Standard Groups:** 30% deposit, 70% on arrival
- **Large Groups (15+):** 50% deposit, 50% on arrival
- **Auto-charge:** 7 days before check-in
- **Retry Attempts:** 3 automatic retries

## 🎨 Design System

### Colors
- **Primary:** Blue shades (booking CTAs)
- **Secondary:** Purple shades (accents)
- **Success:** Green (confirmations)
- **Warning:** Amber (alerts)
- **Seasonal:** Color-coded season indicators

### Typography
- **Display:** Poppins (headings)
- **Body:** Inter (content)
- **Mono:** System monospace (code)

### Breakpoints
```css
sm:  640px
md:  768px
lg:  1024px
xl:  1280px
2xl: 1400px
```

## 🔐 Environment Variables

### Required (Development)
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Required (Production)
```bash
NEXT_PUBLIC_SITE_URL=https://lapacasario.com
NEXT_PUBLIC_API_URL=https://api.lapacasario.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

Nota: MercadoPago/PIX ya no tiene SDK en el frontend -- el checkout se
delega 100% al backend, así que no hace falta ninguna `NEXT_PUBLIC_MP_*`.
Tampoco hay `NEXT_PUBLIC_GTM_ID` -- ver sección de Analytics.

### Optional (Analytics)
```bash
# FIX (auditoría 2026-08-30): AnalyticsProvider (components/analytics/
# analytics-provider.tsx) ahora lee estas dos en vez de tener IDs de
# ejemplo hardcodeados. Si cualquiera de las dos falta, ese servicio
# puntual simplemente no se carga -- no rompe nada dejarlas vacías.
NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_FB_PIXEL_ID=1234567890
```

See `.env.local` for complete list with descriptions.

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run tests with coverage
npm run test:ci

# Run E2E tests
npm run test:e2e
```

## 📦 Build & Deploy

### Development Build
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

### Type Checking
```bash
npm run type-check
```

### Linting
```bash
npm run lint
npm run lint:fix
```

### Bundle Analysis
```bash
ANALYZE=true npm run build
```

## 🚢 Deployment

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Environment Variables (Vercel)
Set all production environment variables in Vercel dashboard under Project Settings → Environment Variables.

### Build Configuration
- **Framework Preset:** Next.js
- **Build Command:** `npm run build`
- **Output Directory:** `.next`
- **Install Command:** `npm install`
- **Node Version:** 20.x

## 📊 Performance Targets

- **Lighthouse Score:** 90+ (all metrics)
- **First Contentful Paint:** < 1.5s
- **Time to Interactive:** < 3.5s
- **Largest Contentful Paint:** < 2.5s
- **Cumulative Layout Shift:** < 0.1

## 🌐 Internationalization

Supported languages:
- **Portuguese (pt)** - Default
- **Spanish (es)**
- **English (en)**

Translation files: `src/messages/{locale}.json`

## 📱 Browser Support

- Chrome/Edge (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- iOS Safari (last 2 versions)
- Android Chrome (last 2 versions)

## 🔒 Security Features

- HTTPS enforced
- Strict CSP headers
- XSS protection
- CSRF protection
- Rate limiting
- Input sanitization
- Secure payment handling (PCI DSS compliant)

## 📖 Documentation

- [API Documentation](../docs/api/openapi.yaml)
- [Deployment Guide](../docs/deployment/setup-guide.md)
- [Development Guide](../docs/development/getting-started.md)
- [Pricing Logic](../docs/business/pricing-logic.md)

## 🤝 Contributing

This is a private project for Lapa Casa Hostel. For internal team members:

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes with type-safe code
3. Run tests: `npm test`
4. Commit: `git commit -m "feat: your feature"`
5. Push: `git push origin feature/your-feature`
6. Create Pull Request

## 📞 Support

**Tech Team:** lapalandiarj@gmail.com  
**Reservations:** lapalandiarj@gmail.com  
**WhatsApp:** +55 21 99999-9999

## 📄 License

UNLICENSED - Proprietary software for Lapa Casa Hostel

---

**Built with ❤️ for Lapa Casa Hostel**  
**Santa Teresa, Rio de Janeiro**
