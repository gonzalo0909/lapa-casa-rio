// lapa-casa-hostel/backend/src/services/season-type.ts
// Fuente única para resolver el tipo de temporada de una fecha de check-in.
// Antes vivía duplicado como método privado en PricingService y como función
// standalone en group-payment-service.ts -- misma query SQL, código idéntico.

import { query } from '../config/database';

export async function getSeasonType(checkIn: string): Promise<string> {
  const { rows } = await query<{ get_season_type: string }>(
    `SELECT get_season_type($1::date) AS get_season_type`,
    [checkIn]
  );
  return rows[0].get_season_type;
}
