import { Router } from 'express';
import { HoldsService } from '../../services/holds';
import { validateBody } from '../../middleware/validation';
import { holdRequestSchema } from '../../utils/validation/schemas';
import { logger } from '../../utils/logger';

const router = Router();
const holdsService = new HoldsService();

/**
 * POST /api/holds
 * Crear hold temporal
 */
router.post('/', validateBody(holdRequestSchema), async (req, res, next) => {
  try {
    const { beds, expiresInMinutes, dates, guests } = req.body;

    if (!dates || !guests) {
      return res.status(400).json({
        ok: false,
        error: 'Faltan datos requeridos: dates, guests',
      });
    }

    const result = await holdsService.createHold({
      dates,
      guests,
      beds,
      expiresInMinutes,
    });

    logger.info('Hold created', result);

    res.status(201).json({
      ok: true,
      ...result,
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/holds/:holdId
 * Obtener información de hold
 */
router.get('/:holdId', async (req, res, next) => {
  try {
    const { holdId } = req.params;
    
    const hold = await holdsService.getHold(holdId);
    
    if (!hold) {
      return res.status(404).json({
        ok: false,
        error: 'Hold not found',
      });
    }

    res.json({
      ok: true,
      hold,
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/holds/:holdId/confirm
 * Confirmar hold (preparar para booking)
 */
router.post('/:holdId/confirm', async (req, res, next) => {
  try {
    const { holdId } = req.params;
    
    const confirmed = await holdsService.confirmHold(holdId);
    
    if (!confirmed) {
      return res.status(404).json({
        ok: false,
        error: 'Hold not found or already expired',
      });
    }

    res.json({
      ok: true,
      holdId,
      status: 'confirmed',
    });

  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/holds/:holdId
 * Liberar hold
 */
router.delete('/:holdId', async (req, res, next) => {
  try {
    const { holdId } = req.params;
    
    const released = await holdsService.releaseHold(holdId);
    
    if (!released) {
      return res.status(404).json({
        ok: false,
        error: 'Hold not found',
      });
    }

    res.json({
      ok: true,
      holdId,
      status: 'released',
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/holds/:holdId/extend
 * Extender tiempo de hold
 */
router.post('/:holdId/extend', async (req, res, next) => {
  try {
    const { holdId } = req.params;
    const { additionalMinutes = 5 } = req.body;

    const extended = await holdsService.extendHold(holdId, additionalMinutes);
    
    if (!extended) {
      return res.status(404).json({
        ok: false,
        error: 'Hold not found or cannot be extended',
      });
    }

    res.json({
      ok: true,
      holdId,
      extended: true,
      additionalMinutes,
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/holds
 * Listar holds activos (admin)
 */
router.get('/', async (req, res, next) => {
  try {
    const holds = await holdsService.listActiveHolds();
    const stats = await holdsService.getHoldStats();

    res.json({
      ok: true,
      holds,
      stats,
    });

  } catch (error) {
    next(error);
  }
});

export default router;
