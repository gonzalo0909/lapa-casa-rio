// lapa-casa-hostel/backend/src/routes/bookings/update-booking.ts
// ventana3

import { Request, Response, NextFunction } from 'express';
import { bookingService } from '../../services/booking-service';
import { AvailabilityService } from '../../services/availability-service';
import { PricingService } from '../../services/pricing-service';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

const availabilityService = new AvailabilityService();
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

      const availability = await availabilityService.checkAvailability({
        checkIn: newCheckIn,
        checkOut: newCheckOut,
        bedsNeeded: totalBeds,
      });

      if (!availability.available) {
        res.status(409).json(
          ApiResponse.error('No hay disponibilidad para las fechas solicitadas', {
            availableBeds: availability.availableBeds,
            requestedBeds: totalBeds,
          })
        );
        return;
      }

      const nights = Math.round(
        (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
      );
      const newPricing = await pricingService.calculateTotalPrice({
        checkInDate: newCheckIn,
        checkOutDate: newCheckOut,
        rooms: updates.rooms || [],
        totalBeds,
      });

      newFinalPrice = newPricing.totalPrice;
      newDepositAmount = newPricing.depositAmount;
      newRemainingAmount = newPricing.remainingAmount;

      await bookingService.updateBooking(id, {
        check_in_date: newCheckIn,
        check_out_date: newCheckOut,
        nights_count: nights,
        final_price: newFinalPrice,
        deposit_amount: newDepositAmount,
        remaining_amount: newRemainingAmount,
        group_discount: newPricing.groupDiscount ?? existingBooking.group_discount,
        season_multiplier: newPricing.seasonMultiplier ?? existingBooking.season_multiplier,
      });

      logger.info('Fechas de reserva actualizadas', { bookingId: id, newCheckIn, newCheckOut });
    }

    if (updates.guest) {
      const guestUpdate: any = {};
      if (updates.guest.firstName || updates.guest.lastName) {
        const first = updates.guest.firstName || '';
        const last = updates.guest.lastName || '';
        guestUpdate.full_name = `${first} ${last}`.trim();
      }
      if (updates.guest.phone) guestUpdate.phone = updates.guest.phone;
      if (updates.guest.country) guestUpdate.country = updates.guest.country;

      if (Object.keys(guestUpdate).length > 0) {
        await bookingService.updateGuest(existingBooking.guest_id, guestUpdate);
      }
    }

    if (updates.specialRequests !== undefined) {
      await bookingService.updateBooking(id, { special_requests: updates.specialRequests });
    }

    const updatedBooking = await bookingService.getBooking(id);
    if (!updatedBooking) throw new Error('No se pudo obtener la reserva actualizada');

    const oldTotal = Number(existingBooking.final_price);
    const priceDifference = datesChanged || roomsChanged ? newFinalPrice - oldTotal : 0;

    res.status(200).json(
      ApiResponse.success({
        booking: {
          id: updatedBooking.id,
          confirmationNumber: `LCH-${updatedBooking.id.substring(0, 8).toUpperCase()}`,
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
    logger.error('Error al actualizar reserva', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    next(error);
  }
};
