jest.mock('../../config/database', () => ({ query: jest.fn(), withTransaction: jest.fn() }));
jest.mock('../email-service', () => ({ emailService: { sendAdminAlert: jest.fn() } }));
jest.mock('../channel-service', () => ({ channelService: {} }));

import { subtractRanges } from '../ical-service';

describe('bloqueos exportados a una OTA que ya tiene reserva en esas noches', () => {
  it('una reserva que cubre todo el bloqueo lo elimina', () => {
    expect(subtractRanges('2026-10-09', '2026-10-13', [{ start: '2026-10-09', end: '2026-10-13' }])).toEqual([]);
  });
  it('una reserva dentro del bloqueo lo parte en dos', () => {
    expect(subtractRanges('2026-10-09', '2026-10-20', [{ start: '2026-10-12', end: '2026-10-14' }])).toEqual([
      { start: '2026-10-09', end: '2026-10-12' },
      { start: '2026-10-14', end: '2026-10-20' },
    ]);
  });
  it('sin superposición no cambia nada', () => {
    expect(subtractRanges('2026-10-09', '2026-10-13', [{ start: '2026-10-13', end: '2026-10-15' }])).toEqual([
      { start: '2026-10-09', end: '2026-10-13' },
    ]);
  });
});
