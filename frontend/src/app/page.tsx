// src/app/page.tsx
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

function detectPreferredLanguage(): string {
  const headersList = headers();
  const acceptLanguage = headersList.get('accept-language') || '';
  
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
  
  const supportedLanguages = ['pt', 'en', 'es'];
  
  for (const { code } of languages) {
    if (supportedLanguages.includes(code)) {
      return code;
    }
  }
  
  return 'pt';
}

export const metadata: Metadata = {
  title: 'Lapa Casa Hostel - Hospedagem em Santa Teresa, Rio de Janeiro',
  description: 'Hostel especializado em grupos no coração de Santa Teresa, Rio de Janeiro. Reserve agora e aproveite descontos especiais para grupos.',
  alternates: {
    canonical: '/',
  },
};

export default function RootPage() {
  const preferredLanguage = detectPreferredLanguage();
  redirect(`/${preferredLanguage}`);
}

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
