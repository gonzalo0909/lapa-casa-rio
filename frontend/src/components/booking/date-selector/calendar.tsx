// lapa-casa-hostel-frontend/src/components/booking/date-selector/calendar.tsx

'use client';

import React, { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isToday, 
  isBefore, 
  isAfter,
  addMonths,
  subMonths
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { getSeasonMultiplier } from '../../../lib/pricing';
import { cn } from '../../../lib/utils';

interface CalendarProps {
  selected?: {
    from: Date | null;
    to: Date | null;
  };
  onSelect?: (date: Date) => void;
  onRangeSelect?: (range: { from: Date; to: Date }) => void;
  mode?: 'single' | 'range';
  disabled?: (date: Date) => boolean;
  showSeasonIndicators?: boolean;
  className?: string;
}

interface CalendarState {
  currentMonth: Date;
  hoveredDate: Date | null;
  selectingRange: boolean;
  rangeStart: Date | null;
}

export function Calendar({
  selected,
  onSelect,
  onRangeSelect,
  mode = 'range',
  disabled,
  showSeasonIndicators = true,
  className
}: CalendarProps) {
  const t = useTranslations('booking.calendar');

  const [state, setState] = useState<CalendarState>({
    currentMonth: new Date(),
    hoveredDate: null,
    selectingRange: false,
    rangeStart: null
  });

  // Navegar meses
  const navigateMonth = useCallback((direction: 'prev' | 'next') => {
    setState(prev => ({
      ...prev,
      currentMonth: direction === 'prev' 
        ? subMonths(prev.currentMonth, 1)
        : addMonths(prev.currentMonth, 1)
    }));
  }, []);

  // Manejar click en fecha
  const handleDateClick = useCallback((date: Date) => {
    if (disabled && disabled(date)) return;

    if (mode === 'single') {
      onSelect?.(date);
      return;
    }

    // Modo range
    if (!state.selectingRange) {
      setState(prev => ({
        ...prev,
        selectingRange: true,
        rangeStart: date
      }));
    } else {
      const rangeStart = state.rangeStart!;
      const rangeEnd = date;
      
      if (isBefore(rangeEnd, rangeStart)) {
        // Si la fecha final es anterior, intercambiar
        onRangeSelect?.({ from: rangeEnd, to: rangeStart });
      } else {
        onRangeSelect?.({ from: rangeStart, to: rangeEnd });
      }
      
      setState(prev => ({
        ...prev,
        selectingRange: false,
        rangeStart: null
      }));
    }
  }, [mode, disabled, onSelect, onRangeSelect, state.selectingRange, state.rangeStart]);

  // Manejar hover
  const handleDateHover = useCallback((date: Date) => {
    setState(prev => ({
      ...prev,
      hoveredDate: date
    }));
  }, []);

  // Obtener días del mes
  const getCalendarDays = useCallback(() => {
    const monthStart = startOfMonth(state.currentMonth);
    const monthEnd = endOfMonth(state.currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [state.currentMonth]);

  // Verificar si una fecha está en el rango seleccionado
  const isInRange = useCallback((date: Date) => {
    if (!selected?.from || !selected?.to) return false;
    return !isBefore(date, selected.from) && !isAfter(date, selected.to);
  }, [selected]);

  // Verificar si una fecha está en el rango siendo seleccionado
  const isInPreviewRange = useCallback((date: Date) => {
    if (!state.selectingRange || !state.rangeStart || !state.hoveredDate) return false;
    
    const start = state.rangeStart;
    const end = state.hoveredDate;
    
    if (isBefore(end, start)) {
      return !isBefore(date, end) && !isAfter(date, start);
    } else {
      return !isBefore(date, start) && !isAfter(date, end);
    }
  }, [state.selectingRange, state.rangeStart, state.hoveredDate]);

  // Obtener información de temporada para una fecha
  const getSeasonInfo = useCallback((date: Date) => {
    if (!showSeasonIndicators) return null;
    return getSeasonMultiplier(date, date);
  }, [showSeasonIndicators]);

  // Verificar si una fecha está deshabilitada
  const isDateDisabled = useCallback((date: Date) => {
    if (disabled && disabled(date)) return true;
    if (isBefore(date, new Date().setHours(0, 0, 0, 0))) return true;
    return false;
  }, [disabled]);

  const calendarDays = getCalendarDays();
  const today = new Date();

  return (
    <div className={cn('p-4', className)}>
      {/* Header del calendario */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigateMonth('prev')}
        >
          ←
        </Button>
        
        <h3 className="text-lg font-semibold">
          {format(state.currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </h3>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigateMonth('next')}
        >
          →
        </Button>
      </div>

      {/* Días de la semana */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
          <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
            {day}
          </div>
        ))}
      </div>

      {/* Días del calendario */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((date) => {
          const isCurrentMonth = isSameMonth(date, state.currentMonth);
          const isSelected = selected?.from && isSameDay(date, selected.from) || 
                           selected?.to && isSameDay(date, selected.to);
          const isRangeSelected = isInRange(date);
          const isPreviewRange = isInPreviewRange(date);
          const isDisabled = isDateDisabled(date);
          const isTodayDate = isToday(date);
          const seasonInfo = getSeasonInfo(date);

          return (
            <div
              key={date.toISOString()}
              className={cn(
                'relative p-1 text-center cursor-pointer transition-colors',
                {
                  'text-gray-300': !isCurrentMonth,
                  'text-gray-900': isCurrentMonth && !isDisabled,
                  'text-gray-400 cursor-not-allowed': isDisabled,
                  'bg-blue-600 text-white': isSelected,
                  'bg-blue-100': isRangeSelected && !isSelected,
                  'bg-blue-50': isPreviewRange && !isRangeSelected,
                  'ring-2 ring-blue-600': isTodayDate && !isSelected
                }
              )}
              onClick={() => !isDisabled && handleDateClick(date)}
              onMouseEnter={() => !isDisabled && handleDateHover(date)}
            >
              <div className="h-8 w-8 flex items-center justify-center rounded text-sm font-medium">
                {format(date, 'd')}
              </div>

              {/* Indicador de temporada */}
              {seasonInfo && seasonInfo.multiplier !== 1 && isCurrentMonth && (
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2">
                  <div
                    className={cn(
                      'w-1 h-1 rounded-full',
                      {
                        'bg-red-500': seasonInfo.multiplier > 1.5,
                        'bg-orange-500': seasonInfo.multiplier > 1 && seasonInfo.multiplier <= 1.5,
                        'bg-green-500': seasonInfo.multiplier < 1
                      }
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Leyenda de temporadas */}
      {showSeasonIndicators && (
        <div className="mt-4 pt-4 border-t">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            {t('seasonLegend.title')}
          </h4>
          <div className="flex flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              <span className="text-gray-600">{t('seasonLegend.high')}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-orange-500 rounded-full" />
              <span className="text-gray-600">{t('seasonLegend.medium')}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-gray-600">{t('seasonLegend.low')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Información del rango seleccionado */}
      {selected?.from && selected?.to && (
        <div className="mt-4 pt-4 border-t">
          <div className="text-sm text-gray-600 text-center">
            <div>
              <strong>{format(selected.from, 'dd/MM/yyyy')}</strong>
              {' → '}
              <strong>{format(selected.to, 'dd/MM/yyyy')}</strong>
            </div>
            <div className="mt-1">
              {t('nightsSelected', { 
                count: Math.ceil((selected.to.getTime() - selected.from.getTime()) / (1000 * 60 * 60 * 24))
              })}
            </div>
          </div>
        </div>
      )}

      {/* Estado de selección en progreso */}
      {state.selectingRange && state.rangeStart && (
        <div className="mt-4 pt-4 border-t">
          <div className="text-sm text-blue-600 text-center">
            {t('selectingRange', {
              start: format(state.rangeStart, 'dd/MM/yyyy')
            })}
          </div>
        </div>
      )}

      {/* Shortcuts rápidos */}
      <div className="mt-4 pt-4 border-t">
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          {t('quickSelect.title')}
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const from = new Date();
              const to = new Date();
              to.setDate(to.getDate() + 2);
              onRangeSelect?.({ from, to });
            }}
            className="text-xs"
          >
            {t('quickSelect.weekend')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const from = new Date();
              const to = new Date();
              to.setDate(to.getDate() + 7);
              onRangeSelect?.({ from, to });
            }}
            className="text-xs"
          >
            {t('quickSelect.week')}
          </Button>
        </div>
      </div>
    </div>
  );
}
