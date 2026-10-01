// Los apartamentos se reservan como unidad completa: no tienen camas.
// Su bloqueo vive en reservation_beds con bed_id NULL y room_type_id
// (migracion 0058); el EXCLUDE no_overlapping_unit_assignments es la
// autoridad final contra doble reserva.

import type { PoolClient } from 'pg';

export async function isApartmentRoomType(client: PoolClient, roomTypeId: string): Promise<boolean> {
  const { rows } = await client.query<{ property_type: string }>(
    `SELECT property_type FROM room_types WHERE id = $1`,
    [roomTypeId],
  );
  return rows[0]?.property_type === 'apartment';
}

/** true si el apartamento tiene una reserva activa que se superpone con [checkIn, checkOut). */
export async function isUnitOccupied(
  client: PoolClient,
  roomTypeId: string,
  checkIn: string,
  checkOut: string,
): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT 1
     FROM reservation_beds rb
     JOIN reservations res ON res.id = rb.reservation_id
     WHERE rb.room_type_id = $1
       AND res.status != 'cancelled'
       AND daterange(rb.check_in, rb.check_out, '[)') && daterange($2::date, $3::date, '[)')
     LIMIT 1`,
    [roomTypeId, checkIn, checkOut],
  );
  return rows.length > 0;
}

export async function insertUnitBlock(
  client: PoolClient,
  reservationId: string,
  roomTypeId: string,
  checkIn: string,
  checkOut: string,
): Promise<void> {
  await client.query(
    `INSERT INTO reservation_beds (reservation_id, bed_id, room_type_id, check_in, check_out)
     VALUES ($1, NULL, $2, $3::date, $4::date)`,
    [reservationId, roomTypeId, checkIn, checkOut],
  );
}
