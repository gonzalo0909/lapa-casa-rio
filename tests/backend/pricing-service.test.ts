// lapa-casa-hostel/tests/backend/pricing-service.test.ts

import { PricingService } from '@/services/pricing-service';

/**
 * @fileoverview Test suite for PricingService
 * Tests group discounts, seasonal pricing, deposits, carnival logic
 */

describe('PricingService', () => {
  let pricingService: PricingService;

  beforeEach(() => {
    pricingService = new PricingService();
  });

  describe('calculatePrice', () => {
    test('calculates base price correctly', () => {
      const result = pricingService.calculatePrice({
        checkIn: '2025-06-01',
        checkOut: '2025-06-05',
        rooms: [{ roomId: 'room_mixto_12a', beds: 1, basePrice: 60 }]
      });

      expect(result.basePrice).toBe(240.00);
      expect(result.nights).toBe(4);
      expect(result.total).toBe(192.00);
    });

    test('applies 10% group discount for 7-15 beds', () => {
      const result = pricingService.calculatePrice({
        checkIn: '2025-06-01',
        checkOut: '2025-06-05',
        rooms: [{ roomId: 'room_mixto_12a', beds: 8, basePrice: 60 }]
      });

      expect(result.groupDiscount).toBe(0.10);
      expect(result.total).toBe(1382.40);
    });

    test('applies 15% group discount for 16-25 beds', () => {
      const result = pricingService.calculatePrice({
        checkIn: '2025-06-01',
        checkOut: '2025-06-05',
        rooms: [
          { roomId: 'room_mixto_12a', beds: 12, basePrice: 60 },
          { roomId: 'room_mixto_7', beds: 5, basePrice: 60 }
        ]
      });

      expect(result.groupDiscount).toBe(0.15);
      expect(result.totalBeds).toBe(17);
    });

    test('applies 20% group discount for 26+ beds', () => {
      const result = pricingService.calculatePrice({
        checkIn: '2025-06-01',
        checkOut: '2025-06-05',
        rooms: [
          { roomId: 'room_mixto_12a', beds: 12, basePrice: 60 },
          { roomId: 'room_mixto_12b', beds: 12, basePrice: 60 },
          { roomId: 'room_mixto_7', beds: 7, basePrice: 60 }
        ]
      });

      expect(result.groupDiscount).toBe(0.20);
      expect(result.totalBeds).toBe(31);
    });

    test('applies low season multiplier (Jun-Sep)', () => {
      const result = pricingService.calculatePrice({
        checkIn: '2025-07-01',
        checkOut: '2025-07-05',
        rooms: [{ roomId: 'room_mixto_12a', beds: 1, basePrice: 60 }]
      });

      expect(result.seasonMultiplier).toBe(0.80);
      expect(result.season).toBe('low');
    });

    test('applies high season multiplier (Dec-Mar)', () => {
      const result = pricingService.calculatePrice({
        checkIn: '2025-12-20',
        checkOut: '2025-12-25',
        rooms: [{ roomId: 'room_mixto_12a', beds: 1, basePrice: 60 }]
      });

      expect(result.seasonMultiplier).toBe(1.50);
      expect(result.season).toBe('high');
    });

    test('applies carnival multiplier', () => {
      const result = pricingService.calculatePrice({
        checkIn: '2026-02-14',
        checkOut: '2026-02-19',
        rooms: [{ roomId: 'room_mixto_12a', beds: 2, basePrice: 60 }]
      });

      expect(result.seasonMultiplier).toBe(2.00);
      expect(result.season).toBe('carnival');
      expect(result.total).toBe(1200.00);
    });

    test('combines group discount with seasonal pricing', () => {
      const result = pricingService.calculatePrice({
        checkIn: '2025-12-20',
        checkOut: '2025-12-25',
        rooms: [{ roomId: 'room_mixto_12a', beds: 10, basePrice: 60 }]
      });

      expect(result.groupDiscount).toBe(0.10);
      expect(result.seasonMultiplier).toBe(1.50);
      expect(result.total).toBe(4050.00);
    });
  });

  describe('calculateDeposit', () => {
    test('calculates 30% deposit for standard booking', () => {
      const result = pricingService.calculateDeposit(1000.00, 10);

      expect(result.depositPercentage).toBe(0.30);
      expect(result.depositAmount).toBe(300.00);
      expect(result.remainingAmount).toBe(700.00);
    });

    test('calculates 50% deposit for large groups (15+)', () => {
      const result = pricingService.calculateDeposit(2000.00, 20);

      expect(result.depositPercentage).toBe(0.50);
      expect(result.depositAmount).toBe(1000.00);
      expect(result.remainingAmount).toBe(1000.00);
    });

    test('includes auto-charge date 7 days before check-in', () => {
      const checkIn = '2025-07-15';
      const result = pricingService.calculateDeposit(1000.00, 10, checkIn);

      expect(result.autoChargeDate).toBe('2025-07-08');
      expect(result.daysBeforeCheckIn).toBe(7);
    });
  });

  describe('validateCarnival', () => {
    test('validates minimum 5 nights for carnival', () => {
      const result = pricingService.validateCarnivalBooking('2026-02-14', '2026-02-19');

      expect(result.isValid).toBe(true);
      expect(result.nights).toBe(5);
    });

    test('rejects less than 5 nights during carnival', () => {
      const result = pricingService.validateCarnivalBooking('2026-02-14', '2026-02-17');

      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/minimum.*5.*nights/i);
    });
  });

  describe('Edge Cases', () => {
    test('handles single night stays', () => {
      const result = pricingService.calculatePrice({
        checkIn: '2025-07-01',
        checkOut: '2025-07-02',
        rooms: [{ roomId: 'room_mixto_12a', beds: 3, basePrice: 60 }]
      });

      expect(result.nights).toBe(1);
      expect(result.total).toBe(144.00);
    });

    test('handles maximum capacity bookings', () => {
      const result = pricingService.calculatePrice({
        checkIn: '2025-07-01',
        checkOut: '2025-07-05',
        rooms: [
          { roomId: 'room_mixto_12a', beds: 12, basePrice: 60 },
          { roomId: 'room_mixto_12b', beds: 12, basePrice: 60 },
          { roomId: 'room_mixto_7', beds: 7, basePrice: 60 },
          { roomId: 'room_flexible_7', beds: 7, basePrice: 60 }
        ]
      });

      expect(result.totalBeds).toBe(38);
      expect(result.groupDiscount).toBe(0.20);
    });

    test('rounds to 2 decimal places', () => {
      const result = pricingService.calculatePrice({
        checkIn: '2025-07-01',
        checkOut: '2025-07-04',
        rooms: [{ roomId: 'room_mixto_12a', beds: 7, basePrice: 60 }]
      });

      expect(result.total).toBe(907.20);
      expect(Number.isInteger(result.total * 100)).toBe(true);
    });
  });
});
