// lapa-casa-hostel/backend/src/lib/ical/conflict-resolver.ts

import { PrismaClient } from '@prisma/client';
import { ParsedBooking } from '../../integrations/ical/ical-parser';

/**
 * @module ConflictResolver
 * @description Resolves booking conflicts when importing from iCal feeds
 */

const prisma = new PrismaClient();

/**
 * @interface ConflictingBooking
 * @description Represents a booking that conflicts with an import
 */
export interface ConflictingBooking {
  id: string;
  guestName: string;
  checkIn: Date;
  checkOut: Date;
  status: string;
  platform: string;
  source: string;
  createdAt: Date;
}

/**
 * @interface ConflictResolution
 * @description Result of conflict resolution
 */
export interface ConflictResolution {
  canProceed: boolean;
  action: 'keep_existing' | 'replace' | 'merge' | 'skip' | 'block';
  reason: string;
  conflictsResolved: number;
  bookingsModified: string[];
}

/**
 * @type ResolutionStrategy
 * @description Strategy for resolving conflicts
 */
export type ResolutionStrategy = 
  | 'platform_priority'  // Prioritize based on platform hierarchy
  | 'newest_wins'        // Keep the most recent booking
  | 'oldest_wins'        // Keep the oldest booking
  | 'manual'             // Require manual intervention
  | 'ical_priority';     // Always prefer iCal imports

/**
 * @constant PLATFORM_PRIORITY
 * @description Platform priority hierarchy (higher number = higher priority)
 */
const PLATFORM_PRIORITY: Record<string, number> = {
  direct: 100,        // Direct bookings have highest priority
  airbnb: 80,
  booking: 80,
  expedia: 70,
  vrbo: 70,
  hostelworld: 60,
  internal: 50,
  unknown: 10,
};

/**
 * @class ConflictResolver
 * @description Handles resolution of booking conflicts during iCal sync
 */
export class ConflictResolver {
  private strategy: ResolutionStrategy;

  constructor(strategy: ResolutionStrategy = 'platform_priority') {
    this.strategy = strategy;
  }

  /**
   * @method findConflicts
   * @description Finds existing bookings that conflict with a date range
   * @param {string} roomId - Room ID
   * @param {Date} checkIn - Check-in date
   * @param {Date} checkOut - Check-out date
   * @param {string} [excludeId] - Booking ID to exclude from search
   * @returns {Promise<ConflictingBooking[]>} Array of conflicting bookings
   */
  async findConflicts(
    roomId: string,
    checkIn: Date,
    checkOut: Date,
    excludeId?: string
  ): Promise<ConflictingBooking[]> {
    const where: any = {
      roomId,
      status: {
        in: ['confirmed', 'pending', 'blocked'],
      },
      OR: [
        {
          checkIn: {
            gte: checkIn,
            lt: checkOut,
          },
        },
        {
          checkOut: {
            gt: checkIn,
            lte: checkOut,
          },
        },
        {
          AND: [
            { checkIn: { lte: checkIn } },
            { checkOut: { gte: checkOut } },
          ],
        },
      ],
    };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    const conflicts = await prisma.booking.findMany({
      where,
      select: {
        id: true,
        guestName: true,
        checkIn: true,
        checkOut: true,
        status: true,
        platform: true,
        source: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return conflicts;
  }

  /**
   * @method resolveConflicts
   * @description Resolves conflicts between existing bookings and new import
   * @param {ConflictingBooking[]} conflicts - Conflicting bookings
   * @param {ParsedBooking} newBooking - New booking to import
   * @param {string} platform - Platform of new booking
   * @returns {Promise<ConflictResolution>} Resolution result
   */
  async resolveConflicts(
    conflicts: ConflictingBooking[],
    newBooking: ParsedBooking,
    platform: string
  ): Promise<ConflictResolution> {
    if (conflicts.length === 0) {
      return {
        canProceed: true,
        action: 'keep_existing',
        reason: 'No conflicts found',
        conflictsResolved: 0,
        bookingsModified: [],
      };
    }

    switch (this.strategy) {
      case 'platform_priority':
        return await this.resolveBypPlatformPriority(conflicts, newBooking, platform);
      
      case 'newest_wins':
        return await this.resolveByNewest(conflicts, newBooking);
      
      case 'oldest_wins':
        return await this.resolveByOldest(conflicts, newBooking);
      
      case 'ical_priority':
        return await this.resolveByICalPriority(conflicts, newBooking);
      
      case 'manual':
        return {
          canProceed: false,
          action: 'skip',
          reason: 'Manual resolution required',
          conflictsResolved: 0,
          bookingsModified: [],
        };
      
      default:
        return await this.resolveBypPlatformPriority(conflicts, newBooking, platform);
    }
  }

  /**
   * @method resolveBypPlatformPriority
   * @description Resolves conflicts based on platform priority
   * @param {ConflictingBooking[]} conflicts - Conflicting bookings
   * @param {ParsedBooking} newBooking - New booking
   * @param {string} platform - Platform of new booking
   * @returns {Promise<ConflictResolution>} Resolution result
   */
  private async resolveBypPlatformPriority(
    conflicts: ConflictingBooking[],
    newBooking: ParsedBooking,
    platform: string
  ): Promise<ConflictResolution> {
    const newPriority = PLATFORM_PRIORITY[platform.toLowerCase()] || PLATFORM_PRIORITY.unknown;
    const bookingsModified: string[] = [];
    let conflictsResolved = 0;

    for (const conflict of conflicts) {
      const existingPriority = PLATFORM_PRIORITY[conflict.platform.toLowerCase()] || PLATFORM_PRIORITY.unknown;

      if (newPriority > existingPriority) {
        // New booking has higher priority - cancel existing
        await prisma.booking.update({
          where: { id: conflict.id },
          data: {
            status: 'cancelled',
            notes: `Automatically cancelled due to conflict with ${platform} booking`,
          },
        });

        bookingsModified.push(conflict.id);
        conflictsResolved++;
      } else if (newPriority < existingPriority) {
        // Existing booking has higher priority - skip new booking
        return {
          canProceed: false,
          action: 'skip',
          reason: `Existing ${conflict.platform} booking has higher priority`,
          conflictsResolved: 0,
          bookingsModified: [],
        };
      } else {
        // Same priority - use creation date as tiebreaker
        if (conflict.source === 'ical') {
          // Both from iCal - skip to avoid duplication
          return {
            canProceed: false,
            action: 'skip',
            reason: 'Identical priority booking already exists',
            conflictsResolved: 0,
            bookingsModified: [],
          };
        }
      }
    }

    return {
      canProceed: true,
      action: conflictsResolved > 0 ? 'replace' : 'keep_existing',
      reason: `Resolved ${conflictsResolved} conflicts based on platform priority`,
      conflictsResolved,
      bookingsModified,
    };
  }

  /**
   * @method resolveByNewest
   * @description Keeps the newest booking
   * @param {ConflictingBooking[]} conflicts - Conflicting bookings
   * @param {ParsedBooking} newBooking - New booking
   * @returns {Promise<ConflictResolution>} Resolution result
   */
  private async resolveByNewest(
    conflicts: ConflictingBooking[],
    newBooking: ParsedBooking
  ): Promise<ConflictResolution> {
    // Assume new booking is newest
    const bookingsModified: string[] = [];

    for (const conflict of conflicts) {
      await prisma.booking.update({
        where: { id: conflict.id },
        data: {
          status: 'cancelled',
          notes: 'Automatically cancelled - newer booking imported',
        },
      });
      bookingsModified.push(conflict.id);
    }

    return {
      canProceed: true,
      action: 'replace',
      reason: 'Newer booking takes precedence',
      conflictsResolved: conflicts.length,
      bookingsModified,
    };
  }

  /**
   * @method resolveByOldest
   * @description Keeps the oldest booking
   * @param {ConflictingBooking[]} conflicts - Conflicting bookings
   * @param {ParsedBooking} newBooking - New booking
   * @returns {Promise<ConflictResolution>} Resolution result
   */
  private async resolveByOldest(
    conflicts: ConflictingBooking[],
    newBooking: ParsedBooking
  ): Promise<ConflictResolution> {
    // Keep existing (oldest) bookings
    return {
      canProceed: false,
      action: 'skip',
      reason: 'Older booking takes precedence',
      conflictsResolved: 0,
      bookingsModified: [],
    };
  }

  /**
   * @method resolveByICalPriority
   * @description Always prioritizes iCal imports over manual bookings
   * @param {ConflictingBooking[]} conflicts - Conflicting bookings
   * @param {ParsedBooking} newBooking - New booking
   * @returns {Promise<ConflictResolution>} Resolution result
   */
  private async resolveByICalPriority(
    conflicts: ConflictingBooking[],
    newBooking: ParsedBooking
  ): Promise<ConflictResolution> {
    const bookingsModified: string[] = [];

    for (const conflict of conflicts) {
      // Don't cancel other iCal bookings or direct bookings
      if (conflict.source === 'ical' || conflict.platform === 'direct') {
        return {
          canProceed: false,
          action: 'skip',
          reason: `Cannot override ${conflict.source} booking`,
          conflictsResolved: 0,
          bookingsModified: [],
        };
      }

      // Cancel manual bookings
      await prisma.booking.update({
        where: { id: conflict.id },
        data: {
          status: 'cancelled',
          notes: 'Automatically cancelled - iCal booking imported',
        },
      });
      bookingsModified.push(conflict.id);
    }

    return {
      canProceed: true,
      action: 'replace',
      reason: 'iCal import takes precedence over manual bookings',
      conflictsResolved: conflicts.length,
      bookingsModified,
    };
  }

  /**
   * @method setStrategy
   * @description Changes the conflict resolution strategy
   * @param {ResolutionStrategy} strategy - New strategy
   */
  setStrategy(strategy: ResolutionStrategy): void {
    this.strategy = strategy;
  }

  /**
   * @method getStrategy
   * @description Gets the current resolution strategy
   * @returns {ResolutionStrategy} Current strategy
   */
  getStrategy(): ResolutionStrategy {
    return this.strategy;
  }

  /**
   * @method analyzeConflict
   * @description Analyzes a conflict without resolving it
   * @param {ConflictingBooking} existing - Existing booking
   * @param {ParsedBooking} newBooking - New booking
   * @param {string} platform - Platform of new booking
   * @returns {object} Conflict analysis
   */
  analyzeConflict(
    existing: ConflictingBooking,
    newBooking: ParsedBooking,
    platform: string
  ): {
    overlap: { days: number; percentage: number };
    priorityDifference: number;
    recommendation: string;
  } {
    // Calculate overlap
    const overlapStart = new Date(Math.max(existing.checkIn.getTime(), newBooking.checkIn.getTime()));
    const overlapEnd = new Date(Math.min(existing.checkOut.getTime(), newBooking.checkOut.getTime()));
    const overlapDays = Math.max(0, Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)));

    const totalDays = Math.ceil((newBooking.checkOut.getTime() - newBooking.checkIn.getTime()) / (1000 * 60 * 60 * 24));
    const overlapPercentage = (overlapDays / totalDays) * 100;

    // Calculate priority difference
    const newPriority = PLATFORM_PRIORITY[platform.toLowerCase()] || PLATFORM_PRIORITY.unknown;
    const existingPriority = PLATFORM_PRIORITY[existing.platform.toLowerCase()] || PLATFORM_PRIORITY.unknown;
    const priorityDifference = newPriority - existingPriority;

    // Generate recommendation
    let recommendation: string;
    if (priorityDifference > 0) {
      recommendation = 'Replace existing booking with new import';
    } else if (priorityDifference < 0) {
      recommendation = 'Keep existing booking, skip import';
    } else {
      recommendation = 'Equal priority - use secondary criteria';
    }

    return {
      overlap: {
        days: overlapDays,
        percentage: Math.round(overlapPercentage),
      },
      priorityDifference,
      recommendation,
    };
  }

  /**
   * @method findPotentialDuplicates
   * @description Finds potential duplicate bookings
   * @param {string} roomId - Room ID
   * @param {ParsedBooking} booking - Booking to check
   * @returns {Promise<ConflictingBooking[]>} Potential duplicates
   */
  async findPotentialDuplicates(
    roomId: string,
    booking: ParsedBooking
  ): Promise<ConflictingBooking[]> {
    // Look for bookings with exact same dates
    const duplicates = await prisma.booking.findMany({
      where: {
        roomId,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        status: {
          in: ['confirmed', 'pending'],
        },
      },
      select: {
        id: true,
        guestName: true,
        checkIn: true,
        checkOut: true,
        status: true,
        platform: true,
        source: true,
        createdAt: true,
      },
    });

    return duplicates;
  }
}

/**
 * @function createConflictResolver
 * @description Factory function to create a new ConflictResolver instance
 * @param {ResolutionStrategy} [strategy] - Resolution strategy
 * @returns {ConflictResolver} New ConflictResolver instance
 */
export function createConflictResolver(strategy?: ResolutionStrategy): ConflictResolver {
  return new ConflictResolver(strategy);
}

// ✅ Archivo 9/10 completado
