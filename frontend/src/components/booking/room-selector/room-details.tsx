// src/components/booking/room-selector/room-details.tsx

'use client';

import React, { useState } from 'react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Modal } from '../../ui/modal';
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

interface RoomDetailsProps {
  room: Room;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (beds: number) => void;
  selectedBeds: number;
  className?: string;
}

export function RoomDetails({
  room,
  isOpen,
  onClose,
  onSelect,
  selectedBeds,
  className
}: RoomDetailsProps) {
  const [bedCount, setBedCount] = useState(selectedBeds);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const handleBedCountChange = (value: string) => {
    const beds = parseInt(value) || 0;
    if (beds >= 0 && beds <= room.availableBeds) {
      setBedCount(beds);
    }
  };

  const handleConfirm = () => {
    onSelect(bedCount);
    onClose();
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  // Imágenes placeholder para las habitaciones
  const roomImages = room.images.length > 0 ? room.images : [
    '/images/rooms/placeholder-1.jpg',
    '/images/rooms/placeholder-2.jpg',
    '/images/rooms/placeholder-3.jpg'
  ];

  // Configuración específica por habitación
  const getRoomSpecificInfo = () => {
    switch (room.id) {
      case 'room_mixto_12a':
        return {
          floor: 'Planta baja',
          bathroom: 'Baño compartido en el pasillo',
          windows: '2 ventanas grandes con vista al patio',
          specialFeatures: ['Aire acondicionado', 'Cerca de la cocina común', 'Fácil acceso']
        };
      case 'room_mixto_12b':
        return {
          floor: 'Primera planta',
          bathroom: 'Baño compartido en el piso',
          windows: '3 ventanas con vista a la calle',
          specialFeatures: ['Ventiladores de techo', 'Más silenciosa', 'Balcón pequeño']
        };
      case 'room_mixto_7':
        return {
          floor: 'Primera planta',
          bathroom: 'Baño compartido cercano',
          windows: '2 ventanas con vista lateral',
          specialFeatures: ['Ambiente íntimo', 'Perfecto para grupos pequeños', 'Muy acogedor']
        };
      case 'room_flexible_7':
        return {
          floor: 'Segunda planta',
          bathroom: 'Baño compartido exclusivo del piso',
          windows: '1 ventana grande con vista panorámica',
          specialFeatures: ['Configuración flexible', 'Más privacidad', 'Vista espectacular']
        };
      default:
        return {
          floor: 'Variable',
          bathroom: 'Baño compartido',
          windows: 'Ventanas con vista',
          specialFeatures: ['Cómodo y acogedor']
        };
    }
  };

  const roomInfo = getRoomSpecificInfo();

  const amenitiesList = [
    'Camas individuales cómodas',
    'Ropa de cama incluida',
    'Lockers individuales',
    'Toallas incluidas',
    'WiFi gratuito',
    'Área común 24/7',
    'Cocina compartida',
    'Limpieza diaria'
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} className={className}>
      <div className="max-w-2xl mx-auto bg-white rounded-lg overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {room.name}
              </h2>
              <div className="flex items-center space-x-2 mt-1">
                <Badge className={cn(
                  room.isFlexible 
                    ? 'bg-purple-100 text-purple-800'
                    : room.type === 'mixed'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-pink-100 text-pink-800'
                )}>
                  {room.isFlexible ? 'Flexible' : room.type === 'mixed' ? 'Mixta' : 'Femenina'}
                </Badge>
                <span className="text-sm text-gray-500">
                  {room.capacity} camas • {formatPrice(room.basePrice)}/noche
                </span>
              </div>
            </div>
            <Button variant="ghost" onClick={onClose} className="h-8 w-8 p-0">
              ✕
            </Button>
          </div>
        </div>

        {/* Image Gallery */}
        <div className="relative">
          <div className="h-64 bg-gray-200 overflow-hidden">
            <img
              src={roomImages[currentImageIndex]}
              alt={`${room.name} - imagen ${currentImageIndex + 1}`}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = '/images/rooms/default-room.jpg';
              }}
            />
          </div>
          
          {roomImages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
              {roomImages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  className={cn(
                    'w-2 h-2 rounded-full transition-colors',
                    index === currentImageIndex ? 'bg-white' : 'bg-white/50'
                  )}
                />
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Description */}
          <div>
            <h3 className="font-semibold mb-2">Descripción</h3>
            <p className="text-gray-600">{room.description}</p>
          </div>

          {/* Room Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4">
              <h4 className="font-medium mb-3">Detalles de la habitación</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Ubicación:</span>
                  <span>{roomInfo.floor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Baño:</span>
                  <span>{roomInfo.bathroom}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Ventanas:</span>
                  <span>{roomInfo.windows}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Disponibles:</span>
                  <span className="font-medium text-green-600">{room.availableBeds} camas</span>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h4 className="font-medium mb-3">Características especiales</h4>
              <div className="space-y-1">
                {roomInfo.specialFeatures.map((feature, index) => (
                  <div key={index} className="flex items-center text-sm">
                    <span className="text-green-500 mr-2">✓</span>
                    {feature}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Amenities */}
          <div>
            <h3 className="font-semibold mb-3">Incluido</h3>
            <div className="grid grid-cols-2 gap-2">
              {amenitiesList.map((amenity, index) => (
                <div key={index} className="flex items-center text-sm">
                  <span className="text-green-500 mr-2">✓</span>
                  {amenity}
                </div>
              ))}
            </div>
          </div>

          {/* Flexible Room Notice */}
          {room
