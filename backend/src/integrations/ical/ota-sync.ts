// lapa-casa-hostel/backend/src/integrations/ical/ota-sync.ts

import { PrismaClient } from '@prisma/client';
import { ICalParser, ParsedBooking } from './ical-parser';
import { ConflictResolver } from '../../lib/ical/conflict-resolver';

/**
 * @module OTASync
 * @description Synchronizes bookings from OTA platforms via iCal feeds
 */

const prisma = new PrismaClient();

/**
 * @interface SyncFeed
 * @description iCal feed configuration from database
 */
interface SyncFeed {
  id: string;
  name: string;
  url: string;
  roomId: string;
  platform: string;
  isActive: boolean;
  lastSyncAt?: Date | null;
}

/**
 * @interface SyncResult
 * @description Result of a sync operation
 */
export interface SyncResult {
  feedId: string;
  feedName: string;
  success: boolean;
  bookingsImported: number;
  bookingsUpdated: number;
  bookingsSkipped: number;
  blockedDatesCreated: number;
  conflictsResolved: number;
  errors: string[];
  syncedAt: Date;
}

/**
 * @interface BatchSyncResult
 * @description Result of syncing multiple feeds
 */
export interface BatchSyncResult {
  totalFeeds: number;
  successfulFeeds: number;
  failedFeeds: number;
  totalBookingsImported: number;
  totalBookingsUpdated: number;
  totalBlockedDates: number;
  results: SyncResult[];
  errors: string[];
}

/**
 * @class OTASync
 * @description Handles synchronization of bookings from OTA platforms
 */
export class OTASync {
  private parser: ICalParser;
  private conflictResolver: ConflictResolver;

  constructor() {
    this.parser = new ICalParser();
    this.conflictResolver = new ConflictResolver();
  }

  /**
   * @method syncFeed
   * @description Synchronizes a single iCal feed
   * @param {string} feedId - Feed ID to sync
   * @returns {Promise<SyncResult>} Sync result
   */
  async syncFeed(feedId: string): Promise<SyncResult> {
    const errors: string[] = [];
    const syncedAt = new Date();

    try {
      // Fetch feed configuration
      const feed = await this.getFeed(feedId);

      if (!feed) {
        throw new Error(`Feed not found: ${feedId}`);
      }

      if (!feed.isActive) {
        throw new Error(`Feed is not active: ${feed.name}`);
      }

      // Parse iCal feed
      const parseResult = await this.parser.parseFromUrl(feed.url, feed.platform);

      if (!parseResult.success) {
        throw new Error(`Parse failed: ${parseResult.errors.join(', ')}`);
      }

      // Add any parse warnings to errors
      errors.push(...parseResult.errors);

      // Process bookings
      const processResult = await this.processBookings(
        parseResult.bookings,
        feed.roomId,
        feed.platform,
        feed.id
      );

      // Update feed last sync time
      await prisma.iCalFeed.update({
        where: { id: feedId },
        data: {
          lastSyncAt: syncedAt,
          lastSyncStatus: 'success',
          lastSyncError: null,
        },
      });

      return {
        feedId: feed.id,
        feedName: feed.name,
        success: true,
        bookingsImported: processResult.imported,
        bookingsUpdated: processResult.updated,
        bookingsSkipped: processResult.skipped,
        blockedDatesCreated: processResult.blockedDates,
        conflictsResolved: processResult.conflictsResolved,
        errors,
        syncedAt,
      };
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      errors.push(errorMessage);

      // Update feed with error status
      try {
        await prisma.iCalFeed.update({
          where: { id: feedId },
          data: {
            lastSyncAt: syncedAt,
            lastSyncStatus: 'error',
            lastSyncError: errorMessage,
          },
        });
      } catch (updateError) {
        console.error('Failed to update feed error status:', updateError);
      }

      return {
        feedId,
        feedName: 'Unknown',
        success: false,
        bookingsImported: 0,
        bookingsUpdated: 0,
        bookingsSkipped: 0,
        blockedDatesCreated: 0,
        conflictsResolved: 0,
        errors,
        syncedAt,
      };
    }
  }

  /**
   * @method syncAllActiveFeeds
   * @description Synchronizes all active feeds
   * @returns {Promise<BatchSyncResult>} Batch sync result
   */
  async syncAllActiveFeeds(): Promise<BatchSyncResult> {
    const errors: string[] = [];

    try {
      // Fetch all active feeds
      const feeds = await prisma.iCalFeed.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          url: true,
          roomId: true,
          platform: true,
          isActive: true,
          lastSyncAt: true,
        },
      });

      if (feeds.length === 0) {
        return {
          totalFeeds: 0,
          successfulFeeds: 0,
          failedFeeds: 0,
          totalBookingsImported: 0,
          totalBookingsUpdated: 0,
          totalBlockedDates: 0,
          results: [],
          errors: ['No active feeds found'],
        };
      }

      // Sync each feed
      const results: SyncResult[] = [];

      for (const feed of feeds) {
        try {
          const result = await this.syncFeed(feed.id);
          results.push(result);
        } catch (error) {
          const errorMessage = `Feed ${feed.name}: ${this.getErrorMessage(error)}`;
          errors.push(errorMessage);

          results.push({
            feedId: feed.id,
            feedName: feed.name,
            success: false,
            bookingsImported: 0,
            bookingsUpdated: 0,
            bookingsSkipped: 0,
            blockedDatesCreated: 0,
            conflictsResolved: 0,
            errors: [errorMessage],
            syncedAt: new Date(),
          });
        }
      }

      // Calculate totals
      const successfulFeeds = results.filter(r => r.success).length;
      const failedFeeds = results.filter(r => !r.success).length;
      const totalBookingsImported = results.reduce((sum, r) => sum + r.bookingsImported, 0);
      const totalBookingsUpdated = results.reduce((sum, r) => sum + r.bookingsUpdated, 0);
      const totalBlockedDates = results.reduce((sum, r) => sum + r.blockedDatesCreated, 0);

      return {
        totalFeeds: feeds.length,
        successfulFeeds,
        failedFeeds,
        totalBookingsImported,
        totalBookingsUpdated,
        totalBlockedDates,
        results,
        errors,
      };
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      errors.push(errorMessage);

      return {
        totalFeeds: 0,
        successfulFeeds: 0,
        failedFeeds: 0,
        totalBookingsImported: 0,
        totalBookingsUpdated: 0,
        totalBlockedDates: 0,
        results: [],
        errors,
      };
    }
  }

  /**
   * @method processBookings
   * @description Processes parsed bookings and saves to database
   * @param {ParsedBooking[]} bookings - Parsed bookings
   * @param {string} roomId - Room ID
   * @param {string} platform - Platform name
   * @param {string} feedId - Feed ID
   * @returns {Promise<object>} Processing statistics
   */
  private async processBookings(
    bookings: ParsedBooking[],
    roomId: string,
    platform: string,
    feedId: string
  ): Promise<{
    imported: number;
    updated: number;
    skipped: number;
    blockedDates: number;
    conflictsResolved: number;
  }> {
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let blockedDates = 0;
    let conflictsResolved = 0;

    for (const booking of bookings) {
      try {
        // Validate booking
        if (!this.parser.validateBooking(booking)) {
          skipped++;
          continue;
        }

        // Check for conflicts
        const conflicts = await this.conflictResolver.findConflicts(
          roomId,
          booking.checkIn,
          booking.checkOut
        );

        if (conflicts.length > 0) {
          // Resolve conflicts
          const resolution = await this.conflictResolver.resolveConflicts(
            conflicts,
            booking,
            platform
          );

          conflictsResolved += resolution.conflictsResolved;

          // Skip if resolution failed
          if (!resolution.canProceed) {
            skipped++;
            continue;
          }
        }

        // Check if booking already exists
        const existing = await prisma.booking.findFirst({
          where: {
            externalId: booking.externalId,
            platform,
          },
        });

        if (existing) {
          // Update existing booking
          await prisma.booking.update({
            where: { id: existing.id },
            data: {
              guestName: booking.guestName,
              checkIn: booking.checkIn,
              checkOut: booking.checkOut,
              status: booking.status,
              adults: booking.adults,
              children: booking.children,
              notes: booking.notes,
              updatedAt: new Date(),
            },
          });
          updated++;
        } else {
          // Create new booking
          await prisma.booking.create({
            data: {
              externalId: booking.externalId,
              roomId,
              guestName: booking.guestName,
              checkIn: booking.checkIn,
              checkOut: booking.checkOut,
              status: booking.status,
              platform,
              adults: booking.adults || 1,
              children: booking.children || 0,
              notes: booking.notes,
              source: 'ical',
              iCalFeedId: feedId,
            },
          });

          if (booking.status === 'blocked') {
            blockedDates++;
          } else {
            imported++;
          }
        }
      } catch (error) {
        console.error(`Failed to process booking ${booking.externalId}:`, error);
        skipped++;
      }
    }

    return {
      imported,
      updated,
      skipped,
      blockedDates,
      conflictsResolved,
    };
  }

  /**
   * @method getFeed
   * @description Fetches feed configuration from database
   * @param {string} feedId - Feed ID
   * @returns {Promise<SyncFeed | null>} Feed configuration or null
   */
  private async getFeed(feedId: string): Promise<SyncFeed | null> {
    const feed = await prisma.iCalFeed.findUnique({
      where: { id: feedId },
      select: {
        id: true,
        name: true,
        url: true,
        roomId: true,
        platform: true,
        isActive: true,
        lastSyncAt: true,
      },
    });

    return feed;
  }

  /**
   * @method cleanupOldBookings
   * @description Removes old imported bookings that are no longer in the feed
   * @param {string} feedId - Feed ID
   * @param {Date} cutoffDate - Cutoff date (remove bookings before this date)
   * @returns {Promise<number>} Number of bookings removed
   */
  async cleanupOldBookings(feedId: string, cutoffDate: Date): Promise<number> {
    try {
      const result = await prisma.booking.deleteMany({
        where: {
          iCalFeedId: feedId,
          checkOut: {
            lt: cutoffDate,
          },
          source: 'ical',
        },
      });

      return result.count;
    } catch (error) {
      console.error('Failed to cleanup old bookings:', error);
      return 0;
    }
  }

  /**
   * @method syncFeedsByRoom
   * @description Synchronizes all feeds for a specific room
   * @param {string} roomId - Room ID
   * @returns {Promise<BatchSyncResult>} Batch sync result
   */
  async syncFeedsByRoom(roomId: string): Promise<BatchSyncResult> {
    const errors: string[] = [];

    try {
      const feeds = await prisma.iCalFeed.findMany({
        where: {
          roomId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          url: true,
          roomId: true,
          platform: true,
          isActive: true,
          lastSyncAt: true,
        },
      });

      if (feeds.length === 0) {
        return {
          totalFeeds: 0,
          successfulFeeds: 0,
          failedFeeds: 0,
          totalBookingsImported: 0,
          totalBookingsUpdated: 0,
          totalBlockedDates: 0,
          results: [],
          errors: ['No active feeds found for this room'],
        };
      }

      const results: SyncResult[] = [];

      for (const feed of feeds) {
        try {
          const result = await this.syncFeed(feed.id);
          results.push(result);
        } catch (error) {
          const errorMessage = `Feed ${feed.name}: ${this.getErrorMessage(error)}`;
          errors.push(errorMessage);
        }
      }

      const successfulFeeds = results.filter(r => r.success).length;
      const failedFeeds = results.filter(r => !r.success).length;
      const totalBookingsImported = results.reduce((sum, r) => sum + r.bookingsImported, 0);
      const totalBookingsUpdated = results.reduce((sum, r) => sum + r.bookingsUpdated, 0);
      const totalBlockedDates = results.reduce((sum, r) => sum + r.blockedDatesCreated, 0);

      return {
        totalFeeds: feeds.length,
        successfulFeeds,
        failedFeeds,
        totalBookingsImported,
        totalBookingsUpdated,
        totalBlockedDates,
        results,
        errors,
      };
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      errors.push(errorMessage);

      return {
        totalFeeds: 0,
        successfulFeeds: 0,
        failedFeeds: 0,
        totalBookingsImported: 0,
        totalBookingsUpdated: 0,
        totalBlockedDates: 0,
        results: [],
        errors,
      };
    }
  }

  /**
   * @method getErrorMessage
   * @description Safely extracts error message
   * @param {unknown} error - Error object
   * @returns {string} Error message
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}

/**
 * @function createOTASync
 * @description Factory function to create a new OTASync instance
 * @returns {OTASync} New OTASync instance
 */
export function createOTASync(): OTASync {
  return new OTASync();
}

// ✅ Archivo 4/10 completado
