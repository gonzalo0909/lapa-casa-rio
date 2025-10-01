// lapa-casa-hostel/frontend/src/components/booking/flexible-room-notice.tsx

"use client";

import React from 'react';
import { Alert } from '@/components/ui/alert';

/**
 * FlexibleRoomNotice Component
 * 
 * Alert for flexible room auto-conversion logic
 * Shows countdown and conversion information
 * 
 * @component
 */
interface FlexibleRoomNoticeProps {
  roomName: string;
  hoursRemaining: number;
  locale?: 'pt' | 'es' | 'en';
  className?: string;
}

export const FlexibleRoomNotice: React.FC<FlexibleRoomNoticeProps> = ({
  roomName,
  hoursRemaining,
  locale = 'pt',
  className = ''
}) => {
  const isConversionImminent = hoursRemaining <= 24;
  const daysRemaining = Math.floor(hoursRemaining / 24);
  const hoursOnly = hoursRemaining % 24;

  const getTimeDisplay = () => {
    if (daysRemaining > 0) {
      return `${daysRemaining} ${daysRemaining === 1 ? T('day', locale) : T('days', locale)} ${
        hoursOnly > 0
          ? `${T('and', locale)} ${hoursOnly} ${hoursOnly === 1 ? T('hour', locale) : T('hours', locale)}`
          : ''
      }`;
    }
    return `${hoursRemaining} ${hoursRemaining === 1 ? T('hour', locale) : T('hours', locale)}`;
  };

  return (
    <Alert
      variant={isConversionImminent ? 'warning' : 'info'}
      className={`flexible-room-notice ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">
          {isConversionImminent ? '⚠️' : 'ℹ️'}
        </span>
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 mb-2">
            {isConversionImminent ? T('urgentTitle', locale) : T('infoTitle', locale)}
          </h4>
          <p className="text-sm text-gray-700 mb-3">
            {T('roomName', locale)}: <strong>{roomName}</strong>
          </p>
          <p className="text-sm text-gray-700 mb-3">
            {T('description', locale)}
          </p>
          <div className="p-3 bg-white rounded border border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{T('timeRemaining', locale)}:</span>
              <span className="font-bold text-gray-900">{getTimeDisplay()}</span>
            </div>
            {isConversionImminent && (
              <p className="text-xs text-orange-600 mt-2">
                🔔 {T('conversionSoon', locale)}
              </p>
            )}
          </div>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <p>✓ {T('benefit1', locale)}</p>
            <p>✓ {T('benefit2', locale)}</p>
            <p>✓ {T('benefit3', locale)}</p>
          </div>
        </div>
      </div>
    </Alert>
  );
};

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      urgentTitle: 'Quarto Flexível - Conversão em Breve',
      infoTitle: 'Quarto Flexível Disponível',
      roomName: 'Quarto',
      description: 'Este quarto é feminino por padrão, mas será automaticamente convertido para misto se não houver reservas femininas 48 horas antes do check-in.',
      timeRemaining: 'Tempo até conversão',
      conversionSoon: 'Conversão iminente! Reserve logo se preferir quarto feminino',
      day: 'dia',
      days: 'dias',
      hour: 'hora',
      hours: 'horas',
      and: 'e',
      benefit1: 'Garanta sua preferência reservando agora',
      benefit2: 'Mesmo preço para todos os tipos de quarto',
      benefit3: 'Conversão automática maximiza ocupação'
    },
    es: {
      urgentTitle: 'Habitación Flexible - Conversión Próxima',
      infoTitle: 'Habitación Flexible Disponible',
      roomName: 'Habitación',
      description: 'Esta habitación es femenina por defecto, pero se convertirá automáticamente en mixta si no hay reservas femeninas 48 horas antes del check-in.',
      timeRemaining: 'Tiempo hasta conversión',
      conversionSoon: '¡Conversión inminente! Reserva pronto si prefieres habitación femenina',
      day: 'día',
      days: 'días',
      hour: 'hora',
      hours: 'horas',
      and: 'y',
      benefit1: 'Garantiza tu preferencia reservando ahora',
      benefit2: 'Mismo precio para todos los tipos de habitación',
      benefit3: 'Conversión automática maximiza ocupación'
    },
    en: {
      urgentTitle: 'Flexible Room - Conversion Soon',
      infoTitle: 'Flexible Room Available',
      roomName: 'Room',
      description: 'This room is female by default, but will be automatically converted to mixed if there are no female bookings 48 hours before check-in.',
      timeRemaining: 'Time until conversion',
      conversionSoon: 'Conversion imminent! Book soon if you prefer female room',
      day: 'day',
      days: 'days',
      hour: 'hour',
      hours: 'hours',
      and: 'and',
      benefit1: 'Guarantee your preference by booking now',
      benefit2: 'Same price for all room types',
      benefit3: 'Automatic conversion maximizes occupancy'
    }
  };
  return t[locale]?.[key] || key;
}
