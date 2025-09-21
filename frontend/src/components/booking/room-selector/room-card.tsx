// src/components/booking/room-selector/room-card.tsx

'use client';

import React, { useState } from 'react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
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

interface RoomConfig {
  displayName: string;
  description: string;
  features: string[];
}

interface RoomCardProps {
  room: Room;
  selectedBeds: number;
  onBedChange: (beds: number) => void;
  onDetailsClick: () => void;
  dateRange: {
    checkIn: Date | null;
    checkOut: Date | null;
  };
  roomConfig?: RoomConfig;
  className?: string;
}

export function RoomCard({
  room,
  selectedBeds,
  onBedChange,
  onDetailsClick,
  dateRange,
  roomConfig,
  className
}: RoomCardProps) {
  const [bedInput, setBedInput] = useState(selectedBeds.toString());

  const handleBedInputChange = (value: string) => {
    setBedInput(value);
    const beds = parseInt(value) || 0;
    if (beds >= 0 && beds <= room.availableBeds) {
      onBedChange(beds);
    }
  };

  const handleQuickSelect = (beds: number) => {
    setBedInput(beds.toString());
    onBedChange(beds);
  };

  const getRoomTypeDisplay = () => {
    if (room.isFlexible) {
      return 'Flexible (F→M)';
    }
    return room.type === 'mixed' ? 'Mixta' : 'Femenina';
  };

  const getRoomTypeColor = () => {
    if (room.isFlexible) return 'bg-purple-100 text-purple-800';
    if (room.type === 'mixed') return 'bg-blue-100 text-blue-800';
    return 'bg-pink-100 text-pink-800';
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const totalPrice = selectedBeds * room.basePrice;
  const quickSelectOptions = [1, 2, 4, room.capacity].filter(n => n <= room.availableBeds);

  return (
    <Card className={cn(
      'p-4 transition-all duration-200 hover:shadow-md',
      selectedBeds > 0 && 'ring-2 ring-blue-500 ring-offset-1 bg-blue-50',
      className
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <h3 className="font-semibold text-lg">
              {roomConfig?.displayName || room.name}
            </h3>
            <Badge className={getRoomTypeColor()}>
              {getRoomTypeDisplay()}
            </Badge>
          </div>
          
          <p className="text-sm text-gray-600 mb-2">
            {roomConfig?.description || room.description}
          </p>
          
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <span>{room.capacity} camas</span>
            <span>•</span>
            <span>{room.availableBeds} disponibles</span>
            <span>•</span>
            <span>{formatPrice(room.basePrice)}/noche</span>
          </div>
        </div>

        {/* Availability indicator */}
        <div className="text-right">
          <div className={cn(
            'text-sm font-medium px-2 py-1 rounded',
            room.availableBeds > 0 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          )}>
            {room.availableBeds > 0 ? 'Disponible' : 'Agotado'}
          </div>
        </div>
      </div>

      {/* Room features */}
      {roomConfig?.features && (
        <div className="mb-4">
          <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
            {roomConfig.features.map((feature, index) => (
              <div key={index} className="flex items-center">
                <span className="text-green-500 mr-1">✓</span>
                {feature}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Special notices */}
      {room.isFlexible && (
        <div className="mb-4 p-2 bg-purple-50 border border-purple-200 rounded text-xs">
          <div className="font-medium text-purple-800 mb-1">Habitación Flexible</div>
          <div className="text-purple-700">
            Configurada como femenina. Se convierte a mixta automáticamente 48h antes del check-in si no hay reservas femeninas.
          </div>
        </div>
      )}

      {/* Bed selection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Camas necesarias:</label>
          <Button
            variant="outline"
            size="sm"
            onClick={onDetailsClick}
            className="text-xs"
          >
            Ver detalles
          </Button>
        </div>

        {/* Quick selectors */}
        <div className="flex space-x-1">
          {quickSelectOptions.map(beds => (
            <Button
              key={beds}
              variant={selectedBeds === beds ? "default" : "outline"}
              size="sm"
              onClick={() => handleQuickSelect(beds)}
              disabled={beds > room.availableBeds}
              className="flex-1 text-xs"
            >
              {beds}
            </Button>
          ))}
        </div>

        {/* Manual input */}
        <div className="flex items-center space-x-2">
          <div className="flex-1">
            <Input
              type="number"
              value={bedInput}
              onChange={(e) => handleBedInputChange(e.target.value)}
              min="0"
              max={room.availableBeds}
              placeholder="0"
              className="text-center"
            />
          </div>
          <div className="text-xs text-gray-500">
            máx. {room.availableBeds}
          </div>
        </div>

        {/* Price display */}
        {selectedBeds > 0 && (
          <div className="pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                {selectedBeds} {selectedBeds === 1 ? 'cama' : 'camas'} x {formatPrice(room.basePrice)}
              </span>
              <span className="font-semibold">
                {formatPrice(totalPrice)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-4 pt-3 border-t border-gray-200 flex space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleQuickSelect(0)}
          disabled={selectedBeds === 0}
          className="flex-1"
        >
          Quitar
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleQuickSelect(room.availableBeds)}
          disabled={room.availableBeds === 0 || selectedBeds === room.availableBeds}
          className="flex-1"
        >
          Toda la habitación
        </Button>
      </div>

      {/* Capacity warning */}
      {selectedBeds > room.availableBeds && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          No hay suficientes camas disponibles. Máximo: {room.availableBeds}
        </div>
      )}

      {/* Group benefits */}
      {selectedBeds >= 7 && (
        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
          <div className="font-medium">¡Descuento grupal aplicable!</div>
          <div>Reservando 7+ camas obtienes descuento automático</div>
        </div>
      )}
    </Card>
  );
}
