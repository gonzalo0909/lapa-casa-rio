// lapa-casa-hostel/frontend/src/hooks/use-availability.ts

import { useCallback, useState } from 'react';
import { availabilityAPI, handleAPIError } from '@/lib/api';
import type { GroupDiscountTier, RoomAvailability } from '@/types/global';

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

interface BackendRoom {
  roomId: string;
  name: string;
  type: 'mixed' | 'female' | 'male';
  capacity: number;
  availableBeds: number;
  isFlexible: boolean;
  basePrice: number;
}

export function useAvailability() {
  const [availableRooms, setAvailableRooms] = useState<RoomAvailability[]>([]);
  const [groupDiscountTiers, setGroupDiscountTiers] = useState<GroupDiscountTier[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Consulta disponibilidad real contra GET /api/v1/availability/check.
   * `beds` es solo para calcular las opciones de asignación sugeridas —
   * la lista de habitaciones con su disponibilidad real viene siempre completa.
   */
  const checkAvailability = useCallback(async (checkIn: Date, checkOut: Date, beds = 1) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await availabilityAPI.check({
        checkIn: toDateOnly(checkIn),
        checkOut: toDateOnly(checkOut),
        beds,
      });

      const rooms: BackendRoom[] = response.data?.rooms || [];

      setAvailableRooms(
        rooms.map((r) => ({
          id: r.roomId,
          code: r.roomId,
          name: r.name,
          type: r.type,
          capacity: r.capacity,
          availableBeds: r.availableBeds,
          basePrice: r.basePrice,
          isFlexible: r.isFlexible,
        }))
      );
      setGroupDiscountTiers(response.data?.groupDiscountTiers || []);
    } catch (err) {
      setError(handleAPIError(err));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { availableRooms, groupDiscountTiers, isLoading, error, checkAvailability };
}
