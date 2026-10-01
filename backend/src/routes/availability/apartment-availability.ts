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
    // available = true si el anuncio está aprobado (listing_status) Y no
    // existe reserva/bloqueo solapado con las fechas -- un apartamento con
    // listing_status != 'approved' se sigue mostrando (foto, nombre,
    // precio) pero queda como "Indisponível" y no seleccionable, mismo
    // mecanismo que ya usa el frontend para fechas ocupadas (no se oculta
    // la tarjeta, ver apartment-card.tsx). No se filtra por is_active ni
    // por precio -- sí por published_snapshot: el contenido del anuncio
    // (nombre, barrio, dirección, fotos) requiere aprobación de un admin
    // (0051_apartment_listing_approval.sql); un apartamento sin snapshot
    // todavía nunca fue aprobado y no aparece acá. Se lee del snapshot, no
    // de las columnas en vivo, para que una edición pendiente de revisión
    // no cambie lo que ya se está mostrando.
    const { rows: apartments } = await query<{
      id: string; code: string; capacity: number; base_price: string; available: boolean;
      external_rating: string | null; external_review_count: number | null; external_rating_label: string | null;
      lat: string | null; lng: string | null;
      published_snapshot: {
        name: string; neighborhood: string | null; address: string | null;
        photos: { id: string; image_url: string; is_primary: boolean; alt_text: string | null }[];
      };
    }>(
      `SELECT
         rt.id,
         rt.code,
         rt.capacity,
         rt.base_price,
         rt.external_rating,
         rt.external_review_count,
         rt.external_rating_label,
         rt.lat,
         rt.lng,
         rt.published_snapshot,
         (
           rt.listing_status = 'approved'
           AND NOT EXISTS (
             SELECT 1
             FROM reservation_beds rb
             JOIN reservations res ON res.id = rb.reservation_id
             WHERE rb.room_type_id = rt.id
               AND res.status != 'cancelled'
               AND daterange(rb.check_in, rb.check_out, '[)') && daterange($1::date, $2::date, '[)')
           )
           AND NOT EXISTS (
             SELECT 1
             FROM room_blocks rbl
             WHERE rbl.room_type_id = rt.id
               AND daterange(rbl.start_date, rbl.end_date, '[)') && daterange($1::date, $2::date, '[)')
           )
         ) AS available
       FROM room_types rt
       WHERE rt.property_type = 'apartment' AND rt.published_snapshot IS NOT NULL
       ORDER BY rt.published_snapshot->>'name'`,
      [checkIn, checkOut]
    );

    // Regla de pago completo (Cláusula 3 Termo de Adesão v2.1):
    // si el check-in es en menos de 48h, no hay tiempo de cobrar el saldo
    // restante, por lo que se requiere el 100% al reservar.
    // Se calcula con el mismo criterio que create-booking.ts: el check-in
    // se toma a las 14:00 BRT (17:00 UTC) para no castigar reservas de hoy
    // hechas a primera hora de la mañana.
    const checkInAt14hBRT = new Date(checkIn!);
    checkInAt14hBRT.setUTCHours(17, 0, 0, 0);
    const hoursUntilCheckIn = (checkInAt14hBRT.getTime() - now.getTime()) / (1000 * 60 * 60);
    const fullPaymentRequired = hoursUntilCheckIn < 48;

    // El "Preço base" que carga el owner es el precio final -- a pedido
    // explícito, sin multiplicador de temporada ni descuento por reserva
    // anticipada (esos vienen de calculate_final_price/rate_plans, pensados
    // para el hostel; antes se llamaban acá igual pese al comentario de que
    // "temporadas no aplican a apartamentos", así que sí aplicaban -- ver
    // pricing-service.ts calculateTotalPrice, mismo criterio, es lo que de
    // verdad cobra create-apartment-booking.ts). Solo depositPercent sigue
    // viniendo de la función SQL (calculate_deposit), no depende de temporada.
    let depositPercent = 0.3;
    let pricingFailed = false;
    const finalPriceById = new Map<string, number>();

    for (const apt of apartments) {
      finalPriceById.set(apt.id, Math.round((parseFloat(apt.base_price) || 0) * nights * 100) / 100);
    }

    try {
      const { rows: depositPctRows } = await query<{ deposit_percent: string }>(
        `SELECT deposit_percent FROM calculate_deposit(100::numeric, 1)`
      );
      depositPercent = parseFloat(depositPctRows[0].deposit_percent);
    } catch (pricingError) {
      pricingFailed = true;
      logger.warn('Apartment deposit percent unavailable for date range', {
        checkIn, checkOut, error: pricingError instanceof Error ? pricingError.message : 'Unknown error',
      });
    }

    const apartmentsWithAvailability = apartments.map((apt) => {
      const basePrice = parseFloat(apt.base_price) || 0;
      const finalPrice = finalPriceById.get(apt.id) ?? basePrice * nights;
      // Si faltan menos de 48h para el check-in se cobra el total al reservar
      // (no hay tiempo de gestionar el pago del saldo restante).
      // Se muestra el monto real para que el huésped no se sorprenda al pagar.
      const depositAmount = fullPaymentRequired
        ? finalPrice
        : Math.round(finalPrice * depositPercent * 100) / 100;

      return {
        id: apt.id,
        code: apt.code,
        name: apt.published_snapshot.name,
        capacity: apt.capacity,
        // El backend confirma explícitamente si el apartamento cabe para la
        // cantidad solicitada, para que el frontend no lo recalcule por su cuenta.
        fitsGuests: apt.capacity >= guestCount,
        basePrice,
        available: apt.available,
        neighborhood: apt.published_snapshot.neighborhood ?? undefined,
        street: apt.published_snapshot.address ?? undefined,
        lat: apt.lat !== null ? parseFloat(apt.lat) : undefined,
        lng: apt.lng !== null ? parseFloat(apt.lng) : undefined,
        externalRating: apt.external_rating !== null ? parseFloat(apt.external_rating) : undefined,
        externalReviewCount: apt.external_review_count ?? undefined,
        externalRatingLabel: apt.external_rating_label ?? undefined,
        photos: (apt.published_snapshot.photos ?? []).map(p => ({
          id: p.id, url: p.image_url, isPrimary: p.is_primary, altText: p.alt_text,
        })),
        priceTotal: finalPrice,
        depositAmount,
        // Indica al frontend si se requiere pago completo y el motivo,
        // para que pueda mostrar una explicación clara al huésped.
        fullPaymentRequired,
        fullPaymentReason: fullPaymentRequired ? 'less_than_48h' : null,
        // true cuando calculate_deposit falló -- priceTotal sigue siendo exacto
        // (base_price × noches, ya no depende de ninguna query), solo
        // depositAmount pudo haber usado el 30% por defecto en vez del real.
        pricingFailed: pricingFailed || undefined,
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
