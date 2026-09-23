// backend/src/routes/bookings/create-hostel-booking.ts
//
// Handler exclusivo para reservas del hostel (camas compartidas).
// No detecta apartamentos ni aplica reglas de pago completo <48h.
// Las reservas de apartamento van a create-apartment-booking.ts.

import type { Request, Response, NextFunction } from 'express';
import { BookingService, InsufficientAvailabilityError } from '../../services/booking-service';
import { PricingService, MinNightsRequiredError } from '../../services/pricing-service';
import { notificationService } from '../../services/notification-service';
import { whatsappNotificationService } from '../../services/whatsapp-notification-service';
import type { BookingWithGuest } from '../../services/email-service';
import { query } from '../../config/database';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';
import { generateConfirmationToken } from '../../utils/confirmation-token';
import { GuestRepository } from '../../database/repositories/guest-repository';
import { uploadDocumentPhoto } from '../../lib/cloudinary/cloudinary-client';
import { decodeBase64Image } from '../../utils/decode-base64-image';
import { generateReferralCode } from '../../utils/encryption';
import {
  type CreateBookingRequest,
  anyDocumentBlocked,
  insertBookingGuests,
  uploadAdditionalGuestPhotos,
  calcCheckInBounds,
  isBrazilHoliday,
} from './create-booking.shared';

const guestRepo = new GuestRepository();
const bookingService = new BookingService();
const pricingService = new PricingService();

export const createHostelBookingHandler = async (
  req: Request<{}, {}, CreateBookingRequest>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const bookingData = req.body;

    logger.info('Creating hostel booking', {
      checkIn: bookingData.checkIn,
      checkOut: bookingData.checkOut,
      totalBeds: bookingData.rooms.reduce((sum, r) => sum + r.bedsCount, 0),
    });

    const checkIn = new Date(bookingData.checkIn);
    const checkOut = new Date(bookingData.checkOut);

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

    // Bloqueo total de feriados nacionais do Brasil
    const cursor = new Date(checkIn);
    while (cursor < checkOut) {
      if (isBrazilHoliday(cursor)) {
        res.status(422).json(ApiResponse.error(
          'Las fechas seleccionadas incluyen un feriado nacional de Brasil y no están disponibles para reserva.',
        ));
        return;
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    const totalBedsRequested = bookingData.rooms.reduce((sum, r) => sum + r.bedsCount, 0);

    // Verificación de lista negra
    const allDocuments = [
      bookingData.guest.document,
      ...(bookingData.additionalGuests ?? []).map((g) => g.document),
    ].filter(Boolean) as string[];
    const hasBlocked = await anyDocumentBlocked(allDocuments);
    if (hasBlocked) {
      logger.warn('Hostel booking blocked: CPF en lista negra', {
        reservationEmail: bookingData.guest.email,
      });
      res.status(409).json(ApiResponse.error('No hay disponibilidad para las fechas seleccionadas'));
      return;
    }

    // Pricing
    const pricingDetails = await pricingService.calculateTotalPrice({
      checkInDate: bookingData.checkIn,
      checkOutDate: bookingData.checkOut,
      rooms: bookingData.rooms.map((r) => ({ roomId: r.roomId, hostelBeds: r.bedsCount })),
      totalBeds: totalBedsRequested,
    });

    // Cupón de descuento (hostel puede usar cupones generales, no códigos de referido)
    let appliedOffer: {
      id: string; code: string; label: string; discount_percent: number;
      discount_amount: number | null; monthly_limit: number | null;
    } | null = null;
    if (bookingData.offerCode) {
      const today = bookingData.checkIn;
      const { rows: offerRows } = await query(
        `SELECT id, code, label, discount_percent, discount_amount, monthly_limit,
                referral_owner_guest_id
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
        // Códigos de referido no aplican al hostel
        if (offer.referral_owner_guest_id) {
          logger.info('Código de referido rechazado para hostel', { offerCode: offer.code });
        } else {
          appliedOffer = offer;
          if (offer.discount_amount != null && offer.discount_amount > 0) {
            const discount = Math.min(offer.discount_amount, pricingDetails.totalPrice);
            pricingDetails.totalPrice = Math.round((pricingDetails.totalPrice - discount) * 100) / 100;
            const depositRatio = pricingDetails.depositAmount / ((pricingDetails.depositAmount + pricingDetails.remainingAmount) || 1);
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
          logger.info('Oferta aplicada a reserva de hostel', { offerCode: offer.code });
        }
      }
    }

    const fullName = `${bookingData.guest.firstName} ${bookingData.guest.lastName}`.trim();

    const booking = await bookingService.createBooking({
      checkIn: bookingData.checkIn,
      checkOut: bookingData.checkOut,
      rooms: bookingData.rooms.map((r) => ({ roomId: r.roomId, hostelBeds: r.bedsCount, preferredBedIds: r.preferredBedIds })),
      guest: {
        full_name: fullName,
        email: bookingData.guest.email,
        phone: bookingData.guest.phone,
        country: bookingData.guest.country,
        document: bookingData.guest.document,
        language: bookingData.language || 'pt',
      },
      nights,
      totalBeds: totalBedsRequested,
      pricing: pricingDetails,
      appliedOfferCode: appliedOffer?.code,
      offerMonthlyLimit: appliedOffer?.monthly_limit ?? null,
      specialRequests: [
        bookingData.arrivalTime
          ? `Horario de llegada: ${bookingData.arrivalTime.includes('-') ? bookingData.arrivalTime.replace('-', ':00 – ') + ':00' : bookingData.arrivalTime}`
          : null,
        bookingData.specialRequests || null,
      ].filter(Boolean).join('\n') || undefined,
      source: bookingData.source || 'website',
      language: bookingData.language || 'pt',
      status: 'pending_payment',
      guestGender: bookingData.guestGender || 'mixed',
      bookingPrefix: 'LCH',
    });

    logger.info('Hostel booking created', { bookingId: booking.id, totalPrice: pricingDetails.totalPrice });

    // Programa de referidos: generar o recuperar código propio del huésped
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
        // nota: envío directo porque notification-service no cubre canal WhatsApp (solo email)
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
          groupDiscount: pricingDetails.discountAmount,
          seasonalAdjustment: pricingDetails.priceAfterSeason - pricingDetails.basePrice,
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
            : new Date(checkIn.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        pendingExpiresAt: booking.pending_expires_at,
        confirmationToken: generateConfirmationToken(booking.id),
      },
    }, 'Booking created successfully'));
  } catch (error) {
    if (error instanceof MinNightsRequiredError) {
      res.status(422).json(ApiResponse.error(error.message, { minNights: error.minNights, label: error.label, roomId: error.roomId, pricePerNight: error.pricePerNight }));
      return;
    }
    if (error instanceof InsufficientAvailabilityError) {
      logger.warn('Insufficient availability during createHostelBooking', { details: error.details });
      res.status(409).json(ApiResponse.error(error.message, error.details));
      return;
    }
    if (error instanceof Error && error.message === 'OFFER_MONTHLY_LIMIT_EXCEEDED') {
      res.status(409).json(ApiResponse.error('El código de oferta ya alcanzó su límite mensual'));
      return;
    }
    logger.error('Error creating hostel booking', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    next(error);
  }
};
