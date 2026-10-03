jest.mock('../../config/database', () => ({ query: jest.fn(), withTransaction: jest.fn() }));
jest.mock('../email-service', () => ({ emailService: { sendAdminAlert: jest.fn() } }));
jest.mock('../channel-service', () => ({ channelService: {} }));

import { feedAlertThreshold, parseICalEvents } from '../ical-service';

describe('aviso de feed caido', () => {
  it('avisa al primer fallo si la URL esta vencida o sin permiso', () => {
    for (const code of [401, 403, 404, 410]) {
      expect(feedAlertThreshold(`Parseo fallido: HTTP ${code}: Forbidden`)).toBe(1);
    }
  });
  it('espera 3 fallos seguidos si el error puede ser pasajero', () => {
    expect(feedAlertThreshold('HTTP 503: Service Unavailable')).toBe(3);
    expect(feedAlertThreshold('The operation was aborted (timeout)')).toBe(3);
    expect(feedAlertThreshold(undefined)).toBe(3);
  });
});

describe('cierre del propietario en Airbnb', () => {
  const ics = (summary: string) => [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//t//EN', 'BEGIN:VEVENT', 'UID:abc123456@airbnb.com',
    'DTSTART;VALUE=DATE:20261010', 'DTEND;VALUE=DATE:20261012', `SUMMARY:${summary}`, 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');

  it('"Airbnb (Not available)" es un cierre del propietario', async () => {
    const { events } = await parseICalEvents(ics('Airbnb (Not available)'), 'airbnb');
    expect(events[0].isOwnerBlock).toBe(true);
  });
  it('"Reserved" es una reserva real, no un cierre', async () => {
    const { events } = await parseICalEvents(ics('Reserved'), 'airbnb');
    expect(events[0].isOwnerBlock).toBe(false);
  });
  it('en Booking no se puede distinguir, asi que no se marca', async () => {
    const { events } = await parseICalEvents(ics('CLOSED - Not available'), 'booking');
    expect(events[0].isOwnerBlock).toBe(false);
  });
});
