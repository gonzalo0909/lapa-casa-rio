// lapa-casa-hostel/backend/src/routes/ical/ical.routes.ts

import { Router } from 'express';
import { pool } from '../../config/database';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth';
import { OTASync } from '../../integrations/ical/ota-sync';
import { ICalGenerator } from '../../integrations/ical/ical-generator';

const router = Router();
const otaSync = new OTASync();
const icalGenerator = new ICalGenerator();

const CreateFeedSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  roomId: z.string().uuid(),
  platform: z.enum(['airbnb', 'booking', 'expedia', 'vrbo', 'hostelworld', 'custom']),
});

const UpdateFeedSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  isActive: z.boolean().optional(),
});

router.get('/feeds', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { rows: feeds } = await pool.query(
      `SELECT f.id, f.name, f.url, f.room_id, rm.name AS room_name, f.platform,
              f.is_active, f.last_sync_at, f.last_sync_status, f.last_sync_error,
              COUNT(r.id) AS bookings_imported
       FROM ical_feeds f
       JOIN rooms rm ON rm.id = f.room_id
       LEFT JOIN reservations r ON r.metadata->>'ical_feed_id' = f.id::text
       GROUP BY f.id, rm.name
       ORDER BY f.created_at DESC`
    ).catch(() => ({ rows: [] }));

    const stats = {
      totalFeeds: feeds.length,
      activeFeeds: feeds.filter((f: any) => f.is_active).length,
      lastSyncTime: feeds.filter((f: any) => f.last_sync_at).sort((a: any, b: any) => new Date(b.last_sync_at).getTime() - new Date(a.last_sync_at).getTime())[0]?.last_sync_at,
      bookingsImported: feeds.reduce((s: number, f: any) => s + Number(f.bookings_imported), 0),
      errors: feeds.filter((f: any) => f.last_sync_status === 'error').length,
    };

    res.json({ feeds, stats });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch feeds', error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/feeds', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const data = CreateFeedSchema.parse(req.body);

    const { rows: roomRows } = await pool.query(`SELECT id FROM rooms WHERE id = $1`, [data.roomId]);
    if (roomRows.length === 0) return res.status(404).json({ message: 'Room not found' });

    const { rows: existing } = await pool.query(
      `SELECT id FROM ical_feeds WHERE url = $1 AND room_id = $2`,
      [data.url, data.roomId]
    ).catch(() => ({ rows: [] }));
    if (existing.length > 0) return res.status(400).json({ message: 'A feed with this URL already exists for this room' });

    const { rows } = await pool.query(
      `INSERT INTO ical_feeds (name, url, room_id, platform, is_active) VALUES ($1, $2, $3, $4, true) RETURNING *`,
      [data.name, data.url, data.roomId, data.platform]
    ).catch(() => ({ rows: [] }));

    res.status(201).json({ message: 'Feed created successfully', feed: rows[0] });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: error.errors });
    res.status(500).json({ message: 'Failed to create feed', error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.patch('/feeds/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const data = UpdateFeedSchema.parse(req.body);

    const { rows: feedRows } = await pool.query(`SELECT id FROM ical_feeds WHERE id = $1`, [id]).catch(() => ({ rows: [] }));
    if (feedRows.length === 0) return res.status(404).json({ message: 'Feed not found' });

    const updates: string[] = [];
    const params: any[] = [];
    if (data.name !== undefined) { params.push(data.name); updates.push(`name = $${params.length}`); }
    if (data.url !== undefined) { params.push(data.url); updates.push(`url = $${params.length}`); }
    if (data.isActive !== undefined) { params.push(data.isActive); updates.push(`is_active = $${params.length}`); }

    params.push(id);
    const { rows } = await pool.query(
      `UPDATE ical_feeds SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
      params
    ).catch(() => ({ rows: [] }));

    res.json({ message: 'Feed updated successfully', feed: rows[0] });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: error.errors });
    res.status(500).json({ message: 'Failed to update feed', error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.delete('/feeds/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: feedRows } = await pool.query(`SELECT id FROM ical_feeds WHERE id = $1`, [id]).catch(() => ({ rows: [] }));
    if (feedRows.length === 0) return res.status(404).json({ message: 'Feed not found' });

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM reservations WHERE metadata->>'ical_feed_id' = $1`,
      [id]
    );
    const bookingsCount = Number(countRows[0].count);

    if (bookingsCount > 0) {
      await pool.query(`UPDATE reservations SET status = 'cancelled' WHERE metadata->>'ical_feed_id' = $1`, [id]);
    }

    await pool.query(`DELETE FROM ical_feeds WHERE id = $1`, [id]).catch(() => {});
    res.json({ message: 'Feed deleted successfully', bookingsDeleted: bookingsCount });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete feed', error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/feeds/:id/sync', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(`SELECT id, is_active FROM ical_feeds WHERE id = $1`, [id]).catch(() => ({ rows: [] }));
    if (rows.length === 0) return res.status(404).json({ message: 'Feed not found' });
    if (!rows[0].is_active) return res.status(400).json({ message: 'Feed is not active' });

    const result = await otaSync.syncFeed(id);
    if (!result.success) return res.status(500).json({ message: 'Sync failed', errors: result.errors });

    res.json({ message: 'Sync completed successfully', result: { bookingsImported: result.bookingsImported, bookingsUpdated: result.bookingsUpdated, blockedDatesCreated: result.blockedDatesCreated, conflictsResolved: result.conflictsResolved, syncedAt: result.syncedAt } });
  } catch (error) {
    res.status(500).json({ message: 'Sync failed', error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/sync-all', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const result = await otaSync.syncAllActiveFeeds();
    res.json({
      message: 'Batch sync completed',
      totalImported: result.totalBookingsImported,
      totalUpdated: result.totalBookingsUpdated,
      feedsSynced: result.successfulFeeds,
      feedsFailed: result.failedFeeds,
      results: result.results.map(r => ({ feedName: r.feedName, success: r.success, bookingsImported: r.bookingsImported, bookingsUpdated: r.bookingsUpdated, errors: r.errors })),
    });
  } catch (error) {
    res.status(500).json({ message: 'Batch sync failed', error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/settings', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT value FROM system_config WHERE key = 'ical_sync'`);
    const config = rows[0]?.value || { autoSync: true, syncInterval: 60 };
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch settings', error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.patch('/settings', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { autoSync, syncInterval } = req.body;
    if (typeof autoSync !== 'boolean' && autoSync !== undefined) return res.status(400).json({ message: 'autoSync must be a boolean' });
    if (syncInterval !== undefined) {
      const interval = Number(syncInterval);
      if (isNaN(interval) || interval < 15 || interval > 1440) return res.status(400).json({ message: 'syncInterval must be between 15 and 1440 minutes' });
    }

    const value = JSON.stringify({ autoSync: autoSync ?? true, syncInterval: syncInterval ?? 60 });
    await pool.query(
      `INSERT INTO system_config (key, value, description) VALUES ('ical_sync', $1::jsonb, 'iCal sync settings')
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [value]
    );

    res.json({ message: 'Settings updated successfully', settings: { autoSync: autoSync ?? true, syncInterval: syncInterval ?? 60 } });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update settings', error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;
