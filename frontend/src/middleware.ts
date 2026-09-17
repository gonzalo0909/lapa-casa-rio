import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

export const config = {
  // Excluye API, assets internos de Next, archivos estáticos (con extensión)
  // y /owner (panel de administradores de apartamento -- herramienta interna,
  // sin traducción por idioma como el resto del sitio, no necesita el
  // prefijo /pt /es /en... que exige localePrefix: 'always').
  matcher: ['/((?!api|_next|_vercel|owner|.*\\..*).*)'],
};
