// lapa-casa-hostel/frontend/src/components/booking/room-selector.tsx

"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { RoomCard } from './room-card';
import { AvailabilityIndicator } from './availability-indicator';
import { FlexibleRoomNotice } from './flexible-room-notice';
import { Alert } from '@/components/ui/alert';
import type { BookingGender, DateRange, Room, RoomAvailability } from '@/types/global';

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
  gender: BookingGender;
  availableRooms: RoomAvailability[];
  selectedRooms: Room[] | null;
  onChange: (rooms: Room[]) => void;
  locale?: 'pt' | 'es' | 'en';
  error?: string;
  className?: string;
}

export const RoomSelector: React.FC<RoomSelectorProps> = ({
  dateRange,
  gender,
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

  // Cuartos mixtos son elegibles para cualquiera; el cuarto solo-mujeres
  // (isFlexible) solo aparece si el huesped eligio "solo mujeres" en el
  // primer paso (ver GenderSelector).
  const visibleRooms = useMemo(() => {
    return availableRooms.filter((r) => gender === 'female' || !r.isFlexible);
  }, [availableRooms, gender]);

  // El cuarto de 12 siempre es mas barato por cama que el de 7 (regla de
  // negocio manual, ver room_types.base_price) -- ordenar por precio
  // ascendente muestra esa opcion primero, como pidio el dueno.
  const sortedRooms = useMemo(() => {
    return [...visibleRooms].sort((a, b) => {
      if (a.availableBeds === 0 && b.availableBeds > 0) {return 1;}
      if (a.availableBeds > 0 && b.availableBeds === 0) {return -1;}
      return a.basePrice - b.basePrice;
    });
  }, [visibleRooms]);

  // Descuento por grupo: es por cuarto (group_discount_min_beds/percentage
  // de room_types, editable desde el admin), no un tramo global fijo --
  // ver cada cuarto seleccionado contra su propio umbral.
  const roomsWithDiscount = useMemo(() => {
    return Array.from(localSelections.entries())
      .map(([id, beds]) => {
        const room = availableRooms.find((r) => r.id === id);
        if (!room || beds < room.groupDiscountMinBeds) {return null;}
        return { name: room.name, percentage: room.groupDiscountPercentage };
      })
      .filter((r): r is { name: string; percentage: number } => r !== null);
  }, [localSelections, availableRooms]);
  const hasGroupDiscount = roomsWithDiscount.length > 0;

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

  const flexibleRoom = visibleRooms.find(r => r.isFlexible);
  const hoursUntilCheckIn = dateRange.checkIn
    ? Math.floor((dateRange.checkIn.getTime() - Date.now()) / (1000 * 60 * 60))
    : 0;
  const showFlexibleNotice = flexibleRoom && hoursUntilCheckIn <= 48 && hoursUntilCheckIn > 0;

  return (
    <div className={`room-selector ${className}`}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{T('title', locale)}</h2>
        <p className="text-gray-600">{T('subtitle', locale)}</p>
      </div>

      {error && (
        <Alert variant="danger" className="mb-4">
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
          totalBeds={visibleRooms.reduce((sum, r) => sum + r.capacity, 0)}
          availableBeds={visibleRooms.reduce((sum, r) => sum + r.availableBeds, 0)}
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
              {roomsWithDiscount.map((r) => (
                <p key={r.name} className="text-sm">
                  {r.name}: {Math.round(r.percentage * 100)}% {T('off', locale)}
                </p>
              ))}
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
                  ✓ {T('discountApplied', locale)}
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
          {sortedRooms.map((room) => (
            <li key={room.id}>
              • {room.name}: R$ {room.basePrice.toFixed(0)}/{T('bed', locale)} — {T('discountFrom', locale)}{' '}
              {room.groupDiscountMinBeds} {T('beds', locale)} ({Math.round(room.groupDiscountPercentage * 100)}%)
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      title: 'Escolha seus Quartos',
      subtitle: 'Selecione os quartos e quantidade de camas',
      totalSelected: 'Total selecionado',
      bed: 'cama',
      beds: 'camas',
      off: 'de desconto',
      clearSelection: 'Limpar seleção',
      groupDiscountTitle: 'Desconto para Grupos Ativo!',
      discountApplied: 'Desconto aplicado',
      discountFrom: 'desconto a partir de',
      noAvailability: 'Sem Disponibilidade',
      tryOtherDates: 'Tente outras datas',
      importantInfo: 'Informações Importantes'
    },
    es: {
      title: 'Elige tus Habitaciones',
      subtitle: 'Selecciona las habitaciones y cantidad de camas',
      totalSelected: 'Total seleccionado',
      bed: 'cama',
      beds: 'camas',
      off: 'de descuento',
      clearSelection: 'Limpiar selección',
      groupDiscountTitle: '¡Descuento para Grupos Activo!',
      discountApplied: 'Descuento aplicado',
      discountFrom: 'descuento desde',
      noAvailability: 'Sin Disponibilidad',
      tryOtherDates: 'Prueba otras fechas',
      importantInfo: 'Información Importante'
    },
    en: {
      title: 'Choose your Rooms',
      subtitle: 'Select rooms and number of beds',
      totalSelected: 'Total selected',
      bed: 'bed',
      beds: 'beds',
      off: 'off',
      clearSelection: 'Clear selection',
      groupDiscountTitle: 'Group Discount Active!',
      discountApplied: 'Discount applied',
      discountFrom: 'discount from',
      noAvailability: 'No Availability',
      tryOtherDates: 'Try other dates',
      importantInfo: 'Important Information'
    }
  };
  return t[locale]?.[key] || key;
}
