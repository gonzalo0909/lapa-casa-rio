//
// Presets de feriados para el formulario de bloqueo manual (blocked-dates):
// calcula el rango ±7 días de cada feriado brasileño para autocompletar
// Desde/Hasta al elegirlo, pero el bloqueo en sí sigue siendo por
// habitación y por fecha -- no hay acción masiva a todas las unidades.

import { Router } from 'express';
import { getHolidayBlockPresets } from '../../utils/brazil-holidays';
import { ApiResponse } from '../../utils/responses';

const router = Router();

/** GET /admin/holiday-blocks/presets?year=YYYY — feriados del año con rango ±7 días ya calculado */
router.get('/presets', async (req, res, next) => {
  try {
    const year = parseInt(String(req.query.year), 10) || new Date().getFullYear();
    res.status(200).json(ApiResponse.success({ presets: getHolidayBlockPresets(year) }));
  } catch (error) {
    next(error);
  }
});

export { router as adminHolidayBlocksRouter };
