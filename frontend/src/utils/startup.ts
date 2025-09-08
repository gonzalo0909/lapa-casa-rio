import { db } from '../services/database';
import { redis } from '../services/redis';
import { logger } from './logger';
import { config } from '../config';

export class StartupService {
  
  /**
   * Inicializar todos los servicios
   */
  public static async initialize(): Promise<void> {
    logger.info('Initializing services...');

    try {
      // Conectar base de datos
      await db.connect();
      logger.info('Database connected');

      // Conectar Redis
      await redis.connect();
      logger.info('Redis connected');

      // Verificar configuración crítica
      await StartupService.validateConfiguration();

      // Inicializar datos base si es necesario
      await StartupService.seedDatabase();

      // Configurar cleanup periódico
      StartupService.setupCleanupJobs();

      logger.info('All services initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize services:', error);
      throw error;
    }
  }

  /**
   * Validar configuración crítica
   */
  private static async validateConfiguration(): Promise<void> {
    const errors: string[] = [];

    if (!config.databaseUrl) {
      errors.push('DATABASE_URL not configured');
    }

    if (!config.redisUrl) {
      errors.push('REDIS_URL not configured');
    }

    // Verificar conectividad
    const dbHealth = await db.healthCheck();
    const redisHealth = await redis.healthCheck();

    if (!dbHealth) {
      errors.push('Database connection failed');
    }

    if (!redisHealth) {
      errors.push('Redis connection failed');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration errors: ${errors.join(', ')}`);
    }

    logger.info('Configuration validation passed');
  }

  /**
   * Inicializar datos base en la base de datos
   */
  private static async seedDatabase(): Promise<void> {
    const prisma = db.getClient();

    try {
      // Verificar si ya hay datos
      const bookingCount = await prisma.booking.count();
      
      if (bookingCount === 0) {
        // Crear habitaciones base si no existen
        const rooms = [
          { id: 1, name: 'Cuarto 1 (Mixto)', totalBeds: 12, femaleOnly: false, basePrice: 55 },
          { id: 3, name: 'Cuarto 3 (Mixto)', totalBeds: 12, femaleOnly: false, basePrice: 55 },
          { id: 5, name: 'Cuarto 5 (Mixto)', totalBeds: 7, femaleOnly: false, basePrice: 55 },
          { id: 6, name: 'Cuarto 6 (Feminino)', totalBeds: 7, femaleOnly: true, basePrice: 60 },
        ];

        for (const room of rooms) {
          await prisma.room.upsert({
            where: { id: room.id },
            update: room,
            create: room,
          });
        }

        logger.info('Database seeded with room data');
      }

    } catch (error) {
      logger.warn('Database seeding failed:', error);
      // No es crítico, continuar
    }
  }

  /**
   * Configurar trabajos de limpieza periódicos
   */
  private static setupCleanupJobs(): void {
    // Limpiar holds expirados cada 5 minutos
    setInterval(async () => {
      try {
        const { HoldsService } = await import('../services/holds');
        const { InventoryService } = await import('../core/inventory');
        
        const holdsService = new HoldsService();
        const inventoryService = new InventoryService();

        const [holdsCleanedUp, locksCleanedUp] = await Promise.all([
          holdsService.cleanupExpiredHolds(),
          inventoryService.cleanupExpiredLocks(),
        ]);

        if (holdsCleanedUp > 0 || locksCleanedUp > 0) {
          logger.info(`Cleanup completed: ${holdsCleanedUp} holds, ${locksCleanedUp} locks`);
        }

      } catch (error) {
        logger.error('Cleanup job failed:', error);
      }
    }, 5 * 60 * 1000); // 5 minutos

    logger.info('Cleanup jobs scheduled');
  }

  /**
   * Graceful shutdown
   */
  public static async shutdown(): Promise<void> {
    logger.info('Shutting down services...');

    try {
      await db.disconnect();
      await redis.disconnect();
      logger.info('All services shut down gracefully');

    } catch (error) {
      logger.error('Error during shutdown:', error);
    }
  }
}
