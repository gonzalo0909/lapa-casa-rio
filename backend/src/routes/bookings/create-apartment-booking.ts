// backend/src/routes/bookings/create-apartment-booking.ts
//
// Handler exclusivo para reservas de apartamento.
// Incluye: regla 48h, programa de referidos, verificación directa por NOT EXISTS.
// Las reservas de hostel van a create-hostel-booking.ts.

import type { Request, Response, NextFunction } from 'express';
import { BookingService, InsufficientAvailabilityError } from '../../services/booking-service';
import { PricingService, MinNightsRequiredError } from '../../services/pricing-service';
import { notificationService } from '../../services/notification-service';
import { whatsappNotificationService } from '../../services/whatsapp-notification-service';
import type { BookingWithGuest } from '../../services/email-service';
import { query } from '../../config/database';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';
import { generateReferralCode } from '../../utils/encryption';
import { generateConfirmationToken } from '../../utils/confirmation-token';
import { GuestRepository } from '../../database/repositories/guest-repository';
import { uploadDocumentPhoto } from '../../lib/cloudinary/cloudinary-client';
import { decodeBase64Image } from '../../utils/decode-base64-image';
import {
  anyDocumentBlocked,
  insertBookingGuests,
  uploadAdditionalGuestPhotos,
  calcCheckInBounds,
  isBrazilHoliday,
} from './create-booking.shared';
import { type CreateApartmentBookingRequest } from '../../middleware/validation';

const guestRepo = new GuestRepository();
const bookingService = new BookingService();
const pricingService = new PricingService();

export const createApartmentBookingHandler = async (
  req: Request<{}, {}, CreateApartmentBookingRequest>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const bookingData = req.body;

    logger.info('Creating apartment booking', {
      checkIn: bookingData.checkIn,
      checkOut: bookingData.checkOut,
    });

    const checkIn = new Date(bookingData.checkIn);
    const checkOut = new Date(bookingData.checkOut);
    const now = new Date();

    // Validación de fecha mínima de check-in (corte 12h BRT)
    const { minCheckIn, todayInSaoPaulo } = calcCheckInBounds();
    if (bookingData.checkIn < minCheckIn) {
      res.status(400).json(ApiResponse.error(
        bookingData.checkIn === todayInSaoPaulo
          ? 'Las reservas para hoy solo se aceptan antes de las 12h'
          : 'La fecha de check-in no puede ser en el pasado',
      ));
      return;
    }

    if (checkOut <= checkIn) {
      res.status(400).json(ApiResponse.error('Check-out date must be after check-in date'));
      return;
    }

    const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    // Horas hasta el check-in — determina modo de pago (Cláusula 3.2/3.3 Termo de Adesão v2.1).
    // El check-in se toma a las 14:00 BRT (17:00 UTC) para no penalizar reservas mañaneras.
    const checkInAt14hBRT = new Date(bookingData.checkIn);
    checkInAt14hBRT.setUTCHours(17, 0, 0, 0);
    const hoursUntilCheckIn = (checkInAt14hBRT.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Verificación de lista negra
    const allDocuments = [
      bookingData.guest.document,
      ...(bookingData.additionalGuests ?? []).map((g) => g.document),
    ].filter(Boolean) as string[];
    const hasBlocked = await anyDocumentBlocked(allDocuments);
    if (hasBlocked) {
      logger.warn('Apartment booking blocked: CPF en lista negra', {
        reservationEmail: bookingData.guest.email,
      });
      res.status(409).json(ApiResponse.error('No hay disponibilidad para las fechas seleccionadas'));
      return;
    }

    // Verificación de disponibilidad por apartamento (NOT EXISTS directo)
    for (const room of bookingData.rooms) {
      const { rows: aptAvail } = await query<{ available: boolean }>(
        `SELECT (
           NOT EXISTS (
             SELECT 1
             FROM reservation_beds rb
             JOIN beds b ON b.id = rb.bed_id
             JOIN reservations res ON res.id = rb.reservation_id
             WHERE b.room_type_id = $1
               AND res.status != 'cancelled'
               AND daterange(rb.check_in, rb.check_out, '[)') && daterange($2::date, $3::date, '[)')
           )
           AND NOT EXISTS (
             SELECT 1
             FROM room_blocks rbl
             WHERE rbl.room_type_id = $1
               AND daterange(rbl.start_date, rbl.end_date, '[)') && daterange($2::date, $3::date, '[)')
           )
         ) AS available`,
        [room.roomId, bookingData.checkIn, bookingData.checkOut],
      );
      if (!aptAvail[0]?.available) {
        res.status(409).json(ApiResponse.error('El apartamento ya no está disponible para esas fechas', {
          roomId: room.roomId,
        }));
        return;
      }
    }

    const pricingDetails = await pricingService.calculateTotalPrice({
      checkInDate: bookingData.checkIn,
      checkOutDate: bookingData.checkOut,
      rooms: bookingData.rooms,
      totalBeds: bookingData.rooms.length,
    });

    // Cupón de descuento + programa de referidos (apartment_offers)
    let appliedOffer: {
      id: string;
      code: string;
      label: string;
      discount_percent: number;
      discount_amount: number | null;
      monthly_limit: number | null;
      referral_owner_guest_id: string | null;
    } | null = null;
    if (bookingData.offerCode) {
      const today = bookingData.checkIn;
      const { rows: offerRows } = await query(
        `SELECT id, code, label, discount_percent, discount_amount, monthly_limit,
                apartment_ids, referral_owner_guest_id
         FROM apartment_offers
         WHERE code = $1
           AND is_active = true
           AND (valid_from IS NULL OR valid_from <= $2::date)
           AND (valid_to   IS NULL OR valid_to   >= $2::date)
         LIMIT 1`,
        [bookingData.offerCode.trim().toUpperCase(), today],
      );
      if (offerRows.length > 0) {
        const offer = offerRows[0];
        const requestedAptIds = bookingData.rooms.map((r) => r.roomId).filter(Boolean);
        const aptOk =
          !offer.apartment_ids ||
          offer.apartment_ids.length === 0 ||
          requestedAptIds.every((id: string) => offer.apartment_ids.includes(id));

        let selfReferral = false;
        if (aptOk && offer.referral_owner_guest_id) {
          const { rows: ownerRows } = await query<{ email: string }>(
            `SELECT email FROM guests WHERE id = $1`,
            [offer.referral_owner_guest_id],
          );
          selfReferral =
            ownerRows[0]?.email?.toLowerCase() === bookingData.guest.email.trim().toLowerCase();
          if (selfReferral) {
            logger.warn('Código de referido rechazado -- autorreferido', { offerCode: offer.code });
          }
        }

        // Un mismo amigo no puede usar el beneficio de referido más de una vez
        let alreadyUsedReferral = false;
        if (aptOk && !selfReferral && offer.referral_owner_guest_id) {
          const docTrimmed = (bookingData.guest.document ?? '').trim();
          if (!docTrimmed) {
            // Fix #1: sin documento no se puede verificar la identidad del amigo
            alreadyUsedReferral = true;
            logger.warn('Código de referido rechazado -- huésped sin documento', { offerCode: offer.code });
          } else {
            // Fix #2: normaliza documento (quita guiones/espacios) para evitar bypass CPF vs pasaporte
            const { rows: usedRows } = await query<{ count: string }>(
              `SELECT COUNT(*) AS count FROM reservations r
               JOIN guests g ON r.guest_id = g.id
               WHERE r.applied_offer_code = $3
                 AND r.status != 'cancelled'
                 AND (
                   LOWER(g.email) = LOWER($1)
                   OR (g.document IS NOT NULL
                       AND REGEXP_REPLACE(g.document, '[^A-Za-z0-9]', '', 'g')
                           = REGEXP_REPLACE($2, '[^A-Za-z0-9]', '', 'g'))
                 )`,
              [bookingData.guest.email.trim(), docTrimmed, offer.code],
            );
            if (parseInt(usedRows[0]?.count ?? '0') > 0) {
              alreadyUsedReferral = true;
              logger.warn('Código de referido rechazado -- huésped ya usó un referido antes', {
                offerCode: offer.code,
                email: bookingData.guest.email,
              });
            }
          }
        }

        // Códigos de referido no aplican en fechas festivas
        let holidayConflict = false;
        if (aptOk && !selfReferral && !alreadyUsedReferral && offer.referral_owner_guest_id) {
          const ci = new Date(bookingData.checkIn);
          const co = new Date(bookingData.checkOut);
          const cursor = new Date(ci);
          while (cursor < co) {
            if (isBrazilHoliday(cursor)) {
              holidayConflict = true;
              break;
            }
            cursor.setDate(cursor.getDate() + 1);
          }
          if (holidayConflict) {
            logger.info('Código de referido rechazado -- fecha festiva', { offerCode: offer.code });
          }
        }

        if (aptOk && !selfReferral && !alreadyUsedReferral && !holidayConflict) {
          appliedOffer = offer;
          if (offer.discount_amount != null && offer.discount_amount > 0) {
            const discount = Math.min(offer.discount_amount, pricingDetails.totalPrice);
            pricingDetails.totalPrice = Math.round((pricingDetails.totalPrice - discount) * 100) / 100;
            const depositRatio = pricingDetails.depositAmount / (pricingDetails.depositAmount + pricingDetails.remainingAmount || 1);
            const depositDiscount = Math.round(discount * depositRatio * 100) / 100;
            const remainingDiscount = Math.round((discount - depositDiscount) * 100) / 100;
            pricingDetails.depositAmount = Math.max(0, Math.round((pricingDetails.depositAmount - depositDiscount) * 100) / 100);
            pricingDetails.remainingAmount = Math.max(0, Math.round((pricingDetails.remainingAmount - remainingDiscount) * 100) / 100);
          } else {
            const discountFactor = 1 - offer.discount_percent / 100;
            pricingDetails.totalPrice = Math.round(pricingDetails.totalPrice * discountFactor * 100) / 100;
            pricingDetails.depositAmount = Math.round(pricingDetails.depositAmount * discountFactor * 100) / 100;
            pricingDetails.remainingAmount = Math.round(pricingDetails.remainingAmount * discountFactor * 100) / 100;
          }
          logger.info('Oferta aplicada a reserva de apartamento', { offerCode: offer.code, discount_percent: offer.discount_percent, discount_amount: offer.discount_amount });
        }
      }
    }

    // Regla de pago completo <48h (Cláusula 3 Termo de Adesão v2.1)
    if (hoursUntilCheckIn < 48) {
      pricingDetails.depositAmount = pricingDetails.totalPrice;
      pricingDetails.depositPercent = 100;
      pricingDetails.remainingAmount = 0;
      logger.info('Apartamento: pago 100% al reservar (antecedencia < 48h)', {
        hoursUntilCheckIn: Math.round(hoursUntilCheckIn),
        totalPrice: pricingDetails.totalPrice,
      });
    }

    const fullName = `${bookingData.guest.firstName} ${bookingData.guest.lastName}`.trim();

    const booking = await bookingService.createBooking({
      checkIn: bookingData.checkIn,
      checkOut: bookingData.checkOut,
      rooms: bookingData.rooms,
      guest: {
        full_name: fullName,
        email: bookingData.guest.email,
        phone: bookingData.guest.phone,
        country: bookingData.guest.country,
        document: bookingData.guest.document,
        language: bookingData.language || 'pt',
      },
      nights,
      totalBeds: bookingData.rooms.length,
      pricing: pricingDetails,
      specialRequests: [
        bookingData.arrivalTime
          ? `Horario de llegada: ${bookingData.arrivalTime.includes('-') ? bookingData.arrivalTime.replace('-', ':00 – ') + ':00' : bookingData.arrivalTime}`
          : null,
        bookingData.specialRequests || null,
      ].filter(Boolean).join('\n') || undefined,
      source: bookingData.source || 'website',
      language: bookingData.language || 'pt',
      status: 'pending_payment',
      appliedOfferCode: appliedOffer?.code,
      offerMonthlyLimit: appliedOffer?.monthly_limit,
    });

    logger.info('Apartment booking created', { bookingId: booking.id, totalPrice: pricingDetails.totalPrice });

    // Programa de referidos (idea #49, roadmap.html)
    let ownReferralCode: string | null = null;
    try {
      const { rows: existing } = await query<{ code: string }>(
        `SELECT code FROM apartment_offers
         WHERE referral_owner_guest_id = $1
           AND label = 'Código de referido'
           AND is_active = true
         ORDER BY created_at ASC
         LIMIT 1`,
        [booking.guest_id],
      );
      if (existing.length > 0) {
        ownReferralCode = existing[0]!.code;
      } else {
        ownReferralCode = generateReferralCode();
        await query(
          `INSERT INTO apartment_offers
             (code, label, discount_percent, apartment_ids, valid_from, valid_to, is_active, referral_owner_guest_id)
           VALUES ($1, 'Código de referido', 10, NULL, now()::date, $3, true, $2)`,
          [ownReferralCode, booking.guest_id, process.env.REFERRAL_CODE_VALID_UNTIL ?? '2099-12-31'],
        );
      }
    } catch (error) {
      logger.error('No se pudo obtener/generar el código de referido', { bookingId: booking.id, error: String(error) });
      ownReferralCode = null;
    }

    // Foto del documento del titular
    if (bookingData.guest.documentPhotoBase64) {
      try {
        const photoBuffer = decodeBase64Image(bookingData.guest.documentPhotoBase64);
        const photo = await uploadDocumentPhoto(photoBuffer);
        await guestRepo.setDocumentPhoto(booking.guest_id, photo);
      } catch (err) {
        logger.error('No se pudo guardar la foto del documento', { bookingId: booking.id, error: String(err) });
      }
    }

    // Acompañantes
    try {
      const additionalWithPhotos = await uploadAdditionalGuestPhotos(booking.id, bookingData.additionalGuests ?? []);
      await insertBookingGuests(
        booking.id,
        { fullName, document: bookingData.guest.document ?? '', documentType: /[a-zA-Z]/.test(bookingData.guest.document ?? '') ? 'passaporte' : 'CPF' },
        additionalWithPhotos,
      );
    } catch (err) {
      logger.error('No se pudo insertar booking_guests', { bookingId: booking.id, error: String(err) });
    }

    // Notificaciones (no bloqueante)
    bookingService.getBooking(booking.id).then((bookingWithGuest) => {
      if (!bookingWithGuest?.guest) {return;}
      const guest = bookingWithGuest as BookingWithGuest;
      if (guest.guest.phone) {
        whatsappNotificationService.sendBookingNotification({
          phone: guest.guest.phone,
          bookingId: guest.reservation_number,
          checkIn: String(guest.check_in_date),
          language: (['pt', 'en', 'es'] as string[]).includes(guest.guest.language ?? '') ? (guest.guest.language as 'pt' | 'en' | 'es') : 'en',
        }).catch((err) => logger.error('Failed to send WhatsApp notification', { bookingId: booking.id, error: err.message }));
      }
      return notificationService.notify('booking_confirmation', guest, { referralCode: ownReferralCode });
    }).catch((err) => logger.error('Failed to send confirmation email', { bookingId: booking.id, error: err.message }));

    res.status(201).json(ApiResponse.success({
      booking: {
        id: booking.id,
        confirmationNumber: booking.reservation_number,
        status: booking.status,
        checkIn: bookingData.checkIn,
        checkOut: bookingData.checkOut,
        nights,
        rooms: bookingData.rooms,
        guest: { name: fullName, email: bookingData.guest.email },
        referralCode: ownReferralCode,
        pricing: {
          subtotal: pricingDetails.basePrice,
          total: pricingDetails.totalPrice,
          deposit: pricingDetails.depositAmount,
          remaining: pricingDetails.remainingAmount,
          currency: 'BRL',
          ...(appliedOffer ? { appliedOffer: { code: appliedOffer.code, label: appliedOffer.label, discount_percent: appliedOffer.discount_percent, discount_amount: appliedOffer.discount_amount } } : {}),
        },
        payment: {
          depositRequired: true,
          depositAmount: pricingDetails.depositAmount,
          depositDueDate: booking.pending_expires_at,
          remainingAmount: pricingDetails.remainingAmount,
          remainingDueDate: pricingDetails.remainingAmount === 0
            ? null
            : (() => {
                const morning = new Date(checkIn);
                morning.setUTCHours(11, 0, 0, 0); // 8:00 AM São Paulo = 11:00 UTC
                return morning.toISOString();
              })(),
        },
        pendingExpiresAt: booking.pending_expires_at,
        confirmationToken: generateConfirmationToken(booking.id),
      },
    }, 'Apartment booking created successfully'));
  } catch (error) {
    if (error instanceof MinNightsRequiredError) {
      res.status(422).json(ApiResponse.error(error.message, { minNights: error.minNights, label: error.label, roomId: error.roomId, pricePerNight: error.pricePerNight }));
      return;
    }
    if (error instanceof InsufficientAvailabilityError) {
      logger.warn('Insufficient availability during createApartmentBooking', { details: error.details });
      res.status(409).json(ApiResponse.error('El apartamento ya no está disponible para esas fechas', error.details));
      return;
    }
    if (error instanceof Error && error.message === 'OFFER_MONTHLY_LIMIT_EXCEEDED') {
      res.status(409).json(ApiResponse.error('El código de oferta ya alcanzó su límite de uso este mes'));
      return;
    }
    logger.error('Error creating apartment booking', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    next(error);
  }
};
