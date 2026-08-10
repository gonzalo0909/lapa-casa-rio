// lapa-casa-hostel/frontend/src/components/booking/room-selector.tsx

"use client";

import React, { useState, useCallback, useMemo } from 'react';
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

function buildFamilies(rooms: RoomAvailability[]): Family[] {
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
  // El cuarto solo-mujeres siempre aparece cuando hay disponibilidad.
  // La traba es el modal de confirmación que se muestra al seleccionarlo.
  if (female.length > 0) {
    families.push({ key: 'female', labelKey: 'familyFemale', members: female });
  }
  return families;
}

function familyToCard(family: Family, locale: string): RoomAvailability {
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
    name: T(family.labelKey, locale),
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
  availableRooms,
  groupDiscountTiers,
  selectedRooms,
  onChange,
  locale = 'pt',
  error,
  className = ''
}) => {
  const families = useMemo(() => buildFamilies(availableRooms), [availableRooms]);

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
          const displayName = T('familyFemale', locale);
          rooms = rooms.map((r) => ({ ...r, name: displayName, type: 'female' as const }));
        }
      }
      onChange(rooms);
    },
    [families, locale, onChange]
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
          <ModalTitle>{T('femaleConfirmTitle', locale)}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <p className="text-gray-700 text-sm leading-relaxed">
            {T('femaleConfirmBody', locale)}
          </p>
        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            onClick={handleFemaleCancel}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {T('femaleConfirmCancel', locale)}
          </button>
          <button
            type="button"
            onClick={handleFemaleConfirm}
            className="px-4 py-2 rounded-lg bg-pink-600 text-white text-sm font-medium hover:bg-pink-700 transition-colors"
          >
            {T('femaleConfirmYes', locale)}
          </button>
        </ModalFooter>
      </Modal>

    </div>
  );
};

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      title: "Escolha seu Quarto",
      subtitle: "Selecione um tipo de quarto e a quantidade de pessoas",
      familyTwelve: "Misto (até 12)",
      familySeven: "Misto (até 7)",
      familyFemale: "Só Mulheres",
      oneFamilyOnly: "Só se pode escolher um tipo de quarto por reserva.",
      totalSelected: "Total selecionado",
      bed: "pessoa",
      beds: "pessoas",
      off: "de desconto",
      clearSelection: "Limpar seleção",
      groupDiscountTitle: "Desconto para Grupos Ativo!",
      discountApplied: "Desconto aplicado",
      discountFrom: "desconto a partir de",
      noAvailability: "Sem Disponibilidade",
      tryOtherDates: "Tente outras datas",
      importantInfo: "Informações Importantes",
      femaleConfirmTitle: "Quarto exclusivo para mulheres",
      femaleConfirmBody: "Este quarto só pode ser ocupado por mulheres. Ao confirmar, você declara que todos os hóspedes deste quarto são mulheres.",
      femaleConfirmYes: "Sim, confirmo",
      femaleConfirmCancel: "Cancelar",
    },
    es: {
      title: "Elige tu Habitación",
      subtitle: "Selecciona un tipo de habitación y la cantidad de personas",
      familyTwelve: "Mixto (hasta 12)",
      familySeven: "Mixto (hasta 7)",
      familyFemale: "Solo Mujeres",
      oneFamilyOnly: "Solo se puede elegir un tipo de habitación por reserva.",
      totalSelected: "Total seleccionado",
      bed: "persona",
      beds: "personas",
      off: "de descuento",
      clearSelection: "Limpiar selección",
      groupDiscountTitle: "¡Descuento para Grupos Activo!",
      discountApplied: "Descuento aplicado",
      discountFrom: "descuento desde",
      noAvailability: "Sin Disponibilidad",
      tryOtherDates: "Prueba otras fechas",
      importantInfo: "Información Importante",
      femaleConfirmTitle: "Cuarto exclusivo para mujeres",
      femaleConfirmBody: "Este cuarto solo puede ser ocupado por mujeres. Al confirmar, declarás que todos los huéspedes de este cuarto son mujeres.",
      femaleConfirmYes: "Sí, confirmo",
      femaleConfirmCancel: "Cancelar",
    },
    en: {
      title: "Choose your Room",
      subtitle: "Select a room type and number of people",
      familyTwelve: "Mixed (up to 12)",
      familySeven: "Mixed (up to 7)",
      familyFemale: "Women Only",
      oneFamilyOnly: "Only one room type can be chosen per booking.",
      totalSelected: "Total selected",
      bed: "person",
      beds: "people",
      off: "off",
      clearSelection: "Clear selection",
      groupDiscountTitle: "Group Discount Active!",
      discountApplied: "Discount applied",
      discountFrom: "discount from",
      noAvailability: "No Availability",
      tryOtherDates: "Try other dates",
      importantInfo: "Important Information",
      femaleConfirmTitle: "Women-only room",
      femaleConfirmBody: "This room is exclusively for women. By confirming, you declare that all guests staying in this room are women.",
      femaleConfirmYes: "Yes, I confirm",
      femaleConfirmCancel: "Cancel",
    },
    fr: {
      title: "Choisissez votre Chambre",
      subtitle: "Sélectionnez un type de chambre et le nombre de personnes",
      familyTwelve: "Mixte (jusqu'à 12)",
      familySeven: "Mixte (jusqu'à 7)",
      familyFemale: "Femmes Uniquement",
      oneFamilyOnly: "Un seul type de chambre peut être choisi par réservation.",
      totalSelected: "Total sélectionné",
      bed: "personne",
      beds: "personnes",
      off: "de réduction",
      clearSelection: "Effacer la sélection",
      groupDiscountTitle: "Remise de Groupe Active !",
      discountApplied: "Remise appliquée",
      discountFrom: "remise à partir de",
      noAvailability: "Aucune Disponibilité",
      tryOtherDates: "Essayez d'autres dates",
      importantInfo: "Informations Importantes",
      femaleConfirmTitle: "Chambre réservée aux femmes",
      femaleConfirmBody: "Cette chambre est exclusivement réservée aux femmes. En confirmant, vous déclarez que tous les hébergés de cette chambre sont des femmes.",
      femaleConfirmYes: "Oui, je confirme",
      femaleConfirmCancel: "Annuler",
    },
    de: {
      title: "Wählen Sie Ihr Zimmer",
      subtitle: "Wählen Sie einen Zimmertyp und die Personenanzahl",
      familyTwelve: "Gemischt (bis 12)",
      familySeven: "Gemischt (bis 7)",
      familyFemale: "Nur Frauen",
      oneFamilyOnly: "Pro Buchung kann nur ein Zimmertyp gewählt werden.",
      totalSelected: "Insgesamt ausgewählt",
      bed: "Person",
      beds: "Personen",
      off: "Rabatt",
      clearSelection: "Auswahl löschen",
      groupDiscountTitle: "Gruppenrabatt Aktiv!",
      discountApplied: "Rabatt angewendet",
      discountFrom: "Rabatt ab",
      noAvailability: "Keine Verfügbarkeit",
      tryOtherDates: "Andere Daten versuchen",
      importantInfo: "Wichtige Informationen",
      femaleConfirmTitle: "Zimmer nur für Frauen",
      femaleConfirmBody: "Dieses Zimmer ist ausschließlich für Frauen. Mit der Bestätigung erklären Sie, dass alle Gäste in diesem Zimmer Frauen sind.",
      femaleConfirmYes: "Ja, ich bestätige",
      femaleConfirmCancel: "Abbrechen",
    }
  };
  return t[locale]?.[key] || key;
}
