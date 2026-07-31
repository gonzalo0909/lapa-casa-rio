// lapa-casa-hostel/tests/frontend/pricing.test.ts

import {
  calculateGroupDiscount,
  getSeasonMultiplier,
  calculateTotalPrice,
  calculateDepositAmount,
  isCarnivalPeriod,
  validateCarnivalBooking
} from '@/lib/pricing';

/**
 * @fileoverview Test suite for pricing calculation functions
 * Tests group discounts, seasonal pricing, deposits, and carnival logic
 */

describe('Pricing Calculations', () => {
  describe('calculateGroupDiscount', () => {
    test('returns 0% for less than 7 beds', () => {
      expect(calculateGroupDiscount(1)).toBe(0);
      expect(calculateGroupDiscount(3)).toBe(0);
      expect(calculateGroupDiscount(6)).toBe(0);
    });

    test('returns 10% for 7-15 beds', () => {
      expect(calculateGroupDiscount(7)).toBe(0.10);
      expect(calculateGroupDiscount(10)).toBe(0.10);
      expect(calculateGroupDiscount(15)).toBe(0.10);
    });

    test('returns 15% for 16-25 beds', () => {
      expect(calculateGroupDiscount(16)).toBe(0.15);
      expect(calculateGroupDiscount(20)).toBe(0.15);
      expect(calculateGroupDiscount(25)).toBe(0.15);
    });

    test('returns 20% for 26+ beds', () => {
      expect(calculateGroupDiscount(26)).toBe(0.20);
      expect(calculateGroupDiscount(31)).toBe(0.20);
      expect(calculateGroupDiscount(38)).toBe(0.20);
    });

    test('handles edge case of 0 beds', () => {
      expect(calculateGroupDiscount(0)).toBe(0);
    });

    test('handles negative values gracefully', () => {
      expect(calculateGroupDiscount(-5)).toBe(0);
    });
  });

  describe('getSeasonMultiplier', () => {
    test('returns 1.50 for high season (Dec-Mar)', () => {
      expect(getSeasonMultiplier('2025-12-15')).toBe(1.50);
      expect(getSeasonMultiplier('2026-01-20')).toBe(1.50);
      expect(getSeasonMultiplier('2026-02-10')).toBe(1.50);
      expect(getSeasonMultiplier('2026-03-25')).toBe(1.50);
    });

    test('returns 1.00 for medium season (Apr-May, Oct-Nov)', () => {
      expect(getSeasonMultiplier('2025-04-15')).toBe(1.00);
      expect(getSeasonMultiplier('2025-05-20')).toBe(1.00);
      expect(getSeasonMultiplier('2025-10-10')).toBe(1.00);
      expect(getSeasonMultiplier('2025-11-25')).toBe(1.00);
    });

    test('returns 0.80 for low season (Jun-Sep)', () => {
      expect(getSeasonMultiplier('2025-06-15')).toBe(0.80);
      expect(getSeasonMultiplier('2025-07-20')).toBe(0.80);
      expect(getSeasonMultiplier('2025-08-10')).toBe(0.80);
      expect(getSeasonMultiplier('2025-09-25')).toBe(0.80);
    });

    test('returns 2.00 for carnival period', () => {
      expect(getSeasonMultiplier('2026-02-14')).toBe(2.00);
      expect(getSeasonMultiplier('2026-02-15')).toBe(2.00);
      expect(getSeasonMultiplier('2026-02-16')).toBe(2.00);
      expect(getSeasonMultiplier('2026-02-17')).toBe(2.00);
    });

    test('handles season transitions correctly', () => {
      expect(getSeasonMultiplier('2025-03-31')).toBe(1.50);
      expect(getSeasonMultiplier('2025-04-01')).toBe(1.00);
      expect(getSeasonMultiplier('2025-05-31')).toBe(1.00);
      expect(getSeasonMultiplier('2025-06-01')).toBe(0.80);
    });
  });

  describe('calculateTotalPrice', () => {
    test('calculates base price correctly', () => {
      const result = calculateTotalPrice({
        checkIn: '2025-06-01',
        checkOut: '2025-06-05',
        rooms: [{ id: 'room_mixto_12a', beds: 1, basePrice: 60 }]
      });

      // 1 bed × 4 nights × R$60 × 0.80 (low season) = R$192
      expect(result.total).toBe(192.00);
      expect(result.basePrice).toBe(240.00);
      expect(result.nights).toBe(4);
    });

    test('applies group discount correctly', () => {
      const result = calculateTotalPrice({
        checkIn: '2025-06-01',
        checkOut: '2025-06-05',
        rooms: [{ id: 'room_mixto_12a', beds: 8, basePrice: 60 }]
      });

      // 8 beds × 4 nights × R$60 × 0.80 × 0.90 = R$1,382.40
      expect(result.total).toBe(1382.40);
      expect(result.groupDiscount).toBe(0.10);
      expect(result.discountAmount).toBe(153.60);
    });

    test('applies seasonal multiplier correctly', () => {
      const result = calculateTotalPrice({
        checkIn: '2025-12-20',
        checkOut: '2025-12-25',
        rooms: [{ id: 'room_mixto_12a', beds: 5, basePrice: 60 }]
      });

      // 5 beds × 5 nights × R$60 × 1.50 = R$2,250
      expect(result.total).toBe(2250.00);
      expect(result.seasonMultiplier).toBe(1.50);
    });

    test('combines group discount and seasonal pricing', () => {
      const result = calculateTotalPrice({
        checkIn: '2025-12-20',
        checkOut: '2025-12-25',
        rooms: [{ id: 'room_mixto_12a', beds: 10, basePrice: 60 }]
      });

      // 10 beds × 5 nights × R$60 × 1.50 × 0.90 = R$4,050
      expect(result.total).toBe(4050.00);
      expect(result.groupDiscount).toBe(0.10);
      expect(result.seasonMultiplier).toBe(1.50);
    });

    test('handles multiple rooms', () => {
      const result = calculateTotalPrice({
        checkIn: '2025-06-01',
        checkOut: '2025-06-05',
        rooms: [
          { id: 'room_mixto_12a', beds: 8, basePrice: 60 },
          { id: 'room_mixto_7', beds: 5, basePrice: 60 }
        ]
      });

      // 13 beds total × 4 nights × R$60 × 0.80 × 0.90 = R$2,246.40
      expect(result.totalBeds).toBe(13);
      expect(result.total).toBe(2246.40);
      expect(result.groupDiscount).toBe(0.10);
    });

    test('applies carnival pricing', () => {
      const result = calculateTotalPrice({
        checkIn: '2026-02-14',
        checkOut: '2026-02-19',
        rooms: [{ id: 'room_mixto_12a', beds: 2, basePrice: 60 }]
      });

      // 2 beds × 5 nights × R$60 × 2.00 = R$1,200
      expect(result.total).toBe(1200.00);
      expect(result.seasonMultiplier).toBe(2.00);
    });

    test('handles single night stays', () => {
      const result = calculateTotalPrice({
        checkIn: '2025-06-01',
        checkOut: '2025-06-02',
        rooms: [{ id: 'room_mixto_12a', beds: 3, basePrice: 60 }]
      });

      // 3 beds × 1 night × R$60 × 0.80 = R$144
      expect(result.total).toBe(144.00);
      expect(result.nights).toBe(1);
    });
  });

  describe('calculateDepositAmount', () => {
    test('returns 30% deposit for standard booking', () => {
      const result = calculateDepositAmount(1000, 10);

      expect(result.depositPercentage).toBe(0.30);
      expect(result.depositAmount).toBe(300);
      expect(result.remainingAmount).toBe(700);
    });

    test('returns 50% deposit for 15+ people', () => {
      const result = calculateDepositAmount(2000, 15);

      expect(result.depositPercentage).toBe(0.50);
      expect(result.depositAmount).toBe(1000);
      expect(result.remainingAmount).toBe(1000);
    });

    test('returns 50% deposit for 20+ people', () => {
      const result = calculateDepositAmount(3000, 25);

      expect(result.depositPercentage).toBe(0.50);
      expect(result.depositAmount).toBe(1500);
      expect(result.remainingAmount).toBe(1500);
    });

    test('handles edge case at 15 people threshold', () => {
      const result14 = calculateDepositAmount(1000, 14);
      const result15 = calculateDepositAmount(1000, 15);

      expect(result14.depositPercentage).toBe(0.30);
      expect(result15.depositPercentage).toBe(0.50);
    });

    test('rounds to 2 decimal places', () => {
      const result = calculateDepositAmount(333.33, 5);

      expect(result.depositAmount).toBe(100.00);
      expect(result.remainingAmount).toBe(233.33);
    });

    test('includes auto-charge date', () => {
      const result = calculateDepositAmount(1000, 10);

      expect(result.autoChargeDate).toBeDefined();
      expect(result.daysBeforeCheckIn).toBe(7);
    });
  });

  describe('isCarnivalPeriod', () => {
    test('returns true for carnival 2026', () => {
      expect(isCarnivalPeriod('2026-02-14')).toBe(true);
      expect(isCarnivalPeriod('2026-02-15')).toBe(true);
      expect(isCarnivalPeriod('2026-02-16')).toBe(true);
      expect(isCarnivalPeriod('2026-02-17')).toBe(true);
    });

    test('returns true for carnival 2027', () => {
      expect(isCarnivalPeriod('2027-02-06')).toBe(true);
      expect(isCarnivalPeriod('2027-02-07')).toBe(true);
      expect(isCarnivalPeriod('2027-02-08')).toBe(true);
      expect(isCarnivalPeriod('2027-02-09')).toBe(true);
    });

    test('returns false for non-carnival dates', () => {
      expect(isCarnivalPeriod('2026-02-10')).toBe(false);
      expect(isCarnivalPeriod('2026-02-20')).toBe(false);
      expect(isCarnivalPeriod('2026-03-01')).toBe(false);
    });

    test('returns false for dates outside carnival years', () => {
      expect(isCarnivalPeriod('2025-02-14')).toBe(false);
      expect(isCarnivalPeriod('2028-02-14')).toBe(false);
    });
  });

  describe('validateCarnivalBooking', () => {
    test('validates minimum 5 nights for carnival', () => {
      const result = validateCarnivalBooking('2026-02-14', '2026-02-19');

      expect(result.isValid).toBe(true);
      expect(result.nights).toBe(5);
    });

    test('rejects less than 5 nights during carnival', () => {
      const result = validateCarnivalBooking('2026-02-14', '2026-02-17');

      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/minimum.*5.*nights/i);
      expect(result.nights).toBe(3);
    });

    test('allows bookings not during carnival', () => {
      const result = validateCarnivalBooking('2026-02-10', '2026-02-12');

      expect(result.isValid).toBe(true);
      expect(result.isCarnival).toBe(false);
    });

    test('validates partial carnival bookings', () => {
      const result = validateCarnivalBooking('2026-02-13', '2026-02-18');

      expect(result.isValid).toBe(true);
      expect(result.isCarnival).toBe(true);
      expect(result.nights).toBe(5);
    });

    test('rejects check-out before check-in', () => {
      const result = validateCarnivalBooking('2026-02-19', '2026-02-14');

      expect(result.isValid).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('handles zero price gracefully', () => {
      const result = calculateTotalPrice({
        checkIn: '2025-06-01',
        checkOut: '2025-06-05',
        rooms: []
      });

      expect(result.total).toBe(0);
      expect(result.basePrice).toBe(0);
    });

    test('handles invalid date formats', () => {
      const result = calculateTotalPrice({
        checkIn: 'invalid-date',
        checkOut: '2025-06-05',
        rooms: [{ id: 'room_mixto_12a', beds: 1, basePrice: 60 }]
      });

      expect(result.total).toBe(0);
      expect(result.error).toBeTruthy();
    });

    test('handles same check-in and check-out dates', () => {
      const result = calculateTotalPrice({
        checkIn: '2025-06-01',
        checkOut: '2025-06-01',
        rooms: [{ id: 'room_mixto_12a', beds: 1, basePrice: 60 }]
      });

      expect(result.nights).toBe(0);
      expect(result.total).toBe(0);
    });

    test('handles very large groups', () => {
      const result = calculateTotalPrice({
        checkIn: '2025-06-01',
        checkOut: '2025-06-05',
        rooms: [
          { id: 'room_mixto_12a', beds: 12, basePrice: 60 },
          { id: 'room_mixto_12b', beds: 12, basePrice: 60 },
          { id: 'room_mixto_7', beds: 7, basePrice: 60 },
          { id: 'room_flexible_7', beds: 7, basePrice: 60 }
        ]
      });

      expect(result.totalBeds).toBe(38);
      expect(result.groupDiscount).toBe(0.20);
      expect(result.total).toBeGreaterThan(0);
    });

    test('handles decimal bed counts', () => {
      const result = calculateTotalPrice({
        checkIn: '2025-06-01',
        checkOut: '2025-06-05',
        rooms: [{ id: 'room_mixto_12a', beds: 2.5, basePrice: 60 }]
      });

      expect(result.totalBeds).toBe(2);
      expect(result.total).toBeGreaterThan(0);
    });
  });

  describe('Price Consistency', () => {
    test('maintains price consistency across calculations', () => {
      const bookingData = {
        checkIn: '2025-06-01',
        checkOut: '2025-06-05',
        rooms: [{ id: 'room_mixto_12a', beds: 10, basePrice: 60 }]
      };

      const result1 = calculateTotalPrice(bookingData);
      const result2 = calculateTotalPrice(bookingData);

      expect(result1.total).toBe(result2.total);
      expect(result1.groupDiscount).toBe(result2.groupDiscount);
      expect(result1.seasonMultiplier).toBe(result2.seasonMultiplier);
    });

    test('deposit and remaining always sum to total', () => {
      const total = 1920.00;
      const beds = 10;

      const result = calculateDepositAmount(total, beds);

      expect(result.depositAmount + result.remainingAmount).toBe(total);
    });

    test('group discount never exceeds 20%', () => {
      for (let beds = 0; beds <= 100; beds++) {
        const discount = calculateGroupDiscount(beds);
        expect(discount).toBeLessThanOrEqual(0.20);
        expect(discount).toBeGreaterThanOrEqual(0);
      }
    });

    test('seasonal multiplier always positive', () => {
      const dates = [
        '2025-01-15', '2025-04-15', '2025-07-15', '2025-10-15',
        '2026-02-15', '2026-06-15', '2026-12-15'
      ];

      dates.forEach(date => {
        const multiplier = getSeasonMultiplier(date);
        expect(multiplier).toBeGreaterThan(0);
        expect(multiplier).toBeLessThanOrEqual(2.00);
      });
    });
  });
});
