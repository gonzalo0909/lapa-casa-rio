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
        t('rooms.mixto7.features.shared_bathroom'),
        t('rooms.mixto7.features.quiet_area')
      ],
      available: true,
      isFlexible: false
    },
    {
      id: 'flexible_7',
      name: t('rooms.flexible7.name'),
      type: t('rooms.flexible7.type'),
      capacity: 7,
      basePrice: 60,
      images: [
        '/images/rooms/flexible-7-1.jpg',
        '/images/rooms/flexible-7-2.jpg',
        '/images/rooms/flexible-7-3.jpg'
      ],
      amenities: [
        t('amenities.aircon'),
        t('amenities.lockers'),
        t('amenities.wifi'),
        t('amenities.reading_lights')
      ],
      description: t('rooms.flexible7.description'),
      features: [
        t('rooms.flexible7.features.adaptive_configuration'),
        t('rooms.flexible7.features.priority_female'),
        t('rooms.flexible7.features.auto_conversion')
      ],
      available: true,
      isFlexible: true
    }
  ];

  // Iconos para amenidades
  const amenityIcons = {
    [t('amenities.aircon')]: AirVent,
    [t('amenities.lockers')]: Lock,
    [t('amenities.wifi')]: Wifi,
    [t('amenities.reading_lights')]: Lightbulb
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header Section */}
      <section className="bg-gradient-to-r from-primary/10 to-secondary/10 py-16">
        <div className="container-lapa">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">
              {t('title')}
            </h1>
            <p className="text-lg text-muted-foreground mb-6">
              {t('subtitle')}
            </p>
            <div className="flex items-center justify-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <Bed className="w-4 h-4 text-primary" />
                <span>45 {t('stats.totalBeds')}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-primary" />
                <span>4 {t('stats.rooms')}</span>
              </div>
              <div className="flex items-center space-x-2">
                <DollarSign className="w-4 h-4 text-primary" />
                <span>R$ 60/{t('stats.perNight')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Rooms Grid */}
      <section className="section-padding">
        <div className="container-lapa">
          <div className="space-y-12">
            {rooms.map((room, index) => (
              <Card key={room.id} className="overflow-hidden">
                <div className={`grid grid-cols-1 lg:grid-cols-2 gap-0 ${index % 2 === 1 ? 'lg:grid-flow-col-dense' : ''}`}>
                  {/* Images */}
                  <div className={`relative ${index % 2 === 1 ? 'lg:order-2' : ''}`}>
                    <div className="aspect-video lg:aspect-square relative">
                      <Image
                        src={room.images[0]}
                        alt={room.name}
                        fill
                        className="object-cover"
                      />
                      {room.isFlexible && (
                        <Badge className="absolute top-4 right-4 bg-secondary">
                          {t('flexible')}
                        </Badge>
                      )}
                      <div className="absolute bottom-4 left-4">
                        <Badge variant="secondary" className="bg-black/50 text-white">
                          {room.capacity} {t('beds')}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className={`p-8 ${index % 2 === 1 ? 'lg:order-1' : ''}`}>
                    <div className="space-y-6">
                      {/* Header */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h2 className="text-2xl font-bold">{room.name}</h2>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-primary">
                              R$ {room.basePrice}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {t('perBed')}/{t('perNight')}
                            </div>
                          </div>
                        </div>
                        <p className="text-muted-foreground text-lg">
                          {room.type}
                        </p>
                      </div>

                      {/* Description */}
                      <p className="text-foreground">
                        {room.description}
                      </p>

                      {/* Features */}
                      <div>
                        <h3 className="font-semibold mb-3">{t('features')}</h3>
                        <ul className="space-y-2">
                          {room.features.map((feature, featureIndex) => (
                            <li key={featureIndex} className="flex items-center space-x-2 text-sm">
                              <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Amenities */}
                      <div>
                        <h3 className="font-semibold mb-3">{t('amenities.title')}</h3>
                        <div className="grid grid-cols-2 gap-3">
                          {room.amenities.map((amenity, amenityIndex) => {
                            const IconComponent = amenityIcons[amenity] || Info;
                            return (
                              <div key={amenityIndex} className="flex items-center space-x-2 text-sm">
                                <IconComponent className="w-4 h-4 text-primary" />
                                <span>{amenity}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Special Notice for Flexible Room */}
                      {room.isFlexible && (
                        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                          <div className="flex items-start space-x-3">
                            <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                            <div className="text-sm">
                              <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                                {t('flexibleRoom.title')}
                              </p>
                              <p className="text-blue-800 dark:text-blue-200">
                                {t('flexibleRoom.description')}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Link href={`/${locale}/booking?room=${room.id}`} className="flex-1">
                          <Button className="w-full">
                            <Calendar className="w-4 h-4 mr-2" />
                            {t('bookThisRoom')}
                          </Button>
                        </Link>
                        <Button variant="outline" className="sm:w-auto">
                          {t('viewGallery')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="bg-muted/50 section-padding">
        <div className="container-lapa">
          <h2 className="text-3xl font-bold text-center mb-12">
            {t('comparison.title')}
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full bg-card rounded-lg border">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4 font-semibold">{t('comparison.feature')}</th>
                  {rooms.map((room) => (
                    <th key={room.id} className="text-center p-4 font-semibold">
                      {room.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-4">{t('comparison.capacity')}</td>
                  {rooms.map((room) => (
                    <td key={room.id} className="text-center p-4">
                      {room.capacity} {t('beds')}
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="p-4">{t('comparison.type')}</td>
                  {rooms.map((room) => (
                    <td key={room.id} className="text-center p-4">
                      {room.type}
                      {room.isFlexible && (
                        <Badge className="ml-2 text-xs" variant="secondary">
                          {t('flexible')}
                        </Badge>
                      )}
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="p-4">{t('comparison.pricePerBed')}</td>
                  {rooms.map((room) => (
                    <td key={room.id} className="text-center p-4 font-semibold text-primary">
                      R$ {room.basePrice}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4">{t('comparison.availability')}</td>
                  {rooms.map((room) => (
                    <td key={room.id} className="text-center p-4">
                      <Badge variant={room.available ? 'default' : 'secondary'}>
                        {room.available ? t('available') : t('unavailable')}
                      </Badge>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Group Pricing */}
      <section className="section-padding">
        <div className="container-lapa">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">
              {t('groupPricing.title')}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t('groupPricing.description')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 text-center">
              <div className="text-3xl font-bold text-primary mb-2">10%</div>
              <h3 className="font-semibold mb-2">{t('groupPricing.small.title')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('groupPricing.small.description')}
              </p>
            </Card>
            
            <Card className="p-6 text-center border-primary">
              <div className="text-3xl font-bold text-primary mb-2">15%</div>
              <h3 className="font-semibold mb-2">{t('groupPricing.medium.title')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('groupPricing.medium.description')}
              </p>
            </Card>
            
            <Card className="p-6 text-center">
              <div className="text-3xl font-bold text-primary mb-2">20%</div>
              <h3 className="font-semibold mb-2">{t('groupPricing.large.title')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('groupPricing.large.description')}
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary text-primary-foreground section-padding">
        <div className="container-lapa text-center">
          <h2 className="text-3xl font-bold mb-4">
            {t('cta.title')}
          </h2>
          <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
            {t('cta.description')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={`/${locale}/booking`}>
              <Button size="lg" className="bg-white text-primary hover:bg-white/90">
                <Calendar className="w-5 h-5 mr-2" />
                {t('cta.bookNow')}
              </Button>
            </Link>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-white text-white hover:bg-white hover:text-primary"
              onClick={() => window.open('https://wa.me/5521999999999', '_blank')}
            >
              {t('cta.contact')}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
