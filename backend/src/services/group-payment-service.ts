// lapa-casa-hostel/backend/src/services/group-payment-service.ts
// Feature 2 v3: un solo link compartido para todo el grupo.
//
// Flujo:
//   1. Titular crea la sesión desde el motor del hostel → recibe UN solo
//      link + mensaje de WhatsApp. Lo reenvía manualmente (compartir/
//      reenviar) a cada invitado, uno por uno.
//   2. El mismo link lo abren los N-1 invitados. Cada uno completa sus
//      datos, sube la foto de su documento (obligatoria) y paga su propia
//      cama — al pagar, esa cama queda cerrada (no se puede pagar dos veces).
//   3. Un solo timer de 10 minutos para toda la sesión, no por invitado.
//   4. Al expirar: los que pagaron quedan confirmados; los que no, se
//      liberan y esos invitados son derivados a reservar manualmente.
//   5. El titular reserva su propia cama por separado, con pago individual
//      normal — esta sesión no incluye su cama.
//
// Opción D de precios por overflow:
//   baja     → todos pagan el precio de la habitación más barata del grupo
//   media    → precio promedio ponderado entre habitaciones
//   alta/carnaval → cada cama paga el precio real de su habitación

import crypto from 'crypto';
import type { PoolClient } from 'pg';
import { withTransaction, query } from '../config/database';
import { GuestRepository } from '../database/repositories/guest-repository';
import { acquireLock } from '../database/lock-middleware';
import { enqueueSheetsExport } from '../queues/sheets-export.queue';
import redisClient from '../cache/redis-client';
import { logger } from '../utils/logger';
import { getSeasonType } from './season-type';
import { uploadDocumentPhoto } from '../lib/cloudinary/cloudinary-client';
import { decodeBase64Image } from '../utils/decode-base64-image';

const guestRepo = new GuestRepository();

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface GroupSessionInput {
  checkIn: string;
  checkOut: string;
  totalBeds: number;
  nights: number;
  guestGender: 'mixed' | 'female' | 'male';
  /** Datos del titular (capturados en la página principal al crear la sesión) */
  titular: {
    full_name: string;
    email: string;
    phone?: string;
    country?: string;
    document?: string;
    language?: string;
  };
  specialRequests?: string;
  /** URL base del backend para armar los links de miembro */
  appBaseUrl: string;
}

export interface RoomAllocation {
  roomTypeId: string;
  roomCode: string;
  basePricePerBed: number;
  amountPerBed: number;
  bedsCount: number;
  bedIds: string[];
}

export interface GroupSessionResult {
  sessionId: string;
  token: string;
  reservationId: string;
  reservationNumber: string;
  /** N-1: cantidad de invitados que tienen que pagar (no incluye al titular) */
  totalBeds: number;
  paidBeds: number;
  pricingStrategy: string;
  seasonType: string;
  amountPerBed: number;
  roomAllocations: RoomAllocation[];
  expiresAt: string;
  /** Único link, compartido por el titular a todos los invitados */
  groupPaymentUrl: string;
  waShareUrl: string;
}

export interface ClaimSlotInput {
  /** Token de la sesión (el único link que comparte el titular) */
  sessionToken: string;
  guest: {
    full_name: string;
    email: string;
    phone?: string;
    country?: string;
    language?: string;
  };
  paymentMethod: 'card' | 'pix';
  /** Foto del documento (DNI/pasaporte) como data URL base64 — obligatoria */
  documentPhotoBase64: string;
}

export interface MemberPaymentResult {
  memberId: string;
  paymentMethod: 'card' | 'pix';
  amountCharged: number;
  cardSurcharge: number;
  checkoutUrl?: string;
  pixData?: { qrCode: string; qrCodeBase64: string; expiresAt: string };
  providerPaymentId: string;
}

// ── Helpers internos ─────────────────────────────────────────────────────────

const generateToken = (): string => crypto.randomBytes(32).toString('hex');

const generateReservationNumber = (): string =>
  `LCH-G-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

async function getCardSurchargePercent(): Promise<number> {
  const { rows } = await query<{ value: number }>(
    `SELECT value FROM system_config WHERE key = 'card_surcharge_percent'`,
  );
  return rows[0]?.value ?? 0;
}

function resolvePricingStrategy(seasonType: string): 'min' | 'weighted_avg' | 'per_room' {
  if (seasonType === 'baja') {
    return 'min';
  }
  if (seasonType === 'media') {
    return 'weighted_avg';
  }
  return 'per_room';
}

async function allocateGroupBeds(
  client: PoolClient,
  checkIn: string,
  checkOut: string,
  totalBeds: number,
  gender: 'mixed' | 'female' | 'male',
): Promise<RoomAllocation[]> {
  const { rows: rooms } = await client.query<{
    id: string;
    code: string;
    capacity: number;
    base_price: string;
    is_flexible: boolean;
  }>(
    `SELECT id, code, capacity, base_price, is_flexible
     FROM room_types
     WHERE property_type = 'hostel'
       AND (
         default_gender = 'mixed'
         OR default_gender = $1::bed_gender
         OR is_flexible = true
       )
     ORDER BY is_flexible ASC, capacity DESC, code ASC`,
    [gender],
  );

  const allocations: RoomAllocation[] = [];
  let remaining = totalBeds;

  for (const room of rooms) {
    if (remaining <= 0) {
      break;
    }

    if (room.is_flexible && gender !== 'female') {
      const { rows: statusRows } = await client.query<{ effective_gender: string }>(
        `SELECT effective_gender FROM availability_cache
         WHERE room_type_id = $1 AND date = $2::date LIMIT 1`,
        [room.id, checkIn],
      );
      const effectiveGender = statusRows[0]?.effective_gender ?? 'female';
      if (effectiveGender === 'female') {
        continue;
      }
    }

    const { rows: beds } = await client.query<{ bed_id: string }>(
      `SELECT bed_id FROM check_availability($1::date, $2::date, $3::bed_gender)
       WHERE room_type_id = $4::uuid
         AND is_gender_eligible = true
         AND is_available = true
       ORDER BY regexp_replace(bed_code, '[0-9]+$', ''),
                NULLIF(regexp_replace(bed_code, '^[^0-9]*', ''), '')::INT
       LIMIT $5`,
      [checkIn, checkOut, gender, room.id, remaining],
    );

    if (beds.length === 0) {
      continue;
    }

    const bedIds = beds.map((b) => b.bed_id);
    const basePricePerBed = parseFloat(room.base_price);

    allocations.push({
      roomTypeId: room.id,
      roomCode: room.code,
      basePricePerBed,
      amountPerBed: 0,
      bedsCount: bedIds.length,
      bedIds,
    });

    remaining -= bedIds.length;
  }

  if (remaining > 0) {
    throw new Error(
      `No hay suficientes camas disponibles. Faltan ${remaining} de ${totalBeds} solicitadas.`,
    );
  }

  return allocations;
}

function applyPricingStrategy(
  allocations: RoomAllocation[],
  strategy: 'min' | 'weighted_avg' | 'per_room',
  nights: number,
  seasonMultiplier: number,
): { allocations: RoomAllocation[]; defaultAmountPerBed: number } {
  const pricePerBed = (a: RoomAllocation) =>
    parseFloat((a.basePricePerBed * nights * seasonMultiplier).toFixed(2));

  if (strategy === 'min') {
    const minPrice = Math.min(...allocations.map(pricePerBed));
    return {
      allocations: allocations.map((a) => ({ ...a, amountPerBed: minPrice })),
      defaultAmountPerBed: minPrice,
    };
  }

  if (strategy === 'weighted_avg') {
    const totalBeds = allocations.reduce((s, a) => s + a.bedsCount, 0);
    const weightedSum = allocations.reduce((s, a) => s + pricePerBed(a) * a.bedsCount, 0);
    const avg = parseFloat((weightedSum / totalBeds).toFixed(2));
    return {
      allocations: allocations.map((a) => ({ ...a, amountPerBed: avg })),
      defaultAmountPerBed: avg,
    };
  }

  const updated = allocations.map((a) => ({ ...a, amountPerBed: pricePerBed(a) }));
  return { allocations: updated, defaultAmountPerBed: pricePerBed(allocations[0]) };
}

// ── Clase principal ───────────────────────────────────────────────────────────

export class GroupPaymentService {
  /**
   * Crea la sesión de pago grupal:
   * 1. Asigna camas (overflow automático)
   * 2. Determina precio por cama (Opción D)
   * 3. Crea reserva pending_group
   * 4. Pre-crea N-1 slots de miembro con tokens individuales (el titular reserva por separado)
   * 5. Retorna N-1 links únicos — uno por invitado, sin incluir la cama del titular
   */
  async createGroupSession(input: GroupSessionInput): Promise<GroupSessionResult> {
    const seasonType = await getSeasonType(input.checkIn);
    const strategy = resolvePricingStrategy(seasonType);

    const { rows: multRows } = await query<{ calculate_season_multiplier: string }>(
      `SELECT calculate_season_multiplier($1::date) AS calculate_season_multiplier`,
      [input.checkIn],
    );
    const seasonMultiplier = parseFloat(multRows[0].calculate_season_multiplier);

    const result = await withTransaction(async (client) => {
      // input.totalBeds es el tamaño total del grupo (incluyendo al titular).
      // El titular reserva su propia cama directamente en el motor del hostel,
      // por lo que la sesión grupal solo cubre a los N-1 invitados restantes.
      const rawAllocations = await allocateGroupBeds(
        client,
        input.checkIn,
        input.checkOut,
        input.totalBeds - 1,
        input.guestGender,
      );

      const { allocations, defaultAmountPerBed } = applyPricingStrategy(
        rawAllocations,
        strategy,
        input.nights,
        seasonMultiplier,
      );

      const allBedIds = allocations.flatMap((a) => a.bedIds);

      await acquireLock(client, allBedIds);

      const { rows: occupied } = await client.query(
        `SELECT bed_id FROM reservation_beds
         WHERE bed_id = ANY($1::uuid[])
           AND daterange(check_in, check_out, '[)') && daterange($2::date, $3::date, '[)')`,
        [allBedIds, input.checkIn, input.checkOut],
      );
      if (occupied.length > 0) {
        throw new Error('Algunas camas ya no están disponibles. Por favor intentá de nuevo.');
      }

      const titular = await guestRepo.upsert({
        full_name: input.titular.full_name,
        email: input.titular.email,
        phone: input.titular.phone ?? null,
        country: input.titular.country ?? null,
        language: input.titular.language ?? null,
      });

      const { rows: chRows } = await client.query(`SELECT id FROM channels WHERE code = 'direct'`);
      if (chRows.length === 0) {
        throw new Error('Canal direct no encontrado');
      }
      const channelId = chRows[0].id;

      const reservationNumber = generateReservationNumber();
      // N-1: el titular reserva su propia cama directamente, no ocupa un slot del grupo
      const totalBeds = input.totalBeds - 1;

      const totalPrice = parseFloat(
        allocations.reduce((s, a) => s + a.amountPerBed * a.bedsCount, 0).toFixed(2),
      );
      const depositPercent = 0.3;
      const depositAmount = parseFloat((totalPrice * depositPercent).toFixed(2));
      const remainingAmount = parseFloat((totalPrice - depositAmount).toFixed(2));

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      const { rows: resRows } = await client.query(
        `INSERT INTO reservations (
           reservation_number, guest_id, channel_id, guest_gender,
           check_in_date, check_out_date, nights_count, beds_count,
           base_price, season_multiplier, group_discount, early_bird_discount, final_price,
           deposit_percent, deposit_amount, remaining_amount,
           status, pending_expires_at, special_requests, source
         ) VALUES (
           $1, $2, $3, $4::bed_gender,
           $5::date, $6::date, $7, $8,
           $9, $10, 0, 0, $11,
           $12, $13, $14,
           'pending_group'::booking_status, $15, $16, 'direct'
         ) RETURNING id, reservation_number`,
        [
          reservationNumber,
          titular.id,
          channelId,
          input.guestGender,
          input.checkIn,
          input.checkOut,
          input.nights,
          totalBeds,
          defaultAmountPerBed,
          seasonMultiplier,
          totalPrice,
          depositPercent,
          depositAmount,
          remainingAmount,
          expiresAt.toISOString(),
          input.specialRequests ?? null,
        ],
      );
      const reservation = resRows[0];

      // Sección 9 auditoría 17 secciones: batch con unnest() en vez de un
      // INSERT por cama en un loop -- N round-trips a la base por 1.
      await client.query(
        `INSERT INTO reservation_beds (reservation_id, bed_id, check_in, check_out)
         SELECT $1, bed_id, $3::date, $4::date
         FROM unnest($2::uuid[]) AS bed_id`,
        [reservation.id, allBedIds, input.checkIn, input.checkOut],
      );

      // Único link de la sesión: el titular lo comparte por WhatsApp,
      // reenviándolo a cada invitado (uno por uno, mismo link).
      const sessionToken = generateToken();
      const groupPaymentUrl = `${input.appBaseUrl}/group-payment/${sessionToken}`;
      const waShareUrl = `https://wa.me/?text=${encodeURIComponent(
        `Hola! Te invito a pagar tu cama para nuestro grupo en Lapa Casa Hostel. Cada uno paga la suya:\n${groupPaymentUrl}\n\nTenés 10 minutos desde que abrí este link.`,
      )}`;

      const { rows: sessionRows } = await client.query(
        `INSERT INTO group_payment_sessions
           (reservation_id, token, total_beds, paid_beds,
            pricing_strategy, season_type, wa_share_url, expires_at)
         VALUES ($1, $2, $3, 0, $4, $5, $6, $7)
         RETURNING id`,
        [
          reservation.id,
          sessionToken,
          totalBeds,
          strategy,
          seasonType,
          waShareUrl,
          expiresAt.toISOString(),
        ],
      );
      const sessionId = sessionRows[0].id;

      // Pre-crear N slots, cada uno con una cama específica ya asignada.
      // No se generan links por slot: todos los invitados usan el mismo
      // link de la sesión y van reclamando el próximo slot libre al pagar
      // (ver claimAndPaySlot). member_token queda null -- ya no se expone
      // ningún link individual.
      // Sección 9 auditoría 17 secciones: batch con unnest() en vez de un
      // INSERT por slot en el loop.
      const slotIndices: number[] = [];
      const slotBedIds: Array<string | null> = [];

      for (let i = 0; i < totalBeds; i++) {
        slotIndices.push(i + 1);
        slotBedIds.push(allBedIds[i] ?? null);
      }

      await client.query(
        `INSERT INTO group_payment_members (session_id, slot_index, bed_id, status)
         SELECT $1, slot_index, bed_id, 'invited'
         FROM unnest($2::int[], $3::uuid[]) AS t(slot_index, bed_id)`,
        [sessionId, slotIndices, slotBedIds],
      );

      return {
        sessionId,
        token: sessionToken,
        reservationId: reservation.id,
        reservationNumber: reservation.reservation_number,
        totalBeds,
        paidBeds: 0,
        pricingStrategy: strategy,
        seasonType,
        amountPerBed: defaultAmountPerBed,
        roomAllocations: allocations,
        expiresAt: expiresAt.toISOString(),
        groupPaymentUrl,
        waShareUrl,
      };
    });

    redisClient.delPattern('availability:*').catch(() => {});
    return result;
  }

  /** Estado general de la sesión (vista del titular — solo lectura). */
  async getSessionStatus(token: string): Promise<{
    found: boolean;
    expired: boolean;
    completed: boolean;
    totalBeds: number;
    paidBeds: number;
    amountPerBed: number;
    seasonType: string;
    pricingStrategy: string;
    expiresAt: string;
    members: Array<{ guestName: string; paymentMethod: string; paidAt: string }>;
  }> {
    const { rows } = await query<{
      id: string;
      status: string;
      total_beds: number;
      paid_beds: number;
      pricing_strategy: string;
      season_type: string;
      expires_at: string;
      reservation_id: string;
    }>(
      `SELECT id, status, total_beds, paid_beds, pricing_strategy, season_type, expires_at, reservation_id
       FROM group_payment_sessions WHERE token = $1`,
      [token],
    );

    if (rows.length === 0) {
      return {
        found: false,
        expired: false,
        completed: false,
        totalBeds: 0,
        paidBeds: 0,
        amountPerBed: 0,
        seasonType: '',
        pricingStrategy: '',
        expiresAt: '',
        members: [],
      };
    }

    const session = rows[0];

    // reservations.base_price ya guarda el precio final por cama para toda
    // la estadía (defaultAmountPerBed de applyPricingStrategy -- nightly
    // rate x noches x multiplicador de temporada, ver createGroupSession
    // más arriba), no una tarifa nightly suelta -- no volver a multiplicar
    // por season_multiplier/nights_count acá, eso duplicaba el cobro.
    const { rows: resRows } = await query<{ base_price: string }>(
      `SELECT base_price FROM reservations WHERE id = $1`,
      [session.reservation_id],
    );
    const res = resRows[0];
    const amountPerBed = res ? parseFloat(parseFloat(res.base_price).toFixed(2)) : 0;

    const { rows: memberRows } = await query<{
      guest_name: string;
      payment_method: string;
      paid_at: string;
    }>(
      `SELECT g.full_name AS guest_name, m.payment_method, m.paid_at
       FROM group_payment_members m
       LEFT JOIN guests g ON g.id = m.guest_id
       WHERE m.session_id = $1 AND m.status = 'paid'
       ORDER BY m.paid_at ASC`,
      [session.id],
    );

    return {
      found: true,
      expired: session.status === 'expired',
      completed: session.status === 'completed',
      totalBeds: session.total_beds,
      paidBeds: session.paid_beds,
      amountPerBed,
      seasonType: session.season_type,
      pricingStrategy: session.pricing_strategy,
      expiresAt: session.expires_at,
      members: memberRows.map((m) => ({
        guestName: m.guest_name,
        paymentMethod: m.payment_method,
        paidAt: m.paid_at,
      })),
    };
  }

  /**
   * Reclama el próximo cupo libre de la sesión e inicia el pago del invitado.
   * Todos los invitados abren el MISMO link (token de sesión); cada uno que
   * paga reclama un slot distinto -- el UPDATE con la subquery
   * FOR UPDATE SKIP LOCKED es atómico, así que dos invitados pagando al
   * mismo tiempo nunca terminan reclamando el mismo slot.
   * La foto del documento es obligatoria y se sube a Cloudinary antes de
   * reclamar el slot (si la subida falla, no se consume ningún cupo).
   */
  async claimAndPaySlot(input: ClaimSlotInput): Promise<MemberPaymentResult> {
    const { rows: sessionRows } = await query<{
      id: string;
      status: string;
      expires_at: string;
      reservation_id: string;
    }>(
      `SELECT id, status, expires_at, reservation_id
       FROM group_payment_sessions WHERE token = $1`,
      [input.sessionToken],
    );

    if (sessionRows.length === 0) {
      throw new Error('Link de pago no encontrado');
    }
    const session = sessionRows[0];

    if (session.status !== 'open') {
      throw new Error('Esta sesión ya está cerrada o expirada');
    }
    if (new Date(session.expires_at) < new Date()) {
      throw new Error('El tiempo para completar el pago grupal expiró');
    }

    // reservations.base_price ya es el precio final por cama para toda la
    // estadía (ver nota en getSessionStatus más arriba) -- no volver a
    // multiplicar por season_multiplier/nights_count, eso duplicaba el cobro.
    const { rows: resRows } = await query<{ base_price: string }>(
      `SELECT base_price FROM reservations WHERE id = $1`,
      [session.reservation_id],
    );
    const res = resRows[0];
    const amountPerBed = parseFloat(parseFloat(res.base_price).toFixed(2));

    const cardSurchargePct = input.paymentMethod === 'card' ? await getCardSurchargePercent() : 0;
    const cardSurcharge = parseFloat(((amountPerBed * cardSurchargePct) / 100).toFixed(2));
    const amountCharged = parseFloat((amountPerBed + cardSurcharge).toFixed(2));

    // Foto del documento — obligatoria, se sube antes de tocar el slot
    const photoBuffer = decodeBase64Image(input.documentPhotoBase64);
    const photo = await uploadDocumentPhoto(photoBuffer);

    // Upsert del guest + guardar la foto del documento
    const guest = await guestRepo.upsert({
      full_name: input.guest.full_name,
      email: input.guest.email,
      phone: input.guest.phone ?? null,
      country: input.guest.country ?? null,
      language: input.guest.language ?? null,
    });
    await guestRepo.setDocumentPhoto(guest.id, photo);

    // Reclamar el próximo slot libre de esta sesión (atómico)
    const { rows: claimedRows } = await query<{ id: string }>(
      `UPDATE group_payment_members
       SET guest_id = $2, amount_charged = $3, payment_method = $4,
           card_surcharge = $5, status = 'pending', updated_at = now()
       WHERE id = (
         SELECT id FROM group_payment_members
         WHERE session_id = $1 AND status = 'invited'
         ORDER BY slot_index ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       RETURNING id`,
      [session.id, guest.id, amountCharged, input.paymentMethod, cardSurcharge],
    );

    if (claimedRows.length === 0) {
      throw new Error('Ya no quedan camas disponibles en este link');
    }

    const memberId = claimedRows[0].id;
    const appBaseUrl = process.env.APP_URL || 'https://api.lapacasario.com';
    const successUrl = `${appBaseUrl}/group-payment/${input.sessionToken}?status=success`;
    const cancelUrl = `${appBaseUrl}/group-payment/${input.sessionToken}?status=cancel`;

    if (input.paymentMethod === 'card') {
      const { stripeHandler } = await import('../lib/payments/stripe-handler');
      const checkoutSession = await stripeHandler.createCheckoutSession({
        amount: amountCharged,
        description: `Pago grupal — cama Lapa Casa Hostel`,
        customerEmail: input.guest.email,
        reservationId: session.reservation_id,
        successUrl,
        cancelUrl,
        metadata: {
          group_session_id: session.id,
          member_id: memberId,
        },
      });

      logger.info('Group payment Stripe checkout creado', { memberId, sessionId: session.id });
      return {
        memberId,
        paymentMethod: 'card',
        amountCharged,
        cardSurcharge,
        checkoutUrl: checkoutSession.url,
        providerPaymentId: checkoutSession.sessionId,
      };
    } else {
      const { mercadoPagoHandler } = await import('../lib/payments/mercado-pago-handler');
      const pixResult = await mercadoPagoHandler.createPaymentIntent({
        amount: amountCharged,
        currency: 'BRL',
        description: `Pago grupal — cama Lapa Casa Hostel`,
        payerEmail: input.guest.email,
        paymentMethod: 'pix',
        metadata: {
          group_session_id: session.id,
          member_id: memberId,
          reservation_id: session.reservation_id,
        },
      });

      logger.info('Group payment PIX creado', { memberId, sessionId: session.id });
      return {
        memberId,
        paymentMethod: 'pix',
        amountCharged,
        cardSurcharge: 0,
        pixData: {
          qrCode: pixResult.qrCode ?? '',
          qrCodeBase64: pixResult.qrCodeBase64 ?? '',
          expiresAt: pixResult.expiresAt?.toISOString() ?? '',
        },
        providerPaymentId: pixResult.paymentIntentId,
      };
    }
  }

  /**
   * Confirma el pago de un miembro (llamado desde webhook de Stripe o MP).
   * Si es el último → auto-confirma la reserva y notifica al titular.
   */
  async confirmMemberPayment(params: {
    memberId: string;
    providerPaymentId: string;
    bedId?: string;
  }): Promise<{ reservationConfirmed: boolean }> {
    const { rows: memberRows } = await query<{
      id: string;
      session_id: string;
      status: string;
    }>(`SELECT id, session_id, status FROM group_payment_members WHERE id = $1`, [params.memberId]);

    if (memberRows.length === 0) {
      throw new Error('Miembro no encontrado');
    }
    const member = memberRows[0];
    if (member.status === 'paid') {
      return { reservationConfirmed: false };
    }

    await query(
      `UPDATE group_payment_members
       SET status = 'paid', paid_at = now(),
           provider_payment_id = $2,
           ${params.bedId ? 'bed_id = $3::uuid,' : ''}
           updated_at = now()
       WHERE id = $1`,
      params.bedId
        ? [params.memberId, params.providerPaymentId, params.bedId]
        : [params.memberId, params.providerPaymentId],
    );

    const { rows: sessionRows } = await query<{
      id: string;
      total_beds: number;
      paid_beds: number;
      reservation_id: string;
    }>(
      `UPDATE group_payment_sessions
       SET paid_beds = paid_beds + 1, updated_at = now()
       WHERE id = $1
       RETURNING id, total_beds, paid_beds, reservation_id`,
      [member.session_id],
    );

    const session = sessionRows[0];
    if (session.paid_beds >= session.total_beds) {
      await this.autoConfirmGroup(session.id, session.reservation_id);
      return { reservationConfirmed: true };
    }

    return { reservationConfirmed: false };
  }

  /** Confirma la reserva grupal cuando todos los miembros pagaron. */
  private async autoConfirmGroup(sessionId: string, reservationId: string): Promise<void> {
    await query(`UPDATE reservations SET status = 'confirmed', updated_at = now() WHERE id = $1`, [
      reservationId,
    ]);
    await query(
      `UPDATE group_payment_sessions SET status = 'completed', updated_at = now() WHERE id = $1`,
      [sessionId],
    );

    // Notificar al titular
    try {
      const { rows: titularRows } = await query<{
        guest_email: string;
        guest_name: string;
        reservation_number: string;
        total_beds: number;
        check_in_date: string;
      }>(
        `SELECT g.email AS guest_email, g.full_name AS guest_name,
                r.reservation_number, r.beds_count AS total_beds, r.check_in_date
         FROM reservations r
         JOIN guests g ON g.id = r.guest_id
         WHERE r.id = $1`,
        [reservationId],
      );
      if (titularRows.length > 0) {
        const t = titularRows[0];
        const { emailService } = await import('./email-service');
        await emailService.sendGroupPaymentComplete({
          titularEmail: t.guest_email,
          titularName: t.guest_name,
          reservationNumber: t.reservation_number,
          totalBeds: t.total_beds,
          checkIn: t.check_in_date,
        });
      }
    } catch (err) {
      logger.warn('Error al enviar email de confirmación grupal', { reservationId, err });
    }

    enqueueSheetsExport(reservationId, 'upsert').catch(() => {});
    redisClient.delPattern('availability:*').catch(() => {});
    logger.info('Reserva grupal confirmada', { reservationId, sessionId });
  }

  /**
   * Procesa sesiones expiradas:
   * - Los que pagaron: sus camas quedan confirmadas (reserva individual)
   * - Los que no pagaron: sus slots se liberan; reciben link para reservar individualmente
   */
  async cancelExpiredSessions(): Promise<number> {
    const { rows: expiredSessions } = await query<{
      id: string;
      reservation_id: string;
    }>(
      `UPDATE group_payment_sessions
       SET status = 'expired', updated_at = now()
       WHERE status = 'open' AND expires_at < now()
       RETURNING id, reservation_id`,
    );

    let processed = 0;
    const frontendUrl = process.env.FRONTEND_URL || 'https://lapacasario.com';

    for (const session of expiredSessions) {
      try {
        const { rows: paidMembers } = await query<{
          id: string;
          bed_id: string;
          guest_id: string;
          payment_method: string;
          provider_payment_id: string;
          amount_charged: string;
        }>(
          `SELECT id, bed_id, guest_id, payment_method, provider_payment_id, amount_charged
           FROM group_payment_members
           WHERE session_id = $1 AND status = 'paid'`,
          [session.id],
        );

        const { rows: unpaidMembers } = await query<{
          id: string;
          guest_id: string;
        }>(
          `SELECT id, guest_id
           FROM group_payment_members
           WHERE session_id = $1 AND status IN ('invited', 'pending')`,
          [session.id],
        );

        if (paidMembers.length > 0) {
          // Hay pagos: confirmar los que pagaron, liberar el resto
          const paidBedIds = paidMembers.map((m) => m.bed_id).filter(Boolean);

          if (paidBedIds.length < paidMembers.length) {
            // Algún miembro sin bed_id asignado — mantener todos los beds y confirmar la reserva parcialmente
            logger.warn('Miembros pagados sin bed_id, confirmando reserva completa', {
              sessionId: session.id,
            });
            await query(
              `UPDATE reservations
               SET status = 'confirmed', updated_at = now()
               WHERE id = $1 AND status = 'pending_group'`,
              [session.reservation_id],
            );
          } else {
            // Eliminar de reservation_beds los beds NO pagados
            await query(
              `DELETE FROM reservation_beds
               WHERE reservation_id = $1
                 AND bed_id NOT IN (SELECT unnest($2::uuid[]))`,
              [session.reservation_id, paidBedIds],
            );

            // Confirmar la reserva con los beds pagados
            await query(
              `UPDATE reservations
               SET status = 'confirmed',
                   beds_count = $2,
                   updated_at = now()
               WHERE id = $1 AND status = 'pending_group'`,
              [session.reservation_id, paidMembers.length],
            );
          }
        } else {
          // Nadie pagó: cancelar la reserva (trigger libera los beds)
          await query(
            `UPDATE reservations
             SET status = 'cancelled', cancelled_at = now(),
                 cancellation_reason = 'Sesión de pago grupal expirada sin pagos'
             WHERE id = $1 AND status = 'pending_group'`,
            [session.reservation_id],
          );
        }

        // Marcar slots no pagados como expirados/fallidos
        await query(
          `UPDATE group_payment_members
           SET status = 'failed', updated_at = now()
           WHERE session_id = $1 AND status IN ('invited', 'pending')`,
          [session.id],
        );

        // Notificar por email a los invitados que no pagaron (si tienen guest_id)
        if (unpaidMembers.length > 0) {
          const unpaidGuestIds = unpaidMembers.map((m) => m.guest_id).filter(Boolean);
          if (unpaidGuestIds.length > 0) {
            try {
              const { rows: unpaidGuests } = await query<{ email: string; full_name: string }>(
                `SELECT email, full_name FROM guests WHERE id = ANY($1::uuid[])`,
                [unpaidGuestIds],
              );
              const { emailService } = await import('./email-service');
              for (const g of unpaidGuests) {
                await emailService
                  .sendGroupPaymentExpiredToUnpaid({
                    guestEmail: g.email,
                    guestName: g.full_name,
                    bookingUrl: `${frontendUrl}/pt/hostel`,
                  })
                  .catch((err: Error) =>
                    logger.warn('Error al enviar email expirado a invitado', { err: err.message }),
                  );
              }
            } catch (err) {
              logger.warn('Error al enviar emails a invitados no pagados', {
                sessionId: session.id,
                err,
              });
            }
          }
        }

        redisClient.delPattern('availability:*').catch(() => {});
        processed++;
        logger.info('Sesión grupal expirada procesada', {
          sessionId: session.id,
          paidCount: paidMembers.length,
          unpaidCount: unpaidMembers.length,
        });
      } catch (err) {
        logger.error('Error al procesar sesión grupal expirada', { sessionId: session.id, err });
      }
    }

    return processed;
  }
}

export const groupPaymentService = new GroupPaymentService();
