import type { Metadata } from 'next';
import { Inter, Poppins } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const poppins = Poppins({ 
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    template: '%s | Lapa Casa Hostel',
    default: 'Lapa Casa Hostel - Book Direct & Save | Santa Teresa, Rio de Janeiro',
  },
  description: 'Experience authentic Rio at Lapa Casa Hostel in Santa Teresa. Book direct for best rates! 45 beds, perfect for groups. Minutes from Lapa nightlife & Christ the Redeemer.',
  keywords: [
    'hostel rio de janeiro',
    'santa teresa hostel',
    'lapa casa hostel',
    'group accommodation rio',
    'backpacker rio',
    'budget travel brazil',
    'hostel booking direct'
  ],
  authors: [{ name: 'Lapa Casa Hostel' }],
  creator: 'Lapa Casa Hostel',
  publisher: 'Lapa Casa Hostel',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://lapacasahostel.com',
    siteName: 'Lapa Casa Hostel',
    title: 'Lapa Casa Hostel - Book Direct & Save | Santa Teresa, Rio',
    description: 'Experience authentic Rio at Lapa Casa Hostel in Santa Teresa. Book direct for best rates! Perfect for groups.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Lapa Casa Hostel - Santa Teresa, Rio de Janeiro',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lapa Casa Hostel - Book Direct & Save',
    description: 'Experience authentic Rio at Lapa Casa Hostel in Santa Teresa. Book direct for best rates!',
    images: ['/og-image.jpg'],
    creator: '@lapacasahostel',
  },
  verification: {
    google: 'your-google-verification-code',
  },
  alternates: {
    canonical: 'https://lapacasahostel.com',
    languages: {
      'en': 'https://lapacasahostel.com/en',
      'pt': 'https://lapacasahostel.com/pt',
      'es': 'https://lapacasahostel.com/es',
    },
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${inter.variable} ${poppins.variable}`}>
      <head>
        {/* Preload critical fonts */}
        <link
          rel="preload"
          href="/fonts/inter-var.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        
        {/* Theme color */}
        <meta name="theme-color" content="#0ea5e9" />
        
        {/* Preconnect to external domains */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://js.stripe.com" />
        <link rel="preconnect" href="https://sdk.mercadopago.com" />
        
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "LodgingBusiness",
              "name": "Lapa Casa Hostel",
              "description": "Authentic hostel experience in Santa Teresa, Rio de Janeiro",
              "url": "https://lapacasahostel.com",
              "address": {
                "@type": "PostalAddress",
                "streetAddress": "Rua Silvio Romero 22",
                "addressLocality": "Santa Teresa",
                "addressRegion": "Rio de Janeiro",
                "addressCountry": "BR",
                "postalCode": "20241-000"
              },
              "geo": {
                "@type": "GeoCoordinates",
                "latitude": "-22.9168",
                "longitude": "-43.1804"
              },
              "telephone": "+55-21-XXXX-XXXX",
              "priceRange": "$$",
              "amenityFeature": [
                "Free WiFi",
                "Air Conditioning",
                "Shared Kitchen",
                "Laundry Service",
                "24-hour Reception"
              ]
            })
          }}
        />
      </head>
      <body className="min-h-screen bg-white font-sans antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {/* Skip to content for accessibility */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary-600 text-white px-4 py-2 rounded-md z-50"
          >
            Skip to main content
          </a>
          
          {/* Main application wrapper */}
          <div className="flex min-h-screen flex-col">
            {/* Header will be added in Phase 2 */}
            {/* <Header /> */}
            
            {/* Main content area */}
            <main id="main-content" className="flex-1">
              {children}
            </main>
            
            {/* Footer will be added in Phase 2 */}
            {/* <Footer /> */}
          </div>
          
          {/* Global notifications/modals container */}
          <div id="modal-root" />
          <div id="notification-root" />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
