import { Router } from 'express';
import { query } from '../../config/database';
import { ICalGenerator } from '../../integrations/ical/ical-generator';
import { rateLimit } from 'express-rate-limit';

const router = Router();
const icalGenerator = new ICalGenerator();

const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  message: 'Too many calendar export requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Room codes that exist in room_types table
const VALID_ROOM_CODES = [
  'room_mixto_12a',
  'room_mixto_12b',
  'room_mixto_7',
  'room_flexible_7'
];

router.get('/export/:roomId', exportLimiter, async (req, res) => {
  try {
    const { roomId } = req.params;
    const {
      months = '12',
      includeBlocked = 'true',
      includePending = 'false',
    } = req.query;

    const result = await query(
      'SELECT id, name, code FROM room_types WHERE code = $1',
      [roomId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const room = result.rows[0];
    const futureMonths = Math.min(Math.max(parseInt(months as string, 10) || 12, 1), 24);
    const shouldIncludeBlocked = includeBlocked === 'true';
    const shouldIncludePending = includePending === 'true';

    const calendar = await icalGenerator.generateForRoom(room.id, {
      includeBlocked: shouldIncludeBlocked,
      includePending: shouldIncludePending,
      futureMonths,
      pastMonths: 1,
    });

    if (!icalGenerator.validateCalendar(calendar)) {
      throw new Error('Generated calendar is invalid');
    }

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(room.name)}.ics"`);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Robots-Tag', 'noindex');

    res.send(calendar);
  } catch (error) {
    console.error('Error generating calendar export:', error);
    res.status(500).json({
      message: 'Failed to generate calendar',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/export/combined', exportLimiter, async (req, res) => {
  try {
    const { rooms, months = '12' } = req.query;

    if (!rooms || typeof rooms !== 'string') {
      return res.status(400).json({ message: 'rooms parameter is required' });
    }

    const roomCodes = rooms.split(',').map(id => id.trim()).filter(id => id.length > 0);

    if (roomCodes.length === 0) {
      return res.status(400).json({ message: 'At least one room ID is required' });
    }

    if (roomCodes.length > 10) {
      return res.status(400).json({ message: 'Maximum 10 rooms allowed' });
    }

    const result = await query(
      'SELECT id FROM room_types WHERE code = ANY($1)',
      [roomCodes]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No valid rooms found' });
    }

    const validRoomIds = result.rows.map((r: any) => r.id);
    const futureMonths = Math.min(Math.max(parseInt(months as string, 10) || 12, 1), 24);

    const calendar = await icalGenerator.generateForMultipleRooms(validRoomIds, {
      includeBlocked: true,
      includePending: false,
      futureMonths,
      pastMonths: 1,
    });

    if (!icalGenerator.validateCalendar(calendar)) {
      throw new Error('Generated calendar is invalid');
    }

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

router.get('/export/:roomId/blocked', exportLimiter, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { months = '12' } = req.query;

    const result = await query(
      'SELECT id, name FROM room_types WHERE code = $1',
      [roomId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const room = result.rows[0];
    const futureMonths = Math.min(Math.max(parseInt(months as string, 10) || 12, 1), 24);
    const now = new Date();
    const startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + futureMonths);
    endDate.setHours(23, 59, 59, 999);

    const calendar = await icalGenerator.generateBlockedDates(room.id, startDate, endDate);

    if (!icalGenerator.validateCalendar(calendar)) {
      throw new Error('Generated calendar is invalid');
    }

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

router.get('/validate/:roomId', exportLimiter, async (req, res) => {
  try {
    const { roomId } = req.params;

    const result = await query(
      'SELECT id, name FROM room_types WHERE code = $1',
      [roomId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ valid: false, message: 'Room not found' });
    }

    const room = result.rows[0];

    const countResult = await query(
      'SELECT COUNT(*) as count FROM reservations WHERE room_type_id = $1',
      [room.id]
    );

    res.json({
      valid: true,
      roomId: room.id,
      roomName: room.name,
      bookingCount: parseInt(countResult.rows[0].count, 10),
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

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

export default router;
