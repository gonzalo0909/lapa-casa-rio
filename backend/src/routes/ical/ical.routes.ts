// lapa-casa-hostel/backend/src/routes/ical/ical.routes.ts

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth';
import { OTASync } from '../../integrations/ical/ota-sync';
import { ICalGenerator } from '../../integrations/ical/ical-generator';

/**
 * @module ICalRoutes
 * @description API routes for iCal feed management
 */

const router = Router();
const prisma = new PrismaClient();
const otaSync = new OTASync();
const icalGenerator = new ICalGenerator();

/**
 * @schema CreateFeedSchema
 * @description Validation schema for creating iCal feeds
 */
const CreateFeedSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  roomId: z.string().uuid(),
  platform: z.enum(['airbnb', 'booking', 'expedia', 'vrbo', 'hostelworld', 'custom']),
});

/**
 * @schema UpdateFeedSchema
 * @description Validation schema for updating iCal feeds
 */
const UpdateFeedSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  isActive: z.boolean().optional(),
});

/**
 * @route GET /api/admin/ical/feeds
 * @description Get all iCal feeds with statistics
 * @access Admin only
 */
router.get('/feeds', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const feeds = await prisma.iCalFeed.findMany({
      include: {
        room: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        _count: {
          select: {
            bookings: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate statistics
    const stats = {
      totalFeeds: feeds.length,
      activeFeeds: feeds.filter(f => f.isActive).length,
      lastSyncTime: feeds
        .filter(f => f.lastSyncAt)
        .sort((a, b) => (b.lastSyncAt?.getTime() || 0) - (a.lastSyncAt?.getTime() || 0))[0]
        ?.lastSyncAt,
      bookingsImported: feeds.reduce((sum, f) => sum + f._count.bookings, 0),
      errors: feeds.filter(f => f.lastSyncStatus === 'error').length,
    };

    // Format feeds
    const formattedFeeds = feeds.map(feed => ({
      id: feed.id,
      name: feed.name,
      url: feed.url,
      roomId: feed.roomId,
      roomName: feed.room.name,
      platform: feed.platform,
      isActive: feed.isActive,
      lastSync: feed.lastSyncAt,
      syncStatus: feed.lastSyncStatus,
      errorMessage: feed.lastSyncError,
      bookingsImported: feed._count.bookings,
    }));

    res.json({
      feeds: formattedFeeds,
      stats,
    });
  } catch (error) {
    console.error('Error fetching feeds:', error);
    res.status(500).json({
      message: 'Failed to fetch feeds',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route POST /api/admin/ical/feeds
 * @description Create a new iCal feed
 * @access Admin only
 */
router.post('/feeds', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const validatedData = CreateFeedSchema.parse(req.body);

    // Verify room exists
    const room = await prisma.room.findUnique({
      where: { id: validatedData.roomId },
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Check for duplicate URL
    const existing = await prisma.iCalFeed.findFirst({
      where: {
        url: validatedData.url,
        roomId: validatedData.roomId,
      },
    });

    if (existing) {
      return res.status(400).json({
        message: 'A feed with this URL already exists for this room',
      });
    }

    // Create feed
    const feed = await prisma.iCalFeed.create({
      data: {
        name: validatedData.name,
        url: validatedData.url,
        roomId: validatedData.roomId,
        platform: validatedData.platform,
        isActive: true,
      },
      include: {
        room: {
          select: {
            name: true,
            type: true,
          },
        },
      },
    });

    res.status(201).json({
      message: 'Feed created successfully',
      feed: {
        id: feed.id,
        name: feed.name,
        url: feed.url,
        roomId: feed.roomId,
        roomName: feed.room.name,
        platform: feed.platform,
        isActive: feed.isActive,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.errors,
      });
    }

    console.error('Error creating feed:', error);
    res.status(500).json({
      message: 'Failed to create feed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route PATCH /api/admin/ical/feeds/:id
 * @description Update an iCal feed
 * @access Admin only
 */
router.patch('/feeds/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = UpdateFeedSchema.parse(req.body);

    // Check if feed exists
    const feed = await prisma.iCalFeed.findUnique({
      where: { id },
    });

    if (!feed) {
      return res.status(404).json({ message: 'Feed not found' });
    }

    // Update feed
    const updated = await prisma.iCalFeed.update({
      where: { id },
      data: validatedData,
      include: {
        room: {
          select: {
            name: true,
          },
        },
      },
    });

    res.json({
      message: 'Feed updated successfully',
      feed: {
        id: updated.id,
        name: updated.name,
        url: updated.url,
        roomId: updated.roomId,
        roomName: updated.room.name,
        platform: updated.platform,
        isActive: updated.isActive,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.errors,
      });
    }

    console.error('Error updating feed:', error);
    res.status(500).json({
      message: 'Failed to update feed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route DELETE /api/admin/ical/feeds/:id
 * @description Delete an iCal feed
 * @access Admin only
 */
router.delete('/feeds/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if feed exists
    const feed = await prisma.iCalFeed.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            bookings: true,
          },
        },
      },
    });

    if (!feed) {
      return res.status(404).json({ message: 'Feed not found' });
    }

    // Optionally delete associated bookings
    if (feed._count.bookings > 0) {
      await prisma.booking.deleteMany({
        where: {
          iCalFeedId: id,
          source: 'ical',
        },
      });
    }

    // Delete feed
    await prisma.iCalFeed.delete({
      where: { id },
    });

    res.json({
      message: 'Feed deleted successfully',
      bookingsDeleted: feed._count.bookings,
    });
  } catch (error) {
    console.error('Error deleting feed:', error);
    res.status(500).json({
      message: 'Failed to delete feed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route POST /api/admin/ical/feeds/:id/sync
 * @description Manually sync a specific feed
 * @access Admin only
 */
router.post('/feeds/:id/sync', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Verify feed exists
    const feed = await prisma.iCalFeed.findUnique({
      where: { id },
    });

    if (!feed) {
      return res.status(404).json({ message: 'Feed not found' });
    }

    if (!feed.isActive) {
      return res.status(400).json({ message: 'Feed is not active' });
    }

    // Sync feed
    const result = await otaSync.syncFeed(id);

    if (!result.success) {
      return res.status(500).json({
        message: 'Sync failed',
        errors: result.errors,
      });
    }

    res.json({
      message: 'Sync completed successfully',
      result: {
        bookingsImported: result.bookingsImported,
        bookingsUpdated: result.bookingsUpdated,
        blockedDatesCreated: result.blockedDatesCreated,
        conflictsResolved: result.conflictsResolved,
        syncedAt: result.syncedAt,
      },
    });
  } catch (error) {
    console.error('Error syncing feed:', error);
    res.status(500).json({
      message: 'Sync failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route POST /api/admin/ical/sync-all
 * @description Sync all active feeds
 * @access Admin only
 */
router.post('/sync-all', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const result = await otaSync.syncAllActiveFeeds();

    res.json({
      message: 'Batch sync completed',
      totalImported: result.totalBookingsImported,
      totalUpdated: result.totalBookingsUpdated,
      feedsSynced: result.successfulFeeds,
      feedsFailed: result.failedFeeds,
      results: result.results.map(r => ({
        feedName: r.feedName,
        success: r.success,
        bookingsImported: r.bookingsImported,
        bookingsUpdated: r.bookingsUpdated,
        errors: r.errors,
      })),
    });
  } catch (error) {
    console.error('Error syncing all feeds:', error);
    res.status(500).json({
      message: 'Batch sync failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route GET /api/admin/ical/settings
 * @description Get iCal sync settings
 * @access Admin only
 */
router.get('/settings', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const settings = await prisma.settings.findFirst({
      where: { key: 'ical_sync' },
    });

    const config = settings?.value as any || {
      autoSync: true,
      syncInterval: 60, // minutes
    };

    res.json(config);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({
      message: 'Failed to fetch settings',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route PATCH /api/admin/ical/settings
 * @description Update iCal sync settings
 * @access Admin only
 */
router.patch('/settings', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { autoSync, syncInterval } = req.body;

    // Validate
    if (typeof autoSync !== 'boolean' && autoSync !== undefined) {
      return res.status(400).json({ message: 'autoSync must be a boolean' });
    }

    if (syncInterval !== undefined) {
      const interval = Number(syncInterval);
      if (isNaN(interval) || interval < 15 || interval > 1440) {
        return res.status(400).json({
          message: 'syncInterval must be between 15 and 1440 minutes',
        });
      }
    }

    // Update or create settings
    const settings = await prisma.settings.upsert({
      where: { key: 'ical_sync' },
      create: {
        key: 'ical_sync',
        value: {
          autoSync: autoSync ?? true,
          syncInterval: syncInterval ?? 60,
        },
      },
      update: {
        value: {
          autoSync: autoSync ?? true,
          syncInterval: syncInterval ?? 60,
        },
      },
    });

    res.json({
      message: 'Settings updated successfully',
      settings: settings.value,
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({
      message: 'Failed to update settings',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

// ✅ Archivo 5/10 completado
