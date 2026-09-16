// lapa-casa-hostel/frontend/src/lib/apartment-seasons.ts

/**
 * Regla de temporada para pintar el calendario y la leyenda del motor de
 * Apartamentos. Espeja get_season_type() / rate_plans (backend/database/
 * migrations/0004_pricing_functions.sql, backend/database/seeds/0001_seed.sql)
 * -- multiplicador y meses reales, no los del prototipo LCACOPIA (que usaba
 * fechas ficticias).
 *
 * Carnaval no se pinta acá: sus fechas viven en system_config (moviles,
 * cargadas en runtime), expuestas al frontend via
 * GET /availability/carnival-dates. apartment-engine.tsx consulta ese
 * endpoint aparte y aplica el tinte de Carnaval (dayCellCarnival) sobre las
 * celdas del calendario. El multiplicador/temporada real de Carnaval sigue
 * llegando correcto desde GET /availability/apartments una vez elegidas
 * las fechas.
 */
export type SeasonName = 'alta' | 'media' | 'baixa';

export interface SeasonInfo {
  name: SeasonName;
  label: string;
  multiplier: number;
  minNights: number;
}

// FIX (auditoría 17 secciones, sección 13): SEASONS y seasonForMonth solo
// se usan internamente en este archivo (vía seasonForDateStr, que sí se
// importa afuera) -- se sacó el `export` que no tenía consumidores reales.
// CARNAVAL_MULTIPLIER se eliminó por completo, sin ningún uso.
const SEASONS: Record<SeasonName, SeasonInfo> = {
  alta: { name: 'alta', label: 'Alta temporada', multiplier: 1.5, minNights: 3 },
  media: { name: 'media', label: 'Média temporada', multiplier: 1.0, minNights: 2 },
  baixa: { name: 'baixa', label: 'Baixa temporada', multiplier: 0.8, minNights: 1 },
};

/** Carnaval: estadia minima real (rate_plans), sin fechas. */
export const CARNAVAL_MIN_NIGHTS = 5;

/** month: 0-11 (Date#getMonth()). */
function seasonForMonth(month: number): SeasonInfo {
  if (month === 11 || month === 0 || month === 1 || month === 2) { return SEASONS.alta; }
  if (month === 3 || month === 4 || month === 9 || month === 10) { return SEASONS.media; }
  return SEASONS.baixa;
}

export function seasonForDateStr(ds: string): SeasonInfo {
  const month = Number(ds.slice(5, 7)) - 1;
  return seasonForMonth(month);
}
