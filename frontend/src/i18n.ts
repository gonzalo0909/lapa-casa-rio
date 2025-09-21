// lapa-casa-hostel-frontend/src/i18n.ts

import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';
import { LOCALE_CONFIG } from './constants/config';

const locales = LOCALE_CONFIG.supported;

export default getRequestConfig(async ({ locale }) => {
  // Validar que el locale es soportado
  if (!locales.includes(locale as any)) {
    notFound();
  }

  return {
    messages: (await import(`../messages/${locale}.json`)).default,
    timeZone: 'America/Sao_Paulo',
    now: new Date(),
    formats: {
      dateTime: {
        short: {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        },
        long: {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          weekday: 'long'
        }
      },
      number: {
        currency: {
          style: 'currency',
          currency: 'BRL'
        }
      }
    }
  };
});

// Configuração de routing para locales
export const routing = {
  locales,
  defaultLocale: LOCALE_CONFIG.default,
  pathnames: {
    '/': '/',
    '/booking': {
      pt: '/reserva',
      en: '/booking',
      es: '/reserva'
    },
    '/rooms': {
      pt: '/quartos',
      en: '/rooms',
      es: '/habitaciones'
    },
    '/about': {
      pt: '/sobre',
      en: '/about',
      es: '/acerca'
    },
    '/contact': {
      pt: '/contato',
      en: '/contact',
      es: '/contacto'
    },
    '/terms': {
      pt: '/termos',
      en: '/terms',
      es: '/terminos'
    },
    '/privacy': {
      pt: '/privacidade',
      en: '/privacy',
      es: '/privacidad'
    }
  }
} as const;

// Metadados por idioma
export const localeMetadata = {
  pt: {
    title: 'Lapa Casa Hostel - Hostel em Santa Teresa, Rio de Janeiro',
    description: 'Hostel no coração de Santa Teresa com 45 camas. Especializado em grupos. Reserve direto e economize!',
    keywords: [
      'hostel rio de janeiro',
      'santa teresa hostel',
      'lapa casa hostel',
      'hostel grupos',
      'hospedagem rio',
      'backpacker rio'
    ]
  },
  en: {
    title: 'Lapa Casa Hostel - Hostel in Santa Teresa, Rio de Janeiro',
    description: 'Hostel in the heart of Santa Teresa with 45 beds. Specialized in groups. Book direct and save!',
    keywords: [
      'hostel rio de janeiro',
      'santa teresa hostel',
      'lapa casa hostel',
      'group hostel',
      'rio accommodation',
      'backpacker rio'
    ]
  },
  es: {
    title: 'Lapa Casa Hostel - Hostel en Santa Teresa, Río de Janeiro',
    description: 'Hostel en el corazón de Santa Teresa con 45 camas. Especializado en grupos. ¡Reserva directo y ahorra!',
    keywords: [
      'hostel rio de janeiro',
      'santa teresa hostel',
      'lapa casa hostel',
      'hostel grupos',
      'alojamiento rio',
      'mochilero rio'
    ]
  }
};

// Configuração de formatos de data e número por locale
export const localeFormats = {
  pt: {
    dateFormat: 'dd/MM/yyyy',
    timeFormat: 'HH:mm',
    dateTimeFormat: 'dd/MM/yyyy HH:mm',
    currency: {
      symbol: 'R$',
      code: 'BRL',
      decimal: ',',
      thousand: '.'
    },
    number: {
      decimal: ',',
      thousand: '.'
    }
  },
  en: {
    dateFormat: 'MM/dd/yyyy',
    timeFormat: 'h:mm a',
    dateTimeFormat: 'MM/dd/yyyy h:mm a',
    currency: {
      symbol: '$',
      code: 'USD',
      decimal: '.',
      thousand: ','
    },
    number: {
      decimal: '.',
      thousand: ','
    }
  },
  es: {
    dateFormat: 'dd/MM/yyyy',
    timeFormat: 'HH:mm',
    dateTimeFormat: 'dd/MM/yyyy HH:mm',
    currency: {
      symbol: '€',
      code: 'EUR',
      decimal: ',',
      thousand: '.'
    },
    number: {
      decimal: ',',
      thousand: '.'
    }
  }
};

// Textos de fallback para casos de emergencia
export const fallbackMessages = {
  pt: {
    common: {
      loading: 'Carregando...',
      error: 'Erro',
      success: 'Sucesso',
      cancel: 'Cancelar',
      confirm: 'Confirmar',
      save: 'Salvar',
      edit: 'Editar',
      delete: 'Excluir',
      back: 'Voltar',
      next: 'Próximo',
      previous: 'Anterior',
      close: 'Fechar'
    },
    booking: {
      title: 'Fazer Reserva',
      checkIn: 'Check-in',
      checkOut: 'Check-out',
      guests: 'Hóspedes',
      rooms: 'Quartos',
      total: 'Total'
    },
    errors: {
      generic: 'Ocorreu um erro. Tente novamente.',
      network: 'Erro de conexão. Verifique sua internet.',
      validation: 'Dados inválidos. Verifique os campos.'
    }
  },
  en: {
    common: {
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      cancel: 'Cancel',
      confirm: 'Confirm',
      save: 'Save',
      edit: 'Edit',
      delete: 'Delete',
      back: 'Back',
      next: 'Next',
      previous: 'Previous',
      close: 'Close'
    },
    booking: {
      title: 'Make Booking',
      checkIn: 'Check-in',
      checkOut: 'Check-out',
      guests: 'Guests',
      rooms: 'Rooms',
      total: 'Total'
    },
    errors: {
      generic: 'An error occurred. Please try again.',
      network: 'Connection error. Check your internet.',
      validation: 'Invalid data. Check the fields.'
    }
  },
  es: {
    common: {
      loading: 'Cargando...',
      error: 'Error',
      success: 'Éxito',
      cancel: 'Cancelar',
      confirm: 'Confirmar',
      save: 'Guardar',
      edit: 'Editar',
      delete: 'Eliminar',
      back: 'Volver',
      next: 'Siguiente',
      previous: 'Anterior',
      close: 'Cerrar'
    },
    booking: {
      title: 'Hacer Reserva',
      checkIn: 'Check-in',
      checkOut: 'Check-out',
      guests: 'Huéspedes',
      rooms: 'Habitaciones',
      total: 'Total'
    },
    errors: {
      generic: 'Ocurrió un error. Inténtelo de nuevo.',
      network: 'Error de conexión. Verifique su internet.',
      validation: 'Datos inválidos. Verifique los campos.'
    }
  }
};

// Utility functions para i18n
export function getLocaleFromUrl(pathname: string): string {
  const segments = pathname.split('/');
  const possibleLocale = segments[1];
  
  if (locales.includes(possibleLocale as any)) {
    return possibleLocale;
  }
  
  return LOCALE_CONFIG.default;
}

export function createLocalizedPath(pathname: string, locale: string): string {
  const segments = pathname.split('/');
  
  // Remove locale atual se existir
  if (locales.includes(segments[1] as any)) {
    segments.splice(1, 1);
  }
  
  // Adiciona novo locale se não for o padrão
  if (locale !== LOCALE_CONFIG.default) {
    segments.splice(1, 0, locale);
  }
  
  return segments.join('/') || '/';
}

export function getAlternateLinks(pathname: string) {
  return locales.map(locale => ({
    hrefLang: locale,
    href: createLocalizedPath(pathname, locale)
  }));
}

export function detectUserLocale(): string {
  if (typeof window === 'undefined') {
    return LOCALE_CONFIG.default;
  }
  
  // Verificar localStorage primeiro
  const stored = localStorage.getItem(LOCALE_CONFIG.cookieName);
  if (stored && locales.includes(stored as any)) {
    return stored;
  }
  
  // Detectar do navegador
  const browserLang = navigator.language.split('-')[0];
  if (locales.includes(browserLang as any)) {
    return browserLang;
  }
  
  return LOCALE_CONFIG.default;
}

export function setUserLocale(locale: string): void {
  if (typeof window === 'undefined') return;
  
  if (locales.includes(locale as any)) {
    localStorage.setItem(LOCALE_CONFIG.cookieName, locale);
  }
}

// Type definitions para rotas localizadas
export type LocalizedPathnames = typeof routing.pathnames;
export type PathnameKey = keyof LocalizedPathnames;
export type Locale = typeof locales[number];

// Helper para obter URL localizada
export function getLocalizedUrl(
  pathname: PathnameKey,
  locale: Locale
): string {
  const pathnames = routing.pathnames[pathname];
  
  if (typeof pathnames === 'string') {
    return pathnames;
  }
  
  return pathnames[locale] || pathnames[LOCALE_CONFIG.default];
}

// Hook personalizado para uso em componentes
export function useCurrentLocale(): Locale {
  if (typeof window === 'undefined') {
    return LOCALE_CONFIG.default;
  }
  
  return getLocaleFromUrl(window.location.pathname) as Locale;
}

// Middleware helper para verificação de locale
export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

// Configuração de direção de texto (para futura expansão RTL)
export const textDirection = {
  pt: 'ltr',
  en: 'ltr',
  es: 'ltr'
} as const;

// Configuração de zona de tempo por locale
export const timeZones = {
  pt: 'America/Sao_Paulo',
  en: 'America/New_York',
  es: 'Europe/Madrid'
} as const;

// Lista de moedas preferenciais por locale
export const preferredCurrencies = {
  pt: 'BRL',
  en: 'USD',
  es: 'EUR'
} as const;
