import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Bed, 
  Wifi, 
  AirVent, 
  Lock, 
  Lightbulb,
  Calendar,
  DollarSign,
  Info
} from 'lucide-react';

interface RoomsPageProps {
  params: {
    locale: string;
  };
}

// Generar metadata dinámicamente
export async function generateMetadata({ 
  params: { locale } 
}: RoomsPageProps): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'RoomsPage' });
  
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    keywords: t('meta.keywords'),
  };
}

export default function RoomsPage({ params: { locale } }: RoomsPageProps) {
  const t = useTranslations('RoomsPage');

  // Configuración de habitaciones con detalles completos
  const rooms = [
    {
      id: 'mixto_12a',
      name: t('rooms.mixto12a.name'),
      type: t('rooms.mixto12a.type'),
      capacity: 12,
      basePrice: 60,
      images: [
        '/images/rooms/mixto-12a-1.jpg',
        '/images/rooms/mixto-12a-2.jpg',
        '/images/rooms/mixto-12a-3.jpg'
      ],
      amenities: [
        t('amenities.aircon'),
        t('amenities.lockers'),
        t('amenities.wifi'),
        t('amenities.reading_lights')
      ],
      description: t('rooms.mixto12a.description'),
      features: [
        t('rooms.mixto12a.features.bunk_beds'),
        t('rooms.mixto12a.features.shared_bathroom'),
        t('rooms.mixto12a.features.common_area')
      ],
      available: true,
      isFlexible: false
    },
    {
      id: 'mixto_12b',
      name: t('rooms.mixto12b.name'),
      type: t('rooms.mixto12b.type'),
      capacity: 12,
      basePrice: 60,
      images: [
        '/images/rooms/mixto-12b-1.jpg',
        '/images/rooms/mixto-12b-2.jpg',
        '/images/rooms/mixto-12b-3.jpg'
      ],
      amenities: [
        t('amenities.aircon'),
        t('amenities.lockers'),
        t('amenities.wifi'),
        t('amenities.reading_lights')
      ],
      description: t('rooms.mixto12b.description'),
      features: [
        t('rooms.mixto12b.features.bunk_beds'),
        t('rooms.mixto12b.features.shared_bathroom'),
        t('rooms.mixto12b.features.balcony')
      ],
      available: true,
      isFlexible: false
    },
    {
      id: 'mixto_7',
      name: t('rooms.mixto7.name'),
      type: t('rooms.mixto7.type'),
      capacity: 7,
      basePrice: 60,
      images: [
        '/images/rooms/mixto-7-1.jpg',
        '/images/rooms/mixto-7-2.jpg',
        '/images/rooms/mixto-7-3.jpg'
      ],
      amenities: [
        t('amenities.aircon'),
        t('amenities.lockers'),
        t('amenities.wifi'),
        t('amenities.reading_lights')
      ],
      description: t('rooms.mixto7.description'),
      features: [
        t('rooms.mixto7.features.compact_design'),
        t('rooms.mixto7.features.share
