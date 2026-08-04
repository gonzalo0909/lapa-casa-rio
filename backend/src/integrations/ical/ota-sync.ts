// lapa-casa-hostel/backend/src/integrations/ical/ota-sync.ts

import { pool } from '../../config/database';
import { ICalParser, ParsedBooking } from './ical-parser';
import { ConflictResolver } from '../../lib/ical/conflict-resolver';

interface SyncFeed {
  id: string;
  name: string;
  url: string;
  room_id: string;
  platform: string;
  is_active: boolean;
  last_sync_at?: Date | null;
}

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

export class OTASync {
  private parser: ICalParser;
  private conflictResolver: ConflictResolver;

  constructor() {
    this.parser = new ICalParser();
    this.conflictResolver = new ConflictResolver();
  }

  async syncFeed(feedId: string): Promise<SyncResult> {
    const errors: string[] = [];
    const syncedAt = new Date();

    try {
      const feed = await this.getFeed(feedId);
      if (!feed) throw new Error(`Feed not found: ${feedId}`);
      if (!feed.is_active) throw new Error(`Feed is not active: ${feed.name}`);

      const parseResult = await this.parser.parseFromUrl(feed.url, feed.platform);
      if (!parseResult.success) throw new Error(`Parse failed: ${parseResult.errors.join(', ')}`);
      errors.push(...parseResult.errors);

      const processResult = await this.processBookings(parseResult.bookings, feed.room_id, feed.platform, feed.id);

      await pool.query(
        `UPDATE ical_feeds SET last_sync_at = $1, last_sync_status = 'success', last_sync_error = NULL WHERE id = $2`,
        [syncedAt, feedId]
      ).catch(() => { /* ical_feeds may not exist */ });

      return { feedId: feed.id, feedName: feed.name, success: true, bookingsImported: processResult.imported, bookingsUpdated: processResult.updated, bookingsSkipped: processResult.skipped, blockedDatesCreated: processResult.blockedDates, conflictsResolved: processResult.conflictsResolved, errors, syncedAt };
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      errors.push(errorMessage);

      await pool.query(
        `UPDATE ical_feeds SET last_sync_at = $1, last_sync_status = 'error', last_sync_error = $2 WHERE id = $3`,
        [syncedAt, errorMessage, feedId]
      ).catch(() => { /* ical_feeds may not exist */ });

      return { feedId, feedName: 'Unknown', success: false, bookingsImported: 0, bookingsUpdated: 0, bookingsSkipped: 0, blockedDatesCreated: 0, conflictsResolved: 0, errors, syncedAt };
    }
  }

  async syncAllActiveFeeds(): Promise<BatchSyncResult> {
    const errors: string[] = [];
    try {
      const { rows: feeds } = await pool.query<SyncFeed>(
        `SELECT id, name, url, room_id, platform, is_active, last_sync_at FROM ical_feeds WHERE is_active = true`
      ).catch(() => ({ rows: [] as SyncFeed[] }));

      if (feeds.length === 0) {
        return { totalFeeds: 0, successfulFeeds: 0, failedFeeds: 0, totalBookingsImported: 0, totalBookingsUpdated: 0, totalBlockedDates: 0, results: [], errors: ['No active feeds found'] };
      }

      const results: SyncResult[] = [];
      for (const feed of feeds) {
        try {
          results.push(await this.syncFeed(feed.id));
        } catch (error) {
          const msg = `Feed ${feed.name}: ${this.getErrorMessage(error)}`;
          errors.push(msg);
          results.push({ feedId: feed.id, feedName: feed.name, success: false, bookingsImported: 0, bookingsUpdated: 0, bookingsSkipped: 0, blockedDatesCreated: 0, conflictsResolved: 0, errors: [msg], syncedAt: new Date() });
        }
      }

      return {
        totalFeeds: feeds.length,
        successfulFeeds: results.filter(r => r.success).length,
        failedFeeds: results.filter(r => !r.success).length,
        totalBookingsImported: results.reduce((s, r) => s + r.bookingsImported, 0),
        totalBookingsUpdated: results.reduce((s, r) => s + r.bookingsUpdated, 0),
        totalBlockedDates: results.reduce((s, r) => s + r.blockedDatesCreated, 0),
        results,
        errors,
      };
    } catch (error) {
      return { totalFeeds: 0, successfulFeeds: 0, failedFeeds: 0, totalBookingsImported: 0, totalBookingsUpdated: 0, totalBlockedDates: 0, results: [], errors: [this.getErrorMessage(error)] };
    }
  }

  async syncFeedsByRoom(roomId: string): Promise<BatchSyncResult> {
    const { rows: feeds } = await pool.query<SyncFeed>(
      `SELECT id, name, url, room_id, platform, is_active, last_sync_at FROM ical_feeds WHERE room_id = $1 AND is_active = true`,
      [roomId]
    ).catch(() => ({ rows: [] as SyncFeed[] }));

    if (feeds.length === 0) {
      return { totalFeeds: 0, successfulFeeds: 0, failedFeeds: 0, totalBookingsImported: 0, totalBookingsUpdated: 0, totalBlockedDates: 0, results: [], errors: ['No active feeds found for this room'] };
    }

    const results: SyncResult[] = [];
    const errors: string[] = [];
    for (const feed of feeds) {
      try { results.push(await this.syncFeed(feed.id)); }
      catch (error) { errors.push(`Feed ${feed.name}: ${this.getErrorMessage(error)}`); }
    }

    return {
      totalFeeds: feeds.length,
      successfulFeeds: results.filter(r => r.success).length,
      failedFeeds: results.filter(r => !r.success).length,
      totalBookingsImported: results.reduce((s, r) => s + r.bookingsImported, 0),
      totalBookingsUpdated: results.reduce((s, r) => s + r.bookingsUpdated, 0),
      totalBlockedDates: results.reduce((s, r) => s + r.blockedDatesCreated, 0),
      results,
      errors,
    };
  }

  async cleanupOldBookings(feedId: string, cutoffDate: Date): Promise<number> {
    const { rows } = await pool.query(
      `SELECT COUNT(*) FROM reservations WHERE metadata->>'ical_feed_id' = $1 AND created_at < $2`,
      [feedId, cutoffDate]
    ).catch(() => ({ rows: [{ count: '0' }] }));
    return Number(rows[0].count);
  }

  private async processBookings(
    bookings: ParsedBooking[],
    roomId: string,
    platform: string,
    feedId: string
  ): Promise<{ imported: number; updated: number; skipped: number; blockedDates: number; conflictsResolved: number }> {
    let imported = 0, updated = 0, skipped = 0, blockedDates = 0, conflictsResolved = 0;

    for (const booking of bookings) {
      try {
        if (!this.parser.validateBooking(booking)) { skipped++; continue; }

        const conflicts = await this.conflictResolver.findConflicts(roomId, booking.checkIn, booking.checkOut);
        if (conflicts.length > 0) {
          const resolution = await this.conflictResolver.resolveConflicts(conflicts, booking, platform);
          conflictsResolved += resolution.conflictsResolved;
          if (!resolution.canProceed) { skipped++; continue; }
        }

        const { rows: existing } = await pool.query(
          `SELECT id FROM reservations WHERE metadata->>'external_id' = $1 AND metadata->>'platform' = $2 LIMIT 1`,
          [booking.externalId, platform]
        );

        if (existing.length > 0) {
          await pool.query(
            `UPDATE reservations SET status = $1::booking_status, updated_at = NOW() WHERE id = $2`,
            [booking.status === 'blocked' ? 'cancelled' : 'confirmed', existing[0].id]
          );
          updated++;
        } else {
          const { rows: channelRows } = await pool.query(`SELECT id FROM channels WHERE code = $1::channel_code`, [platform]);
          if (channelRows.length === 0) { skipped++; continue; }

          const { rows: bedRows } = await pool.query(
            `SELECT b.id FROM beds b
             WHERE b.room_id = $1 AND b.status = 'active'
               AND b.id NOT IN (
                 SELECT rb.bed_id FROM reservation_beds rb
                 JOIN reservations r ON r.id = rb.reservation_id
                 WHERE r.status IN ('confirmed','pending_payment')
                   AND rb.check_in < $3 AND rb.check_out > $2
               )
             LIMIT 1`,
            [roomId, booking.checkIn, booking.checkOut]
          );
          if (bedRows.length === 0) { skipped++; continue; }

          const guestName = booking.guestName || 'OTA Guest';
          const fakeEmail = `ota_${booking.externalId}@${platform}.import`;
          const { rows: guestRows } = await pool.query(
            `INSERT INTO guests (full_name, email) VALUES ($1, $2)
             ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
             RETURNING id`,
            [guestName, fakeEmail]
          );

          const meta = JSON.stringify({ external_id: booking.externalId, platform, ical_feed_id: feedId, source: 'ical' });
          const { rows: resRows } = await pool.query(
            `INSERT INTO reservations (guest_id, channel_id, status, beds_count, check_in, check_out, total_price, deposit_amount, remaining_amount, nights_count, metadata)
             VALUES ($1, $2, $3::booking_status, 1, $4, $5, 0, 0, 0, $6, $7::jsonb)
             RETURNING id`,
            [guestRows[0].id, channelRows[0].id, booking.status === 'blocked' ? 'cancelled' : 'confirmed',
             booking.checkIn, booking.checkOut,
             Math.ceil((booking.checkOut.getTime() - booking.checkIn.getTime()) / 86400000),
             meta]
          );

          await pool.query(
            `INSERT INTO reservation_beds (reservation_id, bed_id, check_in, check_out) VALUES ($1, $2, $3, $4)`,
            [resRows[0].id, bedRows[0].id, booking.checkIn, booking.checkOut]
          );

          if (booking.status === 'blocked') blockedDates++; else imported++;
        }
      } catch (error) {
        console.error(`Failed to process booking ${booking.externalId}:`, error);
        skipped++;
      }
    }

    return { imported, updated, skipped, blockedDates, conflictsResolved };
  }

  private async getFeed(feedId: string): Promise<SyncFeed | null> {
    const { rows } = await pool.query<SyncFeed>(
      `SELECT id, name, url, room_id, platform, is_active, last_sync_at FROM ical_feeds WHERE id = $1`,
      [feedId]
    ).catch(() => ({ rows: [] as SyncFeed[] }));
    return rows[0] || null;
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

export function createOTASync(): OTASync {
  return new OTASync();
}
