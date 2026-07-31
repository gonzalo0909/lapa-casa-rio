// lapa-casa-hostel/backend/src/crons/sync-ota-calendars.ts

import cron from 'node-cron';
import { syncService } from '../services/ical-sync-service';

/**
 * @module SyncOTACalendars
 * @description Cron job for automatic OTA calendar synchronization
 */

/**
 * @interface CronJobConfig
 * @description Configuration for cron jobs
 */
interface CronJobConfig {
  schedule: string;
  timezone: string;
  enabled: boolean;
}

/**
 * @class OTASyncCron
 * @description Manages cron jobs for OTA calendar synchronization
 */
class OTASyncCron {
  private job: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;

  /**
   * @method initialize
   * @description Initializes and starts the cron job
   * @param {CronJobConfig} [config] - Cron job configuration
   */
  initialize(config?: CronJobConfig): void {
    const cronConfig: CronJobConfig = {
      schedule: config?.schedule || '0 * * * *', // Every hour by default
      timezone: config?.timezone || 'America/Sao_Paulo',
      enabled: config?.enabled !== false,
    };

    if (!cronConfig.enabled) {
      console.log('OTA calendar sync cron job is disabled');
      return;
    }

    // Validate cron schedule
    if (!cron.validate(cronConfig.schedule)) {
      console.error(`Invalid cron schedule: ${cronConfig.schedule}`);
      return;
    }

    console.log(`Initializing OTA calendar sync cron job with schedule: ${cronConfig.schedule}`);

    // Create cron job
    this.job = cron.schedule(
      cronConfig.schedule,
      async () => {
        await this.executeSync();
      },
      {
        scheduled: true,
        timezone: cronConfig.timezone,
      }
    );

    console.log('OTA calendar sync cron job initialized and scheduled');

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * @method executeSync
   * @description Executes the synchronization process
   */
  private async executeSync(): Promise<void> {
    if (this.isRunning) {
      console.log('OTA sync already in progress, skipping scheduled run');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('=== Starting scheduled OTA calendar sync ===');

      // Run the sync
      const result = await syncService.runSync();

      const duration = Date.now() - startTime;
      const durationSeconds = (duration / 1000).toFixed(2);

      console.log(`=== OTA calendar sync completed in ${durationSeconds}s ===`);
      console.log(`Feeds synced: ${result.successfulFeeds}/${result.totalFeeds}`);
      console.log(`Bookings imported: ${result.totalBookingsImported}`);
      console.log(`Bookings updated: ${result.totalBookingsUpdated}`);
      console.log(`Blocked dates: ${result.totalBlockedDates}`);

      if (result.failedFeeds > 0) {
        console.warn(`Failed feeds: ${result.failedFeeds}`);
        console.warn('Errors:', result.errors);
      }

      // Send notifications for failures if needed
      if (result.failedFeeds > 0) {
        await this.notifyFailures(result);
      }
    } catch (error) {
      console.error('Error in scheduled OTA sync:', error);
      await this.notifyError(error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * @method setupEventListeners
   * @description Sets up event listeners for the sync service
   */
  private setupEventListeners(): void {
    syncService.on('syncStart', (data) => {
      console.log(`[Sync Event] Sync started at ${data.timestamp}`);
    });

    syncService.on('syncComplete', (data) => {
      console.log(`[Sync Event] Sync completed:`, {
        duration: `${(data.duration / 1000).toFixed(2)}s`,
        bookingsImported: data.result.totalBookingsImported,
        bookingsUpdated: data.result.totalBookingsUpdated,
      });
    });

    syncService.on('syncError', (data) => {
      console.error(`[Sync Event] Sync error:`, data.error);
    });

    syncService.on('syncErrors', (data) => {
      console.warn(`[Sync Event] Sync completed with errors:`, {
        failedFeeds: data.failedFeeds,
        errors: data.errors,
      });
    });
  }

  /**
   * @method notifyFailures
   * @description Sends notifications for sync failures
   * @param {any} result - Sync result with failures
   */
  private async notifyFailures(result: any): Promise<void> {
    try {
      // Log detailed failure information
      console.error('=== OTA Sync Failures ===');
      
      for (const feedResult of result.results) {
        if (!feedResult.success) {
          console.error(`Feed: ${feedResult.feedName}`);
          console.error(`Errors: ${feedResult.errors.join(', ')}`);
        }
      }

      // TODO: Implement email/Slack notifications for admins
      // For now, just log the failures
      
    } catch (error) {
      console.error('Failed to send failure notifications:', error);
    }
  }

  /**
   * @method notifyError
   * @description Sends notifications for critical errors
   * @param {unknown} error - Error object
   */
  private async notifyError(error: unknown): Promise<void> {
    try {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      console.error('=== Critical OTA Sync Error ===');
      console.error('Message:', errorMessage);
      if (errorStack) {
        console.error('Stack:', errorStack);
      }

      // TODO: Implement critical error notifications (email, Slack, etc.)
      
    } catch (notifyError) {
      console.error('Failed to send error notification:', notifyError);
    }
  }

  /**
   * @method stop
   * @description Stops the cron job
   */
  stop(): void {
    if (this.job) {
      this.job.stop();
      this.job = null;
      console.log('OTA calendar sync cron job stopped');
    }
  }

  /**
   * @method getStatus
   * @description Gets the current status of the cron job
   * @returns {object} Cron job status
   */
  getStatus(): {
    isScheduled: boolean;
    isRunning: boolean;
    serviceStatus: any;
  } {
    return {
      isScheduled: this.job !== null,
      isRunning: this.isRunning,
      serviceStatus: syncService.getStatus(),
    };
  }

  /**
   * @method triggerManualSync
   * @description Manually triggers a sync outside the schedule
   * @returns {Promise<any>} Sync result
   */
  async triggerManualSync(): Promise<any> {
    console.log('Manual OTA sync triggered');
    return await this.executeSync();
  }
}

/**
 * @constant otaSyncCron
 * @description Singleton instance of OTASyncCron
 */
export const otaSyncCron = new OTASyncCron();

/**
 * @function initializeOTASyncCron
 * @description Initializes the OTA sync cron job with optional configuration
 * @param {CronJobConfig} [config] - Cron job configuration
 */
export function initializeOTASyncCron(config?: CronJobConfig): void {
  otaSyncCron.initialize(config);
}

/**
 * @function stopOTASyncCron
 * @description Stops the OTA sync cron job
 */
export function stopOTASyncCron(): void {
  otaSyncCron.stop();
}

/**
 * @function getOTASyncStatus
 * @description Gets the current status of the OTA sync cron job
 * @returns {object} Cron job status
 */
export function getOTASyncStatus(): {
  isScheduled: boolean;
  isRunning: boolean;
  serviceStatus: any;
} {
  return otaSyncCron.getStatus();
}

/**
 * @function triggerManualOTASync
 * @description Manually triggers an OTA sync
 * @returns {Promise<any>} Sync result
 */
export async function triggerManualOTASync(): Promise<any> {
  return await otaSyncCron.triggerManualSync();
}

/**
 * @example
 * // Initialize with custom schedule (every 30 minutes)
 * initializeOTASyncCron({
 *   schedule: '*\/30 * * * *',
 *   timezone: 'America/Sao_Paulo',
 *   enabled: true
 * });
 * 
 * @example
 * // Trigger manual sync
 * const result = await triggerManualOTASync();
 * console.log('Sync result:', result);
 * 
 * @example
 * // Get sync status
 * const status = getOTASyncStatus();
 * console.log('Cron status:', status);
 */

// Auto-initialize with default configuration when module is imported
// This can be disabled by setting environment variable DISABLE_AUTO_CRON=true
if (process.env.DISABLE_AUTO_CRON !== 'true') {
  // Initialize with environment-based configuration
  const cronSchedule = process.env.OTA_SYNC_SCHEDULE || '0 * * * *'; // Default: every hour
  const cronTimezone = process.env.TIMEZONE || 'America/Sao_Paulo';
  const cronEnabled = process.env.OTA_SYNC_ENABLED !== 'false'; // Default: enabled

  initializeOTASyncCron({
    schedule: cronSchedule,
    timezone: cronTimezone,
    enabled: cronEnabled,
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: stopping OTA sync cron job');
  stopOTASyncCron();
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: stopping OTA sync cron job');
  stopOTASyncCron();
});

// ✅ Archivo 10/10 completado
