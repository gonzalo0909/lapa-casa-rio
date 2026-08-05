// lapa-casa-hostel/backend/src/routes/admin/conflicts.routes.ts
// ventana5
//
// Reemplaza el listado inline que admin.routes.ts tenia para
// GET /conflicts (agregado como placeholder en Ventana 4) -- se suma
// aca el detalle y la resolucion manual (conflict-service.ts). Montado
// bajo /admin (routes/index.ts ya aplica authenticateToken +
// requireRole(['admin']) a todo ese prefijo).

import { Router } from 'express';
import { z } from 'zod';
import { conflictService, ConflictStatus } from '../../services/conflict-service';
import { ApiResponse } from '../../utils/responses';

const router = Router();

const STATUS_VALUES: ConflictStatus[] = ['open', 'resolved_auto', 'resolved_manual'];

/** GET /admin/conflicts — listado, opcionalmente filtrado por status */
router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query as { status?: string };
    if (status && !STATUS_VALUES.includes(status as ConflictStatus)) {
      res.status(400).json(ApiResponse.error(`status inválido, valores permitidos: ${STATUS_VALUES.join(', ')}`));
      return;
    }
    const conflicts = await conflictService.getConflictHistory(status ? { status: status as ConflictStatus } : {});
    res.status(200).json(ApiResponse.success({ conflicts }));
  } catch (error) {
    next(error);
  }
});

/** GET /admin/conflicts/:id — detalle de un conflicto */
router.get('/:id', async (req, res, next) => {
  try {
    const conflict = await conflictService.getConflictById(req.params.id);
    if (!conflict) {
      res.status(404).json(ApiResponse.error('Conflicto no encontrado'));
      return;
    }
    res.status(200).json(ApiResponse.success({ conflict }));
  } catch (error) {
    next(error);
  }
});

const ResolveSchema = z.object({
  action: z.enum(['keep_ota', 'keep_direct', 'keep_oldest']),
  reason: z.string().min(1).max(500),
});

/** POST /admin/conflicts/:id/resolve — resolución manual */
router.post('/:id/resolve', async (req, res, next) => {
  try {
    const data = ResolveSchema.parse(req.body);
    const conflict = await conflictService.resolveConflict(req.params.id, data.action, data.reason);
    res.status(200).json(ApiResponse.success({ conflict }, 'Conflicto resuelto'));
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json(ApiResponse.error('Validation error', error.errors));
      return;
    }
    if (error instanceof Error && (error.message === 'Conflicto no encontrado' || error.message.startsWith('El conflicto ya fue resuelto'))) {
      res.status(409).json(ApiResponse.error(error.message));
      return;
    }
    next(error);
  }
});

export const adminConflictsRouter = router;
export default router;
