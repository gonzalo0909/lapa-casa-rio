// lapa-casa-hostel/backend/src/routes/availability/apartment-availability.ts
//
// Disponibilidad de apartamentos. Cada apartamento es una unidad completa
// (1 cama en la tabla beds = la unidad entera). El precio es por noche
// sin multiplicadores por persona.

import type { Request, Response, NextFunction } from 'express';
import { query } from '../../config/database';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

export const checkApartmentAvailabilityHandler = async (
  req: Request<{}, {}, {}, { checkIn?: string; checkOut?: string; guests?: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { checkIn, checkOut, guests } = req.query;
    const guestCount = guests ? Math.max(1, parseInt(guests, 10) || 1) : 1;

    if (!checkIn || !checkOut) {
      res.status(400).json(ApiResponse.error('checkIn y checkOut son requeridos (YYYY-MM-DD)'));
      return;
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      res.status(400).json(ApiResponse.error('Fechas inválidas'));
      return;
    }

    // Corte de las 12h: reservas para hoy solo se aceptan antes del mediodía.
    // A partir de las 12:00 BRT el mínimo pasa a ser mañana.
    // Se usa formatToParts para extraer la hora de forma robusta (evita parsear
    // strings localizados que pueden variar según la plataforma).
    const now = new Date();
    const todayInSaoPaulo = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(now);
    const hourParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      hour: 'numeric',
      hour12: false,
    }).formatToParts(now);
    const hourBrt = parseInt(hourParts.find((p) => p.type === 'hour')!.value, 10);

    // Antes de las 12h → hoy permitido. A partir de las 12h → mínimo mañana.
    let minCheckIn = todayInSaoPaulo;
    if (hourBrt >= 12) {
      const [y, m, d] = todayInSaoPaulo.split('-').map(Number);
      const tomorrow = new Date(y, m - 1, d + 1);
      minCheckIn = tomorrow.getFullYear() +
        '-' + String(tomorrow.getMonth() + 1).padStart(2, '0') +
        '-' + String(tomorrow.getDate()).padStart(2, '0');
    }

    if (checkIn < minCheckIn) {
      const msg = checkIn === todayInSaoPaulo
        ? 'Las reservas para hoy solo se aceptan antes de las 12h'
        : 'La fecha de check-in no puede ser en el pasado';
      res.status(400).json(ApiResponse.error(msg));
      return;
    }

    if (checkOutDate <= checkInDate) {
      res.status(400).json(ApiResponse.error('El check-out debe ser posterior al check-in'));
      return;
    }

    const nights = Math.round(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Una sola query: apartamentos + disponibilidad.
    // available = true si NO existe reserva activa solapada con las fechas.
    // No se filtra por is_active ni por precio.
    const { rows: apartments } = await query<{
      id: string; code: string; name: string; capacity: number; base_price: string; available: boolean;
      neighborhood: string | null; external_rating: string | null; external_review_count: number | null; external_rating_label: string | null;
    }>(
      `SELECT
         rt.id,
         rt.code,
         rt.name,
         rt.capacity,
         rt.base_price,
         rt.neighborhood,
         rt.external_rating,
         rt.external_review_count,
         rt.external_rating_label,
         NOT EXISTS (
           SELECT 1
           FROM reservation_beds rb
           JOIN beds b ON b.id = rb.bed_id
           JOIN reservations res ON res.id = rb.reservation_id
           WHERE b.room_type_id = rt.id
             AND res.status != 'cancelled'
             AND daterange(rb.check_in, rb.check_out, '[)') && daterange($1::date, $2::date, '[)')
         ) AS available
       FROM room_types rt
       WHERE rt.property_type = 'apartment'
       ORDER BY rt.name`,
      [checkIn, checkOut]
    );

    // Fotos de todos los apartamentos en una sola query (evitar N+1)
    const { rows: allPhotos } = await query<{
      room_type_id: string; id: string; image_url: string; display_order: number; is_primary: boolean; alt_text: string | null;
    }>(
      `SELECT room_type_id, id, image_url, display_order, is_primary, alt_text
       FROM room_type_photos
       ORDER BY room_type_id, display_order ASC, created_at ASC`
    );
    const photosByApt = allPhotos.reduce<Record<string, typeof allPhotos>>((acc, p) => {
      (acc[p.room_type_id] ??= []).push(p);
      return acc;
    }, {});

    // Pricing en batch: todos los apartamentos comparten las mismas fechas y
    // totalBeds=1, así que season/group-discount/min-nights son idénticos para
    // cada uno. Se hacen 4 queries totales en lugar de 7×N.
    let seasonMultiplier = 1;
    let seasonType: string = 'media';
    let groupDiscount = 0;
    let depositPercent = 0.3;
    let pricingFailed = false;
    const finalPriceById = new Map<string, number>();

    try {
      const bookingDate = new Date().toISOString().slice(0, 10);

      // 1) Valores compartidos — una sola query por aspecto estacional
      const [
        { rows: seasonRows },
        { rows: minNightsRows },
        { rows: groupDiscountRows },
        { rows: depositPctRows },
      ] = await Promise.all([
        query<{ multiplier: string; season_type: string }>(
          `SELECT calculate_season_multiplier($1::date) AS multiplier,
                  get_season_type($1::date) AS season_type`,
          [checkIn]
        ),
        query<{ get_min_nights: number }>(
          `SELECT get_min_nights($1::date) AS get_min_nights`,
          [checkIn]
        ),
        query<{ calculate_group_discount: string }>(
          `SELECT calculate_group_discount(1) AS calculate_group_discount`
        ),
        // totalBeds=1 → deposit_percent es constante; precio ficticio para obtener el %
        query<{ deposit_percent: string }>(
          `SELECT deposit_percent FROM calculate_deposit(100::numeric, 1)`
        ),
      ]);

      seasonMultiplier = parseFloat(seasonRows[0].multiplier);
      seasonType = seasonRows[0].season_type;
      groupDiscount = parseFloat(groupDiscountRows[0].calculate_group_discount);
      depositPercent = parseFloat(depositPctRows[0].deposit_percent);
      const minNights = minNightsRows[0]?.get_min_nights ?? 1;

      if (seasonType === 'carnaval' && nights < minNights) {
        throw new Error(`Durante Carnaval se requiere minimo ${minNights} noches`);
      }

      // 2) calculate_final_price en batch para todos los apartamentos a la vez
      if (apartments.length > 0) {
        const aptIds = apartments.map(a => a.id);
        const basePrices = apartments.map(a => parseFloat(a.base_price) || 0);
        const { rows: priceRows } = await query<{ apt_id: string; final_price: string }>(
          `SELECT t.apt_id,
                  calculate_final_price(t.base_price::numeric, $1, 1, $2::date, $3::date) AS final_price
           FROM UNNEST($4::uuid[], $5::numeric[]) AS t(apt_id, base_price)`,
          [nights, checkIn, bookingDate, aptIds, basePrices]
        );
        for (const row of priceRows) {
          const preDiscount = parseFloat(row.final_price);
          const discountAmount = Math.round(preDiscount * groupDiscount * 100) / 100;
          finalPriceById.set(row.apt_id, Math.round((preDiscount - discountAmount) * 100) / 100);
        }
      }
    } catch (pricingError) {
      pricingFailed = true;
      logger.warn('Apartment batch pricing unavailable for date range', {
        checkIn, checkOut,
        error: pricingError instanceof Error ? pricingError.message : 'Unknown error',
      });
    }

    const apartmentsWithAvailability = apartments.map((apt) => {
      const basePrice = parseFloat(apt.base_price) || 0;
      const finalPrice = finalPriceById.get(apt.id) ?? (pricingFailed ? basePrice * nights : basePrice * nights);
      const depositAmount = Math.round(finalPrice * depositPercent * 100) / 100;

      return {
        id: apt.id,
        code: apt.code,
        name: apt.name,
        capacity: apt.capacity,
        basePrice,
        available: apt.available,
        neighborhood: apt.neighborhood ?? undefined,
        externalRating: apt.external_rating !== null ? parseFloat(apt.external_rating) : undefined,
        externalReviewCount: apt.external_review_count ?? undefined,
        externalRatingLabel: apt.external_rating_label ?? undefined,
        photos: (photosByApt[apt.id] ?? []).map(p => ({
          id: p.id, url: p.image_url, isPrimary: p.is_primary, altText: p.alt_text,
        })),
        priceTotal: finalPrice,
        seasonMultiplier: pricingFailed ? 1 : seasonMultiplier,
        seasonType: pricingFailed ? 'media' : seasonType,
        depositAmount,
      };
    });

    logger.info('Apartment availability checked', {
      checkIn, checkOut, nights, guestCount,
      total: apartments.length,
      available: apartmentsWithAvailability.filter(a => a.available).length,
      fitsGuests: apartmentsWithAvailability.filter(a => a.available && a.capacity >= guestCount).length,
    });

    res.status(200).json(ApiResponse.success({
      checkIn,
      checkOut,
      nights,
      apartments: apartmentsWithAvailability,
    }, 'Disponibilidad de apartamentos consultada'));
  } catch (error) {
    logger.error('Error checking apartment availability', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    next(error);
  }
};
