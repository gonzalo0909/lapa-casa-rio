import { RoomService } from '../../src/core/room';

describe('RoomService', () => {
  let roomService: RoomService;

  beforeEach(() => {
    roomService = new RoomService();
  });

  describe('canAccommodateGroup', () => {
    it('should allow women in room 6', () => {
      const result = roomService.canAccommodateGroup(6, 0, 3);
      expect(result.allowed).toBe(true);
    });

    it('should reject men in room 6 for small groups', () => {
      const result = roomService.canAccommodateGroup(6, 2, 1);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('exclusiva para mujeres');
    });

    it('should allow mixed groups in room 6 for large groups', () => {
      const result = roomService.canAccommodateGroup(6, 16, 16);
      expect(result.allowed).toBe(true);
    });

    it('should allow any gender in mixed rooms', () => {
      expect(roomService.canAccommodateGroup(1, 5, 0).allowed).toBe(true);
      expect(roomService.canAccommodateGroup(3, 0, 5).allowed).toBe(true);
      expect(roomService.canAccommodateGroup(5, 3, 2).allowed).toBe(true);
    });
  });

  describe('validateBedSelection', () => {
    it('should validate correct bed selection', () => {
      const beds = [
        { roomId: 1, bedNumber: 1 },
        { roomId: 1, bedNumber: 2 },
      ];
      const occupiedBeds = { 1: [], 3: [], 5: [], 6: [] };

      const result = roomService.validateBedSelection(beds, 1, 1, occupiedBeds);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject occupied beds', () => {
      const beds = [{ roomId: 1, bedNumber: 1 }];
      const occupiedBeds = { 1: [1], 3: [], 5: [], 6: [] };

      const result = roomService.validateBedSelection(beds, 1, 0, occupiedBeds);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('ya está ocupada');
    });

    it('should reject wrong number of beds', () => {
      const beds = [{ roomId: 1, bedNumber: 1 }];
      const occupiedBeds = { 1: [], 3: [], 5: [], 6: [] };

      const result = roomService.validateBedSelection(beds, 2, 0, occupiedBeds);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('exactamente 2 camas');
    });
  });

  describe('calculatePrice', () => {
    it('should calculate price correctly', () => {
      const beds = [
        { roomId: 1, bedNumber: 1 },
        { roomId: 6, bedNumber: 1 },
      ];

      const result = roomService.calculatePrice(beds, 2);
      expect(result.total).toBe(230); // (55 + 60) * 2 nights
    });
  });
});
