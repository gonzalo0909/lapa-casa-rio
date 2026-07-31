// lapa-casa-hostel/frontend/src/components/booking/room-selector.tsx

"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { RoomCard } from './room-card';
import { AvailabilityIndicator } from './availability-indicator';
import { FlexibleRoomNotice } from './flexible-room-notice';
import { Alert } from '@/components/ui/alert';
import type { DateRange, Room, RoomAvailability } from '@/types/global';

/**
 * RoomSelector Component
 * 
 * Displays available rooms and handles room/bed selection
 * Shows availability, pricing, and flexible room logic
 * 
 * @component
 */
interface RoomSelectorProps {
  dateRange: DateRange;
  availableRooms: RoomAvailability[];
  selectedRooms: Room[] | null;
  onChange: (rooms: Room[]) => void;
  locale?: 'pt' | 'es' | 'en';
  error?: string;
  className?: string;
}

export const RoomSelector: React.FC<RoomSelectorProps> = ({
  dateRange,
  availableRooms,
  selectedRooms,
  onChange,
  locale = 'pt',
  error,
  className = ''
}) => {
  const [localSelections, setLocalSelections] = useState<Map<string, number>>(
    new Map(selectedRooms?.map(r => [r.id, r.bedsCount]) || [])
  );

  const totalSelectedBeds = useMemo(() => {
    return Array.from(localSelections.values()).reduce((sum, beds) => sum + beds, 0);
  }, [localSelections]);

  const hasGroupDiscount = totalSelectedBeds >= 7;

  const handleRoomSelection = useCallback(
    (roomId: string, bedsCount: number) => {
      const newSelections = new Map(localSelections);

      if (bedsCount === 0) {
        newSelections.delete(roomId);
      } else {
        newSelections.set(roomId, bedsCount);
      }

      setLocalSelections(newSelections);

      const rooms: Room[] = Array.from(newSelections.entries()).map(([id, beds]) => {
        const roomData = availableRooms.find(r => r.id === id);
        return {
          id,
          name: roomData?.name || '',
          type: roomData?.type || 'mixed',
          bedsCount: beds,
          capacity: roomData?.capacity || 0,
          basePrice: roomData?.basePrice || 60,
          isFlexible: roomData?.isFlexible || false
        };
      });

      onChange(rooms);
    },
    [localSelections, availableRooms, onChange]
  );

  const flexibleRoom = availableRooms.find(r => r.isFlexible);
  const hoursUntilCheckIn = dateRange.checkIn
    ? Math.floor((dateRange.checkIn.getTime() - Date.now()) / (1000 * 60 * 60))
    : 0;
  const showFlexibleNotice = flexibleRoom && hoursUntilCheckIn <= 48 && hoursUntilCheckIn > 0;

  const sortedRooms = useMemo(() => {
    return [...availableRooms].sort((a, b) => {
      if (a.availableBeds === 0 && b.availableBeds > 0) return 1;
      if (a.availableBeds > 0 && b.availableBeds === 0) return -1;
      return b.capacity - a.capacity;
    });
  }, [availableRooms]);

  return (
    <div className={`room-selector ${className}`}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{T('title', locale)}</h2>
        <p className="text-gray-600">{T('subtitle', locale)}</p>
      </div>

      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      {showFlexibleNotice && flexibleRoom && (
        <FlexibleRoomNotice
          roomName={flexibleRoom.name}
          hoursRemaining={hoursUntilCheckIn}
          locale={locale}
          className="mb-6"
        />
      )}

      <div className="mb-6">
        <AvailabilityIndicator
          totalBeds={availableRooms.reduce((sum, r) => sum + r.capacity, 0)}
          availableBeds={availableRooms.reduce((sum, r) => sum + r.availableBeds, 0)}
          selectedBeds={totalSelectedBeds}
          locale={locale}
        />
      </div>

      {hasGroupDiscount && (
        <Alert variant="info" className="mb-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="font-semibold">{T('groupDiscountTitle', locale)}</p>
              <p className="text-sm">
                {T('groupDiscountDesc', locale).replace(
                  '{discount}',
                  getGroupDiscountPercent(totalSelectedBeds).toString()
                )}
              </p>
            </div>
          </div>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sortedRooms.map(room => (
          <RoomCard
            key={room.id}
            room={room}
            dateRange={dateRange}
            selectedBeds={localSelections.get(room.id) || 0}
            onSelectBeds={(beds) => handleRoomSelection(room.id, beds)}
            locale={locale}
          />
        ))}
      </div>

      {sortedRooms.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">😔</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {T('noAvailability', locale)}
          </h3>
          <p className="text-gray-600">{T('tryOtherDates', locale)}</p>
        </div>
      )}

      {totalSelectedBeds > 0 && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">
                {T('totalSelected', locale)}: {totalSelectedBeds}{' '}
                {totalSelectedBeds === 1 ? T('bed', locale) : T('beds', locale)}
              </p>
              {hasGroupDiscount && (
                <p className="text-sm text-green-700 font-medium mt-1">
                  ✓ {T('discountApplied', locale)}: {getGroupDiscountPercent(totalSelectedBeds)}%
                </p>
              )}
            </div>
            <button
              onClick={() => {
                setLocalSelections(new Map());
                onChange([]);
              }}
              className="text-sm text-red-600 hover:text-red-800 font-medium"
            >
              {T('clearSelection', locale)}
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-gray-900 mb-2">{T('importantInfo', locale)}</h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li>• {T('pricePerBed', locale)}</li>
          <li>• {T('groupDiscount7', locale)}</li>
          <li>• {T('groupDiscount16', locale)}</li>
          <li>• {T('groupDiscount26', locale)}</li>
        </ul>
      </div>
    </div>
  );
};

function getGroupDiscountPercent(totalBeds: number): number {
  if (totalBeds >= 26) return 20;
  if (totalBeds >= 16) return 15;
  if (totalBeds >= 7) return 10;
  return 0;
}

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      title: 'Escolha seus Quartos',
      subtitle: 'Selecione os quartos e quantidade de camas',
      totalSelected: 'Total selecionado',
      bed: 'cama',
      beds: 'camas',
      clearSelection: 'Limpar seleção',
      groupDiscountTitle: 'Desconto para Grupos Ativo!',
      groupDiscountDesc: 'Você está recebendo {discount}% de desconto',
      discountApplied: 'Desconto aplicado',
      noAvailability: 'Sem Disponibilidade',
      tryOtherDates: 'Tente outras datas',
      importantInfo: 'Informações Importantes',
      pricePerBed: 'Preço base: R$ 60 por cama/noite',
      groupDiscount7: '7-15 camas: 10% desconto',
      groupDiscount16: '16-25 camas: 15% desconto',
      groupDiscount26: '26+ camas: 20% desconto'
    },
    es: {
      title: 'Elige tus Habitaciones',
      subtitle: 'Selecciona las habitaciones y cantidad de camas',
      totalSelected: 'Total seleccionado',
      bed: 'cama',
      beds: 'camas',
      clearSelection: 'Limpiar selección',
      groupDiscountTitle: '¡Descuento para Grupos Activo!',
      groupDiscountDesc: 'Estás recibiendo {discount}% de descuento',
      discountApplied: 'Descuento aplicado',
      noAvailability: 'Sin Disponibilidad',
      tryOtherDates: 'Prueba otras fechas',
      importantInfo: 'Información Importante',
      pricePerBed: 'Precio base: R$ 60 por cama/noche',
      groupDiscount7: '7-15 camas: 10% descuento',
      groupDiscount16: '16-25 camas: 15% descuento',
      groupDiscount26: '26+ camas: 20% descuento'
    },
    en: {
      title: 'Choose your Rooms',
      subtitle: 'Select rooms and number of beds',
      totalSelected: 'Total selected',
      bed: 'bed',
      beds: 'beds',
      clearSelection: 'Clear selection',
      groupDiscountTitle: 'Group Discount Active!',
      groupDiscountDesc: 'You are getting {discount}% discount',
      discountApplied: 'Discount applied',
      noAvailability: 'No Availability',
      tryOtherDates: 'Try other dates',
      importantInfo: 'Important Information',
      pricePerBed: 'Base price: R$ 60 per bed/night',
      groupDiscount7: '7-15 beds: 10% discount',
      groupDiscount16: '16-25 beds: 15% discount',
      groupDiscount26: '26+ beds: 20% discount'
    }
  };
  return t[locale]?.[key] || key;
}
