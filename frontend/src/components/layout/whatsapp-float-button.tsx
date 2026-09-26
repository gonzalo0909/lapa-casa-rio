//
// Idea #48 (roadmap.html): "Chat de WhatsApp visible como opción de
// consulta pre-reserva (ya existe integración, falta exponerla como canal
// de venta activo)". La home, /hostel y /apartamentos -- las páginas con
// más visitas -- no tienen ningún footer (SiteFooter solo se usa en las
// páginas de contenido), así que un link en el footer no las cubre. Este
// botón se agrega en el layout raíz para que aparezca en TODAS las
// páginas, sin tocar la estructura interna de cada una.

import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { WhatsAppFloatButtonClient } from './whatsapp-float-button-client';

interface WhatsAppFloatButtonProps {
  locale: Locale;
}

export async function WhatsAppFloatButton({ locale }: WhatsAppFloatButtonProps) {
  const t = await getTranslations({ locale, namespace: 'footer' });
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '5521977157530';

  return (
    <WhatsAppFloatButtonClient href={`https://wa.me/${whatsappNumber}`} label={t('whatsapp')} />
  );
}
