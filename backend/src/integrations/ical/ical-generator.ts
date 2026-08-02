// lapa-casa-hostel/backend/src/integrations/ical/ical-generator.ts

import ical, { ICalCalendar, ICalEventData } from 'ical-generator';
import { pool } from '../../config/database';

export interface GeneratorOptions {
  includeBlocked?: boolean;
  includePending?: boolean;
  futureMonths?: number;
  pastMonths?: number;
  timezone?: string;
}

interface BookingEvent {
  id: string;
  guestName: string;
  checkIn: Date;
  checkOut: Date;
  status: string;
  platform?: string;
  notes?: string;
}

export class ICalGenerator {
  private readonly hostelName: string;
  private readonly hostelUrl: string;
  private readonly timezone: string;

  constructor(
    hostelName: string = 'Lapa Casa Hostel',
    hostelUrl: string = 'https://lapacasahostel.com',
    timezone: string = 'America/Sao_Paulo'
  ) {
    this.hostelName = hostelName;
    this.hostelUrl = hostelUrl;
    this.timezone = timezone;
  }

  async generateForRoom(roomId: string, options: GeneratorOptions = {}): Promise<string> {
    const { includeBlocked = true, includePending = false, futureMonths = 12, pastMonths = 1, timezone = this.timezone } = options;

    const { rows: roomRows } = await pool.query(`SELECT id, name FROM rooms WHERE id = $1`, [roomId]);
    if (roomRows.length === 0) throw new Error(`Room not found: ${roomId}`);
    const room = roomRows[0];

    const now = new Date();
    const startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - pastMonths);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + futureMonths);
    endDate.setHours(23, 59, 59, 999);

    const bookings = await this.fetchBookings(roomId, startDate, endDate, includeBlocked, includePending);

    const calendar = ical({
      name: `${this.hostelName} - ${room.name}`,
      description: `Availability calendar for ${room.name}`,
      timezone,
      url: `${this.hostelUrl}/api/ical/export/${roomId}`,
      ttl: 3600,
    });

    for (const booking of bookings) {
      this.addEventToCalendar(calendar, booking, room.name);
    }

    return calendar.toString();
  }

  async generateForMultipleRooms(roomIds: string[], options: GeneratorOptions = {}): Promise<string> {
    const { includeBlocked = true, includePending = false, futureMonths = 12, pastMonths = 1, timezone = this.timezone } = options;

    const { rows: rooms } = await pool.query(
      `SELECT id, name FROM rooms WHERE id = ANY($1::uuid[])`,
      [roomIds]
    );
    if (rooms.length === 0) throw new Error('No valid rooms found');

    const now = new Date();
    const startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - pastMonths);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + futureMonths);
    endDate.setHours(23, 59, 59, 999);

    const calendar = ical({
      name: `${this.hostelName} - Multiple Rooms`,
      description: `Combined availability calendar`,
      timezone,
      url: `${this.hostelUrl}/api/ical/export/combined`,
      ttl: 3600,
    });

    for (const room of rooms) {
      const bookings = await this.fetchBookings(room.id, startDate, endDate, includeBlocked, includePending);
      for (const booking of bookings) {
        this.addEventToCalendar(calendar, booking, room.name);
      }
    }

    return calendar.toString();
  }

  async generateBlockedDates(roomId: string, startDate: Date, endDate: Date): Promise<string> {
    const { rows: roomRows } = await pool.query(`SELECT name FROM rooms WHERE id = $1`, [roomId]);
    if (roomRows.length === 0) throw new Error(`Room not found: ${roomId}`);
    const room = roomRows[0];

    const { rows: blockRows } = await pool.query(
      `SELECT key, value FROM system_config WHERE key LIKE 'block_%' AND value->>'roomId' = $1`,
      [roomId]
    );

    const calendar = ical({
      name: `${this.hostelName} - ${room.name} - Blocked Dates`,
      description: `Blocked dates for ${room.name}`,
      timezone: this.timezone,
    });

    for (const row of blockRows) {
      const v = row.value;
      const blockStart = new Date(v.startDate);
      const blockEnd = new Date(v.endDate);
      if (blockStart >= startDate && blockEnd <= endDate) {
        calendar.createEvent({
          id: row.key,
          start: blockStart,
          end: blockEnd,
          summary: `Blocked - ${room.name}`,
          description: v.reason || 'Date blocked',
          status: 'CANCELLED',
          busystatus: 'BUSY',
        });
      }
    }

    return calendar.toString();
  }

  private async fetchBookings(
    roomId: string,
    startDate: Date,
    endDate: Date,
    includeBlocked: boolean,
    includePending: boolean
  ): Promise<BookingEvent[]> {
    const statuses = ['confirmed'];
    if (includePending) statuses.push('pending_payment');

    const { rows } = await pool.query(
      `SELECT DISTINCT r.id, g.full_name AS "guestName", rb.check_in AS "checkIn", rb.check_out AS "checkOut",
              r.status, c.code AS platform, r.notes
       FROM reservations r
       JOIN guests g ON g.id = r.guest_id
       JOIN reservation_beds rb ON rb.reservation_id = r.id
       JOIN beds b ON b.id = rb.bed_id
       JOIN channels c ON c.id = r.channel_id
       WHERE b.room_id = $1
         AND r.status = ANY($2::booking_status[])
         AND rb.check_in < $4 AND rb.check_out > $3
       ORDER BY rb.check_in`,
      [roomId, statuses, startDate, endDate]
    );

    return rows;
  }

  private addEventToCalendar(calendar: ICalCalendar, booking: BookingEvent, roomName: string): void {
    const isPending = booking.status === 'pending_payment';
    const summary = isPending ? `Pending - ${roomName}` : `Reserved - ${roomName}`;
    const description = [
      `Guest: ${booking.guestName}`,
      booking.platform && booking.platform !== 'direct' ? `Platform: ${booking.platform}` : '',
      booking.notes ? `Notes: ${booking.notes}` : '',
    ].filter(Boolean).join('\n');

    const eventData: ICalEventData = {
      id: booking.id,
      start: booking.checkIn,
      end: booking.checkOut,
      summary,
      description,
      location: this.hostelName,
      url: `${this.hostelUrl}/admin/bookings/${booking.id}`,
      status: isPending ? 'TENTATIVE' : 'CONFIRMED',
      busystatus: 'BUSY',
      sequence: 0,
      created: new Date(),
      lastModified: new Date(),
    };

    calendar.createEvent(eventData);
  }

  validateCalendar(icalString: string): boolean {
    if (!icalString?.trim().startsWith('BEGIN:VCALENDAR')) return false;
    if (!icalString.trim().endsWith('END:VCALENDAR')) return false;
    if (!icalString.includes('VERSION:2.0')) return false;
    if (!icalString.includes('PRODID:')) return false;
    return true;
  }
}

export function createGenerator(hostelName?: string, hostelUrl?: string, timezone?: string): ICalGenerator {
  return new ICalGenerator(hostelName, hostelUrl, timezone);
}
