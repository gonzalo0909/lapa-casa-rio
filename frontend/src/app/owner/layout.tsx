// lapa-casa-hostel/frontend/src/app/owner/layout.tsx
//
// Root layout propio de /owner (panel de administradores de apartamento).
// No cuelga de app/[locale]/layout.tsx -- middleware.ts excluye /owner del
// prefijo de idioma (ver comentario ahí), así que /owner necesita su
// propio <html>/<body>, como cualquier segmento raíz de la App Router.
// Herramienta interna en un solo idioma (portugués), sin next-intl.

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../globals.css';
import './owner-light.css';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: 'Painel do Proprietário — Lapa Casa Rio',
  robots: { index: false, follow: false },
};

// Variables CSS del tema claro — definidas como inline style en <html> para
// ganar siempre contra @media (prefers-color-scheme: dark) de globals.css.
// Los inline styles tienen mayor especificidad que cualquier regla de hoja
// de estilos, incluyendo las que están dentro de media queries.
const LIGHT_THEME = {
  '--background': '46 41% 89%',
  '--foreground': '150 24% 11%',
  '--primary': '160 42% 21%',
  '--primary-foreground': '46 41% 94%',
  '--secondary': '200 53% 36%',
  '--secondary-foreground': '46 41% 94%',
  '--destructive': '7 55% 40%',
  '--destructive-foreground': '46 41% 94%',
  '--muted': '46 20% 80%',
  '--muted-foreground': '150 10% 35%',
  '--accent': '307 86% 59%',
  '--accent-foreground': '46 41% 96%',
  '--popover': '46 41% 96%',
  '--popover-foreground': '150 24% 11%',
  '--card': '46 30% 97%',
  '--card-foreground': '150 24% 11%',
  '--border': '46 19% 79%',
  '--input': '46 19% 79%',
  '--ring': '160 42% 21%',
  colorScheme: 'only light',
} as React.CSSProperties;

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" style={LIGHT_THEME}>
      <body className={`${inter.className} min-h-screen bg-background text-foreground`}>
        {children}
      </body>
    </html>
  );
}
