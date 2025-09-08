export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AvailabilityRequest {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

export interface AvailabilityResponse {
  from: string;
  to: string;
  rooms: RoomAvailability[];
  occupied: OccupiedBeds;
}

export interface RoomAvailability {
  roomId: number;
  name: string;
  totalBeds: number;
  availableBeds: number[];
  occupiedBeds: number[];
  femaleOnly: boolean;
  basePrice: number;
}

export interface OccupiedBeds {
  [roomId: number]: number[];
}

export interface BookingRequest {
  guest: GuestInfo;
  dates: {
    entrada: string;
    salida: string;
  };
  guests: {
    hombres: number;
    mujeres: number;
  };
  beds: BedSelection[];
  totalPrice: number;
}

export interface GuestInfo {
  nombre: string;
  email: string;
  telefono: string;
}

export interface BedSelection {
  roomId: number;
  bedNumber: number;
}

export interface HoldRequest {
  beds: BedSelection[];
  expiresInMinutes?: number;
}

export interface HoldResponse {
  holdId: string;
  expiresAt: string;
  beds: BedSelection[];
}
