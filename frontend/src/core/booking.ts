import { v4 as uuidv4 } from 'uuid';
import { db } from '../services/database';
import { RoomService, BedSelection } from './room';
import { InventoryService } from './inventory';
import { EmailService } from '../services/email';
import { NotificationService } from '../services/notifications';
import { SheetsIntegrationService } from '../services/integrations/sheets';
import { ConflictError, ValidationError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';
import { config } from '../config';

export interface GuestInfo {
  nombre: string;
  email: string;
  telefono?: string;
}

export interface BookingRequest {
  guest: GuestInfo;
  dates: {
    entrada: string;
    salida: string;
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
  private emailService: EmailService;
  private notificationService: NotificationService;
  private sheetsService: SheetsIntegrationService;

  constructor() {
    this.roomService = new RoomService();
    this.inventoryService = new InventoryService();
    this.emailService = new EmailService();
    this.notificationService = new NotificationService();
    this.sheetsService = new SheetsIntegrationService();
  }

  async createBooking(request: BookingRequest): Promise<BookingResponse> {
    const prisma = db.getClient();

    return prisma.$transaction(async (tx) => {
      // Validaciones existentes...
      this.validateDates(request.dates.entrada, request.dates.salida);
      
      const occupiedBeds = await this.inventoryService.getOccupiedBeds(
        request.dates.entrada,
        request.dates.salida
      );

      const bedValidation = this.roomService.validateBedSelection(
        request.beds,
        request.guests.hombres,
        request.guests.mujeres,
        occupiedBeds
      );

      if (!bedValidation.valid) {
        throw new ValidationError(bedValidation.errors.join(', '));
      }

      const stillAvailable = await this.inventoryService.verifyBedsAvailable(
        request.beds,
        request.dates.entrada,
        request.dates.salida
      );

      if (!stillAvailable) {
        throw new ConflictError('Una o más camas ya no están disponibles');
      }

      // Crear/encontrar huésped
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

      // Crear booking
      const bookingId = `BKG-${Date.now()}-${uuidv4().slice(0, 8)}`;

      const booking = await tx.booking.create({
        data: {
          bookingId,
          guestId: guest.id,
          entrada: new Date(request.dates.entrada + 'T15:00:00'),
          salida: new Date(request.dates.salida + 'T11:00:00'),
          hombres: request.guests.hombres,
          mujeres: request.guests.mujeres,
          totalPrice: request.totalPrice,
          status: 'PENDING',
          payStatus: 'PENDING',
        },
      });

      // Crear registros de camas
      const bedsData = [];
      for (const bed of request.beds) {
        const bedRecord = await tx.bookingBed.create({
          data: {
            bookingId: booking.id,
            roomId: bed.roomId,
            bedNumber: bed.bedNumber,
          },
        });
        bedsData.push(bedRecord);
      }

      // Preparar datos completos para integraciones
      const completeBookingData = {
        ...booking,
        guest,
        beds: bedsData,
      };

      logger.info(`Booking created: ${bookingId}`, {
        guestEmail: guest.email,
        beds: request.beds,
        total: request.totalPrice,
      });

      // Enviar email de confirmación (async)
      this.sendBookingConfirmationEmail(completeBookingData).catch(error => {
        logger.error('Failed to send booking confirmation email:', error);
      });

      // Sincronizar con Google Sheets (async)
      this.sheetsService.syncBookingToSheets(completeBookingData).catch(error => {
        logger.error('Failed to sync booking to Google Sheets:', error);
      });

      return {
        bookingId,
        guestId: guest.id,
        status: 'PENDING',
        message: 'Reserva creada exitosamente',
      };
    });
  }

  async updatePaymentStatus(
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
      include: {
        guest: true,
        beds: true,
      },
    });

    logger.info(`Payment status updated: ${bookingId} -> ${payStatus}`);

    // Si el pago fue exitoso, ejecutar post-payment actions
    if (payStatus === 'PAID') {
      // Enviar confirmación de pago
      this.sendPaymentConfirmationEmail(booking).catch(error => {
        logger.error('Failed to send payment confirmation email:', error);
      });

      // Enviar notificación WhatsApp
      if (booking.guest.telefono) {
        this.notificationService.sendPaymentNotification({
          guestPhone: booking.guest.telefono,
          guestName: booking.guest.nombre,
          bookingId: booking.bookingId,
          amount: parseFloat(booking.totalPrice.toString()),
        }).catch(error => {
          logger.error('Failed to send WhatsApp payment notification:', error);
        });
      }

      // Actualizar Google Sheets
      this.sheetsService.updatePaymentStatusInSheets(bookingId, payStatus).catch(error => {
        logger.error('Failed to update payment status in Google Sheets:', error);
      });

      // Programar email de check-in (24h antes)
      this.scheduleCheckInReminder(booking).catch(error => {
        logger.error('Failed to schedule check-in reminder:', error);
      });
    }

    return booking;
  }

  private async sendBookingConfirmationEmail(booking: any): Promise<void> {
    const beds = booking.beds.map((bed: any) => ({
      room: bed.roomId,
      bed: bed.bedNumber,
    }));

    await this.emailService.sendBookingConfirmation({
      guestEmail: booking.guest.email,
      guestName: booking.guest.nombre,
      bookingId: booking.bookingId,
      checkIn: booking.entrada.toISOString().split('T')[0],
      checkOut: booking.salida.toISOString().split('T')[0],
      beds,
      total: parseFloat(booking.totalPrice.toString()),
    });
  }

  private async sendPaymentConfirmationEmail(booking: any): Promise<void> {
    await this.emailService.sendPaymentConfirmation({
      guestEmail: booking.guest.email,
      guestName: booking.guest.nombre,
      bookingId: booking.bookingId,
      amount: parseFloat(booking.totalPrice.toString()),
      method: 'Online',
    });
  }

  private async scheduleCheckInReminder(booking: any): Promise<void> {
    const checkInDate = new Date(booking.entrada);
    const reminderDate = new Date(checkInDate.getTime() - 24 * 60 * 60 * 1000); // 24h antes
    
    // En producción, usar cron job o queue system
    // Por ahora, solo logging
    logger.info('Check-in reminder scheduled', {
      bookingId: booking.bookingId,
      reminderDate: reminderDate.toISOString(),
      checkInDate: checkInDate.toISOString(),
    });
  }

  // Resto de métodos existentes...
  async getBooking(bookingId: string) {
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

  private validateDates(entrada: string, salida: string): void {
    const checkIn = new Date(entrada);
    const checkOut = new Date(salida);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      throw new ValidationError('Formato de fechas inválido');
    }

    if (checkIn < today) {
      throw new ValidationError('La fecha de entrada no puede ser en el pasado');
    }

    if (checkOut <= checkIn) {
      throw new ValidationError('La fecha de salida debe ser posterior a la entrada');
    }

    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    if (nights < config.business.minStayNights) {
      throw new ValidationError(`Estancia mínima: ${config.business.minStayNights} noche(s)`);
    }

    if (nights > config.business.maxStayNights) {
      throw new ValidationError(`Estancia máxima: ${config.business.maxStayNights} noches`);
    }

    const maxAdvanceMs = config.business.maxAdvanceBookingDays * 24 * 60 * 60 * 1000;
    if (checkIn.getTime() - today.getTime() > maxAdvanceMs) {
      throw new ValidationError(`No se puede reservar con más de ${config.business.maxAdvanceBookingDays} días de anticipación`);
    }
  }
} 
