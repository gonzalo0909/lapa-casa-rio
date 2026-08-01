// lapa-casa-hostel/backend/src/routes/bookings/update-booking.ts

import { Request, Response, NextFunction } from 'express';
import { BookingService } from '../../services/booking-service';
import { AvailabilityService } from '../../services/availability-service';
import { PricingService } from '../../services/pricing-service';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

const bookingService = new BookingService();
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

    logger.info('Updating booking', { bookingId: id });

    const existingBooking = await bookingService.getBookingById(id);

    if (!existingBooking) {
      res.status(404).json(ApiResponse.error('Booking not found', { bookingId: id }));
      return;
    }

    if (existingBooking.status === 'cancelled') {
      res.status(400).json(ApiResponse.error('Cannot modify cancelled booking'));
      return;
    }

    if (existingBooking.status === 'completed') {
      res.status(400).json(ApiResponse.error('Cannot modify completed booking'));
      return;
    }

    const checkInDate = new Date(existingBooking.check_in_date);
    const now = new Date();
    const daysUntilCheckIn = Math.ceil(
      (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilCheckIn < 2 && (updates.checkIn || updates.checkOut || updates.rooms)) {
      res.status(400).json(
        ApiResponse.error('Cannot modify dates or rooms within 48 hours of check-in')
      );
      return;
    }

    const datesChanged = !!(updates.checkIn || updates.checkOut);
    const roomsChanged = !!updates.rooms;

    let newTotalPrice = Number(existingBooking.total_price);
    let newDepositAmount = Number(existingBooking.deposit_amount ?? 0);

    if (datesChanged || roomsChanged) {
      const newCheckIn = updates.checkIn || existingBooking.check_in_date;
      const newCheckOut = updates.checkOut || existingBooking.check_out_date;
      const totalBeds = existingBooking.total_beds || 1;

      const checkIn = new Date(newCheckIn);
      const checkOut = new Date(newCheckOut);

      if (checkIn < now) {
        res.status(400).json(ApiResponse.error('Check-in date cannot be in the past'));
        return;
      }

      if (checkOut <= checkIn) {
        res.status(400).json(ApiResponse.error('Check-out date must be after check-in date'));
        return;
      }

      const newNights = Math.round(
        (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
      );

      const availability = await availabilityService.checkAvailability({
        checkIn: newCheckIn,
        checkOut: newCheckOut,
        bedsNeeded: totalBeds,
        excludeBookingId: id
      });

      if (!availability.available) {
        res.status(409).json(
          ApiResponse.error('Insufficient availability for requested changes', {
            availableBeds: availability.availableBeds,
            requestedBeds: totalBeds
          })
        );
        return;
      }

      const newPricing = await pricingService.calculateTotalPrice({
        checkInDate: newCheckIn,
        checkOutDate: newCheckOut,
        rooms: updates.rooms || [],
        totalBeds
      });

      newTotalPrice = newPricing.totalPrice;
      newDepositAmount = newPricing.depositAmount;

      await bookingService.updateBooking(id, {
        check_in_date: newCheckIn,
        check_out_date: newCheckOut,
        total_price: newTotalPrice,
        deposit_amount: newDepositAmount,
        remaining_amount: newPricing.remainingAmount,
        group_discount_pct: newPricing.groupDiscount,
        season_type: newPricing.seasonType,
        season_multiplier: newPricing.seasonMultiplier
      });

      logger.info('Booking dates updated', { bookingId: id, newCheckIn, newCheckOut });
    }

    // Update guest info
    if (updates.guest) {
      const guestUpdate: any = {};
      if (updates.guest.firstName || updates.guest.lastName) {
        const firstName = updates.guest.firstName || '';
        const lastName = updates.guest.lastName || '';
        guestUpdate.full_name = `${firstName} ${lastName}`.trim();
      }
      if (updates.guest.email) guestUpdate.email = updates.guest.email;
      if (updates.guest.phone) guestUpdate.phone = updates.guest.phone;
      if (updates.guest.country) guestUpdate.country = updates.guest.country;

      if (Object.keys(guestUpdate).length > 0) {
        await bookingService.updateGuest(existingBooking.guest_id, guestUpdate);
      }
    }

    // Update special requests
    if (updates.specialRequests !== undefined) {
      await bookingService.updateBooking(id, { special_requests: updates.specialRequests });
    }

    const updatedBooking = await bookingService.getBookingById(id);

    if (!updatedBooking) {
      throw new Error('Failed to retrieve updated booking');
    }

    const updatedCheckIn = new Date(updatedBooking.check_in_date);
    const updatedCheckOut = new Date(updatedBooking.check_out_date);
    const nights = Math.round(
      (updatedCheckOut.getTime() - updatedCheckIn.getTime()) / (1000 * 60 * 60 * 24)
    );

    const oldTotal = Number(existingBooking.total_price);
    const priceDifference = datesChanged || roomsChanged ? newTotalPrice - oldTotal : 0;

    res.status(200).json(
      ApiResponse.success({
        booking: {
          id: updatedBooking.id,
          confirmationNumber: `LCH-${updatedBooking.id.substring(0, 8).toUpperCase()}`,
          status: updatedBooking.status,
          checkIn: updatedBooking.check_in_date,
          checkOut: updatedBooking.check_out_date,
          nights,
          guest: updatedBooking.guest,
          pricing: {
            total: Number(updatedBooking.total_price),
            deposit: Number(updatedBooking.deposit_amount ?? 0),
            remaining: Number(updatedBooking.remaining_amount ?? 0),
            currency: 'BRL'
          },
          specialRequests: updatedBooking.special_requests,
          updatedAt: updatedBooking.updated_at
        },
        changes: {
          datesChanged,
          roomsChanged,
          guestUpdated: !!updates.guest,
          priceDifference
        }
      }, 'Booking updated successfully')
    );
  } catch (error) {
    logger.error('Error updating booking', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    next(error);
  }
};
