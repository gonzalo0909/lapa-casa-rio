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
process.env.JWT_SECRET = 'test_jwt_secret';

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
global.redis = new Redis(process.env.REDIS_URL);

/**
 * Setup before all tests
 */
beforeAll(async () => {
  // Clear test database
  await clearDatabase();

  // Seed initial test data
  await seedTestData();

  // Clear Redis cache
  await global.redis.flushdb();
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
});

/**
 * Cleanup after all tests
 */
afterAll(async () => {
  // Disconnect from database
  await global.prisma.$disconnect();

  // Disconnect from Redis
  await global.redis.quit();
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

  for (const table of tables) {
    await global.prisma.$executeRawUnsafe(
      `TRUNCATE TABLE "${table}" CASCADE;`
    );
  }
}

/**
 * Seed initial test data
 */
async function seedTestData() {
  // Create test rooms
  await global.prisma.room.createMany({
    data: [
      {
        id: 'room_mixto_12a',
        name: 'Mixto 12A',
        capacity: 12,
        type: 'mixed',
        basePrice: 60.00,
        isFlexible: false
      },
      {
        id: 'room_mixto_12b',
        name: 'Mixto 12B',
        capacity:
