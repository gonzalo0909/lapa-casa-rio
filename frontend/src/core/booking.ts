import { v4 as uuidv4 } from 'uuid';
import { db } from '../services/database';
import { RoomService, BedSelection } from './room';
import { InventoryService } from './inventory';
import { ConflictError, ValidationError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';

export interface GuestInfo {
  nombre: string;
  email: string;
  telefono?: string;
}

export interface BookingRequest {
  guest: GuestInfo;
  dates: {
    entrada: string; // YYYY-MM-DD
    salida: string;  // YYYY-MM-DD
  };
  guests: {
    hombres: number;
    mujeres: number;
  };
  beds: BedSelection[];
  totalPrice: number;
}

export interface BookingResponse {
  bookingId: string;
  guestId: string;
  status: string;
  message: string;
}

export class BookingService {
  private roomService: RoomService;
  private inventoryService: InventoryService;

  constructor() {
    this.roomService = new RoomService();
    this.inventoryService = new InventoryService();
  }

  /**
   * Crear nueva reserva con validaciones completas
   */
  public async createBooking(request: BookingRequest): Promise<BookingResponse> {
    const prisma = db.getClient();

    return prisma.$transaction(async (tx) => {
      // 1. Validar fechas
      this.validateDates(request.dates.entrada, request.dates.salida);

      // 2. Verificar disponibilidad en tiempo real
      const occupiedBeds = await this.inventoryService.getOccupiedBeds(
        request.dates.entrada,
        request.dates.salida
      );

      // 3. Validar selección de camas
      const bedValidation = this.roomService.validateBedSelection(
        request.beds,
        request.guests.hombres,
        request.guests.mujeres,
        occupiedBeds
      );

      if (!bedValidation.valid) {
        throw new ValidationError(bedValidation.errors.join(', '));
      }

      // 4. Verificar que las camas siguen disponibles (double booking protection)
      const stillAvailable = await this.inventoryService.verifyBedsAvailable(
        request.beds,
        request.dates.entrada,
        request.dates.salida
      );

      if (!stillAvailable) {
        throw new ConflictError('Una o más camas ya no están disponibles');
      }

      // 5. Crear o encontrar huésped
      let guest = await tx.guest.findUnique({
        where: { email: request.guest.email },
      });

      if (!guest) {
        guest = await tx.guest.create({
          data: {
            nombre: request.guest.nombre,
            email: request.guest.email,
            telefono: request.guest.telefono,
          },
        });
      }

      // 6. Generar ID único de booking
      const bookingId = `BKG-${Date.now()}-${uuidv4().slice(0, 8)}`;

      // 7. Crear booking
      const booking = await tx.booking.create({
        data: {
          bookingId,
          guestId: guest.id,
          entrada: new Date(request.dates.entrada + 'T15:00:00'), // Check-in 3PM
          salida: new Date(request.dates.salida + 'T11:00:00'),   // Check-out 11AM
          hombres: request.guests.hombres,
          mujeres: request.guests.mujeres,
          totalPrice: request.totalPrice,
          status: 'PENDING',
          payStatus: 'PENDING',
        },
      });

      // 8. Crear registros de camas
      for (const bed of request.beds) {
        await tx.bookingBed.create({
          data: {
            bookingId: booking.id,
            roomId: bed.roomId,
            bedNumber: bed.bedNumber,
          },
        });
      }

      logger.info(`Booking created: ${bookingId}`, {
        guestEmail: guest.email,
        beds: request.beds,
        total: request.totalPrice,
      });

      return {
        bookingId,
        guestId: guest.id,
        status: 'PENDING',
        message: 'Reserva creada exitosamente',
      };
    });
  }

  /**
   * Obtener booking por ID
   */
  public async getBooking(bookingId: string) {
    const prisma = db.getClient();

    const booking = await prisma.booking.findUnique({
      where: { bookingId },
      include: {
        guest: true,
        beds: {
          include: {
            room: true,
          },
        },
        payments: true,
      },
    });

    if (!booking) {
      throw new NotFoundError(`Booking ${bookingId}`);
    }

    return booking;
  }

  /**
   * Actualizar estado de booking
   */
  public async updateBookingStatus(
    bookingId: string, 
    status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED'
  ) {
    const prisma = db.getClient();

    const booking = await prisma.booking.update({
      where: { bookingId },
      data: { status },
    });

    logger.info(`Booking status updated: ${bookingId} -> ${status}`);
    return booking;
  }

  /**
   * Actualizar estado de pago
   */
  public async updatePaymentStatus(
    bookingId: string,
    payStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'
  ) {
    const prisma = db.getClient();

    const booking = await prisma.booking.update({
      where: { bookingId },
      data: { 
        payStatus,
        ...(payStatus === 'PAID' && { status: 'CONFIRMED' }),
      },
    });

    logger.info(`Payment status updated: ${bookingId} -> ${payStatus}`);
    return booking;
  }

  /**
   * Cancelar booking
   */
  public async cancelBooking(bookingId: string, reason?: string) {
    const prisma = db.getClient();

    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { bookingId },
      });

      if (!booking) {
        throw new NotFoundError(`Booking ${bookingId}`);
      }

      if (booking.status === 'CANCELLED') {
        throw new ValidationError('Booking ya está cancelado');
      }

      // Actualizar estado
      await tx.booking.update({
        where: { bookingId },
        data: { 
          status: 'CANCELLED',
          notes: reason || 'Cancelado',
        },
      });

      logger.info(`Booking cancelled: ${bookingId}`, { reason });

      return { success: true, message: 'Booking cancelado exitosamente' };
    });
  }

  /**
   * Buscar bookings con filtros
   */
  public async searchBookings(filters: {
    guestEmail?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const prisma = db.getClient();
    const { page = 1, limit = 10, ...searchFilters } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (searchFilters.guestEmail) {
      where.guest = {
        email: { contains: searchFilters.guestEmail, mode: 'insensitive' },
      };
    }

    if (searchFilters.status) {
      where.status = searchFilters.status;
    }

    if (searchFilters.dateFrom || searchFilters.dateTo) {
      where.entrada = {};
      if (searchFilters.dateFrom) {
        where.entrada.gte = new Date(searchFilters.dateFrom + 'T00:00:00');
      }
      if (searchFilters.dateTo) {
        where.entrada.lte = new Date(searchFilters.dateTo + 'T23:59:59');
      }
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          guest: true,
          beds: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.booking.count({ where }),
    ]);

    return {
      bookings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Validar fechas de reserva
   */
  private validateDates(entrada: string, salida: string): void {
    const checkIn = new Date(entrada);
    const checkOut = new Date(salida);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Verificar formato
    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      throw new ValidationError('Formato de fechas inválido');
    }

    // Check-in no puede ser en el pasado
    if (checkIn < today) {
      throw new ValidationError('La fecha de entrada no puede ser en el pasado');
    }

    // Check-out debe ser después de check-in
    if (checkOut <= checkIn) {
      throw new ValidationError('La fecha de salida debe ser posterior a la entrada');
    }

    // Verificar estancia mínima y máxima
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    if (nights < config.business.minStayNights) {
      throw new ValidationError(`Estancia mínima: ${config.business.minStayNights} noche(s)`);
    }

    if (nights > config.business.maxStayNights) {
      throw new ValidationError(`Estancia máxima: ${config.business.maxStayNights} noches`);
    }

    // Verificar booking adelantado máximo
    const maxAdvanceMs = config.business.maxAdvanceBookingDays * 24 * 60 * 60 * 1000;
    if (checkIn.getTime() - today.getTime() > maxAdvanceMs) {
      throw new ValidationError(`No se puede reservar con más de ${config.business.maxAdvanceBookingDays} días de anticipación`);
    }
  }

  /**
   * Calcular noches y precios
   */
  public calculateStayDetails(entrada: string, salida: string) {
    const checkIn = new Date(entrada);
    const checkOut = new Date(salida);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    return {
      nights,
      checkIn: checkIn.toISOString(),
      checkOut: checkOut.toISOString(),
    };
  }
}
