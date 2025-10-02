// lapa-casa-hostel/tests/backend/test-setup.ts

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

/**
 * @fileoverview Test setup and teardown for backend tests
 * Initializes test database, Redis, and cleanup
 */

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/lapa_test';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock';
process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-mock-token';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.GOOGLE_SHEETS_API_KEY = 'test_sheets_key';

// Global test utilities
declare global {
  var prisma: PrismaClient;
  var redis: Redis;
}

// Initialize Prisma client for tests
global.prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

// Initialize Redis client for tests
global.redis = new Redis(process.env.REDIS_URL, {
  lazyConnect: true
});

/**
 * Setup before all tests
 */
beforeAll(async () => {
  try {
    // Connect to Redis
    await global.redis.connect();

    // Clear test database
    await clearDatabase();

    // Seed initial test data
    await seedTestData();

    // Clear Redis cache
    await global.redis.flushdb();
  } catch (error) {
    console.error('Error in test setup:', error);
    throw error;
  }
});

/**
 * Cleanup after each test
 */
afterEach(async () => {
  // Clear any test data created during tests
  await clearTestData();

  // Clear Redis cache
  await global.redis.flushdb();

  // Reset all mocks
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

/**
 * Cleanup after all tests
 */
afterAll(async () => {
  try {
    // Clear database one final time
    await clearDatabase();

    // Disconnect from database
    await global.prisma.$disconnect();

    // Disconnect from Redis
    await global.redis.quit();
  } catch (error) {
    console.error('Error in test teardown:', error);
  }
});

/**
 * Clear all data from test database
 */
async function clearDatabase() {
  const tables = [
    'Payment',
    'Booking',
    'Guest',
    'Room'
  ];

  try {
    // Disable foreign key constraints
    await global.prisma.$executeRawUnsafe('SET session_replication_role = replica;');

    // Truncate all tables
    for (const table of tables) {
      await global.prisma.$executeRawUnsafe(
        `TRUNCATE TABLE "${table}" CASCADE;`
      );
    }

    // Re-enable foreign key constraints
    await global.prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
  } catch (error) {
    console.error('Error clearing database:', error);
    throw error;
  }
}

/**
 * Clear test data created during tests
 */
async function clearTestData() {
  try {
    // Delete test bookings (keeps seed data)
    await global.prisma.booking.deleteMany({
      where: {
        guest: {
          email: {
            contains: 'test@'
          }
        }
      }
    });

    // Delete test guests
    await global.prisma.guest.deleteMany({
      where: {
        email: {
          contains: 'test@'
        }
      }
    });

    // Delete test payments
    await global.prisma.payment.deleteMany({
      where: {
        booking: {
          guest: {
            email: {
              contains: 'test@'
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Error clearing test data:', error);
  }
}

/**
 * Seed initial test data
 */
async function seedTestData() {
  try {
    // Create test rooms
    await global.prisma.room.createMany({
      data: [
        {
          id: 'room_mixto_12a',
          name: 'Mixto 12A',
          capacity: 12,
          type: 'mixed',
          basePrice: 60.00,
          isFlexible: false,
          isActive: true
        },
        {
          id: 'room_mixto_12b',
          name: 'Mixto 12B',
          capacity: 12,
          type: 'mixed',
          basePrice: 60.00,
          isFlexible: false,
          isActive: true
        },
        {
          id: 'room_mixto_7',
          name: 'Mixto 7',
          capacity: 7,
          type: 'mixed',
          basePrice: 60.00,
          isFlexible: false,
          isActive: true
        },
        {
          id: 'room_flexible_7',
          name: 'Flexible 7',
          capacity: 7,
          type: 'female',
          basePrice: 60.00,
          isFlexible: true,
          isActive: true
        }
      ],
      skipDuplicates: true
    });

    console.log('✓ Test data seeded successfully');
  } catch (error) {
    console.error('Error seeding test data:', error);
    throw error;
  }
}

/**
 * Mock external services
 */
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
      cancel: jest.fn()
    },
    refunds: {
      create: jest.fn(),
      retrieve: jest.fn()
    },
    webhooks: {
      constructEvent: jest.fn()
    }
  }));
});

jest.mock('mercadopago', () => ({
  payment: {
    create: jest.fn(),
    get: jest.fn()
  }
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
  })
}));

jest.mock('twilio', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({ sid: 'test-message-sid' })
    }
  }));
});

/**
 * Test helper functions
 */
export const testHelpers = {
  /**
   * Create test booking
   */
  async createTestBooking(overrides = {}) {
    const guest = await global.prisma.guest.create({
      data: {
        name: 'Test User',
        email: 'test@example.com',
        phone: '+5521999999999',
        country: 'BR'
      }
    });

    const booking = await global.prisma.booking.create({
      data: {
        checkIn: new Date('2025-07-01'),
        checkOut: new Date('2025-07-05'),
        status: 'PENDING',
        totalAmount: 1382.40,
        depositAmount: 414.72,
        remainingAmount: 967.68,
        guestId: guest.id,
        rooms: {
          create: [
            {
              roomId: 'room_mixto_12a',
              beds: 8,
              price: 60.00
            }
          ]
        },
        ...overrides
      },
      include: {
        guest: true,
        rooms: true
      }
    });

    return booking;
  },

  /**
   * Create test payment
   */
  async createTestPayment(bookingId: string, overrides = {}) {
    return await global.prisma.payment.create({
      data: {
        bookingId,
        amount: 414.72,
        currency: 'BRL',
        status: 'PENDING',
        provider: 'stripe',
        providerPaymentId: 'pi_test_123',
        ...overrides
      }
    });
  },

  /**
   * Wait for async operations
   */
  async flushPromises() {
    return new Promise(resolve => setImmediate(resolve));
  },

  /**
   * Mock date for testing
   */
  mockDate(dateString: string) {
    const mockDate = new Date(dateString);
    jest.useFakeTimers();
    jest.setSystemTime(mockDate);
  },

  /**
   * Restore real timers
   */
  restoreDate() {
    jest.useRealTimers();
  }
};

/**
 * Custom matchers
 */
expect.extend({
  toBeValidDate(received: any) {
    const date = new Date(received);
    const pass = !isNaN(date.getTime());

    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid date`
          : `expected ${received} to be a valid date`
    };
  },

  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);

    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid UUID`
          : `expected ${received} to be a valid UUID`
    };
  },

  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;

    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be within range ${floor} - ${ceiling}`
          : `expected ${received} to be within range ${floor} - ${ceiling}`
    };
  }
});

// Extend Jest matchers type
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidDate(): R;
      toBeValidUUID(): R;
      toBeWithinRange(floor: number, ceiling: number): R;
    }
  }
}

// Suppress console logs in tests unless DEBUG is set
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  };
}
