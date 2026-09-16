// lapa-casa-hostel/backend/src/routes/bookings/create-booking.ts
// envío de email de confirmación reenganchado a notificationService (ver notify('booking_confirmation', ...) más abajo)

import type { Request, Response, NextFunction } from 'express';
import { BookingService, InsufficientAvailabilityError } from '../../services/booking-service';
import { AvailabilityService } from '../../services/availability-service';
import { PricingService } from '../../services/pricing-service';
import { notificationService } from '../../services/notification-service';
import { whatsappNotificationService } from '../../services/whatsapp-notification-service';
import { emailService, type BookingWithGuest } from '../../services/email-service';
import { query } from '../../config/database';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';
import { generateReferralCode } from '../../utils/encryption';
import { GuestRepository } from '../../database/repositories/guest-repository';
import { uploadDocumentPhoto } from '../../lib/cloudinary/cloudinary-client';
import { decodeBase64Image } from '../../utils/decode-base64-image';

const guestRepo = new GuestRepository();

const bookingService = new BookingService();
const availabilityService = new AvailabilityService();
const pricingService = new PricingService();

interface CreateBookingRequest {
  checkIn: string;
  checkOut: string;
  rooms: Array<{
    roomId: string;
    bedsCount: number;
    /** Camas puntuales elegidas a mano en el selector -- opcional, ver bookingService.createBooking(). */
    preferredBedIds?: string[];
  }>;
  guest: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    country: string;
    document?: string;
    /** Foto del DNI/pasaporte (data URL base64) -- obligatoria en el motor del hostel. */
    documentPhotoBase64?: string;
  };
  /**
   * Acompañantes declarados por el titular en el checkout (tabla booking_guests).
   * Cada CPF es verificado contra guests.blocked antes de crear la reserva.
   * El huésped bloqueado recibe un error genérico sin revelar el motivo.
   */
  additionalGuests?: Array<{
    fullName: string;
    document: string;
    documentType?: string; // 'CPF' | 'RG' | 'passaporte' — default 'CPF'
    /** Foto del DNI/pasaporte del acompañante (data URL base64) — opcional. */
    documentPhotoBase64?: string;
  }>;
  specialRequests?: string;
  arrivalTime?: string;
  language?: 'pt' | 'en' | 'es';
  source?: string;
  guestGender?: 'mixed' | 'female' | 'male';
  /** Código de oferta/cupón de descuento para apartamentos (opcional). */
  offerCode?: string;
}

// ── Helpers de blocklist ──────────────────────────────────────────────────────

/** Normaliza un CPF quitando puntos y guión → '00000000000' */
function normalizeCPF(doc: string): string {
  return doc.replace(/\D/g, '');
}

/** Verifica si alguno de los documentos está en la lista negra (guests.blocked = true).
 *  Solo verifica CPFs de 11 dígitos — pasaportes y documentos con letras se saltan.
 *  Devuelve true si alguno está bloqueado (no revela cuál para no ayudar a la evasión). */
async function anyDocumentBlocked(documents: string[]): Promise<boolean> {
  const cpfs = documents.map(normalizeCPF).filter((d) => /^\d{11}$/.test(d)); // solo CPFs puros, no pasaportes
  if (cpfs.length === 0) {
    return false;
  }
  // Un solo query paramétrico para todos los CPFs
  const placeholders = cpfs.map((_, i) => `$${i + 1}`).join(', ');
  const result = await query<{ id: string }>(
    `SELECT g.id FROM guests g
     WHERE g.blocked = true
       AND g.document_number = ANY(ARRAY[${placeholders}])
     LIMIT 1`,
    cpfs,
  );
  return (result.rowCount ?? 0) > 0;
}

/** Inserta todos los hóspedes declarados en booking_guests.
 *  El titular va con is_titular = true; los acompañantes con false.
 *  Fire-and-forget seguro: si falla, la reserva ya quedó guardada. */
async function insertBookingGuests(
  reservationId: string,
  titular: { fullName: string; document: string; documentType: string },
  additional: Array<{ fullName: string; document: string; documentType?: string; photoUrl?: string; photoPublicId?: string }>,
): Promise<void> {
  const guests = [
    { ...titular, isTitular: true, photoUrl: null as string | null, photoPublicId: null as string | null },
    ...additional.map((g) => ({
      ...g,
      documentType: g.documentType ?? 'CPF',
      isTitular: false,
      photoUrl: g.photoUrl ?? null,
      photoPublicId: g.photoPublicId ?? null,
    })),
  ];
  // INSERT en batch usando unnest para evitar N queries individuales
  const names = guests.map((g) => g.fullName);
  const docs = guests.map((g) => g.document.replace(/\D/g, '') || g.document); // normaliza CPF
  const types = guests.map((g) => g.documentType);
  const titular_flags = guests.map((g) => g.isTitular);
  const photo_urls = guests.map((g) => g.photoUrl);
  const photo_pids = guests.map((g) => g.photoPublicId);
  const now = new Date().toISOString();
  const uploaded_ats = guests.map((g) => (g.photoUrl ? now : null));
  await query(
    `INSERT INTO booking_guests
       (reservation_id, full_name, document_number, document_type, is_titular,
        document_photo_url, document_photo_public_id, document_photo_uploaded_at)
     SELECT $1, name, doc, dtype, is_tit, photo_url, photo_pid,
            CASE WHEN photo_url IS NOT NULL THEN $8::timestamptz ELSE NULL END
     FROM unnest($2::text[], $3::text[], $4::text[], $5::bool[],
                 $6::text[], $7::text[])
            AS t(name, doc, dtype, is_tit, photo_url, photo_pid)`,
    [reservationId, names, docs, types, titular_flags, photo_urls, photo_pids, now],
  );
}

export const createBookingHandler = async (
  req: Request<{}, {}, CreateBookingRequest>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const bookingData = req.body;

    logger.info('Creating booking', {
      checkIn: bookingData.checkIn,
      checkOut: bookingData.checkOut,
      totalBeds: bookingData.rooms.reduce((sum, r) => sum + r.bedsCount, 0),
    });

    const checkIn = new Date(bookingData.checkIn);
    const checkOut = new Date(bookingData.checkOut);
    const now = new Date();

    // Validación de fecha mínima de check-in en hora de Sao Paulo.
    // Reservas para hoy se aceptan solo antes de las 12:00 BRT;
    // a partir de las 12h el mínimo pasa a ser mañana.
    const todayInSaoPaulo = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
    }).format(now);
    const hourParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      hour: 'numeric',
      hour12: false,
    }).formatToParts(now);
    const hourBrt = parseInt(hourParts.find((p) => p.type === 'hour')!.value, 10);

    // minCheckIn: hoy si son antes de las 12h, mañana si ya pasó el mediodía.
    let minCheckIn = todayInSaoPaulo;
    if (hourBrt >= 12) {
      const [y, m, d] = todayInSaoPaulo.split('-').map(Number);
      const tomorrow = new Date(y, m - 1, d + 1);
      minCheckIn = tomorrow.getFullYear() +
        '-' + String(tomorrow.getMonth() + 1).padStart(2, '0') +
        '-' + String(tomorrow.getDate()).padStart(2, '0');
    }

    if (bookingData.checkIn < minCheckIn) {
      res
        .status(400)
        .json(
          ApiResponse.error(
            bookingData.checkIn === todayInSaoPaulo
              ? 'Las reservas para hoy solo se aceptan antes de las 12h'
              : 'La fecha de check-in no puede ser en el pasado',
          ),
        );
      return;
    }

    // Horas hasta el check-in -- usado más abajo para determinar el modo de
    // pago en reservas de apartamento (Cláusula 3.2 / 3.3 Termo de Adesão v2.1).
    //
    // new Date('2026-09-16') parsea como medianoche UTC, pero el huésped
    // llega a las 14:00 BRT = 17:00 UTC. Sin ajuste, una reserva hecha hoy
    // para pasado mañana mide ~38-46h en vez de ~55h y activa el cobro del
    // 100% cuando debería cobrar solo el 30% de depósito.
    const checkInAt14hBRT = new Date(bookingData.checkIn);
    checkInAt14hBRT.setUTCHours(17, 0, 0, 0); // 14:00 BRT = 17:00 UTC
    const hoursUntilCheckIn = (checkInAt14hBRT.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (checkOut <= checkIn) {
      res.status(400).json(ApiResponse.error('Check-out date must be after check-in date'));
      return;
    }

    const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    const totalBedsRequested = bookingData.rooms.reduce((sum, r) => sum + r.bedsCount, 0);

    // ── Verificación de lista negra (blocklist) ───────────────────────────────
    // Se chequean todos los CPFs: el titular + los acompañantes declarados.
    // Si cualquiera está bloqueado → 409 genérico (sin revelar el motivo ni
    // quién está bloqueado, para evitar que el huésped evada con otro email).
    const allDocuments = [
      bookingData.guest.document,
      ...(bookingData.additionalGuests ?? []).map((g) => g.document),
    ].filter(Boolean) as string[];

    const hasBlocked = await anyDocumentBlocked(allDocuments);
    if (hasBlocked) {
      logger.warn('Booking blocked: CPF en lista negra', {
        // No logueamos qué CPF para respetar la privacidad en los logs públicos
        reservationEmail: bookingData.guest.email,
      });
      res
        .status(409)
        .json(ApiResponse.error('No hay disponibilidad para las fechas seleccionadas'));
      return;
    }

    // Detectar apartamentos antes del OVERALL check para poder saltarlo si
    // aplica. check_availability() es hostel-centric: usa is_gender_eligible,
    // que devuelve false para apartamentos con default_gender != 'mixed', lo
    // que produce falsos 409 cuando el hostel está lleno y el apartamento libre.
    // Declarado acá para reutilizarlo también en el modo de pago más abajo.
    const allRoomIds = bookingData.rooms.map((r) => r.roomId);
    const { rows: aptTypeRows } = await query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM room_types WHERE id = ANY($1::uuid[]) AND property_type = 'apartment'`,
      [allRoomIds],
    );
    const isApartmentBooking = parseInt(aptTypeRows[0]?.count ?? '0') > 0;

    // Check overall availability — solo para reservas del hostel.
    // Para apartamentos se omite: el per-room check con NOT EXISTS que sigue
    // es la autoridad real y no sufre el sesgo de is_gender_eligible.
    if (!isApartmentBooking) {
      const availability = await availabilityService.checkAvailability({
        checkIn: bookingData.checkIn,
        checkOut: bookingData.checkOut,
        bedsNeeded: totalBedsRequested,
      });

      if (!availability.available) {
        logger.warn('Insufficient availability', {
          requested: totalBedsRequested,
          available: availability.availableBeds,
        });
        res.status(409).json(
          ApiResponse.error('Insufficient availability for requested dates', {
            availableBeds: availability.availableBeds,
            requestedBeds: totalBedsRequested,
            alternativeDates: availability.alternativeDates,
          }),
        );
        return;
      }
    }

    // Calculate pricing
    const pricingDetails = await pricingService.calculateTotalPrice({
      checkInDate: bookingData.checkIn,
      checkOutDate: bookingData.checkOut,
      rooms: bookingData.rooms,
      totalBeds: totalBedsRequested,
    });

    // ── Cupón de oferta (apartamentos y referidos) ────────────────────────────
    // Si viene offerCode, validamos contra apartment_offers y aplicamos el
    // descuento al precio final ANTES de crear la reserva. Los códigos de
    // referido (idea #49, roadmap.html) son filas de esta misma tabla con
    // referral_owner_guest_id seteado -- ver 0032_referral_codes.sql.
    let appliedOffer: {
      id: string;
      code: string;
      label: string;
      discount_percent: number;
      referral_owner_guest_id: string | null;
    } | null = null;
    if (bookingData.offerCode) {
      const today = bookingData.checkIn; // fecha de check-in como referencia de validez
      const { rows: offerRows } = await query(
        `SELECT id, code, label, discount_percent, apartment_ids, referral_owner_guest_id
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
        // Verificar si aplica al apartamento solicitado (null/vacío = todos)
        const aptId = bookingData.rooms[0]?.roomId;
        const aptOk =
          !offer.apartment_ids ||
          offer.apartment_ids.length === 0 ||
          (aptId && offer.apartment_ids.includes(aptId));
        // Un código de referido no aplica sobre la reserva del propio dueño
        // del código (mismo email) -- si no, cualquiera se autorregala 10%.
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
        if (aptOk && !selfReferral) {
          appliedOffer = offer;
          const discountFactor = 1 - offer.discount_percent / 100;
          pricingDetails.totalPrice =
            Math.round(pricingDetails.totalPrice * discountFactor * 100) / 100;
          pricingDetails.depositAmount =
            Math.round(pricingDetails.depositAmount * discountFactor * 100) / 100;
          pricingDetails.remainingAmount =
            Math.round(pricingDetails.remainingAmount * discountFactor * 100) / 100;
          logger.info('Oferta aplicada a reserva', {
            offerCode: offer.code,
            discount: offer.discount_percent,
          });
        }
      }
    }

    // ── Modo de pago para apartamentos (Cláusula 3 Termo de Adesão v2.1) ─────
    // 24–48h de antecedencia → 100% al reservar (remaining = 0).
    // ≥48h de antecedencia  → modelo normal 30% / 70%.
    // Hostel (camas) no se ve afectado.
    // isApartmentBooking ya fue calculado arriba junto al OVERALL check.
    if (isApartmentBooking && hoursUntilCheckIn < 48) {
      // Cobro completo al momento de la reserva
      pricingDetails.depositAmount = pricingDetails.totalPrice;
      pricingDetails.depositPercent = 100;
      pricingDetails.remainingAmount = 0;
      logger.info('Apartamento: pago 100% al reservar (antecedencia < 48h)', {
        hoursUntilCheckIn: Math.round(hoursUntilCheckIn),
        totalPrice: pricingDetails.totalPrice,
      });
    }

    // Check per-room availability.
    // Apartamentos usan una query directa (NOT EXISTS sobre reservation_beds)
    // idéntica a la de apartment-availability.ts porque check_availability()
    // está diseñada para el hostel (beds con is_active, géneros) y puede
    // devolver 0 camas disponibles para unidades de apartamento aunque estén
    // libres, causando un falso "Insufficient beds".
    for (const room of bookingData.rooms) {
      const { rows: aptCheck } = await query<{ is_apartment: boolean }>(
        `SELECT property_type = 'apartment' AS is_apartment FROM room_types WHERE id = $1`,
        [room.roomId]
      );
      const isApt = aptCheck[0]?.is_apartment ?? false;

      if (isApt) {
        // Para apartamentos: available si NO existe reserva activa solapada.
        const { rows: aptAvail } = await query<{ available: boolean }>(
          `SELECT NOT EXISTS (
             SELECT 1
             FROM reservation_beds rb
             JOIN beds b ON b.id = rb.bed_id
             JOIN reservations res ON res.id = rb.reservation_id
             WHERE b.room_type_id = $1
               AND res.status != 'cancelled'
               AND daterange(rb.check_in, rb.check_out, '[)') && daterange($2::date, $3::date, '[)')
           ) AS available`,
          [room.roomId, bookingData.checkIn, bookingData.checkOut]
        );
        if (!aptAvail[0]?.available) {
          res.status(409).json(
            ApiResponse.error('El apartamento ya no está disponible para esas fechas', {
              roomId: room.roomId,
            }),
          );
          return;
        }
      } else {
        // Para habitaciones del hostel: usar check_availability() como antes.
        const roomAvail = await availabilityService.checkRoomAvailability(
          room.roomId,
          bookingData.checkIn,
          bookingData.checkOut,
        );
        if (roomAvail.availableBeds < room.bedsCount) {
          res.status(409).json(
            ApiResponse.error(`Insufficient beds in room ${room.roomId}`, {
              roomId: room.roomId,
              requested: room.bedsCount,
              available: roomAvail.availableBeds,
            }),
          );
          return;
        }
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
        document: bookingData.guest.document,
        language: bookingData.language || 'pt',
      },
      nights,
      totalBeds: totalBedsRequested,
      pricing: pricingDetails,
      specialRequests:
        [
          bookingData.arrivalTime
            ? `Horario de llegada: ${
                // Soporta rangos "14-16" → "14:00 – 16:00" y horarios puntuales "14:30" → "14:30"
                bookingData.arrivalTime.includes('-')
                  ? bookingData.arrivalTime.replace('-', ':00 – ') + ':00'
                  : bookingData.arrivalTime
              }`
            : null,
          bookingData.specialRequests || null,
        ]
          .filter(Boolean)
          .join('\n') || undefined,
      source: bookingData.source || 'website',
      language: bookingData.language || 'pt',
      status: 'pending_payment',
      guestGender: bookingData.guestGender || 'mixed',
    });

    logger.info('Booking created successfully', {
      bookingId: booking.id,
      totalPrice: pricingDetails.totalPrice,
    });

    // ── Programa de referidos (idea #49, roadmap.html) ────────────────────────
    // Cada reserva nueva recibe su propio código de referido (10% para quien
    // lo use, ver 0032_referral_codes.sql) -- se muestra en la pantalla de
    // éxito para que el huésped lo comparta. Si esta reserva a su vez redimió
    // un código, quien lo compartió recibe un email con un premio propio.
    // Todo fire-and-forget: un fallo acá nunca debe tumbar la reserva ya creada.
    let ownReferralCode: string | null = null;
    try {
      ownReferralCode = generateReferralCode();
      const validTo = new Date();
      validTo.setFullYear(validTo.getFullYear() + 1);
      await query(
        `INSERT INTO apartment_offers
           (code, label, discount_percent, apartment_ids, valid_from, valid_to, is_active, referral_owner_guest_id)
         VALUES ($1, 'Código de referido', 10, NULL, now()::date, $2::date, true, $3)`,
        [ownReferralCode, validTo.toISOString().slice(0, 10), booking.guest_id],
      );
    } catch (error) {
      logger.error('No se pudo generar el código de referido', {
        bookingId: booking.id,
        error: error instanceof Error ? error.message : String(error),
      });
      ownReferralCode = null;
    }

    if (appliedOffer?.referral_owner_guest_id) {
      (async () => {
        try {
          const { rows: referrerRows } = await query<{
            full_name: string;
            email: string;
            language: string | null;
          }>(`SELECT full_name, email, language FROM guests WHERE id = $1`, [
            appliedOffer!.referral_owner_guest_id,
          ]);
          const referrer = referrerRows[0];
          if (!referrer) {
            return;
          }

          const rewardCode = generateReferralCode();
          const rewardValidTo = new Date();
          rewardValidTo.setDate(rewardValidTo.getDate() + 90);
          await query(
            `INSERT INTO apartment_offers
               (code, label, discount_percent, apartment_ids, valid_from, valid_to, is_active, referral_owner_guest_id)
             VALUES ($1, 'Premio por referido', 10, NULL, now()::date, $2::date, true, $3)`,
            [
              rewardCode,
              rewardValidTo.toISOString().slice(0, 10),
              appliedOffer!.referral_owner_guest_id,
            ],
          );

          await emailService.sendReferralReward(
            { fullName: referrer.full_name, email: referrer.email, language: referrer.language },
            rewardCode,
          );
          logger.info('Premio de referido enviado', {
            referrerGuestId: appliedOffer!.referral_owner_guest_id,
            rewardCode,
          });
        } catch (error) {
          logger.error('No se pudo enviar el premio de referido', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
    }

    // ── Foto del documento (obligatoria en el motor del hostel) ──────────────
    // Opcional a nivel de este endpoint compartido -- el motor de apartamentos
    // reusa la misma ruta y todavía no pide esta foto. El motor del hostel la
    // exige del lado del cliente antes de llegar acá.
    if (bookingData.guest.documentPhotoBase64) {
      try {
        const photoBuffer = decodeBase64Image(bookingData.guest.documentPhotoBase64);
        const photo = await uploadDocumentPhoto(photoBuffer);
        await guestRepo.setDocumentPhoto(booking.guest_id, photo);
      } catch (err) {
        logger.error('No se pudo guardar la foto del documento', {
          bookingId: booking.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // ── Registro de hóspedes declarados (booking_guests) ─────────────────────
    // Fire-and-forget: si falla, la reserva ya quedó guardada correctamente.
    // El admin puede completar el registro en el check-in físico.
    (async () => {
      // Subir fotos de documento de acompañantes a Cloudinary antes del INSERT
      const additionalWithPhotos = await Promise.all(
        (bookingData.additionalGuests ?? []).map(async (g) => {
          if (!g.documentPhotoBase64) { return g; }
          try {
            const photoBuffer = decodeBase64Image(g.documentPhotoBase64);
            const photo = await uploadDocumentPhoto(photoBuffer);
            return { ...g, photoUrl: photo.url, photoPublicId: photo.publicId };
          } catch (err) {
            logger.error('No se pudo subir foto de acompañante a Cloudinary', {
              bookingId: booking.id,
              error: err instanceof Error ? err.message : String(err),
            });
            return g;
          }
        }),
      );
      await insertBookingGuests(
        booking.id,
        {
          fullName,
          document: bookingData.guest.document ?? '',
          documentType: /[a-zA-Z]/.test(bookingData.guest.document ?? '') ? 'passaporte' : 'CPF',
        },
        additionalWithPhotos,
      );
    })().catch((err) => {
      logger.error('No se pudo insertar booking_guests', {
        bookingId: booking.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    // Envio de confirmacion, no bloqueante -- se resuelve con los datos ya
    // insertados (guest joined via bookingService.getBooking), no con el
    // payload crudo del request.
    bookingService
      .getBooking(booking.id)
      .then((bookingWithGuest) => {
        if (!bookingWithGuest?.guest) {
          logger.error('No se pudo cargar guest para email de confirmación', {
            bookingId: booking.id,
          });
          return;
        }
        const guest = bookingWithGuest as BookingWithGuest;
        // WhatsApp queda deshabilitado hasta que haya credenciales reales de
        // Meta (WHATSAPP_ENABLED=false por defecto, ver whatsapp-notification-service.ts)
        // -- sendBookingNotification() no-opea sola en ese caso, así que es
        // seguro llamarla siempre sin chequear el flag acá.
        if (guest.guest.phone) {
          whatsappNotificationService
            .sendBookingNotification({
              phone: guest.guest.phone,
              bookingId: guest.reservation_number,
              checkIn: String(guest.check_in_date),
              language: (['pt', 'en', 'es'] as string[]).includes(guest.guest.language ?? '')
                ? (guest.guest.language as 'pt' | 'en' | 'es')
                : 'en',
            })
            .catch((error) => {
              logger.error('Failed to send booking confirmation WhatsApp', {
                bookingId: booking.id,
                error: error.message,
              });
            });
        }
        return notificationService.notify('booking_confirmation', guest);
      })
      .catch((error) => {
        logger.error('Failed to send booking confirmation email', {
          bookingId: booking.id,
          error: error.message,
        });
      });

    res.status(201).json(
      ApiResponse.success(
        {
          booking: {
            id: booking.id,
            confirmationNumber: booking.reservation_number,
            status: booking.status,
            checkIn: bookingData.checkIn,
            checkOut: bookingData.checkOut,
            nights,
            rooms: bookingData.rooms,
            guest: {
              name: fullName,
              email: bookingData.guest.email,
            },
            // Programa de referidos (idea #49, roadmap.html) -- null solo si
            // falló la generación, no bloquea el resto de la respuesta.
            referralCode: ownReferralCode,
            pricing: {
              subtotal: pricingDetails.basePrice,
              groupDiscount: pricingDetails.discountAmount,
              seasonalAdjustment:
                pricingDetails.priceAfterSeason - pricingDetails.priceAfterDiscount,
              total: pricingDetails.totalPrice,
              deposit: pricingDetails.depositAmount,
              remaining: pricingDetails.remainingAmount,
              currency: 'BRL',
              ...(appliedOffer
                ? {
                    appliedOffer: {
                      code: appliedOffer.code,
                      label: appliedOffer.label,
                      discount_percent: appliedOffer.discount_percent,
                    },
                  }
                : {}),
            },
            payment: {
              depositRequired: true,
              depositAmount: pricingDetails.depositAmount,
              // Antes hardcodeado a +24h, sin relación con el hold real de la
              // reserva -- ahora usa el mismo pending_expires_at que ya vino
              // en el INSERT (booking-service.ts), la única fuente de verdad.
              depositDueDate: booking.pending_expires_at,
              remainingAmount: pricingDetails.remainingAmount,
              // Apartamentos ≥48h: 70% vence la mañana del check-in (8am SP).
              // Apartamentos <48h: remaining = 0, esta fecha es irrelevante.
              // Hostel: 7 días antes del check-in (modelo clásico).
              remainingDueDate: isApartmentBooking
                ? (() => {
                    const morning = new Date(checkIn);
                    morning.setUTCHours(11, 0, 0, 0); // 8:00 AM São Paulo = 11:00 UTC
                    return morning.toISOString();
                  })()
                : new Date(checkIn.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            },
            // Expiración real del hold (5 min) para que el frontend arme el
            // contador regresivo con el dato correcto, no un valor inventado.
            pendingExpiresAt: booking.pending_expires_at,
          },
        },
        'Booking created successfully',
      ),
    );
  } catch (error) {
    // El pre-chequeo de arriba puede pasar y aun asi bookingService.createBooking()
    // lanzar esto -- otra transaccion tomo las camas entre el pre-chequeo y el
    // INSERT bajo lock. Sin este catch especifico caia al error-handler generico
    // y devolvia 500 en vez de 409 (InsufficientAvailabilityError no tiene
    // `statusCode`, asi que error-handler.ts la trataba como error inesperado).
    if (error instanceof InsufficientAvailabilityError) {
      logger.warn('Insufficient availability detected during createBooking', {
        details: error.details,
      });
      res.status(409).json(ApiResponse.error(error.message, error.details));
      return;
    }

    logger.error('Error creating booking', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    next(error);
  }
};
