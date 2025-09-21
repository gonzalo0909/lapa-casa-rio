// src/components/booking/room-selector/availability-indicator.tsx

'use client';

import React from 'react';
import { Progress } from '../../ui/progress';
import { Badge } from '../../ui/badge';
import { cn } from '@/lib/utils';

interface AvailabilityIndicatorProps {
  total: number;
  available: number;
  selected: number;
  className?: string;
}

export function AvailabilityIndicator({
  total,
  available,
  selected,
  className
}: AvailabilityIndicatorProps) {
  const occupied = total - available;
  const remaining = available - selected;
  
  const occupiedPercentage = (occupied / total) * 100;
  const selectedPercentage = (selected / total) * 100;
  const availablePercentage = (remaining / total) * 100;

  const getAvailabilityStatus = () => {
    const availabilityRatio = available / total;
    
    if (availabilityRatio >= 0.7) return { status: 'alta', color: 'text-green-600', bgColor: 'bg-green-100' };
    if (availabilityRatio >= 0.3) return { status: 'media', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
    return { status: 'baja', color: 'text-red-600', bgColor: 'bg-red-100' };
  };

  const statusInfo = getAvailabilityStatus();

  return (
    <div className={cn('space-y-3', className)}>
      {/* Status Badge */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Disponibilidad</span>
        <Badge className={cn(statusInfo.bgColor, statusInfo.color)}>
          {statusInfo.status.charAt(0).toUpperCase() + statusInfo.status.slice(1)}
        </Badge>
      </div>

      {/* Visual Progress Bar */}
      <div className="relative">
        <div className="w-full h-6 bg-gray-200 rounded-full overflow-hidden">
          {/* Occupied beds */}
          <div 
            className="absolute left-0 top-0 h-full bg-gray-400 transition-all duration-300"
            style={{ width: `${occupiedPercentage}%` }}
          />
          
          {/* Selected beds */}
          <div 
            className="absolute top-0 h-full bg-blue-500 transition-all duration-300"
            style={{ 
              left: `${occupiedPercentage}%`,
              width: `${selectedPercentage}%`
            }}
          />
          
          {/* Available beds */}
          <div 
            className="absolute top-0 h-full bg-green-400 transition-all duration-300"
            style={{ 
              left: `${occupiedPercentage + selectedPercentage}%`,
              width: `${availablePercentage}%`
            }}
          />
        </div>

        {/* Labels overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-medium text-white drop-shadow">
            {available} / {total} camas disponibles
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
          <span className="text-gray-600">Ocupadas: {occupied}</span>
        </div>
        
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <span className="text-gray-600">Seleccionadas: {selected}</span>
        </div>
        
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-green-400 rounded-full"></div>
          <span className="text-gray-600">Libres: {remaining}</span>
        </div>
      </div>

      {/* Room breakdown by type */}
      <div className="pt-2 border-t border-gray-200">
        <div className="text-xs text-gray-600 space-y-1">
          <div className="font-medium mb-2">Por habitación:</div>
          
          <div className="grid grid-cols-2 gap-y-1 gap-x-2">
            <div className="flex justify-between">
              <span>Mixto 12A:</span>
              <span className="font-medium">12 camas</span>
            </div>
            <div className="flex justify-between">
              <span>Mixto 12B:</span>
              <span className="font-medium">12 camas</span>
            </div>
            <div className="flex justify-between">
              <span>Mixto 7:</span>
              <span className="font-medium">7 camas</span>
            </div>
            <div className="flex justify-between">
              <span>Flexible 7:</span>
              <span className="font-medium">7 camas</span>
            </div>
          </div>
        </div>
      </div>

      {/* Availability alerts */}
      {available <= 5 && available > 0 && (
        <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
          <div className="font-medium text-yellow-800">¡Pocas camas disponibles!</div>
          <div className="text-yellow-700">
            Solo quedan {available} camas. Te recomendamos reservar pronto.
          </div>
        </div>
      )}

      {available === 0 && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-xs">
          <div className="font-medium text-red-800">Sin disponibilidad</div>
          <div className="text-red-700">
            No hay camas disponibles para estas fechas. Prueba con otras fechas.
          </div>
        </div>
      )}

      {selected > 15 && (
        <div className="p-2 bg-green-50 border border-green-200 rounded text-xs">
          <div className="font-medium text-green-800">¡Grupo grande!</div>
          <div className="text-green-700">
            Descuento automático del {selected >= 26 ? '20%' : selected >= 16 ? '15%' : '10%'} aplicado.
          </div>
        </div>
      )}

      {/* Current selection summary */}
      {selected > 0 && (
        <div className="p-2 bg-blue-50 border border-blue-200 rounded">
          <div className="text-xs space-y-1">
            <div className="flex justify-between items-center">
              <span className="font-medium text-blue-800">Selección actual:</span>
              <span className="text-blue-700">{selected} {selected === 1 ? 'cama' : 'camas'}</span>
            </div>
            
            <div className="text-blue-600">
              {((selected / total) * 100).toFixed(1)}% del hostel ocupado por tu grupo
            </div>
            
            {selected >= 22 && (
              <div className="text-blue-700 font-medium">
                ¡Uso casi exclusivo del hostel!
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
