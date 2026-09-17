// lapa-casa-hostel/backend/src/routes/owner/owner-scope.ts
//
// Helpers de "dueño" para las rutas bajo /owner: cada administrador de
// apartamento solo puede ver/tocar sus propios apartamentos
// (room_types.owner_id), nunca los de otro. room_types es tabla del
// núcleo -- estas queries son de solo lectura de la relación de
// propiedad, nada de esto toca reservas/pagos.

import { query } from '../../config/database';

export async function ownsRoomType(ownerId: string, roomTypeId: string): Promise<boolean> {
  const { rows } = await query(
    `SELECT 1 FROM room_types WHERE id = $1 AND owner_id = $2`,
    [roomTypeId, ownerId]
  );
  return rows.length > 0;
}

/** Para sub-recursos (fotos, resenas, bloqueos) identificados por su propio
 * id: busca a qué room_type pertenecen y confirma que sea del dueño. */
export async function ownsRoomTypeOf(
  table: 'room_type_photos' | 'apartment_reviews' | 'room_blocks',
  rowId: string,
  ownerId: string
): Promise<string | null> {
  const { rows } = await query<{ room_type_id: string }>(
    `SELECT room_type_id FROM ${table} WHERE id = $1`,
    [rowId]
  );
  if (rows.length === 0) {return null;}
  const roomTypeId = rows[0]!.room_type_id;
  return (await ownsRoomType(ownerId, roomTypeId)) ? roomTypeId : null;
}
