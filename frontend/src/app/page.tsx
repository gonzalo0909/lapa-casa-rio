import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

// Detectar idioma preferido del usuario
function detectPreferredLanguage(): string {
  const headersList = headers();
  const acceptLanguage = headersList.get('accept-language') || '';
  
  // Parsear Accept-Language header
  const languages = acceptLanguage
    .split(',')
    .map(lang => {
      const [code, quality = '1'] = lang.trim().split(';q=');
      return {
        code: code.split('-')[0].toLowerCase(),
        quality: parseFloat(quality)
      };
    })
    .sort((a, b) => b.quality - a.quality);
  
  // Idiomas soportados por Lapa Casa Hostel
  const supportedLanguages = ['pt', 'en', 'es'];
  
  // Encontrar el primer idioma soportado
  for (const { code } of languages) {
    if (supportedLanguages.includes(code)) {
      return code;
    }
  }
  
  // Default a portugués (mercado principal Brasil)
  return 'pt';
}

export const metadata: Metadata = {
  title: 'Lapa Casa Hostel - Hospedagem em Santa Teresa, Rio de Janeiro',
  description: 'Hostel especializado em grupos no coração de Santa Teresa, Rio de Janeiro. Reserve agora e aproveite descontos especiais para grupos.',
  alternates: {
    canonical: '/',
  },
};

// Página raíz que redirige al idioma detectado
export default function RootPage() {
  const preferredLanguage = detectPreferredLanguage();
  
  // Redireccionar al idioma detectado
  redirect(`/${preferredLanguage}`);
}

// Esta página nunca se renderiza, pero mantener por compatibilidad
export function RootPageComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Lapa Casa Hostel</h1>
        <p className="text-muted-foreground">Redirecionando...</p>
      </div>
    </div>
  );
}
