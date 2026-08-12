// lapa-casa-hostel/frontend/src/components/booking/room-selector.tsx

"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { RoomCard } from './room-card';
import { FlexibleRoomNotice } from './flexible-room-notice';
import { Alert } from '@/components/ui/alert';
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from '@/components/ui/modal';
import type { BookingGender, DateRange, GroupDiscountTier, Room, RoomAvailability } from '@/types/global';

/**
 * RoomSelector Component
 *
 * El huésped elige UNA sola "familia" de cuarto -- no se pueden combinar
 * dos familias en la misma reserva (pedido explícito del dueño). Siempre
 * se muestran las 3 familias disponibles (12 camas, 7 camas y solo-mujeres).
 * Al elegir el cuarto solo-mujeres aparece un modal de confirmación explícita
 * que actúa como traba: el usuario debe declarar que todos los huéspedes de
 * ese cuarto son mujeres antes de poder continuar. Cada familia puede tener
 * 2 cuartos reales atrás (ej. Mixto 12A + 12B) para grupos que superan la
 * capacidad de un solo cuarto -- la asignación entre esos cuartos reales es
 * automática, invisible para el huésped.
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

/**
 * `gender` filtra qué familias son elegibles (ver comentario en el tipo
 * `BookingGender`, types/global.ts): un huésped mixto solo debe ver los
 * cuartos mixtos; una huésped que eligió "female" ve los mixtos MÁS el
 * cuarto solo-mujeres. Sin este filtro, un grupo mixto podía terminar
 * viendo (y seleccionando) el cuarto solo-mujeres.
 */
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
  // El cuarto solo-mujeres aparece cuando hay disponibilidad Y el género
  // elegido es "female". La traba adicional es el modal de confirmación
  // que se muestra al seleccionarlo.
  if (female.length > 0 && gender === 'female') {
    families.push({ key: 'female', labelKey: 'familyFemale', members: female });
  }
  return families;
}

function familyToCard(family: Family, t: (key: string) => string): RoomAvailability {
  const totalAvailable = family.members.reduce((s, m) => s + m.availableBeds, 0);
  const primary = family.members[0]!;
  // El nombre de la familia ("hasta 12"/"hasta 7") describe la capacidad
  // de UN cuarto real, no la suma de los dos cuartos que la familia puede
  // llegar a combinar -- así que lo que se puede elegir en la tarjeta
  // (contador, capacidad mostrada) se topa ahí, aunque entre los dos
  // cuartos reales haya más camas libres en total. allocateFamily() sigue
  // pudiendo repartir entre ambos cuartos reales para grupos grandes; acá
  // solo se limita lo que esta tarjeta puntual ofrece.
  return {
    id: family.key,
    code: family.key,
    name: t(family.labelKey),
    type: family.key === 'female' ? 'female' : 'mixed',
    capacity: primary.capacity,
    availableBeds: Math.min(totalAvailable, primary.capacity),
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
  const t = useTranslations('roomSelector');
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
  // Cuarto solo-mujeres: guardamos la selección pendiente hasta que el
  // usuario confirme explícitamente en el modal. Si cancela, no se aplica.
  const [pendingFemale, setPendingFemale] = useState<{ beds: number; bedIds?: string[] } | null>(null);

  const totalSelectedBeds = selectedFamilyKey ? bedsCount : 0;
  const groupDiscount = groupDiscountFor(totalSelectedBeds, groupDiscountTiers);
  const hasGroupDiscount = groupDiscount > 0;

  /** Convierte una selección de familia+camas en Room[] y notifica al padre. */
  const applyFamilySelection = useCallback(
    (familyKey: string, beds: number, bedIds?: string[]) => {
      setSelectedFamilyKey(beds > 0 ? familyKey : null);
      setBedsCount(beds);

      const family = families.find((f) => f.key === familyKey);
      let rooms: Room[] = [];
      if (beds > 0 && family) {
        if (bedIds && bedIds.length > 0) {
          // Selector manual: las camas puntuales elegidas son siempre de
          // UN cuarto real (el primario), porque familyToCard() ya topa
          // lo elegible a la capacidad de un solo cuarto -- no hace falta
          // repartir entre los dos cuartos reales de la familia.
          const primary = family.members[0]!;
          rooms = [{
            id: primary.id,
            name: primary.name,
            type: primary.type,
            bedsCount: beds,
            capacity: primary.capacity,
            basePrice: primary.basePrice,
            isFlexible: primary.isFlexible,
            preferredBedIds: bedIds,
          }];
        } else {
          rooms = allocateFamily(family, beds);
        }
        // El cuarto solo-mujeres tiene nombre interno ("Flexible 7" u otros).
        // Se reemplaza por el nombre localizado para que en el resumen y el
        // correo de confirmación nunca aparezca terminología interna.
        if (familyKey === 'female') {
          const displayName = t('familyFemale');
          rooms = rooms.map((r) => ({ ...r, name: displayName, type: 'female' as const }));
        }
      }
      onChange(rooms);
    },
    [families, t, onChange]
  );

  const handleFamilySelection = useCallback(
    (familyKey: string, beds: number, bedIds?: string[]) => {
      // El cuarto solo-mujeres requiere confirmación explícita antes de aplicarse.
      if (familyKey === 'female' && beds > 0) {
        setPendingFemale({ beds, bedIds });
        return;
      }
      applyFamilySelection(familyKey, beds, bedIds);
    },
    [applyFamilySelection]
  );

  const handleFemaleConfirm = useCallback(() => {
    if (!pendingFemale) { return; }
    applyFamilySelection('female', pendingFemale.beds, pendingFemale.bedIds);
    setPendingFemale(null);
  }, [pendingFemale, applyFamilySelection]);

  const handleFemaleCancel = useCallback(() => {
    setPendingFemale(null);
  }, []);

  const flexibleRoom = availableRooms.find((r) => r.isFlexible);
  const hoursUntilCheckIn = dateRange.checkIn
    ? Math.floor((dateRange.checkIn.getTime() - Date.now()) / (1000 * 60 * 60))
    : 0;
  const showFlexibleNotice = flexibleRoom && hoursUntilCheckIn <= 48 && hoursUntilCheckIn > 0;

  return (
    <div className={`room-selector ${className}`}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">{t('title')}</h2>
        <p className="text-muted-foreground">{t('subtitle')}</p>
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

      {hasGroupDiscount && (
        <Alert variant="info" className="mb-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="font-semibold">{t('groupDiscountTitle')}</p>
              <p className="text-sm">{Math.round(groupDiscount * 100)}% {t('off')}</p>
            </div>
          </div>
        </Alert>
      )}

      <p className="text-sm text-muted-foreground mb-3">{t('oneFamilyOnly')}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {families.map((family) => (
          <RoomCard
            key={family.key}
            room={familyToCard(family, t)}
            realRoomId={family.members[0]!.id}
            dateRange={dateRange}
            selectedBeds={selectedFamilyKey === family.key ? bedsCount : 0}
            onSelectBeds={(beds, bedIds) => handleFamilySelection(family.key, beds, bedIds)}
            locale={locale}
          />
        ))}
      </div>

      {families.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">😔</div>
          <h3 className="text-xl font-semibold text-foreground mb-2">
            {t('noAvailability')}
          </h3>
          <p className="text-muted-foreground">{t('tryOtherDates')}</p>
        </div>
      )}

      {totalSelectedBeds > 0 && (
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">
                {t('totalSelected')}: {totalSelectedBeds}{' '}
                {totalSelectedBeds === 1 ? t('bed') : t('beds')}
              </p>
              {hasGroupDiscount && (
                <p className="text-sm text-green-700 dark:text-green-400 font-medium mt-1">
                  ✓ {t('discountApplied')}
                </p>
              )}
            </div>
            <button
              onClick={() => handleFamilySelection(selectedFamilyKey ?? '', 0)}
              className="text-sm text-destructive hover:opacity-80 font-medium"
            >
              {t('clearSelection')}
            </button>
          </div>
        </div>
      )}

      {/* Modal de confirmación: cuarto solo-mujeres */}
      <Modal
        open={pendingFemale !== null}
        onClose={handleFemaleCancel}
        disableBackdropClick
        disableEscapeKey
        showCloseButton={false}
        size="sm"
      >
        <ModalHeader>
          <ModalTitle>{t('femaleConfirmTitle')}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <p className="text-foreground text-sm leading-relaxed">
            {t('femaleConfirmBody')}
          </p>
        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            onClick={handleFemaleCancel}
            className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            {t('femaleConfirmCancel')}
          </button>
          <button
            type="button"
            onClick={handleFemaleConfirm}
            className="px-4 py-2 rounded-lg bg-pink-600 text-white text-sm font-medium hover:bg-pink-700 transition-colors"
          >
            {t('femaleConfirmYes')}
          </button>
        </ModalFooter>
      </Modal>

    </div>
  );
};
