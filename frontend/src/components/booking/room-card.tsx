// lapa-casa-hostel/frontend/src/components/booking/room-card.tsx

"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { RoomDetails } from './room-details';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal, ModalHeader, ModalTitle, ModalBody } from '@/components/ui/modal';
import { availabilityAPI, handleAPIError } from '@/lib/api';
import type { DateRange, RoomAvailability, RoomBed } from '@/types/global';

/**
 * RoomCard Component
 *
 * Cantidad de camas por defecto (modo rápido, asignación automática) con
 * la opción de abrir un selector manual con las camas reales del cuarto,
 * agrupadas en treliches de 3 (abajo/medio/arriba, en ese orden real --
 * ver bed_code en database/seeds/0001_seed.sql). La asignación
 * automática y la manual usan el mismo criterio (primeras camas libres
 * por bed_code), así que cambiar de modo no pierde la selección.
 *
 * @component
 */
interface RoomCardProps {
  room: RoomAvailability;
  /** UUID real del cuarto físico (room_types.id) que se muestra en el selector manual -- distinto del id sintético de la familia. */
  realRoomId: string;
  dateRange: DateRange;
  selectedBeds: number;
  onSelectBeds: (beds: number, bedIds?: string[]) => void;
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
  className?: string;
}

function groupIntoBunks(beds: RoomBed[]): RoomBed[][] {
  const bunks: RoomBed[][] = [];
  for (let i = 0; i < beds.length; i += 3) {
    bunks.push(beds.slice(i, i + 3));
  }
  return bunks;
}

export const RoomCard: React.FC<RoomCardProps> = ({
  room,
  realRoomId,
  dateRange,
  selectedBeds,
  onSelectBeds,
  locale = 'pt',
  className = ''
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [mode, setMode] = useState<'quick' | 'manual'>('quick');
  const [beds, setBeds] = useState<RoomBed[] | null>(null);
  const [isLoadingBeds, setIsLoadingBeds] = useState(false);
  const [bedsError, setBedsError] = useState<string | null>(null);
  const [selectedBedIds, setSelectedBedIds] = useState<string[]>([]);

  // Si cambian las fechas, la disponibilidad de camas puntuales ya
  // consultada queda vieja -- se vuelve al modo rápido y se descarta.
  useEffect(() => {
    setMode('quick');
    setBeds(null);
    setSelectedBedIds([]);
  }, [dateRange.checkIn, dateRange.checkOut, realRoomId]);

  const isAvailable = room.availableBeds > 0;
  const isFullyBooked = room.availableBeds === 0;
  const occupancyPercent = room.capacity > 0
    ? ((room.capacity - room.availableBeds) / room.capacity) * 100
    : 0;
  // Antes del 60% de ocupación no mostramos ningún número de disponibilidad
  // (ni la capacidad total): con pocas reservas, exponer "X/24 camas" hace
  // pensar que hay un solo cuarto de 24 camas en vez de una familia de dos
  // cuartos reales. Pasado el 60%, sí vale la pena mostrar cuánto queda.
  const showAvailability = occupancyPercent >= 60;

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

  const openManualMode = useCallback(async () => {
    if (!beds) {
      setIsLoadingBeds(true);
      setBedsError(null);
      try {
        const response = await availabilityAPI.getRoomAvailability(realRoomId, {
          checkIn: dateRange.checkIn!.toISOString().slice(0, 10),
          checkOut: dateRange.checkOut!.toISOString().slice(0, 10)
        });
        const roomBeds: RoomBed[] = response.data.beds;
        setBeds(roomBeds);
        // Preselecciona las mismas camas que ya elegiría la asignación
        // automática (primeras libres por bed_code), para no perder lo
        // ya elegido en modo rápido al abrir el selector manual.
        const autoIds = roomBeds.filter((b) => b.isAvailable).slice(0, selectedBeds).map((b) => b.bedId);
        setSelectedBedIds(autoIds);
      } catch (err) {
        setBedsError(handleAPIError(err));
      } finally {
        setIsLoadingBeds(false);
      }
    }
    setMode('manual');
  }, [beds, realRoomId, dateRange.checkIn, dateRange.checkOut, selectedBeds]);

  const closeManualMode = useCallback(() => {
    setMode('quick');
  }, []);

  const toggleBed = useCallback((bedId: string) => {
    setSelectedBedIds((prev) => {
      const next = prev.includes(bedId) ? prev.filter((id) => id !== bedId) : [...prev, bedId];
      onSelectBeds(next.length, next);
      return next;
    });
  }, [onSelectBeds]);

  const getRoomIcon = (type: string, isFlexible: boolean) => {
    if (isFlexible) {return '🔄';}
    if (type === 'female') {return '👩';}
    if (type === 'male') {return '👨';}
    return '👥';
  };

  const getRoomTypeLabel = (type: string, isFlexible: boolean) => {
    if (isFlexible) {return T('flexible', locale);}
    if (type === 'female') {return T('female', locale);}
    if (type === 'male') {return T('male', locale);}
    return T('mixed', locale);
  };

  const bunks = beds ? groupIntoBunks(beds) : [];

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

        {showAvailability && !isFullyBooked && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{T('available', locale)}:</span>
              <span className="font-semibold text-green-600">
                {room.availableBeds} {T('beds', locale)}
              </span>
            </div>
            {room.availableBeds <= 3 && (
              <p className="text-xs text-orange-600 mt-1">⚠️ {T('fewBedsLeft', locale)}</p>
            )}
          </div>
        )}

        {isAvailable ? (
          <>
            {mode === 'quick' && (
              <>
                <div className="flex items-center justify-between mb-3">
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
                <button
                  type="button"
                  onClick={openManualMode}
                  disabled={isLoadingBeds}
                  className="text-xs font-semibold text-blue-600 hover:underline disabled:opacity-50"
                >
                  {isLoadingBeds ? T('loadingBeds', locale) : `🛏️ ${T('chooseSpecific', locale)}`}
                </button>
                {bedsError && <p className="text-xs text-red-600 mt-1">{bedsError}</p>}
              </>
            )}

            {mode === 'manual' && (
              <div>
                <div className="flex flex-wrap gap-2 justify-center mb-3">
                  {bunks.map((bunk, i) => (
                    <div key={i} className="flex flex-col-reverse gap-1 bg-gray-50 border border-gray-200 rounded-lg p-1.5">
                      {bunk.map((bed) => {
                        const isSelected = selectedBedIds.includes(bed.bedId);
                        return (
                          <button
                            key={bed.bedId}
                            type="button"
                            disabled={!bed.isAvailable}
                            onClick={() => toggleBed(bed.bedId)}
                            aria-label={`${T('bed', locale)} ${bed.bedCode}${!bed.isAvailable ? `, ${T('fullyBooked', locale)}` : ''}`}
                            aria-pressed={isSelected}
                            className={`w-11 h-6 rounded text-[10px] font-bold flex items-center justify-center border-2 transition-colors ${
                              !bed.isAvailable
                                ? 'bg-gray-200 border-gray-200 text-gray-400 cursor-not-allowed'
                                : isSelected
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400'
                            }`}
                          >
                            {!bed.isAvailable ? '✕' : isSelected ? '✓' : bed.bedCode}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-center gap-3 text-[10px] text-gray-500 mb-3">
                  <span className="flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-sm border-2 border-gray-300" />{T('available', locale)}</span>
                  <span className="flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-600 border-2 border-blue-600" />{T('selectedBed', locale)}</span>
                  <span className="flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-sm bg-gray-200 border-2 border-gray-200" />{T('fullyBooked', locale)}</span>
                </div>
                <button
                  type="button"
                  onClick={closeManualMode}
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  ← {T('backToQuick', locale)}
                </button>
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

      <Modal open={showDetails} onClose={() => setShowDetails(false)}>
        <ModalHeader>
          <ModalTitle>{room.name}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <RoomDetails room={room} dateRange={dateRange} locale={locale} />
        </ModalBody>
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
      chooseSpecific: 'Escolher camas específicas',
      loadingBeds: 'Carregando camas...',
      backToQuick: 'Voltar à seleção rápida',
      selectedBed: 'Selecionada',
      decrease: 'Diminuir',
      increase: 'Aumentar',
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
      chooseSpecific: 'Elegir camas específicas',
      loadingBeds: 'Cargando camas...',
      backToQuick: 'Volver a selección rápida',
      selectedBed: 'Seleccionada',
      decrease: 'Disminuir',
      increase: 'Aumentar',
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
      chooseSpecific: 'Choose specific beds',
      loadingBeds: 'Loading beds...',
      backToQuick: 'Back to quick select',
      selectedBed: 'Selected',
      decrease: 'Decrease',
      increase: 'Increase',
      fullyBooked: 'Fully Booked',
      tryOtherDates: 'Try other dates',
      pricePerNight: 'Price per night',
      viewDetails: 'View details'
    },
    fr: {
      bed: 'lit',
      beds: 'lits',
      mixed: 'Mixte',
      female: 'Féminin',
      male: 'Masculin',
      flexible: 'Flexible',
      available: 'Disponible',
      fewBedsLeft: 'Peu de lits restants',
      selectBeds: 'Sélectionner les lits',
      chooseSpecific: 'Choisir des lits précis',
      loadingBeds: 'Chargement des lits...',
      backToQuick: 'Retour à la sélection rapide',
      selectedBed: 'Sélectionné',
      decrease: 'Diminuer',
      increase: 'Augmenter',
      fullyBooked: 'Complet',
      tryOtherDates: 'Essayez d’autres dates',
      pricePerNight: 'Prix par nuit',
      viewDetails: 'Voir les détails'
    },
    de: {
      bed: 'Bett',
      beds: 'Betten',
      mixed: 'Gemischt',
      female: 'Weiblich',
      male: 'Männlich',
      flexible: 'Flexibel',
      available: 'Verfügbar',
      fewBedsLeft: 'Nur noch wenige Betten',
      selectBeds: 'Betten auswählen',
      chooseSpecific: 'Bestimmte Betten wählen',
      loadingBeds: 'Betten werden geladen...',
      backToQuick: 'Zurück zur Schnellauswahl',
      selectedBed: 'Ausgewählt',
      decrease: 'Verringern',
      increase: 'Erhöhen',
      fullyBooked: 'Ausgebucht',
      tryOtherDates: 'Andere Daten versuchen',
      pricePerNight: 'Preis pro Nacht',
      viewDetails: 'Details ansehen'
    }
  };
  return t[locale]?.[key] || key;
}
