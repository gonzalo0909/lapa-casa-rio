// lapa-casa-hostel/backend/src/services/ical-sync-service.ts

import { PrismaClient } from '@prisma/client';
import { OTASync, BatchSyncResult } from '../integrations/ical/ota-sync';
import { EventEmitter } from 'events';

/**
 * @module ICalSyncService
 * @description Service for managing automated iCal synchronization
 */

const prisma = new PrismaClient();

/**
 * @interface SyncJobStatus
 * @description Status information for a sync job
 */
export interface SyncJobStatus {
  isRunning: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
  lastResult?: BatchSyncResult;
  intervalMinutes: number;
}

/**
 * @class ICalSyncService
 * @description Manages automated synchronization of iCal feeds
 * 
 * Features:
 * - Scheduled automatic sync
 * - Manual sync triggering
 * - Event notifications
 * - Error handling and retry logic
 */
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

  /**
   * @method start
   * @description Starts the automatic sync service
   * @param {number} [intervalMinutes=60] - Sync interval in minutes
   */
  async start(intervalMinutes: number = 60): Promise<void> {
    if (this.syncInterval) {
      console.log('iCal sync service is already running');
      return;
    }

    this.intervalMinutes = Math.max(15, Math.min(intervalMinutes, 1440)); // Between 15 min and 24 hours

    console.log(`Starting iCal sync service with ${this.intervalMinutes} minute interval`);

    // Run initial sync
    await this.runSync();

    // Schedule recurring sync
    const intervalMs = this.intervalMinutes * 60 * 1000;
    this.syncInterval = setInterval(() => {
      this.runSync().catch(error => {
        console.error('Error in scheduled sync:', error);
        this.emit('error', error);
      });
    }, intervalMs);

    this.emit('started', { intervalMinutes: this.intervalMinutes });
  }

  /**
   * @method stop
   * @description Stops the automatic sync service
   */
  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('iCal sync service stopped');
      this.emit('stopped');
    }
  }

  /**
   * @method restart
   * @description Restarts the sync service with a new interval
   * @param {number} [intervalMinutes] - New interval in minutes
   */
  async restart(intervalMinutes?: number): Promise<void> {
    this.stop();
    await this.start(intervalMinutes || this.intervalMinutes);
  }

  /**
   * @method runSync
   * @description Runs a sync operation
   * @param {boolean} [force=false] - Force sync even if already running
   * @returns {Promise<BatchSyncResult>} Sync result
   */
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

      // Check if auto-sync is enabled
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
          errors: ['Auto-sync is disabled'],
        };
      }

      // Run the sync
      const result = await this.otaSync.syncAllActiveFeeds();

      // Store result
      this.lastResult = result;
      this.lastRunAt = new Date();

      // Log results
      const duration = Date.now() - startTime;
      console.log(`iCal sync completed in ${duration}ms:`, {
        totalFeeds: result.totalFeeds,
        successful: result.successfulFeeds,
        failed: result.failedFeeds,
        imported: result.totalBookingsImported,
        updated: result.totalBookingsUpdated,
      });

      // Store sync history
      await this.storeSyncHistory(result, duration);

      // Emit success event
      this.emit('syncComplete', {
        result,
        duration,
        timestamp: new Date(),
      });

      // Emit errors if any
      if (result.errors.length > 0 || result.failedFeeds > 0) {
        this.emit('syncErrors', {
          errors: result.errors,
          failedFeeds: result.failedFeeds,
        });
      }

      return result;
    } catch (error) {
      console.error('iCal sync failed:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Emit error event
      this.emit('syncError', {
        error: errorMessage,
        timestamp: new Date(),
      });

      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * @method syncRoom
   * @description Syncs all feeds for a specific room
   * @param {string} roomId - Room ID
   * @returns {Promise<BatchSyncResult>} Sync result
   */
  async syncRoom(roomId: string): Promise<BatchSyncResult> {
    console.log(`Syncing feeds for room ${roomId}`);

    try {
      const result = await this.otaSync.syncFeedsByRoom(roomId);

      this.emit('roomSyncComplete', {
        roomId,
        result,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      console.error(`Failed to sync room ${roomId}:`, error);

      this.emit('roomSyncError', {
        roomId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * @method getStatus
   * @description Gets the current status of the sync service
   * @returns {SyncJobStatus} Service status
   */
  getStatus(): SyncJobStatus {
    const nextRunAt = this.syncInterval && this.lastRunAt
      ? new Date(this.lastRunAt.getTime() + this.intervalMinutes * 60 * 1000)
      : undefined;

    return {
      isRunning: this.isRunning,
      lastRunAt: this.lastRunAt,
      nextRunAt,
      lastResult: this.lastResult,
      intervalMinutes: this.intervalMinutes,
    };
  }

  /**
   * @method getSettings
   * @description Retrieves sync settings from database
   * @returns {Promise<object>} Sync settings
   */
  private async getSettings(): Promise<{ autoSync: boolean; syncInterval: number }> {
    try {
      const settings = await prisma.settings.findFirst({
        where: { key: 'ical_sync' },
      });

      if (!settings || !settings.value) {
        return {
          autoSync: true,
          syncInterval: 60,
        };
      }

      const value = settings.value as any;
      return {
        autoSync: value.autoSync ?? true,
        syncInterval: value.syncInterval ?? 60,
      };
    } catch (error) {
      console.error('Error fetching sync settings:', error);
      return {
        autoSync: true,
        syncInterval: 60,
      };
    }
  }

  /**
   * @method updateSettings
   * @description Updates sync settings and restarts if necessary
   * @param {object} settings - New settings
   * @param {boolean} [settings.autoSync] - Enable/disable auto-sync
   * @param {number} [settings.syncInterval] - Sync interval in minutes
   */
  async updateSettings(settings: { autoSync?: boolean; syncInterval?: number }): Promise<void> {
    const currentSettings = await this.getSettings();

    const newSettings = {
      autoSync: settings.autoSync ?? currentSettings.autoSync,
      syncInterval: settings.syncInterval ?? currentSettings.syncInterval,
    };

    // Update in database
    await prisma.settings.upsert({
      where: { key: 'ical_sync' },
      create: {
        key: 'ical_sync',
        value: newSettings,
      },
      update: {
        value: newSettings,
      },
    });

    // Restart service if interval changed
    if (settings.syncInterval && settings.syncInterval !== this.intervalMinutes) {
      if (this.syncInterval) {
        await this.restart(settings.syncInterval);
      } else {
        this.intervalMinutes = settings.syncInterval;
      }
    }

    // Stop service if auto-sync disabled
    if (settings.autoSync === false && this.syncInterval) {
      this.stop();
    }

    // Start service if auto-sync enabled and not running
    if (settings.autoSync === true && !this.syncInterval) {
      await this.start(newSettings.syncInterval);
    }

    this.emit('settingsUpdated', newSettings);
  }

  /**
   * @method storeSyncHistory
   * @description Stores sync history in database
   * @param {BatchSyncResult} result - Sync result
   * @param {number} duration - Sync duration in milliseconds
   */
  private async storeSyncHistory(result: BatchSyncResult, duration: number): Promise<void> {
    try {
      await prisma.syncHistory.create({
        data: {
          type: 'ical',
          status: result.failedFeeds > 0 ? 'partial' : 'success',
          feedsSynced: result.successfulFeeds,
          feedsFailed: result.failedFeeds,
          bookingsImported: result.totalBookingsImported,
          bookingsUpdated: result.totalBookingsUpdated,
          durationMs: duration,
          errors: result.errors.length > 0 ? result.errors : null,
          metadata: {
            totalBlockedDates: result.totalBlockedDates,
            results: result.results.map(r => ({
              feedId: r.feedId,
              feedName: r.feedName,
              success: r.success,
              bookingsImported: r.bookingsImported,
              errors: r.errors,
            })),
          },
        },
      });
    } catch (error) {
      console.error('Failed to store sync history:', error);
    }
  }

  /**
   * @method cleanupOldHistory
   * @description Removes old sync history records
   * @param {number} [daysToKeep=30] - Number of days of history to keep
   * @returns {Promise<number>} Number of records deleted
   */
  async cleanupOldHistory(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await prisma.syncHistory.deleteMany({
        where: {
          type: 'ical',
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      console.log(`Cleaned up ${result.count} old sync history records`);
      return result.count;
    } catch (error) {
      console.error('Failed to cleanup sync history:', error);
      return 0;
    }
  }

  /**
   * @method getSyncHistory
   * @description Retrieves recent sync history
   * @param {number} [limit=50] - Maximum number of records to return
   * @returns {Promise<Array>} Sync history records
   */
  async getSyncHistory(limit: number = 50): Promise<any[]> {
    try {
      const history = await prisma.syncHistory.findMany({
        where: { type: 'ical' },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 100),
      });

      return history;
    } catch (error) {
      console.error('Failed to fetch sync history:', error);
      return [];
    }
  }
}

/**
 * @constant syncService
 * @description Singleton instance of ICalSyncService
 */
export const syncService = new ICalSyncService();

/**
 * @function initializeSyncService
 * @description Initializes the sync service with settings from database
 */
export async function initializeSyncService(): Promise<void> {
  try {
    const prismaClient = new PrismaClient();
    const settings = await prismaClient.settings.findFirst({
      where: { key: 'ical_sync' },
    });

    const config = settings?.value as any || {
      autoSync: true,
      syncInterval: 60,
    };

    if (config.autoSync) {
      await syncService.start(config.syncInterval);
      console.log('iCal sync service initialized and started');
    } else {
      console.log('iCal sync service initialized but auto-sync is disabled');
    }

    await prismaClient.$disconnect();
  } catch (error) {
    console.error('Failed to initialize sync service:', error);
  }
}

// ✅ Archivo 7/10 completado
