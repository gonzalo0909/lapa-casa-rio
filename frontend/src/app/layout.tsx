import type { Metadata } from 'next';
import { Inter, Poppins } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap'
});

const poppins = Poppins({ 
  subsets: ['latin'],
  variable: '--font-poppins',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap'
});

export const metadata: Metadata = {
  title: {
    default: 'Lapa Casa Hostel - Hospedagem em Santa Teresa, Rio de Janeiro',
    template: '%s | Lapa Casa Hostel'
  },
  description: 'Hostel especializado em grupos no coração de Santa Teresa, Rio de Janeiro. 45 camas em 4 quartos, ambiente acolhedor e localização privilegiada.',
  keywords: ['hostel rio de janeiro', 'santa teresa', 'hospedagem grupos', 'lapa casa hostel', 'rio hostel'],
  authors: [{ name: 'Lapa Casa Hostel' }],
  creator: 'Lapa Casa Hostel',
  publisher: 'Lapa Casa Hostel',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://lapacasahostel.com'),
  alternates: {
    canonical: '/',
    languages: {
      'pt-BR': '/pt',
      'en-US': '/en',
      'es-ES': '/es',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://lapacasahostel.com',
    title: 'Lapa Casa Hostel - Hospedagem em Santa Teresa, Rio de Janeiro',
    description: 'Hostel especializado em grupos no coração de Santa Teresa, Rio de Janeiro. 45 camas em 4 quartos.',
    siteName: 'Lapa Casa Hostel',
    images: [
      {
        url: '/images/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Lapa Casa Hostel - Santa Teresa',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lapa Casa Hostel - Hospedagem em Santa Teresa',
    description: 'Hostel especializado em grupos no coração de Santa Teresa, Rio de Janeiro.',
    images: ['/images/twitter-image.jpg'],
    creator: '@lapacasahostel',
  },
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
  verification: {
    google: 'google-site-verification-code',
    yandex: 'yandex-verification-code',
    yahoo: 'yahoo-site-verification-code',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1e40af" />
        <meta name="msapplication-TileColor" content="#1e40af" />
        
        {/* Preconnect to external domains */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://api.stripe.com" />
        <link rel="preconnect" href="https://js.stripe.com" />
        <link rel="preconnect" href="https://www.mercadopago.com" />
        
        {/* DNS prefetch for performance */}
        <link rel="dns-prefetch" href="//www.google-analytics.com" />
        <link rel="dns-prefetch" href="//www.googletagmanager.com" />
      </head>
      <body 
        className={cn(
          'min-h-screen bg-background font-sans antialiased',
          inter.variable,
          poppins.variable
        )}
        suppressHydrationWarning
      >
        <div className="relative flex min-h-screen flex-col">
          <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            {/* Header será implementado en componentes específicos */}
          </header>
          
          <main className="flex-1">
            {children}
          </main>
          
          <footer className="border-t bg-background">
            {/* Footer será implementado en componentes específicos */}
          </footer>
        </div>
        
        {/* Scripts externos */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Configuração inicial do tema
              try {
                if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark')
                } else {
                  document.documentElement.classList.remove('dark')
                }
              } catch (_) {}
            `,
          }}
        />
      </body>
    </html>
  );
}
