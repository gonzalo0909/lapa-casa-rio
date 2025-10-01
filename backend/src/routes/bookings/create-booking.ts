/**
 * File: lapa-casa-hostel/backend/src/routes/bookings/create-booking.ts
 * Create Booking Handler
 * Lapa Casa Hostel Channel Manager
 * 
 * Handles booking creation with full validation and anti-overbooking logic
 * Implements group discounts, seasonal pricing, and deposit calculation
 * 
 * @module routes/bookings/create
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
 * Booking Creation Request Interface
 */
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

/**
 * Create Booking Handler
 * 
 * Process flow:
 * 1. Validate dates and availability
 * 2. Calculate pricing with discounts
 * 3. Check for overbooking conflicts
 * 4. Create booking record
 * 5. Send confirmation email
 * 6. Return booking details with payment info
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
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

    // Step 1: Validate dates
    const checkIn = new Date(bookingData.checkIn);
    const checkOut = new Date(bookingData.checkOut);
    const now = new Date();

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

    const nights = Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Step 2: Check availability for all requested rooms
    const totalBedsRequested = bookingData.rooms.reduce(
      (sum, room) => sum + room.bedsCount,
      0
    );

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

    // Step 3: Calculate pricing
    const pricingDetails = await pricingService.calculateBookingPrice({
      checkIn: bookingData.checkIn,
      checkOut: bookingData.checkOut,
      rooms: bookingData.rooms,
      totalBeds: totalBedsRequested
    });

    // Step 4: Validate room allocations
    for (const room of bookingData.rooms) {
      const roomAvailability = await availabilityService.checkRoomAvailability(
        room.roomId,
        bookingData.checkIn,
        bookingData.checkOut
      );

      if (roomAvailability.available < room.bedsCount) {
        res.status(409).json(
          ApiResponse.error(`Insufficient beds in room ${room.roomId}`, {
            roomId: room.roomId,
            requested: room.bedsCount,
            available: roomAvailability.available
          })
        );
        return;
      }
    }

    // Step 5: Create booking
    const booking = await bookingService.createBooking({
      checkIn: bookingData.checkIn,
      checkOut: bookingData.checkOut,
      rooms: bookingData.rooms,
      guest: bookingData.guest,
      nights,
      totalBeds: totalBedsRequested,
      pricing: pricingDetails,
      specialRequests: bookingData.specialRequests,
      source: bookingData.source || 'website',
      language: bookingData.language || 'pt',
      status: 'PENDING'
    });

    logger.info('Booking created successfully', {
      bookingId: booking.id,
      totalPrice: pricingDetails.total
    });

    // Step 6: Send confirmation email (async, non-blocking)
    emailService.sendBookingConfirmation(booking).catch(error => {
      logger.error('Failed to send booking confirmation email', {
        bookingId: booking.id,
        error: error.message
      });
    });

    // Step 7: Return booking details
    res.status(201).json(
      ApiResponse.success({
        booking: {
          id: booking.id,
          confirmationNumber: `LCH-${booking.id.substring(0, 8).toUpperCase()}`,
          status: booking.status,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          nights: booking.nights,
          rooms: booking.rooms,
          guest: {
            name: `${booking.guest.firstName} ${booking.guest.lastName}`,
            email: booking.guest.email
          },
          pricing: {
            subtotal: pricingDetails.subtotal,
            groupDiscount: pricingDetails.groupDiscount,
            seasonalAdjustment: pricingDetails.seasonalAdjustment,
            total: pricingDetails.total,
            deposit: pricingDetails.deposit,
            remaining: pricingDetails.remaining,
            currency: 'BRL'
          },
          payment: {
            depositRequired: true,
            depositAmount: pricingDetails.deposit,
            depositDueDate: new Date(
              Date.now() + 24 * 60 * 60 * 1000
            ).toISOString(),
            remainingAmount: pricingDetails.remaining,
            remainingDueDate: new Date(
              checkIn.getTime() - 7 * 24 * 60 * 60 * 1000
            ).toISOString()
          }
        }
      }, 'Booking created successfully')
    );

  } catch (error) {
    logger.error('Error creating booking', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    next(error);
  }
};

/**
 * Validation Helper: Check minimum stay requirements
 */
function validateMinimumStay(
  checkIn: Date,
  nights: number
): { valid: boolean; message?: string } {
  const month = checkIn.getMonth();
  
  // Carnival period (February) requires minimum 5 nights
  if (month === 1 && nights < 5) {
    return {
      valid: false,
      message: 'Carnival period requires minimum 5 nights stay'
    };
  }

  return { valid: true };
}
