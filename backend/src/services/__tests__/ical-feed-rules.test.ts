jest.mock('../../config/database', () => ({ query: jest.fn(), withTransaction: jest.fn() }));
jest.mock('../email-service', () => ({ emailService: { sendAdminAlert: jest.fn() } }));
jest.mock('../channel-service', () => ({ channelService: {} }));

import { feedAlertThreshold, isBeyondSalesHorizon, parseICalEvents } from '../ical-service';

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

describe('cierre de horizonte de la plataforma', () => {
  const now = new Date('2026-10-08T12:00:00Z');
  it('ignora eventos que terminan despues de hoy+365 o empiezan a mas de 360 dias', () => {
    expect(isBeyondSalesHorizon('2027-10-08', '2027-10-12', now)).toBe(true);
    expect(isBeyondSalesHorizon('2027-10-13', '2027-11-02', now)).toBe(true);
    expect(isBeyondSalesHorizon('2027-10-01', '2027-10-12', now)).toBe(true);
  });
  it('no ignora una estadia normal', () => {
    expect(isBeyondSalesHorizon('2026-10-09', '2026-10-13', now)).toBe(false);
    expect(isBeyondSalesHorizon('2027-01-04', '2027-01-05', now)).toBe(false);
  });
});

describe('eventos con UID repetido', () => {
  const event = (start: string, end: string) => [
    'BEGIN:VEVENT', 'UID:mismo-uid-1234@booking.com', `DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${end}`,
    'SUMMARY:CLOSED - Not available', 'END:VEVENT',
  ];
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//t//EN', ...event('20261009', '20261013'), ...event('20261016', '20261018'), 'END:VCALENDAR'].join('\r\n');

  it('avisa que un evento se perdio en vez de descartarlo en silencio', async () => {
    const { events, errors } = await parseICalEvents(ics, 'booking');
    expect(events).toHaveLength(1);
    expect(errors.join(' ')).toMatch(/UID repetido/);
  });
});
