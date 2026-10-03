jest.mock('../../config/database', () => ({ query: jest.fn(), withTransaction: jest.fn() }));
jest.mock('../../database/repositories/guest-repository', () => ({ __esModule: true, default: { upsert: jest.fn().mockResolvedValue({ id: 'g-1' }) } }));
jest.mock('../../database/lock-middleware', () => ({ acquireLock: jest.fn() }));
jest.mock('../conflict-service', () => ({ conflictService: { recordConflict: jest.fn() } }));
jest.mock('../email-service', () => ({ emailService: { sendAdminAlert: jest.fn() } }));
jest.mock('../apartment-unit', () => ({
  isApartmentRoomType: jest.fn().mockResolvedValue(true),
  isUnitOccupied: jest.fn().mockResolvedValue(false),
  insertUnitBlock: jest.fn(),
}));

import { query, withTransaction } from '../../config/database';
import { channelService } from '../channel-service';

const queryMock = query as jest.Mock;
const txMock = withTransaction as jest.Mock;
const base = { externalReservationId: 'NEW-ID', roomTypeId: 'room-1', guestName: 'Ana', checkIn: '2026-10-10', checkOut: '2026-10-12' };

// canal, existe por id (no), room_type
const preamble = () => queryMock
  .mockResolvedValueOnce({ rows: [{ id: 'ch-1', code: 'booking' }] })
  .mockResolvedValueOnce({ rows: [] })
  .mockResolvedValueOnce({ rows: [{ id: 'room-1', code: 'apt1', name: 'Apto 1' }] });

describe('misma estadia: casos con id o fechas distintas', () => {
  beforeEach(() => { queryMock.mockReset(); txMock.mockReset(); });

  it('webhook que llega despues del iCal: adopta el id del webhook (para poder cancelarla)', async () => {
    preamble().mockResolvedValueOnce({ rows: [{ id: 'res-9', external_reservation_id: 'ical-uid' }] }).mockResolvedValueOnce({ rows: [] });
    const result = await channelService.handleChannelBooking({ ...base, source: 'webhook' }, 'ch-1');
    expect(result).toEqual({ reservationId: 'res-9', deduplicated: true, matchedExternalId: 'NEW-ID' });
    const update = queryMock.mock.calls[4];
    expect(update[0]).toContain('UPDATE reservations SET external_reservation_id');
    expect(update[1]).toEqual(['res-9', 'NEW-ID']);
  });

  it('iCal sobre una estadia con fechas cambiadas: actualiza la reserva en vez de crear un conflicto', async () => {
    preamble()
      .mockResolvedValueOnce({ rows: [] }) // fechas exactas: no
      .mockResolvedValueOnce({ rows: [{ id: 'res-9', external_reservation_id: 'BK-555' }] }); // superpuesta y fuera del feed
    const client = { query: jest.fn().mockResolvedValue({ rows: [{ bed_id: null, room_type_id: 'room-1' }] }) };
    txMock.mockImplementation(async (fn: (c: unknown) => unknown) => fn(client));

    const result = await channelService.handleChannelBooking({ ...base, source: 'ical', feedExternalIds: ['NEW-ID'] }, 'ch-1');

    expect(result).toEqual({ reservationId: 'res-9', deduplicated: true, updated: true, matchedExternalId: 'BK-555' });
    const [sql, params] = queryMock.mock.calls[4];
    expect(sql).toContain('NOT (r.external_reservation_id = ANY($5::text[]))');
    expect(params[4]).toEqual(['NEW-ID']);
    expect(client.query.mock.calls.some((c) => String(c[0]).includes('UPDATE reservation_beds'))).toBe(true);
  });

  it('sin feedExternalIds (webhook) no busca fechas cambiadas', async () => {
    preamble().mockResolvedValueOnce({ rows: [] });
    txMock.mockRejectedValue(new Error('stop'));
    await expect(channelService.handleChannelBooking({ ...base, source: 'webhook' }, 'ch-1')).rejects.toThrow('stop');
    expect(queryMock.mock.calls.some((c) => String(c[0]).includes('daterange(rb.check_in, rb.check_out')
      && String(c[0]).includes('NOT (r.external_reservation_id'))).toBe(false);
  });
});

describe('cierre del propietario: sin precio y fuera de estadisticas', () => {
  beforeEach(() => { queryMock.mockReset(); txMock.mockReset(); });

  const run = async (ownerBlock: boolean) => {
    preamble().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    let insertParams: unknown[] = [];
    const client = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes('INSERT INTO reservations')) { insertParams = params ?? []; return { rows: [{ id: 'res-new' }] }; }
        if (sql.includes('base_price FROM room_types')) {return { rows: [{ base_price: '100' }] };}
        if (sql.includes('calculate_final_price')) {return { rows: [{ v: '100' }] };}
        if (sql.includes('calculate_season_multiplier')) {return { rows: [{ v: '1' }] };}
        if (sql.includes('calculate_')) {return { rows: [{ v: '0' }] };}
        return { rows: [] };
      }),
    };
    txMock.mockImplementation(async (fn: (c: unknown) => unknown) => fn(client));
    await channelService.handleChannelBooking({ ...base, source: 'ical', feedExternalIds: ['NEW-ID'], ownerBlock }, 'ch-1');
    return insertParams;
  };

  it('ownerBlock: final_price 0 y source <canal>_ical_block', async () => {
    const params = await run(true);
    expect(params[13]).toBe(0);
    expect(params[14]).toBe('booking_ical_block');
  });
  it('reserva normal: conserva precio y source del canal', async () => {
    const params = await run(false);
    expect(params[13]).toBeGreaterThan(0);
    expect(params[14]).toBe('booking');
  });
});
