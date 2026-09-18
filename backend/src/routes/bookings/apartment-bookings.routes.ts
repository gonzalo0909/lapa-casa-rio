// backend/src/routes/bookings/apartment-bookings.routes.ts
// Router exclusivo para reservas de apartamento — montado en /apartment-bookings.

import { Router } from 'express';
import { createApartmentBookingHandler } from './create-apartment-booking';
import { validate, apartmentBookingSchema } from '../../middleware/validation';

const router = Router();

/**
 * Create Apartment Booking
 * @route POST /apartment-bookings
 */
router.post('/', validate(apartmentBookingSchema), createApartmentBookingHandler);

export const apartmentBookingsRouter = router;
