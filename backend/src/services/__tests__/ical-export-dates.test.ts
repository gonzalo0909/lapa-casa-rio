jest.mock('../../config/database', () => ({ query: jest.fn(), withTransaction: jest.fn() }));
jest.mock('../email-service', () => ({ emailService: { sendAdminAlert: jest.fn() } }));
jest.mock('../channel-service', () => ({ channelService: {} }));

import { query } from '../../config/database';
import { generateApartmentICalFeed, toCalendarDate } from '../ical-service';

const queryMock = query as jest.Mock;

describe('exportacion iCal: fechas de dia completo', () => {
  const originalTz = process.env.TZ;
  afterEach(() => { process.env.TZ = originalTz; queryMock.mockReset(); });

  // pg entrega las columnas DATE como Date a medianoche local; tambien se acepta 'YYYY-MM-DD'.
  const cases: Array<[string, () => string | Date, () => string | Date]> = [
    ['Date local', () => new Date(2026, 9, 10), () => new Date(2026, 9, 12)],
    ['string ISO', () => '2026-10-10', () => '2026-10-12'],
  ];

  for (const tz of ['UTC', 'America/Sao_Paulo', 'Asia/Tokyo']) {
    for (const [label, start, end] of cases) {
      it(`emite DTSTART/DTEND con VALUE=DATE (TZ=${tz}, ${label})`, async () => {
        process.env.TZ = tz;
        queryMock
          .mockResolvedValueOnce({ rows: [{ id: 'room-1', code: 'apt1', name: 'Apto 1' }] })
          .mockResolvedValueOnce({ rows: [{ id: 'res-1', guestName: 'X', checkIn: start(), checkOut: end(), status: 'confirmed' }] })
          .mockResolvedValueOnce({ rows: [{ id: 'blk-1', checkIn: start(), checkOut: end() }] });

        const ics = await generateApartmentICalFeed('room-1');

        const starts = ics.match(/DTSTART;VALUE=DATE:\d{8}/g);
        const ends = ics.match(/DTEND;VALUE=DATE:\d{8}/g);
        expect(starts).toEqual(['DTSTART;VALUE=DATE:20261010', 'DTSTART;VALUE=DATE:20261010']);
        expect(ends).toEqual(['DTEND;VALUE=DATE:20261012', 'DTEND;VALUE=DATE:20261012']);
        expect(ics).not.toMatch(/DTSTART:\d{8}T/);
      });
    }
  }

  it('toCalendarDate conserva el dia calendario', () => {
    expect(toCalendarDate('2026-12-31').getDate()).toBe(31);
    expect(toCalendarDate(new Date(2026, 0, 1)).getMonth()).toBe(0);
  });
});
