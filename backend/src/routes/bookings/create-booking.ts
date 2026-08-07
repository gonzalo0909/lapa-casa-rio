// lapa-casa-hostel/backend/src/routes/bookings/create-booking.ts
// ventana4: envío de email de confirmación reenganchado a notificationService (ver notify('booking_confirmation', ...) más abajo)

import { Request, Response, NextFunction } from 'express';
import { BookingService } from '../../services/booking-service';
import { AvailabilityService } from '../../services/availability-service';
import { PricingService } from '../../services/pricing-service';
import { notificationService } from '../../services/notification-service';
import type { BookingWithGuest } from '../../services/email-service';
import { InsufficientAvailabilityError } from '../../services/booking-service';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

const bookingService = new BookingService();
const availabilityService = new AvailabilityService();
const pricingService = new PricingService();

interface CreateBookingRequest {
  checkIn: string;
  checkOut: string;
  rooms: Array<{
    roomId: string;
    bedsCount: number;
  }>;
  guest: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    country: string;
    document?: string;
  };
  specialRequests?: string;
  language?: 'pt' | 'en' | 'es';
  source?: string;
}

export const createBookingHandler = async (
  req: Request<{}, {}, CreateBookingRequest>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const bookingData = req.body;

    logger.info('Creating booking', {
      checkIn: bookingData.checkIn,
      checkOut: bookingData.checkOut,
      totalBeds: bookingData.rooms.reduce((sum, r) => sum + r.bedsCount, 0)
    });

    const checkIn = new Date(bookingData.checkIn);
    const checkOut = new Date(bookingData.checkOut);
    const now = new Date();

    if (checkIn < now) {
      res.status(400).json(ApiResponse.error('Check-in date cannot be in the past'));
      return;
    }

    if (checkOut <= checkIn) {
      res.status(400).json(ApiResponse.error('Check-out date must be after check-in date'));
      return;
    }

    const nights = Math.round(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
    );

    const totalBedsRequested = bookingData.rooms.reduce((sum, r) => sum + r.bedsCount, 0);

    // Check overall availability
    const availability = await availabilityService.checkAvailability({
      checkIn: bookingData.checkIn,
      checkOut: bookingData.checkOut,
      bedsNeeded: totalBedsRequested
    });

    if (!availability.available) {
      logger.warn('Insufficient availability', {
        requested: totalBedsRequested,
        available: availability.availableBeds
      });
      res.status(409).json(
        ApiResponse.error('Insufficient availability for requested dates', {
          availableBeds: availability.availableBeds,
          requestedBeds: totalBedsRequested,
          alternativeDates: availability.alternativeDates
        })
      );
      return;
    }

    // Calculate pricing
    const pricingDetails = await pricingService.calculateTotalPrice({
      checkInDate: bookingData.checkIn,
      checkOutDate: bookingData.checkOut,
      rooms: bookingData.rooms,
      totalBeds: totalBedsRequested
    });

    // Check per-room availability
    for (const room of bookingData.rooms) {
      const roomAvail = await availabilityService.checkRoomAvailability(
        room.roomId,
        bookingData.checkIn,
        bookingData.checkOut
      );

      if (roomAvail.availableBeds < room.bedsCount) {
        res.status(409).json(
          ApiResponse.error(`Insufficient beds in room ${room.roomId}`, {
            roomId: room.roomId,
            requested: room.bedsCount,
            available: roomAvail.availableBeds
          })
        );
        return;
      }
    }

    // Merge first/last name for DB
    const fullName = `${bookingData.guest.firstName} ${bookingData.guest.lastName}`.trim();

    // Create booking
    const booking = await bookingService.createBooking({
      checkIn: bookingData.checkIn,
      checkOut: bookingData.checkOut,
      rooms: bookingData.rooms,
      guest: {
        full_name: fullName,
        email: bookingData.guest.email,
        phone: bookingData.guest.phone,
        country: bookingData.guest.country,
        document: bookingData.guest.document
      },
      nights,
      totalBeds: totalBedsRequested,
      pricing: pricingDetails,
      specialRequests: bookingData.specialRequests,
      source: bookingData.source || 'website',
      language: bookingData.language || 'pt',
      status: 'pending_payment'
    });

    logger.info('Booking created successfully', {
      bookingId: booking.id,
      totalPrice: pricingDetails.totalPrice
    });

    // Envio de confirmacion, no bloqueante -- se resuelve con los datos ya
    // insertados (guest joined via bookingService.getBooking), no con el
    // payload crudo del request.
    bookingService.getBooking(booking.id).then(bookingWithGuest => {
      if (!bookingWithGuest?.guest) {
        logger.error('No se pudo cargar guest para email de confirmación', { bookingId: booking.id });
        return;
      }
      return notificationService.notify('booking_confirmation', bookingWithGuest as BookingWithGuest);
    }).catch(error => {
      logger.error('Failed to send booking confirmation email', {
        bookingId: booking.id,
        error: error.message
      });
    });

    res.status(201).json(
      ApiResponse.success({
        booking: {
          id: booking.id,
          confirmationNumber: `LCH-${booking.id.substring(0, 8).toUpperCase()}`,
          status: booking.status,
          checkIn: bookingData.checkIn,
          checkOut: bookingData.checkOut,
          nights,
          rooms: bookingData.rooms,
          guest: {
            name: fullName,
            email: bookingData.guest.email
          },
          pricing: {
            subtotal: pricingDetails.basePrice,
            groupDiscount: pricingDetails.discountAmount,
            seasonalAdjustment: pricingDetails.priceAfterSeason - pricingDetails.priceAfterDiscount,
            total: pricingDetails.totalPrice,
            deposit: pricingDetails.depositAmount,
            remaining: pricingDetails.remainingAmount,
            currency: 'BRL'
          },
          payment: {
            depositRequired: true,
            depositAmount: pricingDetails.depositAmount,
            // Antes hardcodeado a +24h, sin relación con el hold real de la
            // reserva -- ahora usa el mismo pending_expires_at que ya vino
            // en el INSERT (booking-service.ts), la única fuente de verdad.
            depositDueDate: booking.pending_expires_at,
            remainingAmount: pricingDetails.remainingAmount,
            remainingDueDate: new Date(
              checkIn.getTime() - 7 * 24 * 60 * 60 * 1000
            ).toISOString()
          },
          // Expiración real del hold (5 min) para que el frontend arme el
          // contador regresivo con el dato correcto, no un valor inventado.
          pendingExpiresAt: booking.pending_expires_at
        }
      }, 'Booking created successfully')
    );
  } catch (error) {
    // El pre-chequeo de arriba puede pasar y aun asi bookingService.createBooking()
    // lanzar esto -- otra transaccion tomo las camas entre el pre-chequeo y el
    // INSERT bajo lock. Sin este catch especifico caia al error-handler generico
    // y devolvia 500 en vez de 409 (InsufficientAvailabilityError no tiene
    // `statusCode`, asi que error-handler.ts la trataba como error inesperado).
    if (error instanceof InsufficientAvailabilityError) {
      logger.warn('Insufficient availability detected during createBooking', { details: error.details });
      res.status(409).json(ApiResponse.error(error.message, error.details));
      return;
    }

    logger.error('Error creating booking', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    next(error);
  }
};
