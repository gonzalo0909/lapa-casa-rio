/**
 * File: lapa-casa-hostel/backend/src/routes/bookings/update-booking.ts
 * Update Booking Handler
 * Lapa Casa Hostel Channel Manager
 * 
 * Handles booking modifications with availability revalidation
 * Supports date changes, room changes, and guest information updates
 * 
 * @module routes/bookings/update
 * @requires express
 */

import { Request, Response, NextFunction } from 'express';
import { BookingService } from '../../services/booking-service';
import { AvailabilityService } from '../../services/availability-service';
import { PricingService } from '../../services/pricing-service';
import { EmailService } from '../../services/email-service';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

const bookingService = new BookingService();
const availabilityService = new AvailabilityService();
const pricingService = new PricingService();
const emailService = new EmailService();

/**
 * Update Booking Request Interface
 */
interface UpdateBookingRequest {
  checkIn?: string;
  checkOut?: string;
  rooms?: Array<{
    roomId: string;
    bedsCount: number;
  }>;
  guest?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    country?: string;
    document?: string;
  };
  specialRequests?: string;
}

/**
 * Update Booking Handler
 * 
 * Update flow:
 * 1. Validate booking exists and is modifiable
 * 2. Check if dates/rooms changed (requires availability check)
 * 3. Recalculate pricing if applicable
 * 4. Update booking record
 * 5. Send modification email
 * 6. Return updated booking
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const updateBookingHandler = async (
  req: Request<{ id: string }, {}, UpdateBookingRequest>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    logger.info('Updating booking', { bookingId: id, updates });

    // Step 1: Fetch existing booking
    const existingBooking = await bookingService.getBookingById(id);

    if (!existingBooking) {
      res.status(404).json(
        ApiResponse.error('Booking not found', { bookingId: id })
      );
      return;
    }

    // Step 2: Validate booking is modifiable
    if (existingBooking.status === 'CANCELLED') {
      res.status(400).json(
        ApiResponse.error('Cannot modify cancelled booking')
      );
      return;
    }

    if (existingBooking.status === 'COMPLETED') {
      res.status(400).json(
        ApiResponse.error('Cannot modify completed booking')
      );
      return;
    }

    const checkInDate = new Date(existingBooking.checkIn);
    const now = new Date();
    const daysUntilCheckIn = Math.ceil(
      (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Cannot modify within 48 hours of check-in
    if (daysUntilCheckIn < 2 && (updates.checkIn || updates.checkOut || updates.rooms)) {
      res.status(400).json(
        ApiResponse.error(
          'Cannot modify dates or rooms within 48 hours of check-in'
        )
      );
      return;
    }

    // Step 3: Check if dates changed
    const datesChanged = updates.checkIn || updates.checkOut;
    const roomsChanged = updates.rooms;

    let newPricing = existingBooking.pricing;

    if (datesChanged || roomsChanged) {
      const newCheckIn = updates.checkIn || existingBooking.checkIn;
      const newCheckOut = updates.checkOut || existingBooking.checkOut;
      const newRooms = updates.rooms || existingBooking.rooms;

      // Validate new dates
      const checkIn = new Date(newCheckIn);
      const checkOut = new Date(newCheckOut);

      if (checkIn < now) {
        res.status(400).json(
          ApiResponse.error('Check-in date cannot be in the past')
        );
        return;
      }

      if (checkOut <= checkIn) {
        res.status(400).json(
          ApiResponse.error('Check-out date must be after check-in date')
        );
        return;
      }

      // Calculate new nights
      const newNights = Math.ceil(
        (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Check availability for new dates/rooms
      const totalBedsRequested = newRooms.reduce(
        (sum, room) => sum + room.bedsCount,
        0
      );

      const availability = await availabilityService.checkAvailability({
        checkIn: newCheckIn,
        checkOut: newCheckOut,
        bedsNeeded: totalBedsRequested,
        excludeBookingId: id // Exclude current booking from availability check
      });

      if (!availability.available) {
        logger.warn('Insufficient availability for update', {
          bookingId: id,
          requested: totalBedsRequested,
          available: availability.availableBeds
        });

        res.status(409).json(
          ApiResponse.error('Insufficient availability for requested changes', {
            availableBeds: availability.availableBeds,
            requestedBeds: totalBedsRequested
          })
        );
        return;
      }

      // Recalculate pricing
      newPricing = await pricingService.calculateBookingPrice({
        checkIn: newCheckIn,
        checkOut: newCheckOut,
        rooms: newRooms,
        totalBeds: totalBedsRequested
      });

      // Update booking with new dates/rooms/pricing
      await bookingService.updateBooking(id, {
        checkIn: newCheckIn,
        checkOut: newCheckOut,
        nights: newNights,
        rooms: newRooms,
        pricing: newPricing
      });

      logger.info('Booking dates/rooms updated', {
        bookingId: id,
        oldCheckIn: existingBooking.checkIn,
        newCheckIn,
        oldTotal: existingBooking.pricing.total,
        newTotal: newPricing.total
      });
    }

    // Step 4: Update guest information
    if (updates.guest) {
      await bookingService.updateBooking(id, {
        guest: {
          ...existingBooking.guest,
          ...updates.guest
        }
      });

      logger.info('Guest information updated', { bookingId: id });
    }

    // Step 5: Update special requests
    if (updates.specialRequests !== undefined) {
      await bookingService.updateBooking(id, {
        specialRequests: updates.specialRequests
      });
    }

    // Step 6: Fetch updated booking
    const updatedBooking = await bookingService.getBookingById(id);

    if (!updatedBooking) {
      throw new Error('Failed to retrieve updated booking');
    }

    // Step 7: Send modification email
    if (datesChanged || roomsChanged) {
      emailService.sendBookingModification(updatedBooking, {
        oldCheckIn: existingBooking.checkIn,
        oldCheckOut: existingBooking.checkOut,
        oldTotal: existingBooking.pricing.total,
        priceDifference: newPricing.total - existingBooking.pricing.total
      }).catch(error => {
        logger.error('Failed to send modification email', {
          bookingId: id,
          error: error.message
        });
      });
    }

    // Step 8: Return updated booking
    res.status(200).json(
      ApiResponse.success({
        booking: {
          id: updatedBooking.id,
          confirmationNumber: `LCH-${updatedBooking.id.substring(0, 8).toUpperCase()}`,
          status: updatedBooking.status,
          checkIn: updatedBooking.checkIn,
          checkOut: updatedBooking.checkOut,
          nights: updatedBooking.nights,
          rooms: updatedBooking.rooms,
          guest: updatedBooking.guest,
          pricing: {
            subtotal: updatedBooking.pricing.subtotal,
            groupDiscount: updatedBooking.pricing.groupDiscount,
            seasonalAdjustment: updatedBooking.pricing.seasonalAdjustment,
            total: updatedBooking.pricing.total,
            deposit: updatedBooking.pricing.deposit,
            remaining: updatedBooking.pricing.remaining,
            currency: 'BRL'
          },
          specialRequests: updatedBooking.specialRequests,
          updatedAt: updatedBooking.updatedAt
        },
        changes: {
          datesChanged,
          roomsChanged,
          guestUpdated: !!updates.guest,
          priceDifference: datesChanged || roomsChanged
            ? newPricing.total - existingBooking.pricing.total
            : 0
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
