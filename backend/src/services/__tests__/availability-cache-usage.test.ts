jest.mock('../../config/database', () => ({ query: jest.fn() }));
jest.mock('../../cache/redis-client', () => ({ __esModule: true, default: { get: jest.fn(), set: jest.fn(), delPattern: jest.fn() } }));

import { query } from '../../config/database';
import redisClient from '../../cache/redis-client';
import { availabilityCache } from '../../cache/availability-cache';
import { availabilityService } from '../availability-service';

const queryMock = query as jest.Mock;
const row = { room_type_id: 'r1', room_code: 'c', room_name: 'n', capacity: 4, effective_gender: 'mixed', bed_id: 'b1', bed_code: '1', is_gender_eligible: true, is_occupied: false, is_available: true };

describe('cache de disponibilidad en memoria', () => {
  beforeEach(() => { jest.clearAllMocks(); availabilityCache.invalidate(); queryMock.mockResolvedValue({ rows: [row] }); });

  it('la segunda consulta igual no vuelve a la base ni toca Redis', async () => {
    const a = await availabilityService.checkRoomAvailability('r1', '2026-10-10', '2026-10-12');
    const b = await availabilityService.checkRoomAvailability('r1', '2026-10-10', '2026-10-12');
    expect(a).toEqual({ availableBeds: 1, occupiedBeds: 0 });
    expect(b).toEqual(a);
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(redisClient.get).not.toHaveBeenCalled();
    expect(redisClient.set).not.toHaveBeenCalled();
  });

  it('rangos de fechas distintos se consultan por separado', async () => {
    await availabilityService.checkRoomAvailability('r1', '2026-10-10', '2026-10-12');
    await availabilityService.checkRoomAvailability('r1', '2026-10-10', '2026-10-13');
    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it('clearCache() fuerza una consulta nueva a la base y no usa Redis', async () => {
    await availabilityService.checkRoomAvailability('r1', '2026-10-10', '2026-10-12');
    await availabilityService.clearCache();
    queryMock.mockResolvedValue({ rows: [{ ...row, is_available: false, is_occupied: true }] });
    const after = await availabilityService.checkRoomAvailability('r1', '2026-10-10', '2026-10-12');
    expect(after).toEqual({ availableBeds: 0, occupiedBeds: 1 });
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(redisClient.delPattern).not.toHaveBeenCalled();
  });
});
