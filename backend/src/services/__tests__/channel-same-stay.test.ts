jest.mock('../../config/database', () => ({ query: jest.fn(), withTransaction: jest.fn() }));
jest.mock('../../database/repositories/guest-repository', () => ({ __esModule: true, default: { upsert: jest.fn() } }));
jest.mock('../../database/lock-middleware', () => ({ acquireLock: jest.fn() }));
jest.mock('../conflict-service', () => ({ conflictService: { recordConflict: jest.fn() } }));

import { query, withTransaction } from '../../config/database';
import { conflictService } from '../conflict-service';
import { channelService } from '../channel-service';

const queryMock = query as jest.Mock;
const incoming = {
  externalReservationId: 'ical-uid-123',
  roomTypeId: 'room-1',
  guestName: 'booking (iCal)',
  checkIn: '2026-10-10',
  checkOut: '2026-10-12',
};

describe('misma estadia por webhook e iCal (apartamentos)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('no duplica ni registra conflicto: devuelve la reserva ya guardada con otro id', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: 'ch-1', code: 'booking' }] }) // getChannelById
      .mockResolvedValueOnce({ rows: [] }) // no existe por id externo
      .mockResolvedValueOnce({ rows: [{ id: 'room-1', code: 'apt1', name: 'Apto 1' }] }) // getRoomTypeById
      .mockResolvedValueOnce({ rows: [{ id: 'res-9', external_reservation_id: 'BK-555' }] }); // misma estadia

    const result = await channelService.handleChannelBooking(incoming, 'ch-1');

    expect(result).toEqual({ reservationId: 'res-9', deduplicated: true, matchedExternalId: 'BK-555' });
    expect(withTransaction).not.toHaveBeenCalled();
    expect(conflictService.recordConflict).not.toHaveBeenCalled();
  });

  it('la consulta se limita a apartamentos, mismo canal, fechas exactas y otro id', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: 'ch-1', code: 'booking' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'room-1', code: 'apt1', name: 'Apto 1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'res-9', external_reservation_id: 'BK-555' }] });

    await channelService.handleChannelBooking(incoming, 'ch-1');

    const [sql, params] = queryMock.mock.calls[3];
    expect(sql).toContain("rt.property_type = 'apartment'");
    expect(sql).toContain('r.external_reservation_id <> $5');
    expect(params).toEqual(['room-1', 'ch-1', '2026-10-10', '2026-10-12', 'ical-uid-123']);
  });
});
