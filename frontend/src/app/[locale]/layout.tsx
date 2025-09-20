import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { Metadata } from 'next';

// Idiomas soportados
const locales = ['pt', 'en', 'es'];

// Configuración de metadatos por idioma
const metadataByLocale: Record<string, Metadata> = {
  pt: {
    title: {
      default: 'Lapa Casa Hostel - Hospedagem em Santa Teresa, Rio de Janeiro',
      template: '%s | Lapa Casa Hostel'
    },
    description: 'Hostel especializado em grupos no coração de Santa Teresa, Rio de Janeiro. 45 camas em 4 quartos, ambiente acolhedor e localização privilegiada.',
    keywords: ['hostel rio de janeiro', 'santa teresa', 'hospedagem grupos', 'lapa casa hostel', 'rio hostel'],
  },
  en: {
    title: {
      default: 'Lapa Casa Hostel - Accommodation in Santa Teresa, Rio de Janeiro',
      template: '%s | Lapa Casa Hostel'
    },
    description: 'Hostel specialized in groups in the heart of Santa Teresa, Rio de Janeiro. 45 beds in 4 rooms, cozy atmosphere and privileged location.',
    keywords: ['hostel rio de janeiro', 'santa teresa', 'group accommodation', 'lapa casa hostel', 'rio hostel'],
  },
  es: {
    title: {
      default: 'Lapa Casa Hostel - Alojamiento en Santa Teresa, Río de Janeiro',
      template: '%s | Lapa Casa Hostel'
    },
    description: 'Hostel especializado en grupos en el corazón de Santa Teresa, Río de Janeiro. 45 camas en 4 habitaciones, ambiente acogedor y ubicación privilegiada.',
    keywords: ['hostel rio de janeiro', 'santa teresa', 'alojamiento grupos', 'lapa casa hostel', 'rio hostel'],
  }
};

// Validar que el locale es válido
function isValidLocale(locale: string): locale is 'pt' | 'en' | 'es' {
  return locales.includes(locale);
}

// Configuración de next-intl
export const getRequestConfigForLocale = getRequestConfig(async ({ locale }) => {
  if (!isValidLocale(locale)) {
    notFound();
  }

  return {
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: {
    locale: string;
  };
}

// Generar metadata dinámicamente por locale
export async function generateMetadata({ 
  params: { locale } 
}: LocaleLayoutProps): Promise<Metadata> {
  if (!isValidLocale(locale)) {
    notFound();
  }

  const baseMetadata = metadataByLocale[locale];
  
  return {
    ...baseMetadata,
    alternates: {
      canonical: `/${locale}`,
      languages: {
        'pt-BR': '/pt',
        'en-US': '/en',
        'es-ES': '/es',
      },
    },
    openGraph: {
      ...baseMetadata.openGraph,
      locale: locale === 'pt' ? 'pt_BR' : locale === 'en' ? 'en_US' : 'es_ES',
      url: `https://lapacasahostel.com/${locale}`,
    },
  };
}

// Generar páginas estáticas para todos los locales
export function generateStaticParams() {
  return locales.map((locale) => ({
    locale,
  }));
}

export default async function LocaleLayout({
  children,
  params: { locale }
}: LocaleLayoutProps) {
  // Validar locale
  if (!isValidLocale(locale)) {
    notFound();
  }

  // Cargar mensajes de traducción
  let messages;
  try {
    messages = (await import(`../../messages/${locale}.json`)).default;
  } catch (error) {
    notFound();
  }

  return (
    <html lang={locale} dir="ltr">
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <div className="min-h-screen flex flex-col">
            {/* Header con navegación internacionalizada */}
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="container-lapa flex h-16 items-center justify-between">
                {/* Logo */}
                <div className="flex items-center space-x-2">
                  <div className="text-xl font-bold text-primary">
                    Lapa Casa
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Hostel
                  </span>
                </div>

                {/* Navigation */}
                <nav className="hidden md:flex items-center space-x-6">
                  <a 
                    href={`/${locale}`}
                    className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {locale === 'pt' ? 'Início' : locale === 'en' ? 'Home' : 'Inicio'}
                  </a>
                  <a 
                    href={`/${locale}/rooms`}
                    className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {locale === 'pt' ? 'Quartos' : locale === 'en' ? 'Rooms' : 'Habitaciones'}
                  </a>
                  <a 
                    href={`/${locale}/booking`}
                    className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {locale === 'pt' ? 'Reservar' : locale === 'en' ? 'Book Now' : 'Reservar'}
                  </a>
                </nav>

                {/* Language Switcher */}
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1 text-xs">
                    <a 
                      href="/pt"
                      className={`px-2 py-1 rounded ${locale === 'pt' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      PT
                    </a>
                    <a 
                      href="/en"
                      className={`px-2 py-1 rounded ${locale === 'en' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      EN
                    </a>
                    <a 
                      href="/es"
                      className={`px-2 py-1 rounded ${locale === 'es' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      ES
                    </a>
                  </div>
                </div>
              </div>
            </header>

            {/* Main Content */}
            <main className="flex-1">
              {children}
            </main>

            {/* Footer internacionalizado */}
            <footer className="border-t bg-background">
              <div className="container-lapa py-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* Contact Info */}
                  <div>
                    <h3 className="font-semibold mb-4">
                      {locale === 'pt' ? 'Contato' : locale === 'en' ? 'Contact' : 'Contacto'}
                    </h3>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>Rua Silvio Romero 22</p>
                      <p>Santa Teresa, Rio de Janeiro</p>
                      <p>+55 21 9999-9999</p>
                      <p>reservas@lapacasahostel.com</p>
                    </div>
                  </div>

                  {/* Quick Links */}
                  <div>
                    <h3 className="font-semibold mb-4">
                      {locale === 'pt' ? 'Links Rápidos' : locale === 'en' ? 'Quick Links' : 'Enlaces Rápidos'}
                    </h3>
                    <div className="space-y-2 text-sm">
                      <a href={`/${locale}/rooms`} className="block text-muted-foreground hover:text-foreground">
                        {locale === 'pt' ? 'Quartos' : locale === 'en' ? 'Rooms' : 'Habitaciones'}
                      </a>
                      <a href={`/${locale}/booking`} className="block text-muted-foreground hover:text-foreground">
                        {locale === 'pt' ? 'Reservar' : locale === 'en' ? 'Book Now' : 'Reservar'}
                      </a>
                      <a href={`/${locale}/about`} className="block text-muted-foreground hover:text-foreground">
                        {locale === 'pt' ? 'Sobre Nós' : locale === 'en' ? 'About Us' : 'Acerca de'}
                      </a>
                    </div>
                  </div>

                  {/* Social Media */}
                  <div>
                    <h3 className="font-semibold mb-4">
                      {locale === 'pt' ? 'Redes Sociais' : locale === 'en' ? 'Social Media' : 'Redes Sociales'}
                    </h3>
                    <div className="space-y-2 text-sm">
                      <a href="#" className="block text-muted-foreground hover:text-foreground">
                        Instagram
                      </a>
                      <a href="#" className="block text-muted-foreground hover:text-foreground">
                        Facebook
                      </a>
                      <a href="https://wa.me/5521999999999" className="block text-muted-foreground hover:text-foreground">
                        WhatsApp
                      </a>
                    </div>
                  </div>
                </div>

                <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
                  <p>
                    © 2024 Lapa Casa Hostel. 
                    {locale === 'pt' ? ' Todos os direitos reservados.' : 
                     locale === 'en' ? ' All rights reserved.' : 
                     ' Todos los derechos reservados.'}
                  </p>
                </div>
              </div>
            </footer>
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
