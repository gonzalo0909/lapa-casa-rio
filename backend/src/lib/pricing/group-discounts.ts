// lapa-casa-hostel/backend/src/lib/pricing/group-discounts.ts

interface GroupDiscountTier {
  minBeds: number;
  maxBeds: number | null;
  discountPercentage: number;
  name: string;
}

interface DiscountCalculation {
  originalPrice: number;
  discountPercentage: number;
  discountAmount: number;
  finalPrice: number;
  bedsCount: number;
  tierName: string;
  savings: number;
}

interface BulkDiscountResult {
  totalOriginalPrice: number;
  totalDiscountAmount: number;
  totalFinalPrice: number;
  totalSavings: number;
  averageDiscountPercentage: number;
  breakdown: DiscountCalculation[];
}

const GROUP_DISCOUNT_TIERS: GroupDiscountTier[] = [
  {
    minBeds: 26,
    maxBeds: null,
    discountPercentage: 0.20,
    name: 'Large Group (26+ beds)'
  },
  {
    minBeds: 16,
    maxBeds: 25,
    discountPercentage: 0.15,
    name: 'Medium Group (16-25 beds)'
  },
  {
    minBeds: 7,
    maxBeds: 15,
    discountPercentage: 0.10,
    name: 'Small Group (7-15 beds)'
  },
  {
    minBeds: 1,
    maxBeds: 6,
    discountPercentage: 0,
    name: 'Individual (1-6 beds)'
  }
];

export class GroupDiscountCalculator {
  private readonly BASE_PRICE_PER_BED = 60.00;
  private readonly MIN_BEDS_FOR_DISCOUNT = 7;
  private readonly MAX_DISCOUNT_PERCENTAGE = 0.20;

  calculateDiscount(bedsCount: number, basePricePerBed?: number): DiscountCalculation {
    const pricePerBed = basePricePerBed || this.BASE_PRICE_PER_BED;
    
    if (bedsCount < 1) {
      throw new Error('Beds count must be at least 1');
    }

    const tier = this.getDiscountTier(bedsCount);
    const originalPrice = bedsCount * pricePerBed;
    const discountAmount = originalPrice * tier.discountPercentage;
    const finalPrice = originalPrice - discountAmount;

    return {
      originalPrice,
      discountPercentage: tier.discountPercentage,
      discountAmount,
      finalPrice,
      bedsCount,
      tierName: tier.name,
      savings: discountAmount
    };
  }

  private getDiscountTier(bedsCount: number): GroupDiscountTier {
    for (const tier of GROUP_DISCOUNT_TIERS) {
      if (bedsCount >= tier.minBeds && (tier.maxBeds === null || bedsCount <= tier.maxBeds)) {
        return tier;
      }
    }
    return GROUP_DISCOUNT_TIERS[GROUP_DISCOUNT_TIERS.length - 1];
  }

  getDiscountPercentage(bedsCount: number): number {
    const tier = this.getDiscountTier(bedsCount);
    return tier.discountPercentage;
  }

  calculateBulkDiscount(bookings: Array<{ bedsCount: number; basePricePerBed?: number }>): BulkDiscountResult {
    const breakdown: DiscountCalculation[] = [];
    let totalOriginalPrice = 0;
    let totalDiscountAmount = 0;
    let totalFinalPrice = 0;

    for (const booking of bookings) {
      const calculation = this.calculateDiscount(booking.bedsCount, booking.basePricePerBed);
      breakdown.push(calculation);
      
      totalOriginalPrice += calculation.originalPrice;
      totalDiscountAmount += calculation.discountAmount;
      totalFinalPrice += calculation.finalPrice;
    }

    const totalSavings = totalDiscountAmount;
    const averageDiscountPercentage = totalOriginalPrice > 0 
      ? totalDiscountAmount / totalOriginalPrice 
      : 0;

    return {
      totalOriginalPrice,
      totalDiscountAmount,
      totalFinalPrice,
      totalSavings,
      averageDiscountPercentage,
      breakdown
    };
  }

  calculateProgressiveDiscount(bedsCount: number, basePricePerBed?: number): DiscountCalculation[] {
    const pricePerBed = basePricePerBed || this.BASE_PRICE_PER_BED;
    const calculations: DiscountCalculation[] = [];
    
    let remainingBeds = bedsCount;
    const sortedTiers = [...GROUP_DISCOUNT_TIERS].sort((a, b) => a.minBeds - b.minBeds);

    for (let i = 0; i < sortedTiers.length && remainingBeds > 0; i++) {
      const tier = sortedTiers[i];
      const nextTier = sortedTiers[i + 1];
      
      const bedsInTier = nextTier 
        ? Math.min(remainingBeds, nextTier.minBeds - tier.minBeds)
        : remainingBeds;

      if (bedsInTier > 0) {
        const originalPrice = bedsInTier * pricePerBed;
        const discountAmount = originalPrice * tier.discountPercentage;
        const finalPrice = originalPrice - discountAmount;

        calculations.push({
          originalPrice,
          discountPercentage: tier.discountPercentage,
          discountAmount,
          finalPrice,
          bedsCount: bedsInTier,
          tierName: tier.name,
          savings: discountAmount
        });

        remainingBeds -= bedsInTier;
      }
    }

    return calculations;
  }

  getNextDiscountTier(currentBedsCount: number): { 
    nextTier: GroupDiscountTier | null; 
    bedsNeeded: number;
    additionalSavings: number;
  } {
    const currentTier = this.getDiscountTier(currentBedsCount);
    const sortedTiers = [...GROUP_DISCOUNT_TIERS].sort((a, b) => b.discountPercentage - a.discountPercentage);
    
    const currentIndex = sortedTiers.findIndex(t => t.discountPercentage === currentTier.discountPercentage);
    
    if (currentIndex === 0 || currentIndex === -1) {
      return {
        nextTier: null,
        bedsNeeded: 0,
        additionalSavings: 0
      };
    }

    const nextTier = sortedTiers[currentIndex - 1];
    const bedsNeeded = nextTier.minBeds - currentBedsCount;
    
    const currentCalculation = this.calculateDiscount(currentBedsCount);
    const nextCalculation = this.calculateDiscount(nextTier.minBeds);
    const additionalSavings = nextCalculation.savings - currentCalculation.savings;

    return {
      nextTier,
      bedsNeeded: Math.max(0, bedsNeeded),
      additionalSavings: Math.max(0, additionalSavings)
    };
  }

  isEligibleForDiscount(bedsCount: number): boolean {
    return bedsCount >= this.MIN_BEDS_FOR_DISCOUNT;
  }

  getDiscountSummary(bedsCount: number, basePricePerBed?: number): {
    isEligible: boolean;
    currentTier: GroupDiscountTier;
    calculation: DiscountCalculation;
    nextTierInfo: ReturnType<typeof this.getNextDiscountTier>;
  } {
    const currentTier = this.getDiscountTier(bedsCount);
    const calculation = this.calculateDiscount(bedsCount, basePricePerBed);
    const nextTierInfo = this.getNextDiscountTier(bedsCount);
    const isEligible = this.isEligibleForDiscount(bedsCount);

    return {
      isEligible,
      currentTier,
      calculation,
      nextTierInfo
    };
  }

  static getTiers(): GroupDiscountTier[] {
    return GROUP_DISCOUNT_TIERS;
  }

  static getMinBedsForDiscount(): number {
    return 7;
  }

  static getMaxDiscountPercentage(): number {
    return 0.20;
  }

  validateDiscountApplication(bedsCount: number, appliedDiscount: number): boolean {
    const expectedDiscount = this.getDiscountPercentage(bedsCount);
    const tolerance = 0.001;
    return Math.abs(appliedDiscount - expectedDiscount) < tolerance;
  }

  calculateUpgradeIncentive(currentBedsCount: number, basePricePerBed?: number): {
    shouldUpgrade: boolean;
    upgradeToCount: number;
    additionalCost: number;
    additionalSavings: number;
    netBenefit: number;
  } | null {
    const nextTierInfo = this.getNextDiscountTier(currentBedsCount);
    
    if (!nextTierInfo.nextTier || nextTierInfo.bedsNeeded === 0) {
      return null;
    }

    const pricePerBed = basePricePerBed || this.BASE_PRICE_PER_BED;
    const upgradeToCount = currentBedsCount + nextTierInfo.bedsNeeded;
    
    const currentCalc = this.calculateDiscount(currentBedsCount, pricePerBed);
    const upgradedCalc = this.calculateDiscount(upgradeToCount, pricePerBed);
    
    const additionalCost = (upgradeToCount - currentBedsCount) * pricePerBed;
    const additionalSavings = upgradedCalc.savings - currentCalc.savings;
    const netBenefit = additionalSavings - additionalCost;
    const shouldUpgrade = netBenefit > 0;

    return {
      shouldUpgrade,
      upgradeToCount,
      additionalCost,
      additionalSavings,
      netBenefit
    };
  }

  formatDiscountForDisplay(calculation: DiscountCalculation): {
    originalPriceFormatted: string;
    discountPercentageFormatted: string;
    savingsFormatted: string;
    finalPriceFormatted: string;
  } {
    return {
      originalPriceFormatted: `R$ ${calculation.originalPrice.toFixed(2)}`,
      discountPercentageFormatted: `${(calculation.discountPercentage * 100).toFixed(0)}%`,
      savingsFormatted: `R$ ${calculation.savings.toFixed(2)}`,
      finalPriceFormatted: `R$ ${calculation.finalPrice.toFixed(2)}`
    };
  }
}

export const groupDiscountCalculator = new GroupDiscountCalculator();
