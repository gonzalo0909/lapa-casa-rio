// lapa-casa-hostel/frontend/src/components/booking/room-card.tsx

"use client";

import React, { useState, useCallback } from 'react';
import { RoomDetails } from './room-details';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import type { DateRange, RoomAvailability } from '@/types/global';

/**
 * RoomCard Component
 * 
 * Individual room card with selection controls
 * Shows room info, availability, and bed counter
 * 
 * @component
 */
interface RoomCardProps {
  room: RoomAvailability;
  dateRange: DateRange;
  selectedBeds: number;
  onSelectBeds: (beds: number) => void;
  locale?: 'pt' | 'es' | 'en';
  className?: string;
}

export const RoomCard: React.FC<RoomCardProps> = ({
  room,
  dateRange,
  selectedBeds,
  onSelectBeds,
  locale = 'pt',
  className = ''
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const isAvailable = room.availableBeds > 0;
  const isFullyBooked = room.availableBeds === 0;

  const handleIncrement = useCallback(() => {
    if (selectedBeds < room.availableBeds) {
      onSelectBeds(selectedBeds + 1);
    }
  }, [selectedBeds, room.availableBeds, onSelectBeds]);

  const handleDecrement = useCallback(() => {
    if (selectedBeds > 0) {
      onSelectBeds(selectedBeds - 1);
    }
  }, [selectedBeds, onSelectBeds]);

  const handleQuickSelect = useCallback((beds: number) => {
    if (beds <= room.availableBeds) {
      onSelectBeds(beds);
    }
  }, [room.availableBeds, onSelectBeds]);

  const getRoomIcon = (type: string, isFlexible: boolean) => {
    if (isFlexible) return '🔄';
    if (type === 'female') return '👩';
    if (type === 'male') return '👨';
    return '👥';
  };

  const getRoomTypeLabel = (type: string, isFlexible: boolean) => {
    if (isFlexible) return T('flexible', locale);
    if (type === 'female') return T('female', locale);
    if (type === 'male') return T('male', locale);
    return T('mixed', locale);
  };

  return (
    <>
      <Card
        className={`room-card p-6 ${!isAvailable ? 'opacity-60' : ''} ${
          selectedBeds > 0 ? 'ring-2 ring-blue-500' : ''
        } ${className}`}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{getRoomIcon(room.type, room.isFlexible)}</span>
              <h3 className="text-lg font-bold text-gray-900">{room.name}</h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={room.isFlexible ? 'warning' : 'default'}>
                {getRoomTypeLabel(room.type, room.isFlexible)}
              </Badge>
              <Badge variant="outline">
                {room.capacity} {room.capacity === 1 ? T('bed', locale) : T('beds', locale)}
              </Badge>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails(true)}
            aria-label={T('viewDetails', locale)}
          >
            ℹ️
          </Button>
        </div>

        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">{T('available', locale)}:</span>
            <span className={`font-semibold ${isFullyBooked ? 'text-red-600' : 'text-green-600'}`}>
              {room.availableBeds}/{room.capacity} {T('beds', locale)}
            </span>
          </div>
          {room.availableBeds > 0 && room.availableBeds <= 3 && (
            <p className="text-xs text-orange-600 mt-1">⚠️ {T('fewBedsLeft', locale)}</p>
          )}
        </div>

        {isAvailable ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-700">{T('selectBeds', locale)}:</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDecrement}
                  disabled={selectedBeds === 0}
                  className="w-8 h-8 flex items-center justify-center rounded-full border-2 border-gray-300 hover:border-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label={T('decrease', locale)}
                >
                  −
                </button>
                <span className="text-xl font-bold text-gray-900 w-8 text-center">
                  {selectedBeds}
                </span>
                <button
                  onClick={handleIncrement}
                  disabled={selectedBeds >= room.availableBeds}
                  className="w-8 h-8 flex items-center justify-center rounded-full border-2 border-gray-300 hover:border-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label={T('increase', locale)}
                >
                  +
                </button>
              </div>
            </div>

            {room.availableBeds >= 3 && (
              <div className="flex gap-2">
                {[3, 5, room.availableBeds].filter((v, i, a) => a.indexOf(v) === i && v <= room.availableBeds).map(beds => (
                  <button
                    key={beds}
                    onClick={() => handleQuickSelect(beds)}
                    className={`flex-1 px-3 py-1 text-sm rounded border transition-colors ${
                      selectedBeds === beds
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
                    }`}
                  >
                    {beds === room.availableBeds ? T('all', locale) : beds}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-red-600 font-semibold">{T('fullyBooked', locale)}</p>
            <p className="text-sm text-gray-600 mt-1">{T('tryOtherDates', locale)}</p>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{T('pricePerNight', locale)}:</span>
            <span className="font-bold text-gray-900">
              R$ {room.basePrice.toFixed(2)}/{T('bed', locale)}
            </span>
          </div>
        </div>
      </Card>

      <Modal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        title={room.name}
      >
        <RoomDetails room={room} dateRange={dateRange} locale={locale} />
      </Modal>
    </>
  );
};

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      bed: 'cama',
      beds: 'camas',
      mixed: 'Misto',
      female: 'Feminino',
      male: 'Masculino',
      flexible: 'Flexível',
      available: 'Disponível',
      fewBedsLeft: 'Poucas camas restantes',
      selectBeds: 'Selecionar camas',
      decrease: 'Diminuir',
      increase: 'Aumentar',
      all: 'Todas',
      fullyBooked: 'Esgotado',
      tryOtherDates: 'Tente outras datas',
      pricePerNight: 'Preço por noite',
      viewDetails: 'Ver detalhes'
    },
    es: {
      bed: 'cama',
      beds: 'camas',
      mixed: 'Mixto',
      female: 'Femenino',
      male: 'Masculino',
      flexible: 'Flexible',
      available: 'Disponible',
      fewBedsLeft: 'Pocas camas restantes',
      selectBeds: 'Seleccionar camas',
      decrease: 'Disminuir',
      increase: 'Aumentar',
      all: 'Todas',
      fullyBooked: 'Agotado',
      tryOtherDates: 'Prueba otras fechas',
      pricePerNight: 'Precio por noche',
      viewDetails: 'Ver detalles'
    },
    en: {
      bed: 'bed',
      beds: 'beds',
      mixed: 'Mixed',
      female: 'Female',
      male: 'Male',
      flexible: 'Flexible',
      available: 'Available',
      fewBedsLeft: 'Few beds left',
      selectBeds: 'Select beds',
      decrease: 'Decrease',
      increase: 'Increase',
      all: 'All',
      fullyBooked: 'Fully Booked',
      tryOtherDates: 'Try other dates',
      pricePerNight: 'Price per night',
      viewDetails: 'View details'
    }
  };
  return t[locale]?.[key] || key;
}
