jest.mock('../../config/database', () => ({ query: jest.fn(), withTransaction: jest.fn() }));
jest.mock('../../database/repositories/guest-repository', () => ({ __esModule: true, default: { upsert: jest.fn() } }));
jest.mock('../../database/lock-middleware', () => ({ acquireLock: jest.fn() }));
jest.mock('../conflict-service', () => ({ conflictService: { recordConflict: jest.fn() } }));
jest.mock('../email-service', () => ({ emailService: { sendAdminAlert: jest.fn().mockResolvedValue({}) } }));

import { query, withTransaction } from '../../config/database';
import { conflictService } from '../conflict-service';
import { emailService } from '../email-service';
import { channelService, OtaAvailabilityError } from '../channel-service';

const queryMock = query as jest.Mock;
const incoming = { externalReservationId: 'uid-7', roomTypeId: 'room-1', guestName: 'airbnb (iCal)', checkIn: '2026-10-10', checkOut: '2026-10-12' };

// consultas previas al insert: canal, existe por id, room_type, misma estadia
const preamble = () => queryMock
  .mockResolvedValueOnce({ rows: [{ id: 'ch-1', code: 'airbnb' }] })
  .mockResolvedValueOnce({ rows: [] })
  .mockResolvedValueOnce({ rows: [{ id: 'room-1', code: 'apt1', name: 'Apto 1' }] })
  .mockResolvedValueOnce({ rows: [] });

describe('reserva OTA rechazada sin bloqueador', () => {
  beforeEach(() => { jest.clearAllMocks(); (withTransaction as jest.Mock).mockRejectedValue(new OtaAvailabilityError({})); });

  it('avisa al admin una vez y no crea fila de conflicto', async () => {
    preamble()
      .mockResolvedValueOnce({ rows: [] }) // findBlockingReservation: nadie
      .mockResolvedValueOnce({ rows: [{ key: 'k' }] }); // primera vez
    await expect(channelService.handleChannelBooking(incoming, 'ch-1')).rejects.toBeInstanceOf(OtaAvailabilityError);
    expect(emailService.sendAdminAlert).toHaveBeenCalledTimes(1);
    expect(conflictService.recordConflict).not.toHaveBeenCalled();
  });

  it('no repite el email en el sync siguiente', async () => {
    preamble().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] }); // ON CONFLICT DO NOTHING
    await expect(channelService.handleChannelBooking(incoming, 'ch-1')).rejects.toBeInstanceOf(OtaAvailabilityError);
    expect(emailService.sendAdminAlert).not.toHaveBeenCalled();
  });

  it('un no_show o completed tambien cuenta como bloqueador (misma regla que la unidad)', async () => {
    preamble()
      .mockResolvedValueOnce({ rows: [{ id: 'res-1', channel_code: 'direct' }] }) // bloqueador
      .mockResolvedValueOnce({ rows: [] }); // sin conflicto previo
    (conflictService.recordConflict as jest.Mock).mockResolvedValue({});
    await expect(channelService.handleChannelBooking(incoming, 'ch-1')).rejects.toBeInstanceOf(OtaAvailabilityError);
    expect(queryMock.mock.calls[4][0]).toContain("r.status <> 'cancelled'");
    expect(conflictService.recordConflict).toHaveBeenCalledTimes(1);
  });

  it('iCal cuyas fechas caben en una reserva de otro canal: conflicto de probable eco, sin email inmediato', async () => {
    preamble()
      .mockResolvedValueOnce({ rows: [{ id: 'res-1', channel_code: 'direct', covers: true }] })
      .mockResolvedValueOnce({ rows: [] });
    (conflictService.recordConflict as jest.Mock).mockResolvedValue({});
    const farAway = { ...incoming, source: 'ical' as const, checkIn: '2099-01-10', checkOut: '2099-01-12' };
    await expect(channelService.handleChannelBooking(farAway, 'ch-1')).rejects.toBeInstanceOf(OtaAvailabilityError);
    const [input, options] = (conflictService.recordConflict as jest.Mock).mock.calls.at(-1);
    expect(input.rejectedPayload.probableEcho).toBe(true);
    expect(options).toEqual({ notify: false });
  });
});
