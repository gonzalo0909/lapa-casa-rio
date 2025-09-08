import { db } from '../src/services/database';
import { redis } from '../src/services/redis';

// Setup antes de todos los tests
beforeAll(async () => {
  // Conectar servicios para testing
  await db.connect();
  await redis.connect();
});

// Cleanup después de todos los tests
afterAll(async () => {
  await db.disconnect();
  await redis.disconnect();
});

// Cleanup después de cada test
afterEach(async () => {
  // Limpiar datos de test
  const prisma = db.getClient();
  
  // Limpiar en orden por dependencias
  await prisma.bookingBed.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.booking.deleteMany({});
  await prisma.guest.deleteMany({});
  
  // Limpiar Redis
  const keys = await redis.keys('test:*');
  if (keys.length > 0) {
    await Promise.all(keys.map(key => redis.del(key)));
  }
});

# Configurar timeout para tests
jest.setTimeout(30000);
