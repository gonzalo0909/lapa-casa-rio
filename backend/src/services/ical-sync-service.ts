// lapa-casa-hostel/backend/src/services/ical-sync-service.ts

import { OTASync, BatchSyncResult } from '../integrations/ical/ota-sync';
import { EventEmitter } from 'events';
import { query } from '../config/database';

export interface SyncJobStatus {
  isRunning: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
  lastResult?: BatchSyncResult;
  intervalMinutes: number;
}

export class ICalSyncService extends EventEmitter {
  private otaSync: OTASync;
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private intervalMinutes: number = 60;
  private lastRunAt?: Date;
  private lastResult?: BatchSyncResult;

  constructor() {
    super();
    this.otaSync = new OTASync();
  }

  async start(intervalMinutes: number = 60): Promise<void> {
    if (this.syncInterval) {
      console.log('iCal sync service is already running');
      return;
    }

    this.intervalMinutes = Math.max(15, Math.min(intervalMinutes, 1440));
    console.log(`Starting iCal sync service with ${this.intervalMinutes} minute interval`);

    await this.runSync();

    const intervalMs = this.intervalMinutes * 60 * 1000;
    this.syncInterval = setInterval(() => {
      this.runSync().catch(error => {
        console.error('Error in scheduled sync:', error);
        this.emit('error', error);
      });
    }, intervalMs);

    this.emit('started', { intervalMinutes: this.intervalMinutes });
  }

  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('iCal sync service stopped');
      this.emit('stopped');
    }
  }

  async restart(intervalMinutes?: number): Promise<void> {
    this.stop();
    await this.start(intervalMinutes || this.intervalMinutes);
  }

  async runSync(force: boolean = false): Promise<BatchSyncResult> {
    if (this.isRunning && !force) {
      console.log('Sync already in progress, skipping');
      throw new Error('Sync already in progress');
    }

    this.isRunning = true;
    const startTime = Date.now();
    this.emit('syncStart', { timestamp: new Date() });

    try {
      console.log('Starting iCal sync...');

      const settings = await this.getSettings();
      if (!settings.autoSync && !force) {
        console.log('Auto-sync is disabled');
        this.isRunning = false;
        return {
          totalFeeds: 0,
          successfulFeeds: 0,
          failedFeeds: 0,
          totalBookingsImported: 0,
          totalBookingsUpdated: 0,
          totalBlockedDates: 0,
          results: [],
          errors: ['Auto-sync is disabled']
        };
      }

      const result = await this.otaSync.syncAllActiveFeeds();

      this.lastResult = result;
      this.lastRunAt = new Date();

      const duration = Date.now() - startTime;
      console.log(`iCal sync completed in ${duration}ms`, {
        totalFeeds: result.totalFeeds,
        successful: result.successfulFeeds,
        failed: result.failedFeeds,
        imported: result.totalBookingsImported,
        updated: result.totalBookingsUpdated
      });

      await this.storeSyncHistory(result, duration);

      this.emit('syncComplete', { result, duration, timestamp: new Date() });

      if (result.errors.length > 0 || result.failedFeeds > 0) {
        this.emit('syncErrors', { errors: result.errors, failedFeeds: result.failedFeeds });
      }

      return result;
    } catch (error) {
      console.error('iCal sync failed:', error);
      this.emit('syncError', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  async syncRoom(roomId: string): Promise<BatchSyncResult> {
    console.log(`Syncing feeds for room ${roomId}`);
    try {
      const result = await this.otaSync.syncFeedsByRoom(roomId);
      this.emit('roomSyncComplete', { roomId, result, timestamp: new Date() });
      return result;
    } catch (error) {
      console.error(`Failed to sync room ${roomId}:`, error);
      this.emit('roomSyncError', {
        roomId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  getStatus(): SyncJobStatus {
    const nextRunAt = this.syncInterval && this.lastRunAt
      ? new Date(this.lastRunAt.getTime() + this.intervalMinutes * 60 * 1000)
      : undefined;

    return {
      isRunning: this.isRunning,
      lastRunAt: this.lastRunAt,
      nextRunAt,
      lastResult: this.lastResult,
      intervalMinutes: this.intervalMinutes
    };
  }

  private async getSettings(): Promise<{ autoSync: boolean; syncInterval: number }> {
    try {
      const result = await query(
        `SELECT value FROM settings WHERE key = 'ical_sync' LIMIT 1`
      );
      if (!result.rows[0]) return { autoSync: true, syncInterval: 60 };
      const val = result.rows[0].value;
      return {
        autoSync: val?.autoSync ?? true,
        syncInterval: val?.syncInterval ?? 60
      };
    } catch {
      return { autoSync: true, syncInterval: 60 };
    }
  }

  async updateSettings(settings: { autoSync?: boolean; syncInterval?: number }): Promise<void> {
    const current = await this.getSettings();
    const newSettings = {
      autoSync: settings.autoSync ?? current.autoSync,
      syncInterval: settings.syncInterval ?? current.syncInterval
    };

    await query(
      `INSERT INTO settings (key, value)
       VALUES ('ical_sync', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(newSettings)]
    );

    if (settings.syncInterval && settings.syncInterval !== this.intervalMinutes) {
      if (this.syncInterval) {
        await this.restart(settings.syncInterval);
      } else {
        this.intervalMinutes = settings.syncInterval;
      }
    }

    if (settings.autoSync === false && this.syncInterval) this.stop();
    if (settings.autoSync === true && !this.syncInterval) await this.start(newSettings.syncInterval);

    this.emit('settingsUpdated', newSettings);
  }

  private async storeSyncHistory(result: BatchSyncResult, duration: number): Promise<void> {
    try {
      await query(
        `INSERT INTO sync_history
           (type, status, feeds_synced, feeds_failed, bookings_imported,
            bookings_updated, duration_ms, errors, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          'ical',
          result.failedFeeds > 0 ? 'partial' : 'success',
          result.successfulFeeds,
          result.failedFeeds,
          result.totalBookingsImported,
          result.totalBookingsUpdated,
          duration,
          result.errors.length > 0 ? JSON.stringify(result.errors) : null,
          JSON.stringify({
            totalBlockedDates: result.totalBlockedDates,
            results: result.results.map(r => ({
              feedId: r.feedId,
              feedName: r.feedName,
              success: r.success,
              bookingsImported: r.bookingsImported,
              errors: r.errors
            }))
          })
        ]
      );
    } catch (error) {
      console.error('Failed to store sync history:', error);
    }
  }

  async cleanupOldHistory(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysToKeep);
      const result = await query(
        `DELETE FROM sync_history WHERE type = 'ical' AND created_at < $1`,
        [cutoff]
      );
      const count = result.rowCount ?? 0;
      console.log(`Cleaned up ${count} old sync history records`);
      return count;
    } catch (error) {
      console.error('Failed to cleanup sync history:', error);
      return 0;
    }
  }

  async getSyncHistory(limit: number = 50): Promise<any[]> {
    try {
      const result = await query(
        `SELECT * FROM sync_history WHERE type = 'ical'
         ORDER BY created_at DESC LIMIT $1`,
        [Math.min(limit, 100)]
      );
      return result.rows;
    } catch (error) {
      console.error('Failed to fetch sync history:', error);
      return [];
    }
  }
}

export const syncService = new ICalSyncService();

export async function initializeSyncService(): Promise<void> {
  try {
    const result = await query(
      `SELECT value FROM settings WHERE key = 'ical_sync' LIMIT 1`
    );
    const config = result.rows[0]?.value ?? { autoSync: true, syncInterval: 60 };

    if (config.autoSync) {
      await syncService.start(config.syncInterval);
      console.log('iCal sync service initialized and started');
    } else {
      console.log('iCal sync service initialized but auto-sync is disabled');
    }
  } catch (error) {
    console.error('Failed to initialize sync service:', error);
  }
}
