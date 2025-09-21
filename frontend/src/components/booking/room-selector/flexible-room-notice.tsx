// src/components/booking/room-selector/flexible-room-notice.tsx

'use client';

import React from 'react';
import { differenceInHours, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card } from '../../ui/card';
import { Alert, AlertDescription } from '../../ui/alert';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { cn } from '@/lib/utils';

interface RoomSelection {
  roomId: string;
  bedsRequested: number;
}

interface Room {
  id: string;
  name: string;
  capacity: number;
  type: 'mixed' | 'female';
  basePrice: number;
  isFlexible: boolean;
  availableBeds: number;
  amenities: string[];
  images: string[];
  description: string;
}

interface FlexibleRoomNoticeProps {
  selectedRooms: RoomSelection[];
  rooms: Room[];
  dateRange: {
    checkIn: Date | null;
    checkOut: Date | null;
  };
  className?: string;
}

export function FlexibleRoomNotice({
  selectedRooms,
  rooms,
  dateRange,
  className
}: FlexibleRoomNoticeProps) {
  // Filtrar solo las selecciones de habitaciones flexibles
  const flexibleSelections = selectedRooms.filter(selection => {
    const room = rooms.find(r => r.id === selection.roomId);
    return room?.isFlexible;
  });

  if (flexibleSelections.length === 0 || !dateRange.checkIn) {
    return null;
  }

  const checkInDate = dateRange.checkIn;
  const hoursUntilCheckIn = differenceInHours(checkInDate, new Date());
  const conversionThreshold = 48; // 48 horas
  
  const willAutoConvert = hoursUntilCheckIn <= conversionThreshold;
  const timeUntilConversion = Math.max(0, hoursUntilCheckIn - conversionThreshold);

  const getConversionStatus = () => {
    if (willAutoConvert) {
      return {
        status: 'converting',
        title: 'Conversión automática activada',
        description: 'La habitación se convertirá a mixta automáticamente',
        color: 'bg-orange-50 border-orange-200',
        textColor: 'text-orange-800',
        badgeColor: 'bg-orange-100 text-orange-800'
      };
    } else if (timeUntilConversion <= 72) { // Menos de 72 horas para la conversión
      return {
        status: 'pending',
        title: 'Conversión pendiente',
        description: 'La habitación puede convertirse a mixta pronto',
        color: 'bg-yellow-50 border-yellow-200',
        textColor: 'text-yellow-800',
        badgeColor: 'bg-yellow-100 text-yellow-800'
      };
    } else {
      return {
        status: 'stable',
        title: 'Configuración estable',
        description: 'La habitación se mantendrá como femenina',
        color: 'bg-purple-50 border-purple-200',
        textColor: 'text-purple-800',
        badgeColor: 'bg-purple-100 text-purple-800'
      };
    }
  };

  const statusInfo = getConversionStatus();

  const formatTimeUntilConversion = (hours: number) => {
    if (hours <= 0) return 'Inmediatamente';
    if (hours < 24) return `En ${Math.round(hours)} horas`;
    const days = Math.floor(hours / 24);
    const remainingHours = Math.round(hours % 24);
    
    if (remainingHours === 0) {
      return `En ${days} ${days === 1 ? 'día' : 'días'}`;
    }
    return `En ${days}d ${remainingHours}h`;
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Main Alert */}
      <Alert className={statusInfo.color}>
        <AlertDescription className={statusInfo.textColor}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <Badge className={statusInfo.badgeColor}>
                  Habitación Flexible
                </Badge>
                <span className="font-semibold">{statusInfo.title}</span>
              </div>
              
              <p className="mb-3">{statusInfo.description}</p>
              
              <div className="space-y-2 text-sm">
                <div>
                  <strong>Check-in:</strong> {format(checkInDate, 'dd MMM yyyy', { locale: es })}
                </div>
                
                {!willAutoConvert && (
                  <div>
                    <strong>Conversión automática:</strong> {formatTimeUntilConversion(timeUntilConversion)}
                  </div>
                )}
                
                <div>
                  <strong>Camas seleccionadas:</strong> {flexibleSelections.reduce((sum, s) => sum + s.bedsRequested, 0)}
                </div>
              </div>
            </div>
            
            <div className="text-3xl">
              {statusInfo.status === 'converting' ? '🔄' : statusInfo.status === 'pending' ? '⏰' : '🏠'}
            </div>
          </div>
        </AlertDescription>
      </Alert>

      {/* Detailed Information Card */}
      <Card className="p-4">
        <h4 className="font-semibold mb-3">¿Cómo funciona la habitación flexible?</h4>
        
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="font-medium text-purple-600 mb-2">Configuración por defecto</div>
              <ul className="space-y-1 text-gray-600">
                <li>• Habitación femenina exclusiva</li>
                <li>• 7 camas individuales</li>
                <li>• Baño compartido del piso</li>
                <li>• Ambiente más tranquilo</li>
              </ul>
            </div>
            
            <div>
              <div className="font-medium text-blue-600 mb-2">Si se convierte a mixta</div>
              <ul className="space-y-1 text-gray-600">
                <li>• Hombres y mujeres bienvenidos</li>
                <li>• Mismas comodidades</li>
                <li>• Mismo precio</li>
                <li>• Notificación por email</li>
              </ul>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-200">
            <div className="font-medium mb-2">Condiciones para la conversión automática:</div>
            <div className="bg-gray-50 p-3 rounded text-xs space-y-1">
              <div>✓ Faltan 48 horas o menos para el check-in</div>
              <div>✓ No hay reservas confirmadas de mujeres en la habitación</div>
              <div>✓ Hay demanda para camas mixtas disponibles</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Status-specific additional info */}
      {statusInfo.status === 'converting' && (
        <Card className="p-4 bg-orange-50 border-orange-200">
          <div className="text-orange-800">
            <div className="font-semibold mb-2">Conversión en proceso</div>
            <div className="text-sm space-y-1">
              <p>La habitación flexible se está convirtiendo a mixta porque:</p>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li>Tu check-in es en menos de 48 horas</li>
                <li>No hay otras reservas femeninas confirmadas</li>
                <li>Tu reserva será procesada como habitación mixta</li>
              </ul>
              <p className="mt-2 font-medium">
                No hay cambios en precio ni comodidades. Solo en la política de género.
              </p>
            </div>
          </div>
        </Card>
      )}

      {statusInfo.status === 'pending' && (
        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <div className="text-yellow-800">
            <div className="font-semibold mb-2">Posible conversión próxima</div>
            <div className="text-sm">
              <p>
                Tu habitación puede convertirse a mixta {formatTimeUntilConversion(timeUntilConversion).toLowerCase()}.
                Te notificaremos por email si esto ocurre.
              </p>
              <p className="mt-2">
                <strong>¿Prefieres una habitación mixta garantizada?</strong> Puedes cambiar tu selección ahora.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Contact info for questions */}
      <Card className="p-3 bg-gray-50">
        <div className="text-sm">
          <div className="font-medium mb-1">¿Tienes preguntas sobre la habitación flexible?</div>
          <div className="flex items-center space-x-4 text-gray-600">
            <Button variant="link" className="p-0 h-auto text-xs">
              WhatsApp: +55 21 XXXX-XXXX
            </Button>
            <Button variant="link" className="p-0 h-auto text-xs">
              reservas@lapacasahostel.com
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
