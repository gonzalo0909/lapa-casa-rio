import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

export const config = {
  // Excluye API, assets internos de Next y archivos estáticos (con extensión).
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
