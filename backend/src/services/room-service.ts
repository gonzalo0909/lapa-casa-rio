// lapa-casa-hostel/backend/src/services/room-service.ts
//
// Extraido de routes/rooms/list-rooms.ts y routes/rooms/get-room.ts
// (Ventana 2, entregable 5). room_types y beds son la unica fuente de
// verdad -- este servicio nunca inventa habitaciones ni IDs.
//
// De paso corrige el mismo bug que tenia list-rooms.ts antes de
// reescribirse: get-room.ts todavia usaba 4 habitaciones hardcodeadas
// con IDs ficticios ("room_mixto_12a") que nunca matchean un UUID real
// de room_types -- GET /api/rooms/:id con un ID real devolvia 404
// siempre. Se corrige aca, no solo en list-rooms.ts.

import { query } from '../config/database';
import { availabilityService } from './availability-service';

export const ROOM_CONTENT: Record<string, {
  description: { en: string; pt: string; es: string };
  amenities: string[];
  floor: number;
  features: { windowView: boolean; ensuiteBathroom: boolean; balcony: boolean };
  flexibleRoomPolicy?: {
    defaultType: string;
    autoConvertType: string;
    autoConvertHours: number;
    description: { en: string; pt: string; es: string };
  };
}> = {
  mixto_12a: {
    description: {
      en: 'Mixed dormitory with 12 beds, air conditioning and lockers',
      pt: 'Dormitório misto com 12 camas, ar condicionado e armários',
      es: 'Dormitorio mixto con 12 camas, aire acondicionado y casilleros'
    },
    amenities: ['Air conditioning', 'Individual lockers', 'Reading lights', 'Power outlets', 'Free Wi-Fi', 'Shared bathroom'],
    floor: 1,
    features: { windowView: true, ensuiteBathroom: false, balcony: false }
  },
  mixto_12b: {
    description: {
      en: 'Mixed dormitory with 12 beds, air conditioning and lockers',
      pt: 'Dormitório misto com 12 camas, ar condicionado e armários',
      es: 'Dormitorio mixto con 12 camas, aire acondicionado y casilleros'
    },
    amenities: ['Air conditioning', 'Individual lockers', 'Reading lights', 'Power outlets', 'Free Wi-Fi', 'Shared bathroom'],
    floor: 1,
    features: { windowView: true, ensuiteBathroom: false, balcony: false }
  },
  mixto_7: {
    description: {
      en: 'Mixed dormitory with 7 beds, air conditioning and lockers',
      pt: 'Dormitório misto com 7 camas, ar condicionado e armários',
      es: 'Dormitorio mixto con 7 camas, aire acondicionado y casilleros'
    },
    amenities: ['Air conditioning', 'Individual lockers', 'Reading lights', 'Power outlets', 'Free Wi-Fi', 'Shared bathroom'],
    floor: 2,
    features: { windowView: true, ensuiteBathroom: false, balcony: false }
  },
  mixto_7c: {
    description: {
      en: 'Mixed dormitory with 7 beds, air conditioning and lockers',
      pt: 'Dormitório misto com 7 camas, ar condicionado e armários',
      es: 'Dormitorio mixto con 7 camas, aire acondicionado y casilleros'
    },
    amenities: ['Air conditioning', 'Individual lockers', 'Reading lights', 'Power outlets', 'Free Wi-Fi', 'Shared bathroom'],
    floor: 2,
    features: { windowView: true, ensuiteBathroom: false, balcony: false }
  },
  flexible_7: {
    description: {
      en: 'Female dormitory with 7 beds (converts to mixed 48h before if no female bookings)',
      pt: 'Dormitório feminino com 7 camas (converte para misto 48h antes se sem reservas femininas)',
      es: 'Dormitorio femenino con 7 camas (convierte a mixto 48h antes si sin reservas femeninas)'
    },
    amenities: ['Air conditioning', 'Individual lockers', 'Reading lights', 'Power outlets', 'Free Wi-Fi', 'Shared bathroom'],
    floor: 2,
    features: { windowView: true, ensuiteBathroom: false, balcony: true },
    flexibleRoomPolicy: {
      defaultType: 'female',
      autoConvertType: 'mixed',
      autoConvertHours: 48,
      description: {
        en: 'Automatically converts to mixed dormitory 48 hours before check-in if no female bookings',
        pt: 'Converte automaticamente para dormitório misto 48 horas antes do check-in se sem reservas femininas',
        es: 'Convierte automáticamente a dormitorio mixto 48 horas antes del check-in si sin reservas femeninas'
      }
    }
  }
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RoomTypeRow {
  id: string;
  code: string;
  name: string;
  capacity: number;
  default_gender: string;
  is_flexible: boolean;
  base_price: string;
}

export interface RoomSummary {
  id: string;
  code: string;
  name: string;
  type: string;
  capacity: number;
  isFlexible: boolean;
  basePrice: number;
  currency: 'BRL';
  description: { en: string; pt: string; es: string };
  amenities: string[];
  floor: number;
  features: { windowView: boolean; ensuiteBathroom: boolean; balcony: boolean };
  flexibleRoomPolicy?: unknown;
}

const mergeContent = (r: RoomTypeRow): RoomSummary => {
  const content = ROOM_CONTENT[r.code] ?? {
    description: { en: '', pt: '', es: '' },
    amenities: [],
    floor: 1,
    features: { windowView: true, ensuiteBathroom: false, balcony: false }
  };
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    type: r.default_gender,
    capacity: r.capacity,
    isFlexible: r.is_flexible,
    basePrice: parseFloat(r.base_price),
    currency: 'BRL',
    ...content
  };
};

export class RoomService {
  /** Las 5 habitaciones reales, con contenido descriptivo mergeado por `code`. */
  async getRooms(): Promise<RoomSummary[]> {
    const { rows } = await query<RoomTypeRow>(
      `SELECT id, code, name, capacity, default_gender, is_flexible, base_price
       FROM room_types ORDER BY capacity, code`
    );
    return rows.map(mergeContent);
  }

  /** Detalle de una habitacion real (UUID), con sus camas y estado. Null si no existe. */
  async getRoom(roomId: string): Promise<(RoomSummary & {
    beds: Array<{ id: string; bedCode: string; isActive: boolean }>;
  }) | null> {
    if (!UUID_RE.test(roomId)) return null;

    const { rows } = await query<RoomTypeRow>(
      `SELECT id, code, name, capacity, default_gender, is_flexible, base_price
       FROM room_types WHERE id = $1::uuid`,
      [roomId]
    );
    if (rows.length === 0) return null;

    const { rows: bedRows } = await query<{ id: string; bed_code: string; is_active: boolean }>(
      `SELECT id, bed_code, is_active FROM beds WHERE room_type_id = $1::uuid ORDER BY bed_code`,
      [roomId]
    );

    return {
      ...mergeContent(rows[0]),
      beds: bedRows.map((b) => ({ id: b.id, bedCode: b.bed_code, isActive: b.is_active }))
    };
  }

  /**
   * Prediccion de conversion de Flexible 7 para las proximas 48h, dia por
   * dia -- delega en availabilityService.getFlexibleRoomStatus (que a su
   * vez invoca get_flexible_room_status() SQL), nunca reimplementa la
   * regla de conversion (Requisito Critico #6).
   */
  async getFlexibleRoomPrediction(): Promise<Array<{
    date: string;
    effectiveGender: string;
    isConverted: boolean;
    hoursUntilCheckin: number;
    willConvertPrediction: boolean | null;
  }>> {
    const { rows } = await query<{ id: string }>(
      `SELECT id FROM room_types WHERE is_flexible = true LIMIT 1`
    );
    if (rows.length === 0) return [];
    const flexibleRoomId = rows[0].id;

    const today = new Date();
    const predictions = [];
    for (let offset = 0; offset <= 2; offset++) {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      const dateStr = d.toISOString().slice(0, 10);
      const status = await availabilityService.getFlexibleRoomStatus(flexibleRoomId, dateStr);
      predictions.push({ date: dateStr, ...status });
    }
    return predictions;
  }

  /** Actualiza configuracion editable de una habitacion. Hoy solo el precio base. */
  async updateRoomSettings(roomId: string, settings: { basePrice?: number }): Promise<RoomSummary | null> {
    if (settings.basePrice === undefined) {
      const room = await this.getRoom(roomId);
      return room;
    }
    const { rows } = await query<RoomTypeRow>(
      `UPDATE room_types SET base_price = $2::numeric, updated_at = NOW()
       WHERE id = $1::uuid
       RETURNING id, code, name, capacity, default_gender, is_flexible, base_price`,
      [roomId, settings.basePrice]
    );
    if (rows.length === 0) return null;
    return mergeContent(rows[0]);
  }
}

export const roomService = new RoomService();
