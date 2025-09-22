// src/app/manifest.ts
import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Lapa Casa Hostel - Reservas Grupos Santa Teresa Rio',
    short_name: 'Lapa Casa Hostel',
    description: 'Hostel especializado en grupos grandes. 45 camas en Santa Teresa, Rio de Janeiro. Reservas directas con descuentos especiales.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2563eb',
    orientation: 'portrait-primary',
    scope: '/',
    lang: 'pt-BR',
    categories: [
      'travel',
      'hospitality',
      'accommodation',
      'hostel',
      'booking',
    ],
    icons: [
      {
        src: '/icons/manifest-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable any',
      },
      {
        src: '/icons/manifest-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable any',
      },
      {
        src: '/icons/apple-icon-180.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/favicon-32.png',
        sizes: '32x32',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/favicon-16.png',
        sizes: '16x16',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    screenshots: [
      {
        src: '/screenshots/booking-mobile.png',
        sizes: '390x844',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Motor de reservas móvil',
      },
      {
        src: '/screenshots/booking-desktop.png',
        sizes: '1920x1080',
        type: 'image/png',
        form_factor: 'wide',
        label: 'Motor de reservas desktop',
      },
    ],
    related_applications: [],
    prefer_related_applications: false,
    shortcuts: [
      {
        name: 'Reservar Ahora',
        short_name: 'Reservar',
        description: 'Crear nueva reserva para grupo',
        url: '/booking',
        icons: [
          {
            src: '/icons/shortcut-booking.png',
            sizes: '96x96',
          },
        ],
      },
      {
        name: 'Ver Habitaciones',
        short_name: 'Habitaciones',
        description: 'Explorar habitaciones disponibles',
        url: '/rooms',
        icons: [
          {
            src: '/icons/shortcut-rooms.png',
            sizes: '96x96',
          },
        ],
      },
      {
        name: 'Contacto WhatsApp',
        short_name: 'WhatsApp',
        description: 'Contactar por WhatsApp',
        url: 'https://wa.me/5521999999999',
        icons: [
          {
            src: '/icons/shortcut-whatsapp.png',
            sizes: '96x96',
          },
        ],
      },
    ],
    edge_side_panel: {
      preferred_width: 400,
    },
  };
}
