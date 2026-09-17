// lapa-casa-hostel/backend/src/routes/admin/apartment-owners.routes.ts
// Gestión de administradores de apartamentos con Stripe Connect.
//
// Endpoints:
//   GET    /admin/apartment-owners          — lista todos los administradores
//   GET    /admin/apartment-owners/:id      — detalle de uno
//   POST   /admin/apartment-owners          — crea un nuevo administrador
//                                             (cuenta Express de Stripe + link de onboarding +
//                                              contraseña temporal para su propio login)
//   PUT    /admin/apartment-owners/:id      — edita datos (nombre, teléfono, comisión, etc.)
//   DELETE /admin/apartment-owners/:id      — desactiva (soft delete)
//
//   POST   /admin/apartment-owners/:id/onboarding-link
//          — regenera el link de onboarding (expira en 24h, puede necesitar renovarse)
//   POST   /admin/apartment-owners/:id/reset-password
//          — genera una contraseña temporal nueva (ej: el administrador la perdió)
//
//   GET    /admin/apartment-owners/:id/status
//          — consulta el estado actual en Stripe (onboarding completo, payouts habilitados, etc.)
//
//   PUT    /admin/apartment-owners/:id/assign-room/:roomId
//          — asigna este administrador a un apartamento (room_type)
//   DELETE /admin/apartment-owners/:id/assign-room/:roomId
//          — quita la asignación
//
// Seguridad: authenticateToken + requireRole(['admin']) aplicados en index.ts
//            para todo /admin — estos endpoints los heredan automáticamente.
//
// apartment_owners vía Prisma (dominio admin, ver prisma/schema.prisma);
// room_types vía SQL crudo (tabla del núcleo, sin cambios) -- mismo split
// que el resto del backend.

import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { query } from '../../config/database';
import { stripeConnectHandler } from '../../lib/payments/stripe-connect';
import { auditLogService } from '../../services/audit-log-service';
import { hashPassword, generateTempPassword } from '../../utils/encryption';
import { ApiResponse } from '../../utils/responses';
import { logger } from '../../utils/logger';
import { validate } from '../../middleware/validation';
import { signOwnerDocumentUrl } from '../../lib/supabase/storage-client';

const router = Router();

const CreateOwnerSchema = z.object({
  fullName: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().optional(),
  commissionRate: z.number().min(0).max(1).optional(),
  payoutFeeRate: z.number().min(0).max(1).optional(),
  notes: z.string().optional(),
});

const UpdateOwnerSchema = z.object({
  fullName: z.string().trim().min(1).optional(),
  phone: z.string().trim().optional(),
  commissionRate: z.number().min(0).max(1).optional(),
  payoutFeeRate: z.number().min(0).max(1).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
});

// junta la lista de owners (Prisma) con sus apartamentos asignados
// (room_types, SQL crudo) en una sola pasada -- evita el N+1 de una
// query por owner.
async function attachApartments<T extends { id: string }>(owners: T[]) {
  if (owners.length === 0) {
    return owners.map((o) => ({ ...o, apartments: [] as unknown[] }));
  }
  const { rows } = await query(
    `SELECT id, code, name, owner_id FROM room_types WHERE owner_id = ANY($1)`,
    [owners.map((o) => o.id)],
  );
  return owners.map((owner) => ({
    ...owner,
    apartments: rows
      .filter((r: any) => r.owner_id === owner.id)
      .map((r: any) => ({ id: r.id, code: r.code, name: r.name })),
  }));
}

// ─── GET /apartment-owners ───────────────────────────────────────────────────

router.get('/', async (_req, res, next) => {
  try {
    const owners = await prisma.apartmentOwner.findMany({
      orderBy: { fullName: 'asc' },
      omit: { passwordHash: true },
    });
    res.status(200).json(ApiResponse.success(await attachApartments(owners)));
  } catch (error) {
    next(error);
  }
});

// ─── GET /apartment-owners/:id ───────────────────────────────────────────────

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const owner = await prisma.apartmentOwner.findUnique({
      where: { id },
      omit: { passwordHash: true },
    });
    if (!owner) {
      res.status(404).json(ApiResponse.error('Administrador no encontrado'));
      return;
    }
    const [withApartments] = await attachApartments([owner]);
    res.status(200).json(ApiResponse.success(withApartments));
  } catch (error) {
    next(error);
  }
});

// ─── POST /apartment-owners — crea admin + cuenta Stripe Express + login ─────

router.post('/', validate(CreateOwnerSchema), async (req, res, next) => {
  try {
    const { fullName, email, phone, commissionRate, payoutFeeRate, notes } = req.body as z.infer<
      typeof CreateOwnerSchema
    >;

    // 1. Crear cuenta Express en Stripe
    let stripeAccountId: string | null = null;
    let onboardingUrl: string | null = null;
    let onboardingUrlExpiresAt: Date | null = null;

    try {
      stripeAccountId = await stripeConnectHandler.createExpressAccount(email);

      const baseUrl = process.env.FRONTEND_URL ?? 'https://lapacasario.com';
      const linkResult = await stripeConnectHandler.createOnboardingLink({
        stripeAccountId,
        refreshUrl: `${baseUrl}/admin/owners/${stripeAccountId}/onboarding/refresh`,
        returnUrl: `${baseUrl}/admin/owners/${stripeAccountId}/onboarding/complete`,
      });
      onboardingUrl = linkResult.url;
      onboardingUrlExpiresAt = linkResult.expiresAt;
    } catch (stripeError: any) {
      // Si Stripe falla (ej: no hay STRIPE_SECRET_KEY en dev), el admin se
      // crea igual en la DB con status 'pending'. El link se genera después
      // desde el endpoint /onboarding-link.
      logger.warn('No se pudo crear cuenta Stripe Express automáticamente', {
        email,
        error: stripeError.message,
      });
    }

    // 2. Generar contraseña temporal para su propio login (owner-auth.routes.ts)
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    // 3. Guardar en la DB
    const owner = await prisma.apartmentOwner.create({
      data: {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone ?? null,
        stripeAccountId,
        onboardingStatus: 'pending',
        onboardingUrl,
        onboardingUrlExpiresAt,
        commissionRate: commissionRate ?? 0.05,
        payoutFeeRate: payoutFeeRate ?? 0.0099,
        notes: notes ?? null,
        passwordHash,
        mustChangePassword: true,
      },
      omit: { passwordHash: true },
    });

    await auditLogService.log({
      entity_type: 'apartment_owner',
      entity_id: owner.id,
      operation: 'ADMIN_CREATE_OWNER',
      new_data: { fullName, email, stripeAccountId },
    });

    logger.info('Administrador de apartamento creado', {
      ownerId: owner.id,
      email,
      stripeAccountId,
    });

    res
      .status(201)
      .json(
        ApiResponse.success(
          { ...owner, tempPassword },
          'Administrador creado. Compartile la contraseña temporal (tempPassword) y el link de ' +
            'onboarding de Stripe por fuera (WhatsApp/email) -- no vuelven a mostrarse. ' +
            (onboardingUrl
              ? ''
              : 'Aún no se pudo generar el link de Stripe; use el endpoint /onboarding-link cuando esté disponible.'),
        ),
      );
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(409).json(ApiResponse.error('Ya existe un administrador con ese email'));
      return;
    }
    next(error);
  }
});

// ─── PUT /apartment-owners/:id — actualiza datos ─────────────────────────────

router.put('/:id', validate(UpdateOwnerSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = req.body as z.infer<typeof UpdateOwnerSchema>;

    if (Object.keys(data).length === 0) {
      res.status(400).json(ApiResponse.error('Nada para actualizar'));
      return;
    }

    const { fullName, phone, commissionRate, payoutFeeRate, isActive, notes } = data;

    let owner;
    try {
      owner = await prisma.apartmentOwner.update({
        where: { id },
        data: {
          ...(fullName !== undefined && { fullName: fullName.trim() }),
          ...(phone !== undefined && { phone }),
          ...(commissionRate !== undefined && { commissionRate }),
          ...(payoutFeeRate !== undefined && { payoutFeeRate }),
          ...(isActive !== undefined && { isActive }),
          ...(notes !== undefined && { notes }),
        },
        omit: { passwordHash: true },
      });
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        res.status(404).json(ApiResponse.error('Administrador no encontrado'));
        return;
      }
      throw error;
    }

    await auditLogService.log({
      entity_type: 'apartment_owner',
      entity_id: id,
      operation: 'ADMIN_UPDATE_OWNER',
      new_data: req.body,
    });

    res.status(200).json(ApiResponse.success(owner, 'Administrador actualizado'));
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /apartment-owners/:id — desactiva (soft delete) ──────────────────

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    let owner;
    try {
      owner = await prisma.apartmentOwner.update({
        where: { id },
        data: { isActive: false },
        select: { id: true, fullName: true, email: true },
      });
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        res.status(404).json(ApiResponse.error('Administrador no encontrado'));
        return;
      }
      throw error;
    }
    await auditLogService.log({
      entity_type: 'apartment_owner',
      entity_id: id,
      operation: 'ADMIN_DEACTIVATE_OWNER',
      old_data: owner,
    });
    res.status(200).json(ApiResponse.success({ deactivated: owner }, 'Administrador desactivado'));
  } catch (error) {
    next(error);
  }
});

// ─── POST /apartment-owners/:id/onboarding-link ──────────────────────────────
// Regenera el link de onboarding. Se usa cuando:
//   - El link anterior expiró (24h)
//   - El admin no completó el onboarding y necesita un nuevo link

router.post('/:id/onboarding-link', async (req, res, next) => {
  try {
    const { id } = req.params;

    const owner = await prisma.apartmentOwner.findUnique({
      where: { id },
      select: { id: true, stripeAccountId: true, email: true, onboardingStatus: true },
    });

    if (!owner) {
      res.status(404).json(ApiResponse.error('Administrador no encontrado'));
      return;
    }

    if (owner.onboardingStatus === 'active') {
      res
        .status(400)
        .json(ApiResponse.error('Este administrador ya completó el onboarding de Stripe'));
      return;
    }

    // Si no tiene stripeAccountId todavía (Stripe no estaba disponible al crear),
    // lo generamos ahora
    let stripeAccountId = owner.stripeAccountId;
    if (!stripeAccountId) {
      stripeAccountId = await stripeConnectHandler.createExpressAccount(owner.email);
      await prisma.apartmentOwner.update({ where: { id }, data: { stripeAccountId } });
    }

    const baseUrl = process.env.FRONTEND_URL ?? 'https://lapacasario.com';
    const linkResult = await stripeConnectHandler.createOnboardingLink({
      stripeAccountId,
      refreshUrl: `${baseUrl}/admin/owners/${stripeAccountId}/onboarding/refresh`,
      returnUrl: `${baseUrl}/admin/owners/${stripeAccountId}/onboarding/complete`,
    });

    await prisma.apartmentOwner.update({
      where: { id },
      data: {
        onboardingUrl: linkResult.url,
        onboardingUrlExpiresAt: linkResult.expiresAt,
        onboardingStatus: 'in_progress',
      },
    });

    await auditLogService.log({
      entity_type: 'apartment_owner',
      entity_id: id,
      operation: 'ADMIN_GENERATE_ONBOARDING_LINK',
      new_data: { stripeAccountId, expiresAt: linkResult.expiresAt },
    });

    res.status(200).json(
      ApiResponse.success(
        {
          onboardingUrl: linkResult.url,
          expiresAt: linkResult.expiresAt,
          stripeAccountId,
        },
        'Link de onboarding generado. Válido por 24 horas.',
      ),
    );
  } catch (error) {
    next(error);
  }
});

// ─── POST /apartment-owners/:id/reset-password ───────────────────────────────
// Genera una contraseña temporal nueva (ej: el administrador la perdió).
// Mismo patrón que la creación: viaja en texto plano una sola vez en la
// respuesta, la plataforma se la pasa por fuera.

router.post('/:id/reset-password', async (req, res, next) => {
  try {
    const { id } = req.params;

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    let owner;
    try {
      owner = await prisma.apartmentOwner.update({
        where: { id },
        data: { passwordHash, mustChangePassword: true },
        select: { id: true, fullName: true, email: true },
      });
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        res.status(404).json(ApiResponse.error('Administrador no encontrado'));
        return;
      }
      throw error;
    }

    await auditLogService.log({
      entity_type: 'apartment_owner',
      entity_id: id,
      operation: 'ADMIN_RESET_OWNER_PASSWORD',
      new_data: { email: owner.email },
    });

    logger.info('Contraseña de administrador reseteada', { ownerId: id });

    res
      .status(200)
      .json(
        ApiResponse.success(
          { ...owner, tempPassword },
          'Contraseña temporal generada. Compartila con el administrador por fuera -- no vuelve a mostrarse.',
        ),
      );
  } catch (error) {
    next(error);
  }
});

// ─── GET /apartment-owners/:id/status ────────────────────────────────────────
// Consulta el estado real en Stripe y actualiza el campo en la DB si cambió

router.get('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;

    const owner = await prisma.apartmentOwner.findUnique({
      where: { id },
      select: { id: true, stripeAccountId: true, onboardingStatus: true },
    });

    if (!owner) {
      res.status(404).json(ApiResponse.error('Administrador no encontrado'));
      return;
    }

    if (!owner.stripeAccountId) {
      res.status(200).json(
        ApiResponse.success({
          onboardingStatus: owner.onboardingStatus,
          stripeStatus: null,
          message: 'Aún no tiene cuenta Stripe asociada',
        }),
      );
      return;
    }

    const stripeStatus = await stripeConnectHandler.getAccountStatus(owner.stripeAccountId);

    // Sincronizar el estado en la DB si cambió
    let newStatus = owner.onboardingStatus;
    if (stripeStatus.detailsSubmitted && stripeStatus.payoutsEnabled) {
      newStatus = 'active';
    } else if (stripeStatus.detailsSubmitted && !stripeStatus.payoutsEnabled) {
      newStatus = 'restricted';
    }

    if (newStatus !== owner.onboardingStatus) {
      await prisma.apartmentOwner.update({ where: { id }, data: { onboardingStatus: newStatus } });
      logger.info('Estado Stripe Connect actualizado', {
        ownerId: id,
        from: owner.onboardingStatus,
        to: newStatus,
      });
    }

    res.status(200).json(
      ApiResponse.success({
        onboardingStatus: newStatus,
        stripeStatus,
      }),
    );
  } catch (error) {
    next(error);
  }
});

// ─── PUT /apartment-owners/:id/assign-room/:roomId ───────────────────────────

router.put('/:id/assign-room/:roomId', async (req, res, next) => {
  try {
    const { id, roomId } = req.params;

    const owner = await prisma.apartmentOwner.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });
    if (!owner) {
      res.status(404).json(ApiResponse.error('Administrador no encontrado'));
      return;
    }
    if (!owner.isActive) {
      res.status(400).json(ApiResponse.error('No se puede asignar un administrador desactivado'));
      return;
    }

    const { rows } = await query(
      `UPDATE room_types SET owner_id = $1, updated_at = now()
       WHERE id = $2 AND property_type = 'apartment'
       RETURNING id, code, name, property_type, owner_id`,
      [id, roomId],
    );

    if (rows.length === 0) {
      res
        .status(404)
        .json(
          ApiResponse.error(
            'Apartamento no encontrado (solo aplica a room_types de tipo apartment)',
          ),
        );
      return;
    }

    await auditLogService.log({
      entity_type: 'room_type',
      entity_id: roomId,
      operation: 'ADMIN_ASSIGN_OWNER',
      new_data: { ownerId: id },
    });

    res.status(200).json(ApiResponse.success(rows[0], 'Administrador asignado al apartamento'));
  } catch (error) {
    next(error);
  }
});

// ─── GET /apartment-owners/:id/documents ─────────────────────────────────────
// Lista los documentos subidos por un administrador, con URLs firmadas (60 min)
// para que el admin las abra sin exponer la service role key al frontend.

router.get('/:id/documents', async (req, res, next) => {
  try {
    const { id } = req.params;

    const owner = await prisma.apartmentOwner.findUnique({
      where: { id },
      select: { id: true, fullName: true, verificationStatus: true },
    });

    if (!owner) {
      res.status(404).json(ApiResponse.error('Administrador no encontrado'));
      return;
    }

    const documents = await prisma.ownerDocument.findMany({
      where: { ownerId: id },
      orderBy: { uploadedAt: 'desc' },
    });

    // Generar signed URLs para cada documento
    const docsWithUrls = await Promise.all(
      documents.map(async (doc) => {
        let signedUrl: string | null = null;
        try {
          signedUrl = await signOwnerDocumentUrl(doc.filePath, 3600);
        } catch {
          // Si Supabase no está configurado (dev), usar la URL almacenada
          signedUrl = doc.fileUrl;
        }
        return { ...doc, signedUrl };
      }),
    );

    res.status(200).json(
      ApiResponse.success({
        owner: { id: owner.id, fullName: owner.fullName, verificationStatus: owner.verificationStatus },
        documents: docsWithUrls,
      }),
    );
  } catch (error) {
    next(error);
  }
});

// ─── PATCH /apartment-owners/:id/verify ──────────────────────────────────────
// El admin aprueba o rechaza los documentos del administrador.
// status: 'verified' | 'rejected'
// notes: comentario opcional para el administrador (visible en su panel)

const VerifyOwnerSchema = z.object({
  status: z.enum(['verified', 'rejected']),
  notes: z.string().optional(),
});

router.patch('/:id/verify', validate(VerifyOwnerSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body as z.infer<typeof VerifyOwnerSchema>;

    let owner;
    try {
      owner = await prisma.apartmentOwner.update({
        where: { id },
        data: { verificationStatus: status },
        select: { id: true, fullName: true, email: true, verificationStatus: true },
      });
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        res.status(404).json(ApiResponse.error('Administrador no encontrado'));
        return;
      }
      throw error;
    }

    // Guardar las notas de revisión en los documentos más recientes
    if (notes) {
      await prisma.ownerDocument.updateMany({
        where: { ownerId: id },
        data: { reviewedAt: new Date(), reviewNotes: notes },
      });
    }

    await auditLogService.log({
      entity_type: 'apartment_owner',
      entity_id: id,
      operation: status === 'verified' ? 'ADMIN_VERIFY_OWNER' : 'ADMIN_REJECT_OWNER_DOCS',
      new_data: { status, notes },
    });

    logger.info('Estado de verificación de owner actualizado', {
      ownerId: id,
      status,
      notes,
    });

    const msg =
      status === 'verified'
        ? 'Administrador verificado. Ahora tiene el badge "Verificado".'
        : 'Documentos rechazados. El administrador deberá volver a subirlos.';

    res.status(200).json(ApiResponse.success(owner, msg));
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /apartment-owners/:id/assign-room/:roomId ────────────────────────

router.delete('/:id/assign-room/:roomId', async (req, res, next) => {
  try {
    const { id, roomId } = req.params;

    const { rows } = await query(
      `UPDATE room_types SET owner_id = NULL, updated_at = now()
       WHERE id = $1 AND owner_id = $2
       RETURNING id, code, name`,
      [roomId, id],
    );

    if (rows.length === 0) {
      res
        .status(404)
        .json(
          ApiResponse.error('Apartamento no encontrado o no está asignado a este administrador'),
        );
      return;
    }

    await auditLogService.log({
      entity_type: 'room_type',
      entity_id: roomId,
      operation: 'ADMIN_UNASSIGN_OWNER',
      new_data: { removedOwnerId: id },
    });

    res.status(200).json(ApiResponse.success(rows[0], 'Asignación removida'));
  } catch (error) {
    next(error);
  }
});

export const apartmentOwnersRouter = router;
