// src/components/booking/booking-summary/booking-summary.tsx

'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { 
  Calendar, 
  MapPin, 
  Users, 
  Bed, 
  CreditCard, 
  Clock, 
  CheckCircle,
  AlertCircle,
  Edit,
  Printer,
  Download
} from 'lucide-react';
import { useBookingStore } from '@/stores/booking-store';
import { formatCurrency } from '@/lib/utils';
import { calculateGroupDiscount, calculateSeasonMultiplier } from '@/lib/pricing';

interface BookingSummaryProps {
  onEdit?: (step: string) => void;
  onPrint?: () => void;
  onDownload?: () => void;
  showActions?: boolean;
  isConfirmed?: boolean;
}

export function BookingSummary({ 
  onEdit, 
  onPrint, 
  onDownload, 
  showActions = true,
  isConfirmed = false 
}: BookingSummaryProps) {
  const { bookingData } = useBookingStore();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  if (!bookingData.checkIn || !bookingData.checkOut || !bookingData.beds) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Resumo não disponível
          </h3>
          <p className="text-gray-600">
            Complete as informações de reserva para ver o resumo.
          </p>
        </div>
      </Card>
    );
  }

  const checkInDate = new Date(bookingData.checkIn);
  const checkOutDate = new Date(bookingData.checkOut);
  const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
  
  const basePrice = 60; // BRL per bed/night
  const subtotal = basePrice * bookingData.beds * nights;
  const groupDiscount = calculateGroupDiscount(bookingData.beds);
  const seasonMultiplier = calculateSeasonMultiplier(checkInDate);
  
  const discountAmount = subtotal * groupDiscount;
  const seasonAdjustment = subtotal * (seasonMultiplier - 1);
  const finalPrice = subtotal - discountAmount + seasonAdjustment;
  
  const depositAmount = finalPrice * 0.30;
  const remainingAmount = finalPrice - depositAmount;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getRoomName = (roomId: string) => {
    const roomNames = {
      'room_mixto_12a': 'Mixto 12A',
      'room_mixto_12b': 'Mixto 12B', 
      'room_mixto_7': 'Mixto 7',
      'room_flexible_7': 'Flexible 7'
    };
    return roomNames[roomId as keyof typeof roomNames] || roomId;
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className={`p-4 ${isConfirmed ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {isConfirmed ? (
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            ) : (
              <Calendar className="w-6 h-6 text-blue-600" />
            )}
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {isConfirmed ? 'Reserva Confirmada' : 'Resumo da Reserva'}
              </h2>
              <p className="text-gray-600">
                {isConfirmed ? 'Sua reserva foi processada com sucesso' : 'Revise os detalhes antes de continuar'}
              </p>
            </div>
          </div>
          
          {isConfirmed && (
            <div className="flex space-x-2">
              {onPrint && (
                <Button variant="outline" size="sm" onClick={onPrint}>
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimir
                </Button>
              )}
              {onDownload && (
                <Button variant="outline" size="sm" onClick={onDownload}>
                  <Download className="w-4 h-4 mr-2" />
                  PDF
                </Button>
              )}
            </div>
          )}
        </div>
        
        {bookingData.bookingId && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Código da Reserva:</span>
              <Badge variant="secondary" className="font-mono">
                {bookingData.bookingId}
              </Badge>
            </div>
          </div>
        )}
      </Card>

      {/* Detalhes da Estadia */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-blue-600" />
            Detalhes da Estadia
          </h3>
          {showActions && onEdit && (
            <Button variant="ghost" size="sm" onClick={() => onEdit('dates')}>
              <Edit className="w-4 h-4 mr-1" />
              Editar
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <div className="flex items-center text-sm text-gray-600 mb-1">
                <Calendar className="w-4 h-4 mr-2" />
                Check-in
              </div>
              <div className="font-semibold text-gray-900">
                {formatDate(checkInDate)}
              </div>
              <div className="text-sm text-gray-600">
                A partir das 15:00
              </div>
            </div>

            <div>
              <div className="flex items-center text-sm text-gray-600 mb-1">
                <Calendar className="w-4 h-4 mr-2" />
                Check-out
              </div>
              <div className="font-semibold text-gray-900">
                {formatDate(checkOutDate)}
              </div>
              <div className="text-sm text-gray-600">
                Até as 11:00
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center text-sm text-gray-600 mb-1">
                <Clock className="w-4 h-4 mr-2" />
                Duração
              </div>
              <div className="font-semibold text-gray-900">
                {nights} {nights === 1 ? 'noite' : 'noites'}
              </div>
            </div>

            <div>
              <div className="flex items-center text-sm text-gray-600 mb-1">
                <Users className="w-4 h-4 mr-2" />
                Hóspedes
              </div>
              <div className="font-semibold text-gray-900">
                {bookingData.beds} {bookingData.beds === 1 ? 'pessoa' : 'pessoas'}
              </div>
              {groupDiscount > 0 && (
                <Badge className="bg-emerald-100 text-emerald-800 text-xs mt-1">
                  Desconto grupo: {(groupDiscount * 100).toFixed(0)}%
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Localização */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <MapPin className="w-4 h-4 mr-2" />
            Localização
          </div>
          <div className="font-semibold text-gray-900">
            Lapa Casa Hostel
          </div>
          <div className="text-sm text-gray-600">
            Rua Silvio Romero 22, Santa Teresa, Rio de Janeiro
          </div>
        </div>
      </Card>

      {/* Acomodação */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Bed className="w-5 h-5 mr-2 text-purple-600" />
            Acomodação
          </h3>
          {showActions && onEdit && (
            <Button variant="ghost" size="sm" onClick={() => onEdit('rooms')}>
              <Edit className="w-4 h-4 mr-1" />
              Editar
            </Button>
          )}
        </div>

        {bookingData.selectedRooms ? (
          <div className="space-y-3">
            {Object.entries(bookingData.selectedRooms).map(([roomId, beds]) => (
              <div key={roomId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">
                    {getRoomName(roomId)}
                  </div>
                  <div className="text-sm text-gray-600">
                    {beds} {beds === 1 ? 'cama' : 'camas'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">
                    {formatCurrency(basePrice * beds * nights)}
                  </div>
                  <div className="text-xs text-gray-600">
                    R$ {basePrice}/cama/noite
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="font-medium text-gray-900">
              Quartos a serem designados
            </div>
            <div className="text-sm text-gray-600">
              {bookingData.beds} {bookingData.beds === 1 ? 'cama' : 'camas'} - Alocação automática
            </div>
          </div>
        )}
      </Card>

      {/* Informações do Hóspede */}
      {bookingData.guestInfo && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Hóspede Principal
            </h3>
            {showActions && onEdit && (
              <Button variant="ghost" size="sm" onClick={() => onEdit('guest')}>
                <Edit className="w-4 h-4 mr-1" />
                Editar
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600">Nome</div>
              <div className="font-medium text-gray-900">
                {bookingData.guestInfo.fullName}
              </div>
            </div>
            
            <div>
              <div className="text-sm text-gray-600">Email</div>
              <div className="font-medium text-gray-900">
                {bookingData.guestInfo.email}
              </div>
            </div>
            
            <div>
              <div className="text-sm text-gray-600">Telefone</div>
              <div className="font-medium text-gray-900">
                {bookingData.guestInfo.phone}
              </div>
            </div>
            
            <div>
              <div className="text-sm text-gray-600">País</div>
              <div className="font-medium text-gray-900">
                {bookingData.guestInfo.country}
              </div>
            </div>
          </div>

          {bookingData.guestInfo.specialRequests && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={() => toggleSection('requests')}
                className="flex items-center text-sm text-gray-600 hover:text-gray-900"
              >
                Pedidos especiais
                <Badge variant="secondary" className="ml-2 text-xs">
                  Ver detalhes
                </Badge>
              </button>
              
              {expandedSection === 'requests' && (
                <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm text-gray-700">
                  {bookingData.guestInfo.specialRequests}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Resumo Financeiro */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <CreditCard className="w-5 h-5 mr-2 text-green-600" />
            Resumo Financeiro
          </h3>
          {showActions && onEdit && (
            <Button variant="ghost" size="sm" onClick={() => onEdit('payment')}>
              <Edit className="w-4 h-4 mr-1" />
              Editar
            </Button>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">
              Subtotal ({bookingData.beds} camas × {nights} noites)
            </span>
            <span className="text-gray-900">
              {formatCurrency(subtotal)}
            </span>
          </div>

          {groupDiscount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-emerald-600">
                Desconto grupo ({(groupDiscount * 100).toFixed(0)}%)
              </span>
              <span className="text-emerald-600">
                -{formatCurrency(discountAmount)}
              </span>
            </div>
          )}

          {seasonMultiplier !== 1 && (
            <div className="flex justify-between text-sm">
              <span className={seasonMultiplier > 1 ? 'text-orange-600' : 'text-blue-600'}>
                Ajuste temporada ({seasonMultiplier > 1 ? '+' : ''}{((seasonMultiplier - 1) * 100).toFixed(0)}%)
              </span>
              <span className={seasonMultiplier > 1 ? 'text-orange-600' : 'text-blue-600'}>
                {seasonAdjustment > 0 ? '+' : ''}{formatCurrency(seasonAdjustment)}
              </span>
            </div>
          )}

          <div className="border-t border-gray-200 pt-3">
            <div className="flex justify-between font-semibold text-lg">
              <span className="text-gray-900">Total</span>
              <span className="text-gray-900">
                {formatCurrency(finalPrice)}
              </span>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Depósito (30%)</span>
              <span className="font-medium text-gray-900">
                {formatCurrency(depositAmount)}
              </span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">
                Saldo restante (cobrança automática 7 dias antes)
              </span>
              <span className="font-medium text-gray-900">
                {formatCurrency(remainingAmount)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Status de Pagamento */}
      {isConfirmed && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Status de Pagamento
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-emerald-600 mr-3" />
                <div>
                  <div className="font-medium text-emerald-900">
                    Depósito Pago
                  </div>
                  <div className="text-sm text-emerald-700">
                    Processado com sucesso
                  </div>
                </div>
              </div>
              <div className="font-semibold text-emerald-900">
                {formatCurrency(depositAmount)}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center">
                <Clock className="w-5 h-5 text-blue-600 mr-3" />
                <div>
                  <div className="font-medium text-blue-900">
                    Saldo Pendente
                  </div>
                  <div className="text-sm text-blue-700">
                    Cobrança automática em 7 dias antes do check-in
                  </div>
                </div>
              </div>
              <div className="font-semibold text-blue-900">
                {formatCurrency(remainingAmount)}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Informações Importantes */}
      <Alert className="bg-yellow-50 border-yellow-200">
        <AlertCircle className="w-4 h-4" />
        <div>
          <h4 className="font-semibold text-yellow-900 mb-1">
            Informações Importantes
          </h4>
          <ul className="text-sm text-yellow-800 space-y-1">
            <li>• Documento oficial obrigatório no check-in</li>
            <li>• Check-in: 15h00 | Check-out: 11h00</li>
            <li>• Café da manhã incluso (7h30 - 10h30)</li>
            <li>• Cancelamento gratuito até 48h antes</li>
            <li>• WiFi gratuito em todas as áreas</li>
          </ul>
        </div>
      </Alert>

      {/* Próximos Passos */}
      {isConfirmed && (
        <Card className="p-6 bg-emerald-50 border-emerald-200">
          <h3 className="text-lg font-semibold text-emerald-900 mb-4">
            Próximos Passos
          </h3>
          
          <div className="space-y-3 text-sm text-emerald-800">
            <div className="flex items-start">
              <CheckCircle className="w-4 h-4 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
              <span>Email de confirmação enviado para {bookingData.guestInfo?.email}</span>
            </div>
            
            <div className="flex items-start">
              <CheckCircle className="w-4 h-4 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
              <span>SMS/WhatsApp de confirmação enviado</span>
            </div>
            
            <div className="flex items-start">
              <Clock className="w-4 h-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
              <span>Cobrança automática do saldo 7 dias antes do check-in</span>
            </div>
            
            <div className="flex items-start">
              <Clock className="w-4 h-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
              <span>Lembrete com detalhes do check-in 24h antes</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-emerald-200">
            <div className="text-sm text-emerald-800">
              <strong>Contato:</strong> +55 21 2507-0100 | reservas@lapacasahostel.com
            </div>
          </div>
        </Card>
      )}

      {/* Botões de Ação */}
      {showActions && !isConfirmed && (
        <div className="flex justify-between">
          <Button variant="outline" onClick={() => onEdit?.('dates')}>
            Editar Reserva
          </Button>
          
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            Continuar para Pagamento
          </Button>
        </div>
      )}
    </div>
  );
}
