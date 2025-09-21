// lapa-casa-hostel-frontend/src/app/[locale]/rooms/page.tsx
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

export async function generateMetadata({ 
  params: { locale } 
}: RoomsPageProps): Promise<Metadata> {
  return {
    title: 'Quartos - Lapa Casa Hostel',
    description: 'Conheça nossos 4 quartos com 45 camas total. Dormitórios mistos e quarto flexível, todos com ar condicionado e Wi-Fi.',
    keywords: 'quartos hostel rio, dormitórios santa teresa, acomodação grupos rio',
  };
}

export default function RoomsPage({ params: { locale } }: RoomsPageProps) {
  const rooms = [
    {
      id: 'mixto_12a',
      name: 'Mixto 12A',
      type: 'Dormitório Misto',
      capacity: 12,
      basePrice: 60,
      images: [
        '/images/rooms/mixto-12a-1.jpg',
        '/images/rooms/mixto-12a-2.jpg',
        '/images/rooms/mixto-12a-3.jpg'
      ],
      amenities: [
        'Ar condicionado',
        'Armários individuais',
        'Wi-Fi gratuito',
        'Luzes de leitura'
      ],
      description: 'Nosso maior dormitório misto com 12 camas em beliches, perfeito para grupos grandes. Ambiente aconchegante e bem ventilado.',
      features: [
        'Beliches de madeira resistente',
        'Banheiro compartilhado',
        'Área comum integrada'
      ],
      available: true,
      isFlexible: false
    },
    {
      id: 'mixto_12b',
      name: 'Mixto 12B',
      type: 'Dormitório Misto',
      capacity: 12,
      basePrice: 60,
      images: [
        '/images/rooms/mixto-12b-1.jpg',
        '/images/rooms/mixto-12b-2.jpg',
        '/images/rooms/mixto-12b-3.jpg'
      ],
      amenities: [
        'Ar condicionado',
        'Armários individuais',
        'Wi-Fi gratuito',
        'Luzes de leitura'
      ],
      description: 'Segundo dormitório misto com 12 camas, oferece a mesma qualidade e conforto do 12A com vista diferenciada.',
      features: [
        'Beliches de madeira resistente',
        'Banheiro compartilhado',
        'Varanda com vista'
      ],
      available: true,
      isFlexible: false
    },
    {
      id: 'mixto_7',
      name: 'Mixto 7',
      type: 'Dormitório Misto',
      capacity: 7,
      basePrice: 60,
      images: [
        '/images/rooms/mixto-7-1.jpg',
        '/images/rooms/mixto-7-2.jpg',
        '/images/rooms/mixto-7-3.jpg'
      ],
      amenities: [
        'Ar condicionado',
        'Armários individuais',
        'Wi-Fi gratuito',
        'Luzes de leitura'
      ],
      description: 'Dormitório mais compacto e aconchegante, ideal para grupos menores que buscam maior privacidade.',
      features: [
        'Design compacto otimizado',
        'Banheiro compartilhado',
        'Área mais silenciosa'
      ],
      available: true,
      isFlexible: false
    },
    {
      id: 'flexible_7',
      name: 'Flexible 7',
      type: 'Dormitório Flexível',
      capacity: 7,
      basePrice: 60,
      images: [
        '/images/rooms/flexible-7-1.jpg',
        '/images/rooms/flexible-7-2.jpg',
        '/images/rooms/flexible-7-3.jpg'
      ],
      amenities: [
        'Ar condicionado',
        'Armários individuais',
        'Wi-Fi gratuito',
        'Luzes de leitura'
      ],
      description: 'Nosso quarto mais versátil, que se adapta às necessidades dos hóspedes. Configuração feminina por padrão.',
      features: [
        'Configuração adaptativa',
        'Prioridade para mulheres',
        'Conversão automática se necessário'
      ],
      available: true,
      isFlexible: true
    }
  ];

  const amenityIcons = {
    'Ar condicionado': AirVent,
    'Armários individuais': Lock,
    'Wi-Fi gratuito': Wifi,
    'Luzes de leitura': Lightbulb
  };

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-r from-primary/10 to-secondary/10 py-16">
        <div className="container-lapa">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">
              Nossos Quartos
            </h1>
            <p className="text-lg text-muted-foreground mb-6">
              45 camas distribuídas em 4 quartos confortáveis, todos equipados com ar condicionado e Wi-Fi
            </p>
            <div className="flex items-center justify-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <Bed className="w-4 h-4 text-primary" />
                <span>45 camas totais</span>
              </div>
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-primary" />
                <span>4 quartos</span>
              </div>
              <div className="flex items-center space-x-2">
                <DollarSign className="w-4 h-4 text-primary" />
                <span>R$ 60/noite</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-lapa">
          <div className="space-y-12">
            {rooms.map((room, index) => (
              <Card key={room.id} className="overflow-hidden">
                <div className={`grid grid-cols-1 lg:grid-cols-2 gap-0 ${index % 2 === 1 ? 'lg:grid-flow-col-dense' : ''}`}>
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
                          Flexível
                        </Badge>
                      )}
                      <div className="absolute bottom-4 left-4">
                        <Badge variant="secondary" className="bg-black/50 text-white">
                          {room.capacity} camas
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className={`p-8 ${index % 2 === 1 ? 'lg:order-1' : ''}`}>
                    <div className="space-y-6">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h2 className="text-2xl font-bold">{room.name}</h2>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-primary">
                              R$ {room.basePrice}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              por cama/noite
                            </div>
                          </div>
                        </div>
                        <p className="text-muted-foreground text-lg">
                          {room.type}
                        </p>
                      </div>

                      <p className="text-foreground">
                        {room.description}
                      </p>

                      <div>
                        <h3 className="font-semibold mb-3">Características</h3>
                        <ul className="space-y-2">
                          {room.features.map((feature, featureIndex) => (
                            <li key={featureIndex} className="flex items-center space-x-2 text-sm">
                              <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h3 className="font-semibold mb-3">Comodidades</h3>
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

                      {room.isFlexible && (
                        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                          <div className="flex items-start space-x-3">
                            <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                            <div className="text-sm">
                              <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                                Quarto Flexível
                              </p>
                              <p className="text-blue-800 dark:text-blue-200">
                                Configurado como feminino por padrão. Converte automaticamente para misto 48h antes se não houver reservas femininas.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-3">
                        <Link href={`/${locale}/booking?room=${room.id}`} className="flex-1">
                          <Button className="w-full">
                            <Calendar className="w-4 h-4 mr-2" />
                            Reservar Este Quarto
                          </Button>
                        </Link>
                        <Button variant="outline" className="sm:w-auto">
                          Ver Galeria
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

      <section className="bg-muted/50 section-padding">
        <div className="container-lapa">
          <h2 className="text-3xl font-bold text-center mb-12">
            Comparação de Quartos
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full bg-card rounded-lg border">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4 font-semibold">Característica</th>
                  {rooms.map((room) => (
                    <th key={room.id} className="text-center p-4 font-semibold">
                      {room.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-4">Capacidade</td>
                  {rooms.map((room) => (
                    <td key={room.id} className="text-center p-4">
                      {room.capacity} camas
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="p-4">Tipo</td>
                  {rooms.map((room) => (
                    <td key={room.id} className="text-center p-4">
                      {room.type}
                      {room.isFlexible && (
                        <Badge className="ml-2 text-xs" variant="secondary">
                          Flexível
                        </Badge>
                      )}
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="p-4">Preço por cama</td>
                  {rooms.map((room) => (
                    <td key={room.id} className="text-center p-4 font-semibold text-primary">
                      R$ {room.basePrice}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4">Disponibilidade</td>
                  {rooms.map((room) => (
                    <td key={room.id} className="text-center p-4">
                      <Badge variant={room.available ? 'default' : 'secondary'}>
                        {room.available ? 'Disponível' : 'Indisponível'}
                      </Badge>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-lapa">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">
              Preços para Grupos
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Quanto maior o grupo, maior o desconto! Economize até 20% em reservas para grupos
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 text-center">
              <div className="text-3xl font-bold text-primary mb-2">10%</div>
              <h3 className="font-semibold mb-2">Grupos Pequenos</h3>
              <p className="text-sm text-muted-foreground">
                7-15 pessoas
              </p>
            </Card>
            
            <Card className="p-6 text-center border-primary">
              <div className="text-3xl font-bold text-primary mb-2">15%</div>
              <h3 className="font-semibold mb-2">Grupos Médios</h3>
              <p className="text-sm text-muted-foreground">
                16-25 pessoas
              </p>
            </Card>
            
            <Card className="p-6 text-center">
              <div className="text-3xl font-bold text-primary mb-2">20%</div>
              <h3 className="font-semibold mb-2">Grupos Grandes</h3>
              <p className="text-sm text-muted-foreground">
                26+ pessoas
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section className="bg-primary text-primary-foreground section-padding">
        <div className="container-lapa text-center">
          <h2 className="text-3xl font-bold mb-4">
            Pronto para Reservar?
          </h2>
          <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
            Escolha seu quarto ideal e garante sua vaga no coração de Santa Teresa
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={`/${locale}/booking`}>
              <Button size="lg" className="bg-white text-primary hover:bg-white/90">
                <Calendar className="w-5 h-5 mr-2" />
                Fazer Reserva
              </Button>
            </Link>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-white text-white hover:bg-white hover:text-primary"
              onClick={() => window.open('https://wa.me/5521999999999', '_blank')}
            >
              Falar no WhatsApp
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
