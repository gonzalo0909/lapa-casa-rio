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
