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
      type: t('rooms.mixto7.type'),
      image: '/images/rooms/mixto-7.jpg',
      available: true
    },
    {
      id: 'flexible_7',
      name: t('rooms.flexible7.name'),
      capacity: 7,
      type: t('rooms.flexible7.type'),
      image: '/images/rooms/flexible-7.jpg',
      available: true,
      isFlexible: true
    }
  ];

  // Estadísticas del hostel
  const stats = [
    { icon: Bed, value: '45', label: t('stats.beds') },
    { icon: Users, value: '4', label: t('stats.rooms') },
    { icon: Star, value: '4.8', label: t('stats.rating') },
    { icon: MapPin, value: 'Santa Teresa', label: t('stats.location') }
  ];

  // Comodidades principales
  const amenities = [
    { icon: Wifi, label: t('amenities.wifi') },
    { icon: Coffee, label: t('amenities.kitchen') },
    { icon: Car, label: t('amenities.parking') },
    { icon: Shield, label: t('amenities.security') }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-primary to-secondary text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative container-lapa section-padding">
          <div className="mx-auto max-w-4xl text-center space-y-6">
            <h1 className="text-4xl lg:text-6xl font-bold">
              {t('hero.title')}
            </h1>
            <p className="text-xl lg:text-2xl opacity-90">
              {t('hero.subtitle')}
            </p>
            <p className="text-lg opacity-80 max-w-2xl mx-auto">
              {t('hero.description')}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link href={`/${locale}/booking`}>
                <Button size="lg" className="bg-white text-primary hover:bg-white/90">
                  <Calendar className="w-5 h-5 mr-2" />
                  {t('hero.bookNow')}
                </Button>
              </Link>
              
              <Link href={`/${locale}/rooms`}>
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-primary">
                  <Bed className="w-5 h-5 mr-2" />
                  {t('hero.viewRooms')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-b bg-muted/50">
        <div className="container-lapa py-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <stat.icon className="w-8 h-8 mx-auto mb-2 text-primary" />
                <div className="text-2xl lg:text-3xl font-bold text-foreground">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Rooms Preview */}
      <section className="section-padding">
        <div className="container-lapa">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              {t('rooms.title')}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t('rooms.description')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {rooms.map((room) => (
              <Card key={room.id} className="room-card group">
                <div className="relative aspect-photo overflow-hidden rounded-t-lg">
                  <Image
                    src={room.image}
                    alt={room.name}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                  {room.isFlexible && (
                    <Badge className="absolute top-2 right-2 bg-secondary">
                      {t('rooms.flexible')}
                    </Badge>
                  )}
                </div>
                
                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-1">{room.name}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{room.type}</p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1 text-sm">
                      <Users className="w-4 h-4" />
                      <span>{room.capacity} {t('rooms.beds')}</span>
                    </div>
                    
                    <Badge variant={room.available ? 'default' : 'secondary'}>
                      {room.available ? t('rooms.available') : t('rooms.unavailable')}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link href={`/${locale}/rooms`}>
              <Button variant="outline" size="lg">
                {t('rooms.viewAll')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-muted/50 section-padding">
        <div className="container-lapa">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              {t('features.title')}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t('features.description')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {amenities.map((amenity, index) => (
              <Card key={index} className="p-6 text-center">
                <amenity.icon className="w-8 h-8 mx-auto mb-3 text-primary" />
                <h3 className="font-semibold">{amenity.label}</h3>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Group Discount Section */}
      <section className="section-padding">
        <div className="container-lapa">
          <div className="bg-gradient-to-r from-primary to-secondary rounded-2xl p-8 lg:p-12 text-white text-center">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              {t('groupDiscount.title')}
            </h2>
            <p className="text-xl opacity-90 mb-6 max-w-2xl mx-auto">
              {t('groupDiscount.description')}
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white/10 rounded-lg p-4">
                <div className="text-2xl font-bold">7-15 {t('groupDiscount.people')}</div>
                <div className="text-lg">10% {t('groupDiscount.discount')}</div>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <div className="text-2xl font-bold">16-25 {t('groupDiscount.people')}</div>
                <div className="text-lg">15% {t('groupDiscount.discount')}</div>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <div className="text-2xl font-bold">26+ {t('groupDiscount.people')}</div>
                <div className="text-lg">20% {t('groupDiscount.discount')}</div>
              </div>
            </div>

            <Link href={`/${locale}/booking`}>
              <Button size="lg" className="bg-white text-primary hover:bg-white/90">
                <Users className="w-5 h-5 mr-2" />
                {t('groupDiscount.bookGroup')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Location Section */}
      <section className="bg-muted/50 section-padding">
        <div className="container-lapa">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl lg:text-4xl font-bold mb-6">
                {t('location.title')}
              </h2>
              <p className="text-muted-foreground mb-6">
                {t('location.description')}
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <MapPin className="w-5 h-5 text-primary" />
                  <span>Rua Silvio Romero 22, Santa Teresa</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Car className="w-5 h-5 text-primary" />
                  <span>{t('location.transport')}</span>
                </div>
              </div>
            </div>
            
            <div className="relative aspect-video rounded-lg overflow-hidden">
              <Image
                src="/images/location/santa-teresa.jpg"
                alt="Santa Teresa, Rio de Janeiro"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-padding">
        <div className="container-lapa">
          <Card className="p-8 lg:p-12 text-center bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              {t('cta.title')}
            </h2>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              {t('cta.description')}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href={`/${locale}/booking`}>
                <Button size="lg" className="w-full sm:w-auto">
                  <Calendar className="w-5 h-5 mr-2" />
                  {t('cta.bookNow')}
                </Button>
              </Link>
              
              <Button 
                size="lg" 
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => window.open('https://wa.me/5521999999999', '_blank')}
              >
                <CreditCard className="w-5 h-5 mr-2" />
                {t('cta.contact')}
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
