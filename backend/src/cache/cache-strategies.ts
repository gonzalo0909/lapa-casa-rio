// lapa-casa-hostel/backend/src/cache/cache-strategies.ts

import redisClient from './redis-client';

export const CacheKeys = {
  ROOM: (roomId: string) => `room:${roomId}`,
  ROOMS_ALL: 'rooms:all',
  ROOM_AVAILABILITY: (roomId: string, date: string) => `room:${roomId}:availability:${date}`,
  ROOM_AVAILABILITY_RANGE: (roomId: string, start: string, end: string) => 
    `room:${roomId}:availability:${start}:${end}`,
  
  BOOKING: (bookingId: string) => `booking:${bookingId}`,
  BOOKING_NUMBER: (bookingNumber: string) => `booking:number:${bookingNumber}`,
  BOOKINGS_GUEST: (guestId: string) => `bookings:guest:${guestId}`,
  BOOKINGS_ROOM: (roomId: string) => `bookings:room:${roomId}`,
  BOOKINGS_UPCOMING: 'bookings:upcoming',
  
  GUEST: (guestId: string) => `guest:${guestId}`,
  GUEST_EMAIL: (email: string) => `guest:email:${email}`,
  
  PAYMENT: (paymentId: string) => `payment:${paymentId}`,
  PAYMENT_STRIPE: (intentId: string) => `payment:stripe:${intentId}`,
  PAYMENT_MP: (mpId: string) => `payment:mp:${mpId}`,
  
  PRICING: (roomId: string, date: string, beds: number) => 
    `pricing:${roomId}:${date}:${beds}`,
  GROUP_DISCOUNT: (beds: number) => `discount:group:${beds}`,
  SEASON_MULTIPLIER: (date: string) => `season:${date}`,
  
  STATS_ROOMS: 'stats:rooms',
  STATS_BOOKINGS: 'stats:bookings',
  STATS_PAYMENTS: 'stats:payments',
  STATS_REVENUE: (start: string, end: string) => `stats:revenue:${start}:${end}`,
  
  RATE_LIMIT: (ip: string, endpoint: string) => `ratelimit:${ip}:${endpoint}`,
  
  SESSION: (sessionId: string) => `session:${sessionId}`,
  
  LOCK: (resource: string) => `lock:${resource}`
};

export const CacheTTL = {
  SHORT: 60,           // 1 minute
  MEDIUM: 300,         // 5 minutes
  LONG: 1800,          // 30 minutes
  VERY_LONG: 3600,     // 1 hour
  DAY: 86400,          // 24 hours
  WEEK: 604800,        // 7 days
  
  ROOM: 3600,          // 1 hour
  BOOKING: 300,        // 5 minutes
  GUEST: 1800,         // 30 minutes
  PAYMENT: 300,        // 5 minutes
  AVAILABILITY: 300,   // 5 minutes
  PRICING: 1800,       // 30 minutes
  STATS: 3600,         // 1 hour
  SESSION: 86400,      // 24 hours
  RATE_LIMIT: 60       // 1 minute
};

export class CacheStrategies {
  static async cacheRoom(roomId: string, data: any): Promise<boolean> {
    return await redisClient.set(CacheKeys.ROOM(roomId), data, CacheTTL.ROOM);
  }

  static async getRoom(roomId: string): Promise<any | null> {
    return await redisClient.get(CacheKeys.ROOM(roomId));
  }

  static async invalidateRoom(roomId: string): Promise<void> {
    await redisClient.del(CacheKeys.ROOM(roomId));
    await redisClient.delPattern(`room:${roomId}:*`);
  }

  static async cacheAllRooms(rooms: any[]): Promise<boolean> {
    return await redisClient.set(CacheKeys.ROOMS_ALL, rooms, CacheTTL.ROOM);
  }

  static async getAllRooms(): Promise<any[] | null> {
    return await redisClient.get(CacheKeys.ROOMS_ALL);
  }

  static async invalidateAllRooms(): Promise<void> {
    await redisClient.del(CacheKeys.ROOMS_ALL);
  }

  static async cacheAvailability(
    roomId: string,
    startDate: string,
    endDate: string,
    data: any
  ): Promise<boolean> {
    const key = CacheKeys.ROOM_AVAILABILITY_RANGE(roomId, startDate, endDate);
    return await redisClient.set(key, data, CacheTTL.AVAILABILITY);
  }

  static async getAvailability(
    roomId: string,
    startDate: string,
    endDate: string
  ): Promise<any | null> {
    const key = CacheKeys.ROOM_AVAILABILITY_RANGE(roomId, startDate, endDate);
    return await redisClient.get(key);
  }

  static async invalidateAvailability(roomId: string): Promise<void> {
    await redisClient.delPattern(`room:${roomId}:availability:*`);
  }

  static async cacheBooking(bookingId: string, data: any): Promise<boolean> {
    await redisClient.set(CacheKeys.BOOKING(bookingId), data, CacheTTL.BOOKING);
    
    if (data.bookingNumber) {
      await redisClient.set(
        CacheKeys.BOOKING_NUMBER(data.bookingNumber),
        data,
        CacheTTL.BOOKING
      );
    }
    
    return true;
  }

  static async getBooking(bookingId: string): Promise<any | null> {
    return await redisClient.get(CacheKeys.BOOKING(bookingId));
  }

  static async getBookingByNumber(bookingNumber: string): Promise<any | null> {
    return await redisClient.get(CacheKeys.BOOKING_NUMBER(bookingNumber));
  }

  static async invalidateBooking(bookingId: string, bookingNumber?: string): Promise<void> {
    await redisClient.del(CacheKeys.BOOKING(bookingId));
    
    if (bookingNumber) {
      await redisClient.del(CacheKeys.BOOKING_NUMBER(bookingNumber));
    }
  }

  static async invalidateGuestBookings(guestId: string): Promise<void> {
    await redisClient.del(CacheKeys.BOOKINGS_GUEST(guestId));
  }

  static async invalidateRoomBookings(roomId: string): Promise<void> {
    await redisClient.del(CacheKeys.BOOKINGS_ROOM(roomId));
    await redisClient.invalidateAvailability(roomId);
  }

  static async cacheGuest(guestId: string, data: any): Promise<boolean> {
    await redisClient.set(CacheKeys.GUEST(guestId), data, CacheTTL.GUEST);
    
    if (data.email) {
      await redisClient.set(CacheKeys.GUEST_EMAIL(data.email), data, CacheTTL.GUEST);
    }
    
    return true;
  }

  static async getGuest(guestId: string): Promise<any | null> {
    return await redisClient.get(CacheKeys.GUEST(guestId));
  }

  static async getGuestByEmail(email: string): Promise<any | null> {
    return await redisClient.get(CacheKeys.GUEST_EMAIL(email));
  }

  static async invalidateGuest(guestId: string, email?: string): Promise<void> {
    await redisClient.del(CacheKeys.GUEST(guestId));
    
    if (email) {
      await redisClient.del(CacheKeys.GUEST_EMAIL(email));
    }
  }

  static async cachePayment(paymentId: string, data: any): Promise<boolean> {
    await redisClient.set(CacheKeys.PAYMENT(paymentId), data, CacheTTL.PAYMENT);
    
    if (data.stripePaymentIntentId) {
      await redisClient.set(
        CacheKeys.PAYMENT_STRIPE(data.stripePaymentIntentId),
        data,
        CacheTTL.PAYMENT
      );
    }
    
    if (data.mpPaymentId) {
      await redisClient.set(
        CacheKeys.PAYMENT_MP(data.mpPaymentId),
        data,
        CacheTTL.PAYMENT
      );
    }
    
    return true;
  }

  static async getPayment(paymentId: string): Promise<any | null> {
    return await redisClient.get(CacheKeys.PAYMENT(paymentId));
  }

  static async getPaymentByStripe(intentId: string): Promise<any | null> {
    return await redisClient.get(CacheKeys.PAYMENT_STRIPE(intentId));
  }

  static async getPaymentByMP(mpId: string): Promise<any | null> {
    return await redisClient.get(CacheKeys.PAYMENT_MP(mpId));
  }

  static async invalidatePayment(
    paymentId: string,
    stripeIntentId?: string,
    mpId?: string
  ): Promise<void> {
    await redisClient.del(CacheKeys.PAYMENT(paymentId));
    
    if (stripeIntentId) {
      await redisClient.del(CacheKeys.PAYMENT_STRIPE(stripeIntentId));
    }
    
    if (mpId) {
      await redisClient.del(CacheKeys.PAYMENT_MP(mpId));
    }
  }

  static async cachePricing(
    roomId: string,
    date: string,
    beds: number,
    pricing: any
  ): Promise<boolean> {
    const key = CacheKeys.PRICING(roomId, date, beds);
    return await redisClient.set(key, pricing, CacheTTL.PRICING);
  }

  static async getPricing(
    roomId: string,
    date: string,
    beds: number
  ): Promise<any | null> {
    const key = CacheKeys.PRICING(roomId, date, beds);
    return await redisClient.get(key);
  }

  static async invalidatePricing(): Promise<void> {
    await redisClient.delPattern('pricing:*');
    await redisClient.delPattern('discount:*');
    await redisClient.delPattern('season:*');
  }

  static async cacheStats(key: string, data: any, ttl: number = CacheTTL.STATS): Promise<boolean> {
    return await redisClient.set(key, data, ttl);
  }

  static async getStats(key: string): Promise<any | null> {
    return await redisClient.get(key);
  }

  static async invalidateStats(): Promise<void> {
    await redisClient.delPattern('stats:*');
  }

  static async checkRateLimit(
    ip: string,
    endpoint: string,
    maxRequests: number = 100
  ): Promise<{ allowed: boolean; remaining: number }> {
    const key = CacheKeys.RATE_LIMIT(ip, endpoint);
    const current = await redisClient.increment(key);
    
    if (current === 1) {
      await redisClient.expire(key, CacheTTL.RATE_LIMIT);
    }
    
    const allowed = current <= maxRequests;
    const remaining = Math.max(0, maxRequests - current);
    
    return { allowed, remaining };
  }

  static async acquireLock(
    resource: string,
    ttlSeconds: number = 30
  ): Promise<boolean> {
    const key = CacheKeys.LOCK(resource);
    const lockValue = `${Date.now()}`;
    
    const result = await redisClient.set(key, lockValue, ttlSeconds);
    return result;
  }

  static async releaseLock(resource: string): Promise<boolean> {
    const key = CacheKeys.LOCK(resource);
    return await redisClient.del(key);
  }

  static async invalidateAllCache(): Promise<void> {
    await redisClient.flushdb();
  }

  static async invalidateBookingRelatedCache(
    bookingId: string,
    roomId: string,
    guestId: string
  ): Promise<void> {
    await Promise.all([
      this.invalidateBooking(bookingId),
      this.invalidateRoomBookings(roomId),
      this.invalidateGuestBookings(guestId),
      this.invalidateAvailability(roomId),
      this.invalidateStats()
    ]);
  }

  static async warmupCache(): Promise<void> {
    console.log('🔥 Warming up cache...');
    // This method can be called on server start to pre-populate cache
    // Implementation depends on specific needs
  }
}

export default CacheStrategies;
