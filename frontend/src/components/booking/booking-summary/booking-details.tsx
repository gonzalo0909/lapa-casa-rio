// src/components/booking/booking-summary/booking-details.tsx

'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { 
  MapPin, 
  Phone, 
  Mail, 
  Clock, 
  Wifi, 
  Coffee,
  Car,
  Shield,
  Users,
  Bed,
  Calendar,
  Info,
  ExternalLink,
  Navigation,
  Star,
  CheckCircle
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface BookingDetailsProps {
  bookingId: string;
  checkIn: Date;
  checkOut: Date;
  beds: number;
  rooms?: Array<{
    id: string;
    name: string;
    beds: number;
    type: string;
  }>;
  guestInfo?: {
    fullName: string;
    email: string;
    phone: string;
    country: string;
  };
  status: 'pending' | 'confirmed' | 'cancelled';
  totalPrice: number;
  depositPaid: boolean;
  remainingPaid: boolean;
  specialRequests?: string;
  additionalServices?: string[];
  className?: string;
}

export function BookingDetails({
  bookingId,
  checkIn,
  checkOut,
  beds,
  rooms = [],
  guestInfo,
  status,
  totalPrice,
  depositPaid,
  remainingPaid,
  specialRequests,
  additionalServices = [],
  className = ''
}: BookingDetailsProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

  const getStatusBadge = () => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-emerald-100 text-emerald-800">Confirmada</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pendente</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800">Cancelada</Badge>;
      default:
        return <Badge variant="secondary">Status Desconhecido</Badge>;
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <Card className={`${className}`}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Detalhes da Reserva
            </h2>
            <div className="flex items-center space-x-3 mt-1">
              <Badge variant="secondary" className="font-mono text-xs">
                #{bookingId}
              </Badge>
              {getStatusBadge()}
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">
              R$ {totalPrice.toLocaleString('pt-BR')}
            </div>
            <div className="text-sm text-gray-600">
              {beds} {beds === 1 ? 'pessoa' : 'pessoas'} • {nights} {nights === 1 ? 'noite' : 'noites'}
            </div>
          </div>
        </div>

        {/* Informações da Estadia */}
        <div className="space-y-6">
          {/* Datas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start space-x-3">
              <Calendar className="w-5 h-5 text-blue-600 mt-1" />
              <div>
                <div className="font-medium text-gray-900">Check-in</div>
                <div className="text-sm text-gray-600">
                  {formatDate(checkIn, 'full')}
                </div>
                <div className="text-xs text-gray-500">
                  A partir das 15:00
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Calendar className="w-5 h-5 text-purple-600 mt-1" />
              <div>
                <div className="font-medium text-gray-900">Check-out</div>
                <div className="text-sm text-gray-600">
                  {formatDate(checkOut, 'full')}
                </div>
                <div className="text-xs text-gray-500">
                  Até as 11:00
                </div>
              </div>
            </div>
          </div>

          {/* Acomodação */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 flex items-center">
                <Bed className="w-5 h-5 mr-2 text-purple-600" />
                Acomodação
              </h3>
              {rooms.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSection('rooms')}
                >
                  Ver detalhes
                </Button>
              )}
            </div>

            {rooms.length > 0 ? (
              <div className="space-y-2">
                {rooms.map((room) => (
                  <div key={room.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">
                        {room.name}
                      </div>
                      <div className="text-sm text-gray-600">
                        {room.beds} {room.beds === 1 ? 'cama' : 'camas'} • 
                        {room.type === 'mixed' ? ' Misto' : 
                         room.type === 'female' ? ' Feminino' : ' Flexível'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">
                  {beds} {beds === 1 ? 'cama' : 'camas'} - Alocação automática no check-in
                </div>
              </div>
            )}
          </div>

          {/* Informações do Hóspede */}
          {guestInfo && (
            <div>
              <h3 className="font-semibold text-gray-900 flex items-center mb-3">
                <Users className="w-5 h-5 mr-2 text-blue-600" />
                Hóspede Principal
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Nome</div>
                  <div className="font-medium text-gray-900">
                    {guestInfo.fullName}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-600">País</div>
                  <div className="font-medium text-gray-900">
                    {guestInfo.country}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-600">Email</div>
                  <div className="font-medium text-gray-900">
                    {guestInfo.email}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-600">Telefone</div>
                  <div className="font-medium text-gray-900">
                    {guestInfo.phone}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Status de Pagamento */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">
              Status de Pagamento
            </h3>

            <div className="space-y-2">
              <div className={`flex items-center justify-between p-3 rounded-lg ${
                depositPaid ? 'bg-emerald-50 border border-emerald-200' : 'bg-yellow-50 border border-yellow-200'
              }`}>
                <div className="flex items-center">
                  {depositPaid ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600 mr-3" />
                  ) : (
                    <Clock className="w-5 h-5 text-yellow-600 mr-3" />
                  )}
                  <div>
                    <div className={`font-medium ${
                      depositPaid ? 'text-emerald-900' : 'text-yellow-900'
                    }`}>
                      Depósito (30%)
                    </div>
                    <div className={`text-sm ${
                      depositPaid ? 'text-emerald-700' : 'text-yellow-700'
                    }`}>
                      {depositPaid ? 'Pago' : 'Pendente'}
                    </div>
                  </div>
                </div>
                <div className={`font-semibold ${
                  depositPaid ? 'text-emerald-900' : 'text-yellow-900'
                }`}>
                  R$ {(totalPrice * 0.30).toLocaleString('pt-BR')}
                </div>
              </div>

              <div className={`flex items-center justify-between p-3 rounded-lg ${
                remainingPaid ? 'bg-emerald-50 border border-emerald-200' : 'bg-blue-50 border border-blue-200'
              }`}>
                <div className="flex items-center">
                  {remainingPaid ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600 mr-3" />
                  ) : (
                    <Clock className="w-5 h-5 text-blue-600 mr-3" />
                  )}
                  <div>
                    <div className={`font-medium ${
                      remainingPaid ? 'text-emerald-900' : 'text-blue-900'
                    }`}>
                      Saldo (70%)
                    </div>
                    <div className={`text-sm ${
                      remainingPaid ? 'text-emerald-700' : 'text-blue-700'
                    }`}>
                      {remainingPaid ? 'Pago' : 'Cobrança automática 7 dias antes'}
                    </div>
                  </div>
                </div>
                <div className={`font-semibold ${
                  remainingPaid ? 'text-emerald-900' : 'text-blue-900'
                }`}>
                  R$ {(totalPrice * 0.70).toLocaleString('pt-BR')}
                </div>
              </div>
            </div>
          </div>

          {/* Serviços Adicionais */}
          {additionalServices.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">
                Serviços Adicionais
              </h3>
              
              <div className="space-y-2">
                {additionalServices.map((service, index) => (
                  <div key={index} className="flex items-center p-2 bg-gray-50 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-emerald-600 mr-2" />
                    <span className="text-sm text-gray-900">{service}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pedidos Especiais */}
          {specialRequests && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">
                Pedidos Especiais
              </h3>
              
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  {specialRequests}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Informações do Hostel */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-emerald-600" />
            Lapa Casa Hostel
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Localização e Contato */}
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <MapPin className="w-4 h-4 text-gray-600 mt-1" />
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    Endereço
                  </div>
                  <div className="text-sm text-gray-600">
                    Rua Silvio Romero 22<br />
                    Santa Teresa, Rio de Janeiro
                  </div>
                  <Button variant="ghost" size="sm" className="mt-1 p-0 h-auto text-blue-600">
                    <Navigation className="w-3 h-3 mr-1" />
                    Ver no mapa
                  </Button>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Phone className="w-4 h-4 text-gray-600" />
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    Telefone
                  </div>
                  <div className="text-sm text-gray-600">
                    +55 21 2507-0100
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Mail className="w-4 h-4 text-gray-600" />
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    Email
                  </div>
                  <div className="text-sm text-gray-600">
                    reservas@lapacasahostel.com
                  </div>
                </div>
              </div>
            </div>

            {/* Comodidades e Horários */}
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Clock className="w-4 h-4 text-gray-600" />
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    Recepção
                  </div>
                  <div className="text-sm text-gray-600">
                    24 horas
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Coffee className="w-4 h-4 text-gray-600" />
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    Café da manhã
                  </div>
                  <div className="text-sm text-gray-600">
                    7h30 - 10h30 (incluso)
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Wifi className="w-4 h-4 text-gray-600" />
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    WiFi
                  </div>
                  <div className="text-sm text-gray-600">
                    Gratuito em todas as áreas
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Car className="w-4 h-4 text-gray-600" />
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    Estacionamento
                  </div>
                  <div className="text-sm text-gray-600">
                    Disponível mediante consulta
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Políticas e Regras */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleSection('policies')}
            className="w-full justify-between"
          >
            <span className="flex items-center">
              <Shield className="w-4 h-4 mr-2" />
              Políticas e Regras da Casa
            </span>
            {expandedSection === 'policies' ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>

          {expandedSection === 'policies' && (
            <div className="mt-3 space-y-3 text-sm text-gray-600">
              <div>
                <div className="font-medium text-gray-900 mb-1">Check-in/Check-out</div>
                <ul className="space-y-1 ml-4">
                  <li>• Check-in: a partir das 15h00</li>
                  <li>• Check-out: até as 11h00</li>
                  <li>• Documento oficial obrigatório</li>
                  <li>• Check-in antecipado: R$ 30 (sujeito à disponibilidade)</li>
                </ul>
              </div>

              <div>
                <div className="font-medium text-gray-900 mb-1">Cancelamento</div>
                <ul className="space-y-1 ml-4">
                  <li>• Cancelamento gratuito até 48h antes</li>
                  <li>• Cancelamento após 48h: perda do depósito</li>
                  <li>• No-show: cobrança integral</li>
                </ul>
              </div>

              <div>
                <div className="font-medium text-gray-900 mb-1">Regras da Casa</div>
                <ul className="space-y-1 ml-4">
                  <li>• Silêncio após 22h00</li>
                  <li>• Proibido fumar nas áreas internas</li>
                  <li>• Visitantes até 22h00</li>
                  <li>• Uso das áreas comuns até 23h00</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Avaliações */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Star className="w-5 h-5 text-yellow-500 fill-current" />
              <span className="font-semibold text-gray-900">4.7</span>
              <span className="text-sm text-gray-600">(324 avaliações)</span>
            </div>
            
            <Button variant="ghost" size="sm">
              <ExternalLink className="w-4 h-4 mr-1" />
              Ver avaliações
            </Button>
          </div>
        </div>

        {/* Informações de Emergência */}
        <Alert className="mt-6 bg-red-50 border-red-200">
          <Info className="w-4 h-4" />
          <div>
            <h4 className="font-semibold text-red-900 mb-1">
              Em caso de emergência
            </h4>
            <p className="text-sm text-red-800">
              Entre em contato imediatamente com a recepção: +55 21 2507-0100
              <br />
              Ou ligue para o Corpo de Bombeiros: 193 | SAMU: 192 | Polícia: 190
            </p>
          </div>
        </Alert>
      </div>
    </Card>
  );
}
