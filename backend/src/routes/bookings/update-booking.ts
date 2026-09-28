
import type { Request, Response, NextFunction } from 'express';
import { bookingService, InsufficientAvailabilityError } from '../../services/booking-service';
import { PricingService, MinNightsRequiredError } from '../../services/pricing-service';
import { query } from '../../config/database';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

const pricingService = new PricingService();

interface UpdateBookingRequest {
  checkIn?: string;
  checkOut?: string;
  rooms?: Array<{ roomId: string; bedsCount: number }>;
  guest?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    country?: string;
  };
  specialRequests?: string;
}

export const updateBookingHandler = async (
  req: Request<{ id: string }, {}, UpdateBookingRequest>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    logger.info('Actualizando reserva', { bookingId: id });

    const existingBooking = await bookingService.getBooking(id);

    if (!existingBooking) {
      res.status(404).json(ApiResponse.error('Reserva no encontrada', { bookingId: id }));
      return;
    }

    if (existingBooking.status === 'cancelled') {
      res.status(400).json(ApiResponse.error('No se puede modificar una reserva cancelada'));
      return;
    }

    if (existingBooking.status === 'completed') {
      res.status(400).json(ApiResponse.error('No se puede modificar una reserva completada'));
      return;
    }

    const checkInDate = new Date(existingBooking.check_in_date);
    const now = new Date();
    const hoursUntilCheckIn =
      (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilCheckIn < 48 && (updates.checkIn || updates.checkOut || updates.rooms)) {
      res.status(400).json(
        ApiResponse.error('No se pueden modificar fechas o camas dentro de 48h del check-in')
      );
      return;
    }

    const datesChanged = !!(updates.checkIn || updates.checkOut);
    const roomsChanged = !!updates.rooms;

    let newFinalPrice = Number(existingBooking.final_price);
    let newDepositAmount = Number(existingBooking.deposit_amount);
    let newRemainingAmount = Number(existingBooking.remaining_amount);

    if (datesChanged || roomsChanged) {
      const newCheckIn = updates.checkIn || String(existingBooking.check_in_date).slice(0, 10);
      const newCheckOut = updates.checkOut || String(existingBooking.check_out_date).slice(0, 10);
      const totalBeds = existingBooking.beds_count || 1;

      const checkIn = new Date(newCheckIn);
      const checkOut = new Date(newCheckOut);

      if (checkIn < now) {
        res.status(400).json(ApiResponse.error('La fecha de check-in no puede ser en el pasado'));
        return;
      }
      if (checkOut <= checkIn) {
        res.status(400).json(ApiResponse.error('La fecha de check-out debe ser posterior al check-in'));
        return;
      }

      const nights = Math.round(
        (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
      );
      // Si se cambiaron fechas pero no se proveyeron habitaciones explícitamente,
      // se obtienen las habitaciones actuales de la reserva desde DB.
      let roomsForPricing = updates.rooms;
      if (!roomsForPricing) {
        const { rows: currentBedRows } = await query<{ room_type_id: string; bed_count: number }>(
          `SELECT b.room_type_id, COUNT(*)::int AS bed_count
           FROM reservation_beds rb
           JOIN beds b ON b.id = rb.bed_id
           WHERE rb.reservation_id = $1
           GROUP BY b.room_type_id`,
          [id]
        );
        roomsForPricing = currentBedRows.map(r => ({ roomId: r.room_type_id, bedsCount: r.bed_count }));
      }

      const newPricing = await pricingService.calculateTotalPrice({
        checkInDate: newCheckIn,
        checkOutDate: newCheckOut,
        rooms: roomsForPricing || [],
        totalBeds,
      });

      newFinalPrice = newPricing.totalPrice;
      newDepositAmount = newPricing.depositAmount;
      newRemainingAmount = newPricing.remainingAmount;

      // reservation_beds es la fuente de verdad de disponibilidad (EXCLUDE
      // constraint, trigger de liberación, check_availability()) -- este
      // método borra las filas viejas, re-verifica disponibilidad bajo lock
      // e inserta las nuevas, todo en la misma transacción que el UPDATE de
      // `reservations`. Si la disponibilidad falla, no se persiste nada.
      try {
        await bookingService.updateBookingRoomsAndDates(id, {
          checkIn: newCheckIn,
          checkOut: newCheckOut,
          nightsCount: nights,
          rooms: roomsForPricing.map(r => ({ roomId: r.roomId, bedsCount: r.bedsCount })),
          guestGender: (existingBooking.guest_gender as 'mixed' | 'female' | 'male') ?? 'mixed',
          pricing: {
            finalPrice: newFinalPrice,
            depositAmount: newDepositAmount,
            remainingAmount: newRemainingAmount,
            groupDiscount: newPricing.groupDiscount ?? undefined,
            seasonMultiplier: newPricing.seasonMultiplier ?? undefined,
          },
        });
      } catch (error) {
        if (error instanceof InsufficientAvailabilityError) {
          logger.warn('Insufficient availability during updateBooking', { bookingId: id, details: error.details });
          res.status(409).json(ApiResponse.error(error.message, error.details));
          return;
        }
        throw error;
      }

      logger.info('Fechas de reserva actualizadas', { bookingId: id, newCheckIn, newCheckOut });
    }

    if (updates.guest) {
      const guestUpdate: any = {};
      if (updates.guest.firstName || updates.guest.lastName) {
        const first = updates.guest.firstName || '';
        const last = updates.guest.lastName || '';
        guestUpdate.full_name = `${first} ${last}`.trim();
      }
      if (updates.guest.phone) {guestUpdate.phone = updates.guest.phone;}
      if (updates.guest.country) {guestUpdate.country = updates.guest.country;}

      if (Object.keys(guestUpdate).length > 0) {
        await bookingService.updateGuest(existingBooking.guest_id, guestUpdate);
      }
    }

    if (updates.specialRequests !== undefined) {
      await bookingService.updateBooking(id, { special_requests: updates.specialRequests });
    }

    const updatedBooking = await bookingService.getBooking(id);
    if (!updatedBooking) {throw new Error('No se pudo obtener la reserva actualizada');}

    const oldTotal = Number(existingBooking.final_price);
    const priceDifference = datesChanged || roomsChanged ? newFinalPrice - oldTotal : 0;

    res.status(200).json(
      ApiResponse.success({
        booking: {
          id: updatedBooking.id,
          confirmationNumber: updatedBooking.reservation_number,
          status: updatedBooking.status,
          checkIn: updatedBooking.check_in_date,
          checkOut: updatedBooking.check_out_date,
          nights: updatedBooking.nights_count,
          bedsCount: updatedBooking.beds_count,
          guest: updatedBooking.guest,
          pricing: {
            total: Number(updatedBooking.final_price),
            deposit: Number(updatedBooking.deposit_amount),
            remaining: Number(updatedBooking.remaining_amount),
            currency: 'BRL',
          },
          specialRequests: updatedBooking.special_requests,
          updatedAt: updatedBooking.updated_at,
        },
        changes: {
          datesChanged,
          roomsChanged,
          guestUpdated: !!updates.guest,
          priceDifference,
        },
      }, 'Reserva actualizada exitosamente')
    );
  } catch (error) {
    if (error instanceof MinNightsRequiredError) {
      res.status(422).json(ApiResponse.error(error.message, { minNights: error.minNights, label: error.label, roomId: error.roomId, pricePerNight: error.pricePerNight }));
      return;
    }
    logger.error('Error al actualizar reserva', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    next(error);
  }
};
