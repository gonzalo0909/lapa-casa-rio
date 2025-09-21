// lapa-casa-hostel-frontend/src/components/booking/date-selector/date-range-picker.tsx

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { 
  format, 
  addMonths, 
  subMonths,
  isSameDay,
  isWithinInterval,
  startOfDay,
  endOfDay,
  differenceInDays
} from 'date-fns';
import { Locale } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Calendar } from './calendar';
import { getSeasonMultiplier } from '../../../lib/pricing';
import { cn } from '../../../lib/utils';

interface DateRange {
  from: Date | null;
  to: Date | null;
}

interface DateRangePickerProps {
  selected?: DateRange;
  onSelect?: (range: { from: Date; to: Date }) => void;
  disabled?: boolean;
  locale?: Locale;
  numberOfMonths?: number;
  showWeekNumbers?: boolean;
  showOutsideDays?: boolean;
  className?: string;
}

interface PickerState {
  currentDate: Date;
  hoveredDate: Date | null;
  tempRange: DateRange;
  isSelecting: boolean;
}

export function DateRangePicker({
  selected,
  onSelect,
  disabled = false,
  locale = ptBR,
  numberOfMonths = 2,
  showWeekNumbers = false,
  showOutsideDays = true,
  className
}: DateRangePickerProps) {
  const t = useTranslations('booking.dateRange');

  const [state, setState] = useState<PickerState>({
    currentDate: new Date(),
    hoveredDate: null,
    tempRange: { from: selected?.from || null, to: selected?.to || null },
    isSelecting: false
  });

  // Manejar selección de rango
  const handleRangeSelect = useCallback((range: { from: Date; to: Date }) => {
    setState(prev => ({
      ...prev,
      tempRange: range,
      isSelecting: false
    }));
    
    onSelect?.(range);
  }, [onSelect]);

  // Manejar hover sobre fechas
  const handleDateHover = useCallback((date: Date) => {
    if (disabled) return;
    
    setState(prev => ({
      ...prev,
      hoveredDate: date
    }));
  }, [disabled]);

  // Navegar entre meses
  const navigateMonth = useCallback((direction: 'prev' | 'next') => {
    setState(prev => ({
      ...prev,
      currentDate: direction === 'prev' 
        ? subMonths(prev.currentDate, 1)
        : addMonths(prev.currentDate, 1)
    }));
  }, []);

  // Ir a mes específico
  const goToMonth = useCallback((date: Date) => {
    setState(prev => ({
      ...prev,
      currentDate: date
    }));
  }, []);

  // Resetear selección
  const clearSelection = useCallback(() => {
    setState(prev => ({
      ...prev,
      tempRange: { from: null, to: null },
      isSelecting: false
    }));
  }, []);

  // Verificar si una fecha está deshabilitada
  const isDateDisabled = useCallback((date: Date) => {
    if (disabled) return true;
    const today = startOfDay(new Date());
    return date < today;
  }, [disabled]);

  // Obtener información del rango seleccionado
  const getRangeInfo = useMemo(() => {
    if (!state.tempRange.from || !state.tempRange.to) return null;

    const nights = differenceInDays(state.tempRange.to, state.tempRange.from);
    const seasonInfo = getSeasonMultiplier(state.tempRange.from, state.tempRange.to);

    return {
      nights,
      seasonInfo,
      checkIn: state.tempRange.from,
      checkOut: state.tempRange.to
    };
  }, [state.tempRange]);

  // Sugerencias de rangos predefinidos
  const quickSelections = useMemo(() => {
    const today = startOfDay(new Date());
    
    return [
      {
        label: t('quick.thisWeekend'),
        range: {
          from: today,
          to: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000)
        }
      },
      {
        label: t('quick.nextWeekend'),
        range: {
          from: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000),
          to: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
        }
      },
      {
        label: t('quick.oneWeek'),
        range: {
          from: today,
          to: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
        }
      },
      {
        label: t('quick.twoWeeks'),
        range: {
          from: today,
          to: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
        }
      }
    ];
  }, [t]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header con navegación */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateMonth('prev')}
            disabled={disabled}
          >
            ←
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateMonth('next')}
            disabled={disabled}
          >
            →
          </Button>
        </div>

        {/* Botones de acción */}
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToMonth(new Date())}
            disabled={disabled}
          >
            {t('goToToday')}
          </Button>
          
          {state.tempRange.from && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearSelection}
              disabled={disabled}
            >
              {t('clear')}
            </Button>
          )}
        </div>
      </div>

      {/* Calendarios */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: numberOfMonths }, (_, index) => {
          const monthDate = addMonths(state.currentDate, index);
          
          return (
            <Card key={index} className="p-0">
              <Calendar
                selected={state.tempRange}
                onRangeSelect={handleRangeSelect}
                mode="range"
                disabled={isDateDisabled}
                showSeasonIndicators={true}
                className="w-full"
              />
            </Card>
          );
        })}
      </div>

      {/* Información del rango seleccionado */}
      {getRangeInfo && (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Fechas */}
            <div className="text-center">
              <div className="text-sm text-gray-500 mb-1">{t('selectedRange')}</div>
              <div className="font-medium">
                {format(getRangeInfo.checkIn, 'dd/MM/yyyy', { locale })}
                <span className="mx-2">→</span>
                {format(getRangeInfo.checkOut, 'dd/MM/yyyy', { locale })}
              </div>
            </div>

            {/* Noches */}
            <div className="text-center">
              <div className="text-sm text-gray-500 mb-1">{t('nights')}</div>
              <Badge variant="secondary" className="text-lg px-3 py-1">
                {t('nightsCount', { count: getRangeInfo.nights })}
              </Badge>
            </div>

            {/* Temporada */}
            <div className="text-center">
              <div className="text-sm text-gray-500 mb-1">{t('season')}</div>
              <Badge 
                variant={getRangeInfo.seasonInfo.multiplier > 1 ? 'destructive' : 'default'}
                className="px-3 py-1"
              >
                {getRangeInfo.seasonInfo.seasonName}
                {getRangeInfo.seasonInfo.multiplier !== 1 && (
                  <span className="ml-1">
                    {getRangeInfo.seasonInfo.multiplier > 1 ? '+' : ''}
                    {((getRangeInfo.seasonInfo.multiplier - 1) * 100).toFixed(0)}%
                  </span>
                )}
              </Badge>
            </div>
          </div>

          {/* Advertencia de temporada alta */}
          {getRangeInfo.seasonInfo.minimumNights && 
           getRangeInfo.nights < getRangeInfo.seasonInfo.minimumNights && (
            <div className="mt-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
              <div className="text-sm text-orange-800">
                ⚠️ {t('seasonWarning', {
                  minimum: getRangeInfo.seasonInfo.minimumNights,
                  season: getRangeInfo.seasonInfo.seasonName
                })}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Selecciones rápidas */}
      <Card className="p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          {t('quickSelections')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {quickSelections.map((selection, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => handleRangeSelect(selection.range)}
              disabled={disabled}
              className="text-xs justify-start"
            >
              {selection.label}
            </Button>
          ))}
        </div>
      </Card>

      {/* Información adicional */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">
          {t('info.title')}
        </h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• {t('info.clickStart')}</li>
          <li>• {t('info.clickEnd')}</li>
          <li>• {t('info.quickSelect')}</li>
          <li>• {t('info.seasonIndicator')}</li>
        </ul>
      </div>

      {/* Estado de carga/error */}
      {disabled && (
        <div className="text-center py-4">
          <div className="text-sm text-gray-500">
            {t('loadingAvailability')}
          </div>
        </div>
      )}
    </div>
  );
}
