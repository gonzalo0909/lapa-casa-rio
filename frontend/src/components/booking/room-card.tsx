// lapa-casa-hostel/frontend/src/components/booking/room-card.tsx

"use client";

import React, { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { RoomDetails } from './room-details';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal, ModalHeader, ModalTitle, ModalBody } from '@/components/ui/modal';
import { availabilityAPI, handleAPIError } from '@/lib/api';
import { getRoomImage } from '@/lib/room-images';
import type { DateRange, RoomAvailability, RoomBed } from '@/types/global';

/**
 * RoomCard Component
 *
 * Quantidade de camas por padrão (modo rápido, atribuição automática)
 * com opção de abrir seletor manual de camas reais, agrupadas em
 * beliches de 3. Agora inclui imagem do tipo de quarto via next/image.
 * Usa next-intl para i18n.
 *
 * @component
 */
interface RoomCardProps {
  room: RoomAvailability;
  /** UUID real do quarto físico (room_types.id) para o seletor manual. */
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
  const t = useTranslations('roomCard');

  const [showDetails, setShowDetails] = useState(false);
  const [mode, setMode] = useState<'quick' | 'manual'>('quick');
  const [beds, setBeds] = useState<RoomBed[] | null>(null);
  const [isLoadingBeds, setIsLoadingBeds] = useState(false);
  const [bedsError, setBedsError] = useState<string | null>(null);
  const [selectedBedIds, setSelectedBedIds] = useState<string[]>([]);

  // Se as datas mudarem, a disponibilidade de camas consultada fica
  // desatualizada — volta ao modo rápido e descarta.
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
  // Antes de 60% de ocupação não mostramos o número de disponibilidade
  // (ver comentário no original sobre confusão de capacidade total).
  const showAvailability = occupancyPercent >= 60;

  const roomImage = getRoomImage(room.type, room.isFlexible);

  const handleIncrement = useCallback(() => {
    if (selectedBeds < room.availableBeds) { onSelectBeds(selectedBeds + 1); }
  }, [selectedBeds, room.availableBeds, onSelectBeds]);

  const handleDecrement = useCallback(() => {
    if (selectedBeds > 0) { onSelectBeds(selectedBeds - 1); }
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
        const roomBeds: RoomBed[] = response.data?.beds ?? [];
        if (roomBeds.length === 0) {
          setBedsError(t('bedsUnavailable'));
        }
        setBeds(roomBeds);
        const autoIds = roomBeds
          .filter((b) => b.isAvailable)
          .slice(0, selectedBeds)
          .map((b) => b.bedId);
        setSelectedBedIds(autoIds);
      } catch (err) {
        setBedsError(handleAPIError(err, locale));
      } finally {
        setIsLoadingBeds(false);
      }
    }
    setMode('manual');
  }, [beds, realRoomId, dateRange.checkIn, dateRange.checkOut, selectedBeds, locale, t]);

  const closeManualMode = useCallback(() => setMode('quick'), []);

  const toggleBed = useCallback((bedId: string) => {
    setSelectedBedIds((prev) => {
      const next = prev.includes(bedId) ? prev.filter((id) => id !== bedId) : [...prev, bedId];
      onSelectBeds(next.length, next);
      return next;
    });
  }, [onSelectBeds]);

  const getRoomIcon = (type: string, isFlexible: boolean) => {
    if (isFlexible) { return '🔄'; }
    if (type === 'female') { return '👩'; }
    if (type === 'male') { return '👨'; }
    return '👥';
  };

  const getRoomTypeLabel = (type: string, isFlexible: boolean) => {
    if (isFlexible) { return t('flexible'); }
    if (type === 'female') { return t('female'); }
    if (type === 'male') { return t('male'); }
    return t('mixed');
  };

  const bunks = beds ? groupIntoBunks(beds) : [];

  return (
    <>
      <Card
        className={`room-card overflow-hidden ${!isAvailable ? 'opacity-60' : ''} ${
          selectedBeds > 0 ? 'ring-2 ring-primary' : ''
        } ${className}`}
      >
        {/* Imagem do quarto */}
        <div className="relative w-full h-36 bg-muted">
          <Image
            src={roomImage}
            alt={room.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            priority={false}
          />
        </div>

        <div className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{getRoomIcon(room.type, room.isFlexible)}</span>
                <h3 className="text-base font-bold text-foreground">{room.name}</h3>
              </div>
              <Badge variant={room.isFlexible ? 'warning' : 'default'}>
                {getRoomTypeLabel(room.type, room.isFlexible)}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(true)}
              aria-label={t('viewDetails')}
            >
              ℹ️
            </Button>
          </div>

          {showAvailability && !isFullyBooked && (
            <div className="mb-3 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('available')}:</span>
                <span className="font-semibold text-green-600 dark:text-green-400">
                  {room.availableBeds} {t('beds')}
                </span>
              </div>
              {room.availableBeds <= 3 && (
                <p className="text-xs text-orange-600 mt-1">⚠️ {t('fewBedsLeft')}</p>
              )}
            </div>
          )}

          {isAvailable ? (
            <>
              {mode === 'quick' && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-foreground">{t('selectBeds')}:</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleDecrement}
                        disabled={selectedBeds === 0}
                        className="w-8 h-8 flex items-center justify-center rounded-full border-2 border-border hover:border-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label={t('decrease')}
                      >
                        −
                      </button>
                      <span className="text-xl font-bold text-foreground w-8 text-center">
                        {selectedBeds}
                      </span>
                      <button
                        onClick={handleIncrement}
                        disabled={selectedBeds >= room.availableBeds}
                        className="w-8 h-8 flex items-center justify-center rounded-full border-2 border-border hover:border-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label={t('increase')}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={openManualMode}
                    disabled={isLoadingBeds}
                    className="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
                  >
                    {isLoadingBeds ? t('loadingBeds') : `🛏️ ${t('chooseSpecific')}`}
                  </button>
                  {bedsError && <p className="text-xs text-destructive mt-1">{bedsError}</p>}
                </>
              )}

              {mode === 'manual' && (
                <div>
                  <div className="flex flex-wrap gap-2 justify-center mb-3">
                    {bunks.map((bunk, i) => (
                      <div key={i} className="flex flex-col-reverse gap-1 bg-muted border border-border rounded-lg p-1.5">
                        {bunk.map((bed) => {
                          const isSelected = selectedBedIds.includes(bed.bedId);
                          return (
                            <button
                              key={bed.bedId}
                              type="button"
                              disabled={!bed.isAvailable}
                              onClick={() => toggleBed(bed.bedId)}
                              aria-label={`${t('bed')} ${bed.bedCode}${!bed.isAvailable ? `, ${t('fullyBooked')}` : ''}`}
                              aria-pressed={isSelected}
                              className={`w-11 h-6 rounded text-[10px] font-bold flex items-center justify-center border-2 transition-colors ${
                                !bed.isAvailable
                                  ? 'bg-muted border-border text-muted-foreground cursor-not-allowed'
                                  : isSelected
                                  ? 'bg-primary border-primary text-primary-foreground'
                                  : 'bg-card border-border text-muted-foreground hover:border-primary'
                              }`}
                            >
                              {!bed.isAvailable ? '✕' : isSelected ? '✓' : bed.bedCode}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground mb-3">
                    <span className="flex items-center gap-1">
                      <i className="inline-block w-2.5 h-2.5 rounded-sm border-2 border-border" />
                      {t('available')}
                    </span>
                    <span className="flex items-center gap-1">
                      <i className="inline-block w-2.5 h-2.5 rounded-sm bg-primary border-2 border-primary" />
                      {t('selectedBed')}
                    </span>
                    <span className="flex items-center gap-1">
                      <i className="inline-block w-2.5 h-2.5 rounded-sm bg-muted border-2 border-border" />
                      {t('fullyBooked')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={closeManualMode}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    ← {t('backToQuick')}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-destructive font-semibold">{t('fullyBooked')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('tryOtherDates')}</p>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('pricePerNight')}:</span>
              <span className="font-bold text-foreground">
                R$ {room.basePrice.toFixed(2)}/{t('bed')}
              </span>
            </div>
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
