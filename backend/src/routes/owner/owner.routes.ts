// lapa-casa-hostel/backend/src/routes/owner/owner.routes.ts
//
// Endpoints protegidos para el administrador ya logueado (ver
// owner-auth.routes.ts). Primer endpoint real del panel propio: prueba
// que el filtrado por dueño funciona de punta a punta (JWT -> ownerId ->
// solo sus apartamentos). Los siguientes endpoints del panel (ofertas,
// precios, fotos, bloqueos) se agregan sobre esta misma base, siempre
// filtrando por req.user.ownerId -- nunca por un id que venga del body/
// query del cliente.
//
// apartment_owners vía Prisma (dominio admin), room_types vía SQL crudo
// (tabla del núcleo) -- mismo split que el resto del backend, ver
// prisma/schema.prisma.

import { Router } from 'express';
import { prisma } from '../../config/prisma';
import { query } from '../../config/database';
import { ApiResponse } from '../../utils/responses';
import { ownerApartmentsRouter } from './owner-apartments.routes';
import { ownerTermsRouter } from './owner-terms.routes';
import { ownerDocumentsRouter } from './owner-documents.routes';

const router = Router();

router.use('/apartments', ownerApartmentsRouter);
router.use('/accept-terms', ownerTermsRouter);
router.use('/documents', ownerDocumentsRouter);

// ─── GET /owner/me ────────────────────────────────────────────────────────────

router.get('/me', async (req, res, next) => {
  try {
    const ownerId = req.user?.ownerId;
    if (!ownerId) {
      res.status(401).json(ApiResponse.error('Access token required'));
      return;
    }

    const owner = await prisma.apartmentOwner.findUnique({
      where: { id: ownerId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        onboardingStatus: true,
        commissionRate: true,
        isActive: true,
        mustChangePassword: true,
        termAcceptedAt: true,
        termVersion: true,
        verificationStatus: true,
      },
    });

    if (!owner || !owner.isActive) {
      res.status(404).json(ApiResponse.error('Administrador no encontrado'));
      return;
    }

    const { rows: apartments } = await query(
      `SELECT id, code, name, capacity, property_type
       FROM room_types
       WHERE owner_id = $1
       ORDER BY name ASC`,
      [ownerId]
    );

    res.status(200).json(ApiResponse.success({ ...owner, apartments }));
  } catch (error) {
    next(error);
  }
});

export const ownerRouter = router;
