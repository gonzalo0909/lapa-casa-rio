// src/components/booking/room-selector/room-selector.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { RoomCard } from './room-card';
import { RoomDetails } from './room-details';
import { AvailabilityIndicator } from './availability-indicator';
import { FlexibleRoomNotice } from './flexible-room-notice';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Alert, AlertDescription } from '../../ui/alert';
import { LoadingSpinner } from '../../ui/loading-spinner';
import { Badge } from '../../ui/badge';
import { cn } from '@/lib/utils';

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

interface RoomSelection {
  roomId: string;
  bedsRequested: number;
}

interface RoomSelectorProps {
  availableRooms: Room[];
  isLoading?: boolean;
  onRoomSelect: (selections: RoomSelection[]) => void;
  selectedRooms: RoomSelection[];
  dateRange: {
    checkIn: Date | null;
    checkOut: Date | null;
  };
  className?: string;
}

export function RoomSelector({
  availableRooms,
  isLoading = false,
  onRoomSelect,
  selectedRooms,
  dateRange,
  className
}: RoomSelectorProps) {
  const [roomSelections, setRoomSelections] = useState<RoomSelection[]>(selectedRooms);
  const [selectedRoomForDetails, setSelectedRoomForDetails] = useState<string | null>(null);
  const [totalBedsNeeded, setTotalBedsNeeded] = useState(1);

  useEffect(() => {
    setRoomSelections(selectedRooms);
  }, [selectedRooms]);

  const totalSelectedBeds = roomSelections.reduce((sum, selection) => sum + selection.bedsRequested, 0);
  const totalAvailableBeds = availableRooms.reduce((sum, room) => sum + room.availableBeds, 0);

  // Configuración específica de las habitaciones de Lapa Casa Hostel
  const roomsConfig = {
    room_mixto_12a: {
      displayName: 'Mixto 12A',
      description: 'Habitación mixta con 12 camas individuales, ideal para grupos grandes',
      features: ['12 camas individuales', 'Baño compartido', 'Lockers individuales', 'Aires acondicionados']
    },
    room_mixto_12b: {
      displayName: 'Mixto 12B', 
      description: 'Habitación mixta con 12 camas individuales, perfecta para grupos',
      features: ['12 camas individuales', 'Baño compartido', 'Lockers individuales', 'Ventiladores']
    },
    room_mixto_7: {
      displayName: 'Mixto 7',
      description: 'Habitación mixta más íntima con 7 camas individuales',
      features: ['7 camas individuales', 'Baño compartido', 'Lockers individuales', 'Ambiente acogedor']
    },
    room_flexible_7: {
      displayName: 'Flexible 7',
      description: 'Habitación flexible: femenina por defecto, se convierte a mixta 48h antes si no hay reservas femeninas',
      features: ['7 camas individuales', 'Configuración flexible', 'Baño compartido', 'Lockers individuales']
    }
  };

  const handleRoomBedChange = (roomId: string, beds: number) => {
    const newSelections = [...roomSelections];
    const existingIndex = newSelections.findIndex(s => s.roomId === roomId);
    
    if (beds === 0) {
      // Remover selección si beds = 0
      if (existingIndex >= 0) {
        newSelections.splice(existingIndex, 1);
      }
    } else {
      // Actualizar o agregar selección
      if (existingIndex >= 0) {
        newSelections[existingIndex].bedsRequested = beds;
      } else {
        newSelections.push({ roomId, bedsRequested: beds });
      }
    }
    
    setRoomSelections(newSelections);
  };

  const handleQuickSelect = (totalBeds: number) => {
    setTotalBedsNeeded(totalBeds);
    
    // Algoritmo de asignación automática óptima
    const newSelections: RoomSelection[] = [];
    let remainingBeds = totalBeds;
    
    // Ordenar habitaciones por capacidad (más grandes primero para grupos)
    const sortedRooms = [...availableRooms].sort((a, b) => b.capacity - a.capacity);
    
    for (const room of sortedRooms) {
      if (remainingBeds <= 0) break;
      
      const bedsToAssign = Math.min(remainingBeds, room.availableBeds);
      if (bedsToAssign > 0) {
        newSelections.push({
          roomId: room.id,
          bedsRequested: bedsToAssign
        });
        remainingBeds -= bedsToAssign;
      }
    }
    
    setRoomSelections(newSelections);
  };

  const handleConfirmSelection = () => {
    onRoomSelect(roomSelections);
  };

  const getGroupDiscount = (totalBeds: number): number => {
    if (totalBeds >= 26) return 0.20;
    if (totalBeds >= 16) return 0.15;
    if (totalBeds >= 7) return 0.10;
    return 0;
  };

  const groupDiscount = getGroupDiscount(totalSelectedBeds);
  const hasFlexibleRoom = roomSelections.some(s => 
    availableRooms.find(r => r.id === s.roomId)?.isFlexible
  );

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <LoadingSpinner className="mr-3" />
        <span className="text-gray-600">Verificando disponibilidad de habitaciones...</span>
      </div>
    );
  }

  if (availableRooms.length === 0) {
    return (
      <Card className={cn('p-8 text-center', className)}>
        <div className="text-gray-500 mb-4">
          No hay habitaciones disponibles para las fechas seleccionadas
        </div>
        <Button variant="outline" onClick={() => window.history.back()}>
          Cambiar fechas
        </Button>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header con información */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Habitaciones disponibles</h3>
          <p className="text-sm text-gray-600">
            {totalAvailableBeds} camas disponibles • {availableRooms.length} habitaciones
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <AvailabilityIndicator 
            total={45} // Total de camas del hostel
            available={totalAvailableBeds}
            selected={totalSelectedBeds}
          />
        </div>
      </div>

      {/* Quick selectors para grupos */}
      <Card className="p-4">
        <h4 className="font-medium mb-3">Selección rápida para grupos</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[7, 12, 16, 24].map(beds => (
            <Button
              key={beds}
              variant={totalSelectedBeds === beds ? "default" : "outline"}
              size="sm"
              onClick={() => handleQuickSelect(beds)}
              disabled={beds > totalAvailableBeds}
              className="text-sm"
            >
              {beds} personas
              {getGroupDiscount(beds) > 0 && (
                <Badge className="ml-1 text-xs" variant="secondary">
                  -{Math.round(getGroupDiscount(beds) * 100)}%
                </Badge>
              )}
            </Button>
          ))}
        </div>
      </Card>

      {/* Lista de habitaciones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {availableRooms.map(room => {
          const selection = roomSelections.find(s => s.roomId === room.id);
          const selectedBeds = selection?.bedsRequested || 0;
          
          return (
            <RoomCard
              key={room.id}
              room={room}
              selectedBeds={selectedBeds}
              onBedChange={(beds) => handleRoomBedChange(room.id, beds)}
              onDetailsClick={() => setSelectedRoomForDetails(room.id)}
              dateRange={dateRange}
              roomConfig={roomsConfig[room.id as keyof typeof roomsConfig]}
            />
          );
        })}
      </div>

      {/* Aviso habitación flexible */}
      {hasFlexibleRoom && (
        <FlexibleRoomNotice 
          selectedRooms={roomSelections}
          rooms={availableRooms}
          dateRange={dateRange}
        />
      )}

      {/* Resumen de selección */}
      {totalSelectedBeds > 0 && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-blue-900">
                {totalSelectedBeds} {totalSelectedBeds === 1 ? 'cama seleccionada' : 'camas seleccionadas'}
              </div>
              <div className="text-sm text-blue-700">
                {roomSelections.length} {roomSelections.length === 1 ? 'habitación' : 'habitaciones'}
                {groupDiscount > 0 && (
                  <span className="ml-2">
                    • Descuento grupal: {Math.round(groupDiscount * 100)}%
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRoomSelections([])}
              >
                Limpiar
              </Button>
              <Button
                onClick={handleConfirmSelection}
                size="sm"
              >
                Continuar
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Alertas de capacidad */}
      {totalSelectedBeds > totalAvailableBeds && (
        <Alert variant="destructive">
          <AlertDescription>
            Has seleccionado más camas ({totalSelectedBeds}) de las disponibles ({totalAvailableBeds}).
            Por favor ajusta tu selección.
          </AlertDescription>
        </Alert>
      )}

      {totalSelectedBeds >= 26 && (
        <Alert className="border-green-300 bg-green-50">
          <AlertDescription className="text-green-800">
            <div className="font-semibold mb-1">¡Grupo grande detectado!</div>
            <div className="text-sm">
              • Descuento del 20% aplicado automáticamente
              • Contacta con nosotros para servicios adicionales para grupos
              • Posibilidad de uso exclusivo del hostel
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Modal de detalles de habitación */}
      {selectedRoomForDetails && (
        <RoomDetails
          room={availableRooms.find(r => r.id === selectedRoomForDetails)!}
          isOpen={!!selectedRoomForDetails}
          onClose={() => setSelectedRoomForDetails(null)}
          onSelect={(beds) => {
            handleRoomBedChange(selectedRoomForDetails, beds);
            setSelectedRoomForDetails(null);
          }}
          selectedBeds={roomSelections.find(s => s.roomId === selectedRoomForDetails)?.bedsRequested || 0}
        />
      )}

      {/* Información adicional */}
      <Card className="p-4">
        <h4 className="font-medium mb-2">Información importante</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Check-in: 15:00 - Check-out: 11:00</li>
          <li>• Todas las habitaciones incluyen ropa de cama y toallas</li>
          <li>• Lockers individuales disponibles (candado no incluido)</li>
          <li>• Cocina compartida y área común disponibles 24/7</li>
          <li>• WiFi gratuito en todas las áreas</li>
        </ul>
      </Card>
    </div>
  );
}
