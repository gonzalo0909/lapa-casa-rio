// lapa-casa-hostel/backend/src/services/ical-sync-service.ts

import { OTASync, BatchSyncResult } from '../integrations/ical/ota-sync';
import { EventEmitter } from 'events';
import { pool } from '../config/database';

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
  private isRunning = false;
  private intervalMinutes = 60;
  private lastRunAt?: Date;
  private lastResult?: BatchSyncResult;

  constructor() {
    super();
    this.otaSync = new OTASync();
  }

  async start(intervalMinutes = 60): Promise<void> {
    if (this.syncInterval) { console.log('iCal sync service is already running'); return; }
    this.intervalMinutes = Math.max(15, Math.min(intervalMinutes, 1440));
    await this.runSync();
    this.syncInterval = setInterval(() => {
      this.runSync().catch(error => { console.error('Error in scheduled sync:', error); this.emit('error', error); });
    }, this.intervalMinutes * 60 * 1000);
    this.emit('started', { intervalMinutes: this.intervalMinutes });
  }

  stop(): void {
    if (this.syncInterval) { clearInterval(this.syncInterval); this.syncInterval = null; this.emit('stopped'); }
  }

  async restart(intervalMinutes?: number): Promise<void> {
    this.stop();
    await this.start(intervalMinutes || this.intervalMinutes);
  }

  async runSync(force = false): Promise<BatchSyncResult> {
    if (this.isRunning && !force) throw new Error('Sync already in progress');
    this.isRunning = true;
    const startTime = Date.now();
    this.emit('syncStart', { timestamp: new Date() });
    try {
      const settings = await this.getSettings();
      if (!settings.autoSync && !force) {
        this.isRunning = false;
        return { totalFeeds: 0, successfulFeeds: 0, failedFeeds: 0, totalBookingsImported: 0, totalBookingsUpdated: 0, totalBlockedDates: 0, results: [], errors: ['Auto-sync is disabled'] };
      }
      const result = await this.otaSync.syncAllActiveFeeds();
      this.lastResult = result;
      this.lastRunAt = new Date();
      this.emit('syncComplete', { result, duration: Date.now() - startTime, timestamp: new Date() });
      if (result.errors.length > 0 || result.failedFeeds > 0) this.emit('syncErrors', { errors: result.errors, failedFeeds: result.failedFeeds });
      return result;
    } catch (error) {
      this.emit('syncError', { error: error instanceof Error ? error.message : 'Unknown error', timestamp: new Date() });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  async syncRoom(roomId: string): Promise<BatchSyncResult> {
    const result = await this.otaSync.syncFeedsByRoom(roomId);
    this.emit('roomSyncComplete', { roomId, result, timestamp: new Date() });
    return result;
  }

  getStatus(): SyncJobStatus {
    return {
      isRunning: this.isRunning,
      lastRunAt: this.lastRunAt,
      nextRunAt: this.syncInterval && this.lastRunAt ? new Date(this.lastRunAt.getTime() + this.intervalMinutes * 60 * 1000) : undefined,
      lastResult: this.lastResult,
      intervalMinutes: this.intervalMinutes,
    };
  }

  private async getSettings(): Promise<{ autoSync: boolean; syncInterval: number }> {
    try {
      const { rows } = await pool.query(`SELECT value FROM system_config WHERE key = 'ical_sync' LIMIT 1`);
      if (!rows.length || !rows[0].value) return { autoSync: true, syncInterval: 60 };
      const v = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
      return { autoSync: v.autoSync ?? true, syncInterval: v.syncInterval ?? 60 };
    } catch {
      return { autoSync: true, syncInterval: 60 };
    }
  }

  async updateSettings(settings: { autoSync?: boolean; syncInterval?: number }): Promise<void> {
    const current = await this.getSettings();
    const next = { autoSync: settings.autoSync ?? current.autoSync, syncInterval: settings.syncInterval ?? current.syncInterval };
    try {
      await pool.query(
        `INSERT INTO system_config (key, value) VALUES ('ical_sync', $1::jsonb)
         ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, updated_at = NOW()`,
        [JSON.stringify(next)]
      );
    } catch (error) { console.error('Failed to update sync settings:', error); }
    if (settings.syncInterval && settings.syncInterval !== this.intervalMinutes && this.syncInterval) await this.restart(settings.syncInterval);
    if (settings.autoSync === false && this.syncInterval) this.stop();
    if (settings.autoSync === true && !this.syncInterval) await this.start(next.syncInterval);
    this.emit('settingsUpdated', next);
  }

  getSyncHistory(_limit = 50): any[] { return []; }
}

export const syncService = new ICalSyncService();

export async function initializeSyncService(): Promise<void> {
  try {
    const { rows } = await pool.query(`SELECT value FROM system_config WHERE key = 'ical_sync' LIMIT 1`);
    const config = rows[0]?.value || { autoSync: true, syncInterval: 60 };
    const parsed = typeof config === 'string' ? JSON.parse(config) : config;
    if (parsed.autoSync) { await syncService.start(parsed.syncInterval); }
  } catch (error) {
    console.error('Failed to initialize sync service:', error);
  }
}
