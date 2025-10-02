# lapa-casa-hostel/docs/business/pricing-logic.md

# Lapa Casa Hostel - Pricing Logic Documentation

## Overview

This document describes the complete pricing system for Lapa Casa Hostel, including base pricing, group discounts, seasonal multipliers, and payment structure.

---

## Table of Contents

1. [Room Configuration](#room-configuration)
2. [Base Pricing](#base-pricing)
3. [Group Discounts](#group-discounts)
4. [Seasonal Pricing](#seasonal-pricing)
5. [Payment Structure](#payment-structure)
6. [Calculation Examples](#calculation-examples)
7. [Special Cases](#special-cases)
8. [Implementation](#implementation)

---

## Room Configuration

### Room Inventory

Lapa Casa Hostel has **4 rooms** with **38 total beds**:

| Room ID | Room Name | Capacity | Type | Flexible | Base Price (BRL) |
|---------|-----------|----------|------|----------|------------------|
| `room_mixto_12a` | Mixto 12A | 12 beds | Mixed | No | R$ 60.00 |
| `room_mixto_12b` | Mixto 12B | 12 beds | Mixed | No | R$ 60.00 |
| `room_mixto_7` | Mixto 7 | 7 beds | Mixed | No | R$ 60.00 |
| `room_flexible_7` | Flexible 7 | 7 beds | Female* | Yes | R$ 60.00 |

**Total Capacity**: 38 beds

### Flexible Room Logic

**Room: Flexible 7**
- **Default**: Female-only dormitory
- **Auto-conversion**: Automatically converts to mixed dormitory if:
  - No female bookings exist
  - Check-in is within 48 hours
- **Purpose**: Maximize occupancy while prioritizing female guests

```javascript
// Flexible room conversion logic
function checkFlexibleRoomConversion(checkIn) {
  const hoursUntilCheckIn = (checkIn - Date.now()) / (1000 * 60 * 60);
  const femaleBookings = getBookingsForRoom('room_flexible_7', 'female');
  
  if (femaleBookings.length === 0 && hoursUntilCheckIn <= 48) {
    convertRoomType('room_flexible_7', 'mixed');
    return true;
  }
  
  return false;
}
```

---

## Base Pricing

### Per Bed Rate

**Standard Rate**: R$ 60.00 per bed per night

This is the base price before any discounts or multipliers are applied.

### Currency

- **Primary Currency**: Brazilian Real (BRL - R$)
- **Secondary Currencies**: USD, EUR (converted at current exchange rates)
- **Payment Methods**: Credit/Debit Card, PIX (instant), Boleto

---

## Group Discounts

### Automatic Discount Tiers

Discounts are **automatically applied** based on total beds booked:

| Total Beds | Discount | Description |
|------------|----------|-------------|
| 1-6 beds | 0% | No discount |
| 7-15 beds | 10% | Small group discount |
| 16-25 beds | 15% | Medium group discount |
| 26+ beds | 20% | Large group discount |

### Discount Calculation

```javascript
function calculateGroupDiscount(totalBeds) {
  if (totalBeds >= 26) return 0.20;  // 20% off
  if (totalBeds >= 16) return 0.15;  // 15% off
  if (totalBeds >= 7) return 0.10;   // 10% off
  return 0;                          // No discount
}
```

### Examples

**Example 1: 10 beds for 5 nights**
```
Base: 10 beds × R$ 60.00 × 5 nights = R$ 3,000.00
Discount: 10% (10 beds = small group)
Savings: R$ 3,000.00 × 0.10 = R$ 300.00
Final Price: R$ 2,700.00
```

**Example 2: 20 beds for 3 nights**
```
Base: 20 beds × R$ 60.00 × 3 nights = R$ 3,600.00
Discount: 15% (20 beds = medium group)
Savings: R$ 3,600.00 × 0.15 = R$ 540.00
Final Price: R$ 3,060.00
```

**Example 3: 30 beds for 7 nights**
```
Base: 30 beds × R$ 60.00 × 7 nights = R$ 12,600.00
Discount: 20% (30 beds = large group)
Savings: R$ 12,600.00 × 0.20 = R$ 2,520.00
Final Price: R$ 10,080.00
```

---

## Seasonal Pricing

### Season Multipliers

Prices vary by season using multipliers applied **after group discounts**:

| Season | Months | Multiplier | Price Impact |
|--------|--------|------------|--------------|
| **High Season** | Dec-Mar | 1.50× | +50% |
| **Medium Season** | Apr-May, Oct-Nov | 1.00× | Base price |
| **Low Season** | Jun-Sep | 0.80× | -20% |
| **Carnival** | February | 2.00× | +100% |

### Special Season Rules

#### Carnival Week
- **Multiplier**: 2.00× (double price)
- **Minimum Stay**: 5 nights mandatory
- **Dates**: Variable (typically mid-February)
- **No Exceptions**: Minimum stay strictly enforced

### Season Calculation

```javascript
function getSeasonMultiplier(checkIn) {
  const month = checkIn.getMonth() + 1; // 1-12
  
  // Carnival (check specific dates)
  if (isCarnivalWeek(checkIn)) {
    return { multiplier: 2.00, season: 'carnival', minNights: 5 };
  }
  
  // High Season: December-March
  if (month >= 12 || month <= 3) {
    return { multiplier: 1.50, season: 'high', minNights: 1 };
  }
  
  // Medium Season: April-May, October-November
  if ((month >= 4 && month <= 5) || (month >= 10 && month <= 11)) {
    return { multiplier: 1.00, season: 'medium', minNights: 1 };
  }
  
  // Low Season: June-September
  return { multiplier: 0.80, season: 'low', minNights: 1 };
}
```

### Examples with Seasons

**Example 1: Low Season with Group Discount**
```
10 beds × 5 nights in July (Low Season)
Base: 10 × R$ 60.00 × 5 = R$ 3,000.00
Group Discount (10%): -R$ 300.00 = R$ 2,700.00
Season Multiplier (0.80×): R$ 2,700.00 × 0.80 = R$ 2,160.00
```

**Example 2: High Season with Group Discount**
```
20 beds × 3 nights in January (High Season)
Base: 20 × R$ 60.00 × 3 = R$ 3,600.00
Group Discount (15%): -R$ 540.00 = R$ 3,060.00
Season Multiplier (1.50×): R$ 3,060.00 × 1.50 = R$ 4,590.00
```

**Example 3: Carnival Week**
```
30 beds × 5 nights in Carnival
Base: 30 × R$ 60.00 × 5 = R$ 9,000.00
Group Discount (20%): -R$ 1,800.00 = R$ 7,200.00
Season Multiplier (2.00×): R$ 7,200.00 × 2.00 = R$ 14,400.00
```

---

## Payment Structure

### Deposit System

**Standard Deposits**:
- **Small Groups (< 15 people)**: 30% deposit required
- **Large Groups (15+ people)**: 50% deposit required

**Remaining Balance**:
- Due 7 days before check-in
- Automatically charged to payment method on file

### Payment Schedule

```javascript
const depositRules = {
  standard: {
    percentage: 0.30,      // 30%
    minPeople: 1
  },
  largeGroup: {
    percentage: 0.50,      // 50%
    minPeople: 15
  },
  autoChargeDate: 7,       // Days before check-in
  retryAttempts: 3,        // Payment retry attempts
  retryInterval: 24        // Hours between retries
};

function calculateDeposit(totalPrice, totalPeople) {
  if (totalPeople >= 15) {
    return totalPrice * 0.50;  // 50% deposit
  }
  return totalPrice * 0.30;    // 30% deposit
}
```

### Payment Methods

1. **International Cards (Stripe)**
   - Visa, Mastercard, American Express
   - 3D Secure authentication
   - Multi-currency support

2. **Brazilian Cards (Mercado Pago)**
   - All major Brazilian cards
   - Installment options (up to 12x)
   - Lower fees for domestic transactions

3. **PIX (Mercado Pago)**
   - Instant payment confirmation
   - QR Code or Copy-Paste code
   - 24/7 availability
   - No additional fees

### Example Payment Flow

**Booking: 20 beds for 5 nights in January**
```
Calculation:
- Base: 20 × R$ 60.00 × 5 = R$ 6,000.00
- Group Discount (15%): -R$ 900.00 = R$ 5,100.00
- High Season (1.50×): R$ 5,100.00 × 1.50 = R$ 7,650.00

Payment Schedule:
- Deposit (50%): R$ 3,825.00 (due immediately)
- Remaining (50%): R$ 3,825.00 (due 7 days before check-in)
```

---

## Calculation Examples

### Complete Pricing Calculation

```javascript
function calculateTotalPrice(booking) {
  const { beds, nights, checkIn, checkOut } = booking;
  
  // Step 1: Calculate base price
  const basePrice = beds * 60.00 * nights;
  
  // Step 2: Apply group discount
  const discount = calculateGroupDiscount(beds);
  const priceAfterDiscount = basePrice * (1 - discount);
  
  // Step 3: Apply seasonal multiplier
  const seasonInfo = getSeasonMultiplier(checkIn);
  const finalPrice = priceAfterDiscount * seasonInfo.multiplier;
  
  // Step 4: Calculate deposit
  const depositAmount = calculateDeposit(finalPrice, beds);
  const remainingAmount = finalPrice - depositAmount;
  
  return {
    basePrice,
    discount: basePrice * discount,
    discountPercent: discount * 100,
    priceAfterDiscount,
    seasonMultiplier: seasonInfo.multiplier,
    seasonName: seasonInfo.season,
    finalPrice,
    depositAmount,
    remainingAmount,
    currency: 'BRL'
  };
}
```

### Real-World Examples

#### Example 1: Small Group, Low Season
```
Input:
- 8 beds
- 4 nights
- Check-in: July 15, 2025 (Low Season)

Calculation:
Base Price:     8 × R$ 60.00 × 4 = R$ 1,920.00
Group Discount: 10% = -R$ 192.00
After Discount: R$ 1,728.00
Season (0.80×): R$ 1,728.00 × 0.80 = R$ 1,382.40

Payment:
Deposit (30%):  R$ 414.72
Remaining:      R$ 967.68
```

#### Example 2: Large Group, High Season
```
Input:
- 28 beds
- 6 nights
- Check-in: January 10, 2026 (High Season)

Calculation:
Base Price:     28 × R$ 60.00 × 6 = R$ 10,080.00
Group Discount: 20% = -R$ 2,016.00
After Discount: R$ 8,064.00
Season (1.50×): R$ 8,064.00 × 1.50 = R$ 12,096.00

Payment:
Deposit (50%):  R$ 6,048.00
Remaining:      R$ 6,048.00
```

#### Example 3: Corporate Event, Carnival
```
Input:
- 35 beds (full capacity minus 3)
- 5 nights (minimum)
- Check-in: Carnival Week 2026

Calculation:
Base Price:     35 × R$ 60.00 × 5 = R$ 10,500.00
Group Discount: 20% = -R$ 2,100.00
After Discount: R$ 8,400.00
Season (2.00×): R$ 8,400.00 × 2.00 = R$ 16,800.00

Payment:
Deposit (50%):  R$ 8,400.00
Remaining:      R$ 8,400.00
```

---

## Special Cases

### Case 1: Mixed Season Bookings

If a booking spans multiple seasons, use the **check-in date season** for the entire stay.

**Example**:
- Check-in: March 25 (High Season)
- Check-out: April 5 (Medium Season)
- **Applied Season**: High Season (1.50×)

### Case 2: Flexible Room Premium

No premium charged for Flexible 7 room. Same R$ 60.00 base price.

### Case 3: Last-Minute Bookings

No last-minute surcharges. Standard pricing applies.

### Case 4: Extended Stays

No special discount for extended stays beyond group discounts. Consider custom quotes for 30+ night bookings.

### Case 5: Cancellations

**Cancellation Policy**:
- **More than 30 days**: Full refund minus processing fee (5%)
- **15-30 days**: 50% refund
- **Less than 15 days**: No refund (deposit forfeited)
- **Carnival bookings**: Non-refundable

---

## Implementation

### Backend Implementation

Location: `backend/src/services/pricing-service.ts`

```typescript
export class PricingService {
  calculatePrice(booking: BookingRequest): PriceBreakdown {
    // Implementation as described above
  }
  
  getGroupDiscount(beds: number): number {
    // Returns discount percentage
  }
  
  getSeasonMultiplier(date: Date): SeasonInfo {
    // Returns multiplier and season info
  }
  
  calculateDeposit(total: number, people: number): DepositInfo {
    // Returns deposit breakdown
  }
}
```

### Frontend Implementation

Location: `frontend/src/lib/pricing.ts`

```typescript
export function calculatePrice(
  beds: number,
  nights: number,
  checkIn: Date
): PriceBreakdown {
  // Client-side price calculation
  // Must match backend exactly
}
```

### Testing

Pricing logic must have **100% test coverage** due to business criticality.

Location: `tests/backend/pricing-service.test.ts`

---

## Summary

**Key Points**:
1. Base price: R$ 60.00 per bed per night
2. Group discounts: 10%, 15%, 20% based on beds
3. Seasonal multipliers: 0.80×, 1.00×, 1.50×, 2.00×
4. Deposits: 30% or 50% based on group size
5. Remaining balance: Auto-charged 7 days before check-in

**Formula**:
```
Final Price = (Base Price × (1 - Group Discount)) × Season Multiplier
```

This pricing system balances revenue optimization with competitive rates for groups while accounting for seasonal demand fluctuations.

✅ Archivo 184/184 completado
