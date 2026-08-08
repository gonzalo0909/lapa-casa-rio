// lapa-casa-hostel/frontend/src/components/booking/room-selector.tsx

"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { RoomCard } from './room-card';
import { AvailabilityIndicator } from './availability-indicator';
import { FlexibleRoomNotice } from './flexible-room-notice';
import { Alert } from '@/components/ui/alert';
import type { BookingGender, DateRange, GroupDiscountTier, Room, RoomAvailability } from '@/types/global';

/**
 * RoomSelector Component
 *
 * El huésped elige UNA sola "familia" de cuarto -- no se pueden combinar
 * dos familias en la misma reserva (pedido explícito del dueño). Grupo
 * mixto ve 2 familias (12 y 7 camas); solo-mujeres ve esas 2 más la
 * familia de mujeres (Flexible 7). Cada familia puede tener 2 cuartos
 * reales atrás (ej. Mixto 12A + 12B) para grupos que superan la
 * capacidad de un solo cuarto -- la asignación entre esos cuartos
 * reales es automática, invisible para el huésped.
 *
 * @component
 */
interface RoomSelectorProps {
  dateRange: DateRange;
  gender: BookingGender;
  availableRooms: RoomAvailability[];
  groupDiscountTiers: GroupDiscountTier[];
  selectedRooms: Room[] | null;
  onChange: (rooms: Room[]) => void;
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
  error?: string;
  className?: string;
}

interface Family {
  key: string;
  labelKey: string;
  members: RoomAvailability[];
}

function buildFamilies(rooms: RoomAvailability[], gender: BookingGender): Family[] {
  const byName = (a: RoomAvailability, b: RoomAvailability) => a.name.localeCompare(b.name);
  const twelve = rooms.filter((r) => r.capacity === 12).sort(byName);
  const seven = rooms.filter((r) => r.capacity === 7 && !r.isFlexible).sort(byName);
  const female = rooms.filter((r) => r.isFlexible);

  const families: Family[] = [];
  if (twelve.length > 0) {
    families.push({ key: 'twelve', labelKey: 'familyTwelve', members: twelve });
  }
  if (seven.length > 0) {
    families.push({ key: 'seven', labelKey: 'familySeven', members: seven });
  }
  if (gender === 'female' && female.length > 0) {
    families.push({ key: 'female', labelKey: 'familyFemale', members: female });
  }
  return families;
}

function familyToCard(family: Family, locale: string): RoomAvailability {
  const totalCapacity = family.members.reduce((s, m) => s + m.capacity, 0);
  const totalAvailable = family.members.reduce((s, m) => s + m.availableBeds, 0);
  const primary = family.members[0]!;
  return {
    id: family.key,
    code: family.key,
    name: T(family.labelKey, locale),
    type: family.key === 'female' ? 'female' : 'mixed',
    capacity: totalCapacity,
    availableBeds: totalAvailable,
    basePrice: primary.basePrice,
    isFlexible: family.key === 'female',
  };
}

/** Reparte `desiredBeds` entre los cuartos reales de la familia, en orden de preferencia (ej. llena 12A antes de usar 12B). */
function allocateFamily(family: Family, desiredBeds: number): Room[] {
  let remaining = desiredBeds;
  const result: Room[] = [];
  for (const member of family.members) {
    if (remaining <= 0) {
      break;
    }
    const take = Math.min(remaining, member.availableBeds);
    if (take > 0) {
      result.push({
        id: member.id,
        name: member.name,
        type: member.type,
        bedsCount: take,
        capacity: member.capacity,
        basePrice: member.basePrice,
        isFlexible: member.isFlexible,
      });
      remaining -= take;
    }
  }
  return result;
}

function groupDiscountFor(beds: number, tiers: GroupDiscountTier[]): number {
  const applicable = tiers.filter((t) => beds >= t.minBeds).sort((a, b) => b.minBeds - a.minBeds);
  return applicable[0]?.percentage ?? 0;
}

export const RoomSelector: React.FC<RoomSelectorProps> = ({
  dateRange,
  gender,
  availableRooms,
  groupDiscountTiers,
  selectedRooms,
  onChange,
  locale = 'pt',
  error,
  className = ''
}) => {
  const families = useMemo(() => buildFamilies(availableRooms, gender), [availableRooms, gender]);

  const initialFamily = useMemo(() => {
    if (!selectedRooms || selectedRooms.length === 0) {
      return null;
    }
    const selectedIds = new Set(selectedRooms.map((r) => r.id));
    return families.find((f) => f.members.some((m) => selectedIds.has(m.id)))?.key ?? null;
  }, [selectedRooms, families]);

  const [selectedFamilyKey, setSelectedFamilyKey] = useState<string | null>(initialFamily);
  const [bedsCount, setBedsCount] = useState<number>(
    selectedRooms?.reduce((sum, r) => sum + r.bedsCount, 0) ?? 0
  );

  const totalSelectedBeds = selectedFamilyKey ? bedsCount : 0;
  const groupDiscount = groupDiscountFor(totalSelectedBeds, groupDiscountTiers);
  const hasGroupDiscount = groupDiscount > 0;

  const handleFamilySelection = useCallback(
    (familyKey: string, beds: number) => {
      setSelectedFamilyKey(beds > 0 ? familyKey : null);
      setBedsCount(beds);

      const family = families.find((f) => f.key === familyKey);
      const rooms = beds > 0 && family ? allocateFamily(family, beds) : [];
      onChange(rooms);
    },
    [families, onChange]
  );

  const flexibleRoom = availableRooms.find((r) => r.isFlexible && gender === 'female');
  const hoursUntilCheckIn = dateRange.checkIn
    ? Math.floor((dateRange.checkIn.getTime() - Date.now()) / (1000 * 60 * 60))
    : 0;
  const showFlexibleNotice = flexibleRoom && hoursUntilCheckIn <= 48 && hoursUntilCheckIn > 0;

  const totalCapacity = families.reduce((sum, f) => sum + f.members.reduce((s, m) => s + m.capacity, 0), 0);
  const totalAvailable = families.reduce((sum, f) => sum + f.members.reduce((s, m) => s + m.availableBeds, 0), 0);

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
          totalBeds={totalCapacity}
          availableBeds={totalAvailable}
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
              <p className="text-sm">{Math.round(groupDiscount * 100)}% {T('off', locale)}</p>
            </div>
          </div>
        </Alert>
      )}

      <p className="text-sm text-gray-600 mb-3">{T('oneFamilyOnly', locale)}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {families.map((family) => (
          <RoomCard
            key={family.key}
            room={familyToCard(family, locale)}
            dateRange={dateRange}
            selectedBeds={selectedFamilyKey === family.key ? bedsCount : 0}
            onSelectBeds={(beds) => handleFamilySelection(family.key, beds)}
            locale={locale}
          />
        ))}
      </div>

      {families.length === 0 && (
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
              onClick={() => handleFamilySelection(selectedFamilyKey ?? '', 0)}
              className="text-sm text-red-600 hover:text-red-800 font-medium"
            >
              {T('clearSelection', locale)}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      title: 'Escolha seu Quarto',
      subtitle: 'Selecione um tipo de quarto e a quantidade de pessoas',
      familyTwelve: 'Misto (até 12)',
      familySeven: 'Misto (até 7)',
      familyFemale: 'Só Mulheres',
      oneFamilyOnly: 'Só se pode escolher um tipo de quarto por reserva.',
      totalSelected: 'Total selecionado',
      bed: 'pessoa',
      beds: 'pessoas',
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
      title: 'Elige tu Habitación',
      subtitle: 'Selecciona un tipo de habitación y la cantidad de personas',
      familyTwelve: 'Mixto (hasta 12)',
      familySeven: 'Mixto (hasta 7)',
      familyFemale: 'Solo Mujeres',
      oneFamilyOnly: 'Solo se puede elegir un tipo de habitación por reserva.',
      totalSelected: 'Total seleccionado',
      bed: 'persona',
      beds: 'personas',
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
      title: 'Choose your Room',
      subtitle: 'Select a room type and number of people',
      familyTwelve: 'Mixed (up to 12)',
      familySeven: 'Mixed (up to 7)',
      familyFemale: 'Women Only',
      oneFamilyOnly: 'Only one room type can be chosen per booking.',
      totalSelected: 'Total selected',
      bed: 'person',
      beds: 'people',
      off: 'off',
      clearSelection: 'Clear selection',
      groupDiscountTitle: 'Group Discount Active!',
      discountApplied: 'Discount applied',
      discountFrom: 'discount from',
      noAvailability: 'No Availability',
      tryOtherDates: 'Try other dates',
      importantInfo: 'Important Information'
    },
    fr: {
      title: 'Choisissez votre Chambre',
      subtitle: 'Sélectionnez un type de chambre et le nombre de personnes',
      familyTwelve: 'Mixte (jusqu’à 12)',
      familySeven: 'Mixte (jusqu’à 7)',
      familyFemale: 'Femmes Uniquement',
      oneFamilyOnly: 'Un seul type de chambre peut être choisi par réservation.',
      totalSelected: 'Total sélectionné',
      bed: 'personne',
      beds: 'personnes',
      off: 'de réduction',
      clearSelection: 'Effacer la sélection',
      groupDiscountTitle: 'Remise de Groupe Active !',
      discountApplied: 'Remise appliquée',
      discountFrom: 'remise à partir de',
      noAvailability: 'Aucune Disponibilité',
      tryOtherDates: 'Essayez d’autres dates',
      importantInfo: 'Informations Importantes'
    },
    de: {
      title: 'Wählen Sie Ihr Zimmer',
      subtitle: 'Wählen Sie einen Zimmertyp und die Personenanzahl',
      familyTwelve: 'Gemischt (bis 12)',
      familySeven: 'Gemischt (bis 7)',
      familyFemale: 'Nur Frauen',
      oneFamilyOnly: 'Pro Buchung kann nur ein Zimmertyp gewählt werden.',
      totalSelected: 'Insgesamt ausgewählt',
      bed: 'Person',
      beds: 'Personen',
      off: 'Rabatt',
      clearSelection: 'Auswahl löschen',
      groupDiscountTitle: 'Gruppenrabatt Aktiv!',
      discountApplied: 'Rabatt angewendet',
      discountFrom: 'Rabatt ab',
      noAvailability: 'Keine Verfügbarkeit',
      tryOtherDates: 'Andere Daten versuchen',
      importantInfo: 'Wichtige Informationen'
    }
  };
  return t[locale]?.[key] || key;
}
