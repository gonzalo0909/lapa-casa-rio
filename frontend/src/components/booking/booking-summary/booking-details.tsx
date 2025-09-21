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
                    <div className
