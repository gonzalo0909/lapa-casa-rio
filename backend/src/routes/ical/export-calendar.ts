// lapa-casa-hostel/backend/src/routes/ical/export-calendar.ts

import { Router } from 'express';
import { pool } from '../../config/database';
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

router.get('/export/:roomId', exportLimiter, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { token, months = '12', includeBlocked = 'true', includePending = 'false' } = req.query;

    const { rows } = await pool.query(`SELECT id, name, is_active FROM rooms WHERE id = $1`, [roomId]);
    if (rows.length === 0) return res.status(404).json({ message: 'Room not found' });
    const room = rows[0];
    if (!room.is_active) return res.status(403).json({ message: 'Room is not available for export' });

    const futureMonths = Math.min(Math.max(parseInt(months as string, 10) || 12, 1), 24);
    if (token && !(await verifyCalendarToken(roomId, token as string))) {
      return res.status(403).json({ message: 'Invalid calendar token' });
    }

    const calendar = await icalGenerator.generateForRoom(roomId, {
      includeBlocked: includeBlocked === 'true',
      includePending: includePending === 'true',
      futureMonths,
      pastMonths: 1,
    });

    if (!icalGenerator.validateCalendar(calendar)) throw new Error('Generated calendar is invalid');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(room.name)}.ics"`);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Robots-Tag', 'noindex');
    res.send(calendar);
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate calendar', error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/export/combined', exportLimiter, async (req, res) => {
  try {
    const { rooms, token, months = '12' } = req.query;
    if (!rooms || typeof rooms !== 'string') return res.status(400).json({ message: 'rooms parameter is required' });

    const roomIds = rooms.split(',').map(id => id.trim()).filter(Boolean);
    if (roomIds.length === 0) return res.status(400).json({ message: 'At least one room ID is required' });
    if (roomIds.length > 10) return res.status(400).json({ message: 'Maximum 10 rooms allowed' });

    const { rows: validRooms } = await pool.query(
      `SELECT id FROM rooms WHERE id = ANY($1::uuid[]) AND is_active = true`,
      [roomIds]
    );
    if (validRooms.length === 0) return res.status(404).json({ message: 'No valid rooms found' });

    const validRoomIds = validRooms.map((r: any) => r.id);
    const futureMonths = Math.min(Math.max(parseInt(months as string, 10) || 12, 1), 24);

    if (token && !(await verifyCalendarToken(validRoomIds.join(','), token as string))) {
      return res.status(403).json({ message: 'Invalid calendar token' });
    }

    const calendar = await icalGenerator.generateForMultipleRooms(validRoomIds, { includeBlocked: true, includePending: false, futureMonths, pastMonths: 1 });
    if (!icalGenerator.validateCalendar(calendar)) throw new Error('Generated calendar is invalid');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="combined-calendar.ics"');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Robots-Tag', 'noindex');
    res.send(calendar);
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate calendar', error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/export/:roomId/blocked', exportLimiter, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { token, months = '12' } = req.query;

    const { rows } = await pool.query(`SELECT name, is_active FROM rooms WHERE id = $1`, [roomId]);
    if (rows.length === 0) return res.status(404).json({ message: 'Room not found' });
    if (!rows[0].is_active) return res.status(403).json({ message: 'Room is not available' });

    if (token && !(await verifyCalendarToken(roomId, token as string))) {
      return res.status(403).json({ message: 'Invalid calendar token' });
    }

    const futureMonths = Math.min(Math.max(parseInt(months as string, 10) || 12, 1), 24);
    const now = new Date();
    const startDate = new Date(now); startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(now); endDate.setMonth(endDate.getMonth() + futureMonths); endDate.setHours(23, 59, 59, 999);

    const calendar = await icalGenerator.generateBlockedDates(roomId, startDate, endDate);
    if (!icalGenerator.validateCalendar(calendar)) throw new Error('Generated calendar is invalid');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(rows[0].name)}-blocked.ics"`);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Robots-Tag', 'noindex');
    res.send(calendar);
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate calendar', error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/validate/:roomId', exportLimiter, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { rows } = await pool.query(
      `SELECT r.id, r.name, r.is_active, COUNT(res.id) AS booking_count
       FROM rooms r
       LEFT JOIN beds b ON b.room_id = r.id
       LEFT JOIN reservation_beds rb ON rb.bed_id = b.id
       LEFT JOIN reservations res ON res.id = rb.reservation_id AND res.status IN ('confirmed','pending_payment')
       WHERE r.id = $1
       GROUP BY r.id, r.name, r.is_active`,
      [roomId]
    );
    if (rows.length === 0) return res.status(404).json({ valid: false, message: 'Room not found' });
    const room = rows[0];
    if (!room.is_active) return res.json({ valid: false, message: 'Room is not active' });

    res.json({ valid: true, roomId: room.id, roomName: room.name, bookingCount: Number(room.booking_count), exportUrl: `/api/ical/export/${roomId}` });
  } catch (error) {
    res.status(500).json({ valid: false, message: 'Validation failed', error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

async function verifyCalendarToken(resourceId: string, token: string): Promise<boolean> {
  try {
    const { rows } = await pool.query(
      `SELECT value FROM system_config WHERE key = $1`,
      [`calendar_token_${resourceId}`]
    );
    if (rows.length === 0) return false;
    const stored = rows[0].value;
    return stored.token === token && new Date(stored.expiresAt) > new Date() && stored.isActive === true;
  } catch { return false; }
}

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 50);
}

export default router;
