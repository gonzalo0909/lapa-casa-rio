// lapa-casa-hostel/frontend/src/lib/availability/availability-checker.ts

/**
 * Availability Checker Library
 * 
 * Core anti-overbooking logic for Lapa Casa Hostel.
 * Validates room availability and prevents double bookings.
 * 
 * @module lib/availability/availability-checker
 */

/**
 * Room configuration interface
 */
interface Room {
  id: string;
  name: string;
  capacity: number;
  type: 'mixed' | 'female';
  isFlexible: boolean;
}

/**
 * Booking interface
 */
interface Booking {
  id: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  bedsCount: number;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
}

/**
 * Availability result interface
 */
interface AvailabilityResult {
  available: boolean;
  availableRooms: Array<{
    roomId: string;
    roomName: string;
    availableBeds: number;
    totalBeds: number;
  }>;
  totalAvailableBeds: number;
  message?: string;
}

/**
 * Room occupancy map
 */
interface RoomOccupancy {
  [roomId: string]: {
    occupied: number;
    capacity: number;
    room: Room;
  };
}

/**
 * Lapa Casa Hostel room configurations
 */
export const ROOMS: Room[] = [
  {
    id: 'room_mixto_12a',
    name: 'Mixto 12A',
    capacity: 12,
    type: 'mixed',
    isFlexible: false
  },
  {
    id: 'room_mixto_12b',
    name: 'Mixto 12B',
    capacity: 12,
    type: 'mixed',
    isFlexible: false
  },
  {
    id: 'room_mixto_7',
    name: 'Mixto 7',
    capacity: 7,
    type: 'mixed',
    isFlexible: false
  },
  {
    id: 'room_flexible_7',
    name: 'Flexible 7',
    capacity: 7,
    type: 'female',
    isFlexible: true
  }
];

/**
 * Total hostel capacity
 */
export const TOTAL_CAPACITY = 45;

/**
 * Check if two date ranges overlap
 * 
 * @param start1 - Start date of range 1
 * @param end1 - End date of range 1
 * @param start2 - Start date of range 2
 * @param end2 - End date of range 2
 * @returns True if ranges overlap
 * 
 * @example
 * ```ts
 * datesOverlap('2025-01-15', '2025-01-20', '2025-01-18', '2025-01-25') // true
 * datesOverlap('2025-01-15', '2025-01-20', '2025-01-21', '2025-01-25') // false
 * ```
 */
export function datesOverlap(
  start1: string | Date,
  end1: string | Date,
  start2: string | Date,
  end2: string | Date
): boolean {
  const s1 = new Date(start1);
  const e1 = new Date(end1);
  const s2 = new Date(start2);
  const e2 = new Date(end2);

  s1.setHours(0, 0, 0, 0);
  e1.setHours(0, 0, 0, 0);
  s2.setHours(0, 0, 0, 0);
  e2.setHours(0, 0, 0, 0);

  return s1 < e2 && e1 > s2;
}

/**
 * Get hours until a specific date
 * 
 * @param date - Target date
 * @returns Hours until date
 * 
 * @example
 * ```ts
 * getHoursUntilDate('2025-01-20') // Returns number of hours
 * ```
 */
export function getHoursUntilDate(date: string | Date): number {
  const target = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  return diffMs / (1000 * 60 * 60);
}

/**
 * Calculate room occupancy for a date range
 * 
 * @param bookings - Array of existing bookings
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @param excludeBookingId - Booking ID to exclude (for updates)
 * @returns Room occupancy map
 * 
 * @example
 * ```ts
 * const occupancy = calculateRoomOccupancy(bookings, '2025-01-15', '2025-01-20');
 * ```
 */
export function calculateRoomOccupancy(
  bookings: Booking[],
  checkIn: string | Date,
  checkOut: string | Date,
  excludeBookingId?: string
): RoomOccupancy {
  const occupancy: RoomOccupancy = {};

  ROOMS.forEach((room) => {
    occupancy[room.id] = {
      occupied: 0,
      capacity: room.capacity,
      room
    };
  });

  const relevantBookings = bookings.filter((booking) => {
    if (booking.status === 'CANCELLED') return false;
    if (excludeBookingId && booking.id === excludeBookingId) return false;
    return datesOverlap(booking.checkIn, booking.checkOut, checkIn, checkOut);
  });

  relevantBookings.forEach((booking) => {
    if (occupancy[booking.roomId]) {
      occupancy[booking.roomId].occupied += booking.bedsCount;
    }
  });

  return occupancy;
}

/**
 * Handle flexible room auto-conversion logic
 * 
 * @param occupancy - Current room occupancy
 * @param checkIn - Check-in date
 * @returns Updated occupancy with flexible room handled
 * 
 * @example
 * ```ts
 * const updated = handleFlexibleRoom(occupancy, '2025-01-15');
 * ```
 */
export function handleFlexibleRoom(
  occupancy: RoomOccupancy,
  checkIn: string | Date
): RoomOccupancy {
  const flexibleRoom = occupancy['room_flexible_7'];

  if (!flexibleRoom) return occupancy;

  const hoursUntilCheckIn = getHoursUntilDate(checkIn);

  if (flexibleRoom.occupied === 0 && hoursUntilCheckIn <= 48) {
    flexibleRoom.room = {
      ...flexibleRoom.room,
      type: 'mixed'
    };
  }

  return occupancy;
}

/**
 * Check availability for specific beds requirement
 * 
 * @param bookings - Array of existing bookings
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @param requestedBeds - Number of beds requested
 * @param excludeBookingId - Booking ID to exclude (for updates)
 * @returns Availability result
 * 
 * @example
 * ```ts
 * const result = checkAvailability(bookings, '2025-01-15', '2025-01-20', 12);
 * if (result.available) {
 *   console.log('Booking possible!');
 * }
 * ```
 */
export function checkAvailability(
  bookings: Booking[],
  checkIn: string | Date,
  checkOut: string | Date,
  requestedBeds: number,
  excludeBookingId?: string
): AvailabilityResult {
  if (requestedBeds <= 0) {
    return {
      available: false,
      availableRooms: [],
      totalAvailableBeds: 0,
      message: 'Invalid number of beds requested'
    };
  }

  if (requestedBeds > TOTAL_CAPACITY) {
    return {
      available: false,
      availableRooms: [],
      totalAvailableBeds: 0,
      message: `Maximum capacity is ${TOTAL_CAPACITY} beds`
    };
  }

  let occupancy = calculateRoomOccupancy(bookings, checkIn, checkOut, excludeBookingId);

  occupancy = handleFlexibleRoom(occupancy, checkIn);

  const availableRooms = Object.entries(occupancy).map(([roomId, data]) => ({
    roomId,
    roomName: data.room.name,
    availableBeds: data.capacity - data.occupied,
    totalBeds: data.capacity
  }));

  const totalAvailableBeds = availableRooms.reduce(
    (sum, room) => sum + room.availableBeds,
    0
  );

  const available = totalAvailableBeds >= requestedBeds;

  return {
    available,
    availableRooms: availableRooms.filter((room) => room.availableBeds > 0),
    totalAvailableBeds,
    message: available
      ? `${totalAvailableBeds} beds available`
      : `Only ${totalAvailableBeds} beds available (requested ${requestedBeds})`
  };
}

/**
 * Get available rooms for specific date range
 * 
 * @param bookings - Array of existing bookings
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @returns Array of available rooms with capacity
 * 
 * @example
 * ```ts
 * const rooms = getAvailableRooms(bookings, '2025-01-15', '2025-01-20');
 * ```
 */
export function getAvailableRooms(
  bookings: Booking[],
  checkIn: string | Date,
  checkOut: string | Date
): Array<{
  roomId: string;
  roomName: string;
  roomType: 'mixed' | 'female';
  availableBeds: number;
  totalBeds: number;
  isFlexible: boolean;
}> {
  let occupancy = calculateRoomOccupancy(bookings, checkIn, checkOut);
  occupancy = handleFlexibleRoom(occupancy, checkIn);

  return Object.entries(occupancy)
    .map(([roomId, data]) => ({
      roomId,
      roomName: data.room.name,
      roomType: data.room.type,
      availableBeds: data.capacity - data.occupied,
      totalBeds: data.capacity,
      isFlexible: data.room.isFlexible
    }))
    .filter((room) => room.availableBeds > 0);
}

/**
 * Validate booking doesn't cause overbooking
 * 
 * @param bookings - Existing bookings
 * @param newBooking - New booking to validate
 * @returns Validation result
 * 
 * @example
 * ```ts
 * const validation = validateBooking(existingBookings, {
 *   roomId: 'room_mixto_12a',
 *   checkIn: '2025-01-15',
 *   checkOut: '2025-01-20',
 *   bedsCount: 12
 * });
 * ```
 */
export function validateBooking(
  bookings: Booking[],
  newBooking: {
    roomId: string;
    checkIn: string | Date;
    checkOut: string | Date;
    bedsCount: number;
  }
): { valid: boolean; error?: string } {
  const room = ROOMS.find((r) => r.id === newBooking.roomId);

  if (!room) {
    return { valid: false, error: 'Room not found' };
  }

  if (newBooking.bedsCount > room.capacity) {
    return {
      valid: false,
      error: `Room ${room.name} has maximum capacity of ${room.capacity} beds`
    };
  }

  const occupancy = calculateRoomOccupancy(
    bookings,
    newBooking.checkIn,
    newBooking.checkOut
  );

  const roomOccupancy = occupancy[newBooking.roomId];
  const availableBeds = roomOccupancy.capacity - roomOccupancy.occupied;

  if (newBooking.bedsCount > availableBeds) {
    return {
      valid: false,
      error: `Only ${availableBeds} beds available in ${room.name}`
    };
  }

  return { valid: true };
}

/**
 * Get total hostel occupancy for date range
 * 
 * @param bookings - Array of bookings
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @returns Occupancy statistics
 * 
 * @example
 * ```ts
 * const stats = getOccupancyStats(bookings, '2025-01-15', '2025-01-20');
 * console.log(`${stats.occupancyPercentage}% occupied`);
 * ```
 */
export function getOccupancyStats(
  bookings: Booking[],
  checkIn: string | Date,
  checkOut: string | Date
): {
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  occupancyPercentage: number;
} {
  const occupancy = calculateRoomOccupancy(bookings, checkIn, checkOut);

  const occupiedBeds = Object.values(occupancy).reduce(
    (sum, room) => sum + room.occupied,
    0
  );

  const availableBeds = TOTAL_CAPACITY - occupiedBeds;
  const occupancyPercentage = Math.round((occupiedBeds / TOTAL_CAPACITY) * 100);

  return {
    totalBeds: TOTAL_CAPACITY,
    occupiedBeds,
    availableBeds,
    occupancyPercentage
  };
}
