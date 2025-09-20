import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  MapPin, 
  Users, 
  Bed, 
  Wifi, 
  Coffee, 
  Car,
  Star,
  Calendar,
  CreditCard,
  Shield
} from 'lucide-react';

interface HomePageProps {
  params: {
    locale: string;
  };
}

// Generar metadata por idioma
export async function generateMetadata({ 
  params: { locale } 
}: HomePageProps): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'HomePage' });
  
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    keywords: t('meta.keywords'),
  };
}

export default function HomePage({ params: { locale } }: HomePageProps) {
  const t = useTranslations('HomePage');

  // Datos de las habitaciones
  const rooms = [
    {
      id: 'mixto_12a',
      name: t('rooms.mixto12a.name'),
      capacity: 12,
      type: t('rooms.mixto12a.type'),
      image: '/images/rooms/mixto-12a.jpg',
      available: true
    },
    {
      id: 'mixto_12b',
      name: t('rooms.mixto12b.name'),
      capacity: 12,
      type: t('rooms.mixto12b.type'),
      image: '/images/rooms/mixto-12b.jpg',
      available: true
    },
    {
      id: 'mixto_7',
      name: t('rooms.mixto7.name'),
      capacity: 7,
      type: t('rooms.mixto7
