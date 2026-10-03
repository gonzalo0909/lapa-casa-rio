jest.mock('../../config/database', () => ({ query: jest.fn() }));
jest.mock('../email-service', () => ({ emailService: { sendAdminAlert: jest.fn() } }));

import { query } from '../../config/database';
import { conflictService, type BookingConflictRow } from '../conflict-service';

const queryMock = query as jest.Mock;

const base: BookingConflictRow = {
  id: 'c-1', reservation_id_a: 'res-a', reservation_id_b: null, bed_id: null,
  channel_a: 'booking', channel_b: 'airbnb', status: 'open',
  rejected_payload: { externalReservationId: 'uid-1', channelId: 'ch-air', checkIn: '2026-10-10', checkOut: '2026-10-12' },
  detected_at: new Date(), resolved_at: null, resolution_notes: null, created_at: new Date(),
};

describe('autoCloseStaleConflict', () => {
  beforeEach(() => queryMock.mockReset());

  it('cierra un intento rechazado que ya existe como reserva activa', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({ rows: [{ ...base, status: 'resolved_auto' }] });
    const result = await conflictService.autoCloseStaleConflict(base);
    expect(result.status).toBe('resolved_auto');
    expect(queryMock.mock.calls[0][1]).toEqual(['ch-air', 'uid-1']);
    expect(queryMock.mock.calls[1][0]).toContain("status = 'resolved_auto'");
  });

  it('deja abierto un intento rechazado que sigue sin existir', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const result = await conflictService.autoCloseStaleConflict(base);
    expect(result.status).toBe('open');
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('cierra un conflicto entre dos reservas si una ya esta cancelada', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({ rows: [{ ...base, reservation_id_b: 'res-b', status: 'resolved_auto' }] });
    const result = await conflictService.autoCloseStaleConflict({ ...base, reservation_id_b: 'res-b' });
    expect(result.status).toBe('resolved_auto');
  });

  it('no toca conflictos ya resueltos ni sin payload', async () => {
    expect((await conflictService.autoCloseStaleConflict({ ...base, status: 'resolved_manual' })).status).toBe('resolved_manual');
    expect((await conflictService.autoCloseStaleConflict({ ...base, rejected_payload: null })).status).toBe('open');
    expect(queryMock).not.toHaveBeenCalled();
  });
});
