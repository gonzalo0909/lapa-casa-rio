// lapa-casa-hostel/backend/src/routes/ical/export-calendar.ts

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { ICalGenerator } from '../../integrations/ical/ical-generator';
import { rateLimit } from 'express-rate-limit';

/**
 * @module ExportCalendar
 * @description Public routes for exporting iCal calendars
 */

const router = Router();
const prisma = new PrismaClient();
const icalGenerator = new ICalGenerator();

/**
 * @constant exportLimiter
 * @description Rate limiter for calendar exports (100 requests per hour per IP)
 */
const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  message: 'Too many calendar export requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @route GET /api/ical/export/:roomId
 * @description Export iCal calendar for a specific room
 * @access Public (with rate limiting)
 * @param {string} roomId - Room ID
 * @query {string} token - Optional authentication token for private calendars
 * @query {number} months - Number of months ahead to export (default: 12, max: 24)
 * @query {boolean} includeBlocked - Include blocked dates (default: true)
 * @query {boolean} includePending - Include pending bookings (default: false)
 */
router.get('/export/:roomId', exportLimiter, async (req, res) => {
  try {
    const { roomId } = req.params;
    const {
      token,
      months = '12',
      includeBlocked = 'true',
      includePending = 'false',
    } = req.query;

    // Validate room exists
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        name: true,
        type: true,
        isActive: true,
      },
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (!room.isActive) {
      return res.status(403).json({ message: 'Room is not available for export' });
    }

    // Validate months parameter
    const futureMonths = Math.min(Math.max(parseInt(months as string, 10) || 12, 1), 24);

    // Parse boolean parameters
    const shouldIncludeBlocked = includeBlocked === 'true';
    const shouldIncludePending = includePending === 'true';

    // Optional: Verify token for private calendars
    if (token) {
      const isValidToken = await verifyCalendarToken(roomId, token as string);
      if (!isValidToken) {
        return res.status(403).json({ message: 'Invalid calendar token' });
      }
    }

    // Generate calendar
    const calendar = await icalGenerator.generateForRoom(roomId, {
      includeBlocked: shouldIncludeBlocked,
      includePending: shouldIncludePending,
      futureMonths,
      pastMonths: 1,
    });

    // Validate generated calendar
    if (!icalGenerator.validateCalendar(calendar)) {
      throw new Error('Generated calendar is invalid');
    }

    // Set appropriate headers
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(room.name)}.ics"`);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.setHeader('X-Robots-Tag', 'noindex'); // Don't index calendar files

    res.send(calendar);
  } catch (error) {
    console.error('Error generating calendar export:', error);
    res.status(500).json({
      message: 'Failed to generate calendar',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route GET /api/ical/export/combined
 * @description Export combined iCal calendar for multiple rooms
 * @access Public (with rate limiting)
 * @query {string} rooms - Comma-separated room IDs
 * @query {string} token - Optional authentication token
 * @query {number} months - Number of months ahead to export (default: 12, max: 24)
 */
router.get('/export/combined', exportLimiter, async (req, res) => {
  try {
    const {
      rooms,
      token,
      months = '12',
    } = req.query;

    if (!rooms || typeof rooms !== 'string') {
      return res.status(400).json({ message: 'rooms parameter is required' });
    }

    // Parse room IDs
    const roomIds = rooms.split(',').map(id => id.trim()).filter(id => id.length > 0);

    if (roomIds.length === 0) {
      return res.status(400).json({ message: 'At least one room ID is required' });
    }

    if (roomIds.length > 10) {
      return res.status(400).json({ message: 'Maximum 10 rooms allowed' });
    }

    // Validate all rooms exist
    const validRooms = await prisma.room.findMany({
      where: {
        id: { in: roomIds },
        isActive: true,
      },
      select: { id: true },
    });

    if (validRooms.length === 0) {
      return res.status(404).json({ message: 'No valid rooms found' });
    }

    const validRoomIds = validRooms.map(r => r.id);

    // Validate months parameter
    const futureMonths = Math.min(Math.max(parseInt(months as string, 10) || 12, 1), 24);

    // Optional: Verify token
    if (token) {
      const isValidToken = await verifyCalendarToken(validRoomIds.join(','), token as string);
      if (!isValidToken) {
        return res.status(403).json({ message: 'Invalid calendar token' });
      }
    }

    // Generate combined calendar
    const calendar = await icalGenerator.generateForMultipleRooms(validRoomIds, {
      includeBlocked: true,
      includePending: false,
      futureMonths,
      pastMonths: 1,
    });

    // Validate generated calendar
    if (!icalGenerator.validateCalendar(calendar)) {
      throw new Error('Generated calendar is invalid');
    }

    // Set appropriate headers
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="combined-calendar.ics"');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Robots-Tag', 'noindex');

    res.send(calendar);
  } catch (error) {
    console.error('Error generating combined calendar:', error);
    res.status(500).json({
      message: 'Failed to generate calendar',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route GET /api/ical/export/:roomId/blocked
 * @description Export calendar with only blocked dates for a room
 * @access Public (with rate limiting)
 * @param {string} roomId - Room ID
 * @query {string} token - Optional authentication token
 * @query {number} months - Number of months ahead (default: 12, max: 24)
 */
router.get('/export/:roomId/blocked', exportLimiter, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { token, months = '12' } = req.query;

    // Validate room exists
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (!room.isActive) {
      return res.status(403).json({ message: 'Room is not available' });
    }

    // Optional: Verify token
    if (token) {
      const isValidToken = await verifyCalendarToken(roomId, token as string);
      if (!isValidToken) {
        return res.status(403).json({ message: 'Invalid calendar token' });
      }
    }

    // Calculate date range
    const futureMonths = Math.min(Math.max(parseInt(months as string, 10) || 12, 1), 24);
    const now = new Date();
    const startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + futureMonths);
    endDate.setHours(23, 59, 59, 999);

    // Generate blocked dates calendar
    const calendar = await icalGenerator.generateBlockedDates(roomId, startDate, endDate);

    // Validate generated calendar
    if (!icalGenerator.validateCalendar(calendar)) {
      throw new Error('Generated calendar is invalid');
    }

    // Set appropriate headers
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(room.name)}-blocked.ics"`);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Robots-Tag', 'noindex');

    res.send(calendar);
  } catch (error) {
    console.error('Error generating blocked dates calendar:', error);
    res.status(500).json({
      message: 'Failed to generate calendar',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @function verifyCalendarToken
 * @description Verifies a calendar access token
 * @param {string} resourceId - Resource identifier (roomId or combined IDs)
 * @param {string} token - Token to verify
 * @returns {Promise<boolean>} True if token is valid
 */
async function verifyCalendarToken(resourceId: string, token: string): Promise<boolean> {
  try {
    // Look for a valid token in the database
    const calendarToken = await prisma.calendarToken.findFirst({
      where: {
        token,
        resourceId,
        expiresAt: {
          gt: new Date(),
        },
        isActive: true,
      },
    });

    return !!calendarToken;
  } catch (error) {
    console.error('Error verifying calendar token:', error);
    return false;
  }
}

/**
 * @function sanitizeFilename
 * @description Sanitizes a string for use in filenames
 * @param {string} name - Name to sanitize
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

/**
 * @route GET /api/ical/validate/:roomId
 * @description Validate that a room's calendar can be exported
 * @access Public (with rate limiting)
 * @param {string} roomId - Room ID
 */
router.get('/validate/:roomId', exportLimiter, async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        name: true,
        isActive: true,
        _count: {
          select: {
            bookings: true,
          },
        },
      },
    });

    if (!room) {
      return res.status(404).json({
        valid: false,
        message: 'Room not found',
      });
    }

    if (!room.isActive) {
      return res.status(200).json({
        valid: false,
        message: 'Room is not active',
      });
    }

    res.json({
      valid: true,
      roomId: room.id,
      roomName: room.name,
      bookingCount: room._count.bookings,
      exportUrl: `/api/ical/export/${roomId}`,
    });
  } catch (error) {
    console.error('Error validating room:', error);
    res.status(500).json({
      valid: false,
      message: 'Validation failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

// ✅ Archivo 6/10 completado
