// lapa-casa-hostel/frontend/src/components/booking/availability-indicator.tsx

"use client";

import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';

/**
 * AvailabilityIndicator Component
 * 
 * Visual indicator of total hostel availability
 * Shows capacity, available beds, and occupancy
 * 
 * @component
 */
interface AvailabilityIndicatorProps {
  totalBeds: number;
  availableBeds: number;
  selectedBeds: number;
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
  className?: string;
}

export const AvailabilityIndicator: React.FC<AvailabilityIndicatorProps> = ({
  totalBeds,
  availableBeds,
  selectedBeds,
  locale = 'pt',
  className = ''
}) => {
  const occupancyData = useMemo(() => {
    const occupied = totalBeds - availableBeds;
    const remaining = availableBeds - selectedBeds;
    const occupancyPercent = Math.round((occupied / totalBeds) * 100);
    const selectedPercent = Math.round((selectedBeds / totalBeds) * 100);
    const remainingPercent = Math.round((remaining / totalBeds) * 100);

    return {
      occupied,
      remaining,
      occupancyPercent,
      selectedPercent,
      remainingPercent
    };
  }, [totalBeds, availableBeds, selectedBeds]);

  const getAvailabilityStatus = () => {
    if (occupancyData.remainingPercent <= 10) {
      return { color: 'red', label: T('almostFull', locale), icon: '🔴' };
    }
    if (occupancyData.remainingPercent <= 30) {
      return { color: 'orange', label: T('limitedAvailability', locale), icon: '🟠' };
    }
    return { color: 'green', label: T('goodAvailability', locale), icon: '🟢' };
  };

  const status = getAvailabilityStatus();

  // Con poca ocupación, mostrar la capacidad total y un "buena
  // disponibilidad" verde no aporta nada -- solo expone cuántas camas
  // reales hay y da una señal vacía cuando todavía no hay huéspedes.
  // Recién pasado el 60% de ocupación vale la pena mostrar este bloque.
  if (occupancyData.occupancyPercent < 60) {
    return null;
  }

  return (
    <Card className={`availability-indicator p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{status.icon}</span>
          <span className="font-semibold text-gray-900">{status.label}</span>
        </div>
      </div>

      <div className="mb-3">
        <div className="h-6 bg-gray-200 rounded-full overflow-hidden flex">
          <div
            className="bg-gray-400 flex items-center justify-center text-xs text-white font-medium transition-all"
            style={{ width: `${occupancyData.occupancyPercent}%` }}
            title={T('occupied', locale)}
          >
            {occupancyData.occupancyPercent > 10 && `${occupancyData.occupancyPercent}%`}
          </div>
          <div
            className="bg-blue-500 flex items-center justify-center text-xs text-white font-medium transition-all"
            style={{ width: `${occupancyData.selectedPercent}%` }}
            title={T('selected', locale)}
          >
            {occupancyData.selectedPercent > 10 && `${occupancyData.selectedPercent}%`}
          </div>
          <div
            className="bg-green-500 flex items-center justify-center text-xs text-white font-medium transition-all"
            style={{ width: `${occupancyData.remainingPercent}%` }}
            title={T('available', locale)}
          >
            {occupancyData.remainingPercent > 10 && `${occupancyData.remainingPercent}%`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-400" />
          <div>
            <p className="text-gray-600 text-xs">{T('occupied', locale)}</p>
            <p className="font-semibold text-gray-900">{occupancyData.occupied}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <div>
            <p className="text-gray-600 text-xs">{T('selected', locale)}</p>
            <p className="font-semibold text-gray-900">{selectedBeds}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <div>
            <p className="text-gray-600 text-xs">{T('available', locale)}</p>
            <p className="font-semibold text-gray-900">{occupancyData.remaining}</p>
          </div>
        </div>
      </div>

      {selectedBeds > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{T('yourSelection', locale)}:</span>
            <span className="font-bold text-blue-600">
              {selectedBeds} {selectedBeds === 1 ? T('bed', locale) : T('beds', locale)}
            </span>
          </div>
        </div>
      )}

      {occupancyData.remainingPercent <= 20 && occupancyData.remaining > 0 && (
        <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-800">
          ⚠️ {T('hurryUp', locale)}
        </div>
      )}
    </Card>
  );
};

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      almostFull: 'Quase Esgotado',
      limitedAvailability: 'Disponibilidade Limitada',
      goodAvailability: 'Boa Disponibilidade',
      totalCapacity: 'Capacidade Total',
      bed: 'cama',
      beds: 'camas',
      occupied: 'Ocupadas',
      selected: 'Selecionadas',
      available: 'Disponíveis',
      yourSelection: 'Sua seleção',
      hurryUp: 'Reserve logo! Poucas camas disponíveis'
    },
    es: {
      almostFull: 'Casi Completo',
      limitedAvailability: 'Disponibilidad Limitada',
      goodAvailability: 'Buena Disponibilidad',
      totalCapacity: 'Capacidad Total',
      bed: 'cama',
      beds: 'camas',
      occupied: 'Ocupadas',
      selected: 'Seleccionadas',
      available: 'Disponibles',
      yourSelection: 'Tu selección',
      hurryUp: '¡Reserva pronto! Pocas camas disponibles'
    },
    en: {
      almostFull: 'Almost Full',
      limitedAvailability: 'Limited Availability',
      goodAvailability: 'Good Availability',
      totalCapacity: 'Total Capacity',
      bed: 'bed',
      beds: 'beds',
      occupied: 'Occupied',
      selected: 'Selected',
      available: 'Available',
      yourSelection: 'Your selection',
      hurryUp: 'Book soon! Few beds available'
    },
    fr: {
      almostFull: 'Presque Complet',
      limitedAvailability: 'Disponibilité Limitée',
      goodAvailability: 'Bonne Disponibilité',
      totalCapacity: 'Capacité Totale',
      bed: 'lit',
      beds: 'lits',
      occupied: 'Occupés',
      selected: 'Sélectionnés',
      available: 'Disponibles',
      yourSelection: 'Votre sélection',
      hurryUp: 'Réservez vite ! Peu de lits disponibles'
    },
    de: {
      almostFull: 'Fast Ausgebucht',
      limitedAvailability: 'Begrenzte Verfügbarkeit',
      goodAvailability: 'Gute Verfügbarkeit',
      totalCapacity: 'Gesamtkapazität',
      bed: 'Bett',
      beds: 'Betten',
      occupied: 'Belegt',
      selected: 'Ausgewählt',
      available: 'Verfügbar',
      yourSelection: 'Ihre Auswahl',
      hurryUp: 'Buchen Sie bald! Nur noch wenige Betten verfügbar'
    }
  };
  return t[locale]?.[key] || key;
}
