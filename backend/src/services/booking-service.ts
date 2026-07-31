// lapa-casa-hostel/backend/src/services/booking-service.ts

import { PrismaClient, Booking, BookingStatus } from '@prisma/client';
import { addDays, differenceInDays, isAfter, isBefore, parseISO } from 'date-fns';
import { BookingRepository } from '../database/repositories/booking-repository';
import { RoomRepository } from '../database/repositories/room-repository';
import { GuestRepository } from '../database/repositories/guest-repository';
import { AvailabilityService } from './availability-service';
import { PricingService } from './pricing-service';
import { PaymentService } from './payment-service';
import { EmailService } from './email-service';
import { NotificationService } from './notification-service';
import { logger } from '../utils/logger';
import { AppError } from '../utils/responses';

interface CreateBookingDTO {
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestDocument?: string;
  checkInDate: string;
  checkOutDate: string;
  roomsRequested: Array<{
    roomId: string;
    bedsCount: number;
  }>;
  specialRequests?: string;
  language?: 'pt' | 'en' | 'es';
  source?: string;
}

interface UpdateBookingDTO {
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  checkInDate?: string;
  checkOutDate?: string;
  specialRequests?: string;
  status?: BookingStatus;
}

interface BookingWithDetails extends Booking {
  guest: any;
  rooms: any[];
  payments: any[];
}

/**
 * BookingService - Servicio principal para gestión de reservas
 * Maneja creación, actualización, cancelación y lógica de negocio de bookings
 */
export class BookingService {
  private bookingRepo: BookingRepository;
  private roomRepo: RoomRepository;
  private guestRepo: GuestRepository;
  private availabilityService: AvailabilityService;
  private pricingService: PricingService;
  private paymentService: PaymentService;
  private emailService: EmailService;
  private notificationService: NotificationService;

  constructor(prisma: PrismaClient) {
    this.bookingRepo = new BookingRepository(prisma);
    this.roomRepo = new RoomRepository(prisma);
    this.guestRepo = new GuestRepository(prisma);
    this.availabilityService = new AvailabilityService(prisma);
    this.pricingService = new PricingService();
    this.paymentService = new PaymentService(prisma);
    this.emailService = new EmailService();
    this.notificationService = new NotificationService();
  }

  /**
   * Crea una nueva reserva completa con validaciones
   * @param data - Datos de la reserva
   * @returns Reserva creada con detalles
   */
  async createBooking(data: CreateBookingDTO): Promise<BookingWithDetails> {
    try {
      logger.info('Iniciando creación de booking', { email: data.guestEmail });

      // 1. Validar fechas
      this.validateDates(data.checkInDate, data.checkOutDate);

      // 2. Calcular total de camas solicitadas
      const totalBeds = data.roomsRequested.reduce((sum, room) => sum + room.bedsCount, 0);

      if (totalBeds === 0) {
        throw new AppError('Debe solicitar al menos 1 cama', 400);
      }

      // 3. Verificar disponibilidad
      const availability = await this.availabilityService.checkAvailability(
        data.checkInDate,
        data.checkOutDate,
        totalBeds
      );

      if (!availability.available) {
        throw new AppError('No hay disponibilidad para las fechas seleccionadas', 409);
      }

      // 4. Validar asignación de habitaciones
      const roomsValid = await this.validateRoomAssignment(data.roomsRequested, availability);
      if (!roomsValid) {
        throw new AppError('Asignación de habitaciones inválida', 400);
      }

      // 5. Calcular pricing
      const nights = differenceInDays(parseISO(data.checkOutDate), parseISO(data.checkInDate));
      const pricing = await this.pricingService.calculateTotalPrice({
        checkInDate: data.checkInDate,
        checkOutDate: data.checkOutDate,
        rooms: data.roomsRequested,
        totalBeds
      });

      // 6. Crear o actualizar guest
      const guest = await this.guestRepo.findByEmail(data.guestEmail) || 
        await this.guestRepo.create({
          name: data.guestName,
          email: data.guestEmail,
          phone: data.guestPhone,
          document: data.guestDocument
        });

      // 7. Generar booking ID único
      const bookingId = this.generateBookingId();

      // 8. Crear booking
      const booking = await this.bookingRepo.create({
        bookingId,
        guestId: guest.id,
        checkInDate: parseISO(data.checkInDate),
        checkOutDate: parseISO(data.checkOutDate),
        totalBeds,
        nights,
        basePrice: pricing.basePrice,
        discountAmount: pricing.discountAmount,
        seasonMultiplier: pricing.seasonMultiplier,
        totalPrice: pricing.totalPrice,
        depositAmount: pricing.depositAmount,
        remainingAmount: pricing.remainingAmount,
        specialRequests: data.specialRequests,
        status: 'PENDING',
        source: data.source || 'WEBSITE',
        language: data.language || 'pt'
      });

      // 9. Asignar habitaciones
      await this.assignRoomsToBooking(booking.id, data.roomsRequested);

      // 10. Crear payment intent para depósito
      const paymentIntent = await this.paymentService.createDepositPaymentIntent({
        bookingId: booking.id,
        amount: pricing.depositAmount,
        currency: 'BRL',
        guestEmail: data.guestEmail
      });

      // 11. Enviar email de confirmación
      await this.emailService.sendBookingConfirmation({
        to: data.guestEmail,
        bookingId,
        guestName: data.guestName,
        checkIn: data.checkInDate,
        checkOut: data.checkOutDate,
        rooms: data.roomsRequested,
        totalPrice: pricing.totalPrice,
        depositAmount: pricing.depositAmount,
        paymentUrl: paymentIntent.url,
        language: data.language || 'pt'
      });

      // 12. Enviar notificación WhatsApp
      await this.notificationService.sendBookingNotification({
        phone: data.guestPhone,
        bookingId,
        checkIn: data.checkInDate,
        language: data.language || 'pt'
      });

      // 13. Retornar booking completo
      const bookingWithDetails = await this.bookingRepo.findById(booking.id);

      logger.info('Booking creado exitosamente', { bookingId });

      return bookingWithDetails;

    } catch (error) {
      logger.error('Error creando booking', error);
      throw error;
    }
  }

  /**
   * Obtiene una reserva por ID
   * @param bookingId - ID de la reserva
   * @returns Reserva con detalles
   */
  async getBooking(bookingId: string): Promise<BookingWithDetails | null> {
    const booking = await this.bookingRepo.findByBookingId(bookingId);
    
    if (!booking) {
      throw new AppError('Reserva no encontrada', 404);
    }

    return booking;
  }

  /**
   * Actualiza una reserva existente
   * @param bookingId - ID de la reserva
   * @param data - Datos a actualizar
   * @returns Reserva actualizada
   */
  async updateBooking(bookingId: string, data: UpdateBookingDTO): Promise<BookingWithDetails> {
    try {
      const booking = await this.bookingRepo.findByBookingId(bookingId);

      if (!booking) {
        throw new AppError('Reserva no encontrada', 404);
      }

      // No permitir actualización de bookings cancelados
      if (booking.status === 'CANCELLED') {
        throw new AppError('No se puede actualizar una reserva cancelada', 400);
      }

      // Si cambian fechas, recalcular pricing
      let updatedData: any = { ...data };

      if (data.checkInDate || data.checkOutDate) {
        const newCheckIn = data.checkInDate ? parseISO(data.checkInDate) : booking.checkInDate;
        const newCheckOut = data.checkOutDate ? parseISO(data.checkOutDate) : booking.checkOutDate;

        this.validateDates(newCheckIn.toISOString(), newCheckOut.toISOString());

        // Verificar disponibilidad para nuevas fechas
        const availability = await this.availabilityService.checkAvailability(
          newCheckIn.toISOString(),
          newCheckOut.toISOString(),
          booking.totalBeds,
          booking.id
        );

        if (!availability.available) {
          throw new AppError('No hay disponibilidad para las nuevas fechas', 409);
        }

        // Recalcular pricing
        const nights = differenceInDays(newCheckOut, newCheckIn);
        const pricing = await this.pricingService.calculateTotalPrice({
          checkInDate: newCheckIn.toISOString(),
          checkOutDate: newCheckOut.toISOString(),
          rooms: booking.rooms.map(r => ({ roomId: r.roomId, bedsCount: r.bedsCount })),
          totalBeds: booking.totalBeds
        });

        updatedData = {
          ...updatedData,
          nights,
          basePrice: pricing.basePrice,
          totalPrice: pricing.totalPrice,
          depositAmount: pricing.depositAmount,
          remainingAmount: pricing.remainingAmount
        };
      }

      // Actualizar guest si es necesario
      if (data.guestName || data.guestEmail || data.guestPhone) {
        await this.guestRepo.update(booking.guestId, {
          name: data.guestName,
          email: data.guestEmail,
          phone: data.guestPhone
        });
      }

      // Actualizar booking
      const updatedBooking = await this.bookingRepo.update(booking.id, updatedData);

      logger.info('Booking actualizado', { bookingId });

      return updatedBooking;

    } catch (error) {
      logger.error('Error actualizando booking', error);
      throw error;
    }
  }

  /**
   * Cancela una reserva
   * @param bookingId - ID de la reserva
   * @param reason - Motivo de cancelación
   * @returns Reserva cancelada
   */
  async cancelBooking(bookingId: string, reason?: string): Promise<BookingWithDetails> {
    try {
      const booking = await this.bookingRepo.findByBookingId(bookingId);

      if (!booking) {
        throw new AppError('Reserva no encontrada', 404);
      }

      if (booking.status === 'CANCELLED') {
        throw new AppError('La reserva ya está cancelada', 400);
      }

      // Calcular reembolso según política
      const refundAmount = this.calculateRefund(booking);

      // Actualizar status
      const cancelledBooking = await this.bookingRepo.update(booking.id, {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: reason
      });

      // Procesar reembolso si aplica
      if (refundAmount > 0 && booking.depositPaid) {
        await this.paymentService.processRefund({
          bookingId: booking.id,
          amount: refundAmount,
          reason: reason || 'Cancelación de reserva'
        });
      }

      // Enviar email de cancelación
      await this.emailService.sendCancellationEmail({
        to: booking.guest.email,
        bookingId,
        guestName: booking.guest.name,
        refundAmount,
        language: booking.language
      });

      logger.info('Booking cancelado', { bookingId, refundAmount });

      return cancelledBooking;

    } catch (error) {
      logger.error('Error cancelando booking', error);
      throw error;
    }
  }

  /**
   * Confirma una reserva después del pago del depósito
   * @param bookingId - ID de la reserva
   * @returns Reserva confirmada
   */
  async confirmBooking(bookingId: string): Promise<BookingWithDetails> {
    const booking = await this.bookingRepo.findByBookingId(bookingId);

    if (!booking) {
      throw new AppError('Reserva no encontrada', 404);
    }

    if (!booking.depositPaid) {
      throw new AppError('El depósito no ha sido pagado', 400);
    }

    const confirmedBooking = await this.bookingRepo.update(booking.id, {
      status: 'CONFIRMED',
      confirmedAt: new Date()
    });

    // Programar cobro automático del saldo restante
    if (booking.remainingAmount > 0) {
      const chargeDate = addDays(parseISO(booking.checkInDate.toISOString()), -7);
      await this.paymentService.scheduleRemainingPayment({
        bookingId: booking.id,
        amount: booking.remainingAmount,
        scheduledDate: chargeDate
      });
    }

    // Sincronizar con Google Sheets
    await this.syncToGoogleSheets(confirmedBooking);

    logger.info('Booking confirmado', { bookingId });

    return confirmedBooking;
  }

  /**
   * Lista todas las reservas con filtros
   * @param filters - Filtros de búsqueda
   * @returns Lista de reservas
   */
  async listBookings(filters: {
    status?: BookingStatus;
    checkInFrom?: string;
    checkInTo?: string;
    guestEmail?: string;
    page?: number;
    limit?: number;
  }): Promise<{ bookings: BookingWithDetails[]; total: number }> {
    return this.bookingRepo.findMany(filters);
  }

  /**
   * Obtiene estadísticas de reservas
   * @param from - Fecha desde
   * @param to - Fecha hasta
   * @returns Estadísticas
   */
  async getBookingStats(from: string, to: string): Promise<any> {
    const bookings = await this.bookingRepo.findMany({
      checkInFrom: from,
      checkInTo: to
    });

    const stats = {
      totalBookings: bookings.total,
      confirmedBookings: 0,
      pendingBookings: 0,
      cancelledBookings: 0,
      totalRevenue: 0,
      averageBookingValue: 0,
      averageBedsPerBooking: 0,
      occupancyRate: 0
    };

    bookings.bookings.forEach(booking => {
      if (booking.status === 'CONFIRMED') stats.confirmedBookings++;
      if (booking.status === 'PENDING') stats.pendingBookings++;
      if (booking.status === 'CANCELLED') stats.cancelledBookings++;
      
      if (booking.status === 'CONFIRMED') {
        stats.totalRevenue += booking.totalPrice;
      }
    });

    stats.averageBookingValue = stats.totalRevenue / (stats.confirmedBookings || 1);
    stats.averageBedsPerBooking = bookings.bookings.reduce((sum, b) => sum + b.totalBeds, 0) / (bookings.total || 1);

    return stats;
  }

  // MÉTODOS PRIVADOS

  private validateDates(checkIn: string, checkOut: string): void {
    const checkInDate = parseISO(checkIn);
    const checkOutDate = parseISO(checkOut);
    const today = new Date();

    if (isBefore(checkInDate, today)) {
      throw new AppError('La fecha de check-in no puede ser en el pasado', 400);
    }

    if (!isAfter(checkOutDate, checkInDate)) {
      throw new AppError('La fecha de check-out debe ser posterior al check-in', 400);
    }

    const nights = differenceInDays(checkOutDate, checkInDate);
    if (nights < 1) {
      throw new AppError('La reserva debe ser de al menos 1 noche', 400);
    }

    if (nights > 90) {
      throw new AppError('La reserva no puede exceder 90 noches', 400);
    }
  }

  private async validateRoomAssignment(
    roomsRequested: Array<{ roomId: string; bedsCount: number }>,
    availability: any
  ): Promise<boolean> {
    for (const room of roomsRequested) {
      const roomData = await this.roomRepo.findById(room.roomId);
      
      if (!roomData) {
        throw new AppError(`Habitación ${room.roomId} no existe`, 404);
      }

      if (room.bedsCount > roomData.capacity) {
        throw new AppError(`Habitación ${roomData.name} solo tiene ${roomData.capacity} camas`, 400);
      }

      const availableInRoom = availability.roomsAvailable.find((r: any) => r.roomId === room.roomId);
      if (!availableInRoom || room.bedsCount > availableInRoom.availableBeds) {
        throw new AppError(`No hay suficientes camas disponibles en ${roomData.name}`, 409);
      }
    }

    return true;
  }

  private async assignRoomsToBooking(
    bookingId: number,
    rooms: Array<{ roomId: string; bedsCount: number }>
  ): Promise<void> {
    for (const room of rooms) {
      await this.bookingRepo.assignRoom(bookingId, room.roomId, room.bedsCount);
    }
  }

  private generateBookingId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 7);
    return `LCH-${timestamp}-${random}`.toUpperCase();
  }

  private calculateRefund(booking: any): number {
    const now = new Date();
    const checkIn = parseISO(booking.checkInDate.toISOString());
    const hoursUntilCheckIn = differenceInDays(checkIn, now) * 24;

    // Política de cancelación
    if (hoursUntilCheckIn >= 168) { // 7+ días
      return booking.depositPaid ? booking.depositAmount : 0;
    } else if (hoursUntilCheckIn >= 48) { // 2-7 días
      return booking.depositPaid ? booking.depositAmount * 0.5 : 0;
    } else { // < 2 días
      return 0;
    }
  }

  private async syncToGoogleSheets(booking: BookingWithDetails): Promise<void> {
    try {
      // Implementación de sincronización con Google Sheets
      // Se implementará en integrations/google-sheets
      logger.info('Booking sincronizado con Google Sheets', { bookingId: booking.bookingId });
    } catch (error) {
      logger.error('Error sincronizando con Google Sheets', error);
      // No fallar el proceso principal si falla la sincronización
    }
  }
}
