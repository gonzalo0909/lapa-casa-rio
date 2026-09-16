// lapa-casa-hostel/backend/src/routes/owner/owner-documents.routes.ts
//
// Gestión de documentos de verificación (KYC) del administrador.
//
//   POST  /owner/documents           — sube un documento (CPF/CNPJ o comprobante)
//   GET   /owner/documents           — lista sus propios documentos
//   DELETE /owner/documents/:docId   — borra un documento propio (solo si verification_status !== 'verified')
//
// Los documentos van al bucket privado owner-docs en Supabase Storage.
// El admin los revisa desde PATCH /admin/apartment-owners/:id/verify.
// Solo se aceptan imágenes y PDF; límite 10 MB por archivo.

import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../../config/prisma';
import { ApiResponse } from '../../utils/responses';
import { logger } from '../../utils/logger';
import {
  uploadOwnerDocument,
  deleteOwnerDocument,
} from '../../lib/supabase/storage-client';

const router = Router();

// Tipos de documento permitidos
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const DOC_TYPES = new Set(['cpf_cnpj', 'proof_ownership', 'other']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Use JPG, PNG, WEBP o PDF.'));
    }
  },
});

// ─── POST /owner/documents ────────────────────────────────────────────────────

router.post('/', upload.single('document'), async (req, res, next) => {
  try {
    const ownerId = req.user?.ownerId;
    if (!ownerId) {
      res.status(401).json(ApiResponse.error('Access token requerido'));
      return;
    }

    if (!req.file) {
      res.status(400).json(ApiResponse.error('Debe adjuntar un archivo (campo: document)'));
      return;
    }

    const docType = req.body?.docType as string | undefined;
    if (!docType || !DOC_TYPES.has(docType)) {
      res.status(400).json(
        ApiResponse.error('docType inválido. Valores permitidos: cpf_cnpj, proof_ownership, other'),
      );
      return;
    }

    // El admin ya verificó → no puede subir más hasta que el admin rechace / resetee
    const owner = await prisma.apartmentOwner.findUnique({
      where: { id: ownerId },
      select: { verificationStatus: true },
    });

    if (owner?.verificationStatus === 'verified') {
      res.status(409).json(
        ApiResponse.error('Tu cuenta ya está verificada. Contacta al soporte si necesitas actualizar documentos.'),
      );
      return;
    }

    const { buffer, mimetype, originalname } = req.file;
    const { url, path } = await uploadOwnerDocument(buffer, mimetype, originalname);

    const doc = await prisma.ownerDocument.create({
      data: {
        ownerId,
        docType,
        fileUrl: url,
        filePath: path,
        originalName: originalname,
        mimeType: mimetype,
      },
    });

    // Si estaba rechazado, volver a pending al subir nuevo doc
    if (owner?.verificationStatus === 'rejected') {
      await prisma.apartmentOwner.update({
        where: { id: ownerId },
        data: { verificationStatus: 'pending' },
      });
    }

    logger.info('Documento de owner subido', { ownerId, docType, docId: doc.id });

    res.status(201).json(
      ApiResponse.success(
        {
          id: doc.id,
          docType: doc.docType,
          originalName: doc.originalName,
          uploadedAt: doc.uploadedAt,
        },
        'Documento recibido. Será revisado en los próximos días hábiles.',
      ),
    );
  } catch (error) {
    next(error);
  }
});

// ─── GET /owner/documents ─────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const ownerId = req.user?.ownerId;
    if (!ownerId) {
      res.status(401).json(ApiResponse.error('Access token requerido'));
      return;
    }

    const [owner, documents] = await Promise.all([
      prisma.apartmentOwner.findUnique({
        where: { id: ownerId },
        select: { verificationStatus: true },
      }),
      prisma.ownerDocument.findMany({
        where: { ownerId },
        orderBy: { uploadedAt: 'desc' },
        select: {
          id: true,
          docType: true,
          originalName: true,
          mimeType: true,
          uploadedAt: true,
          reviewedAt: true,
          reviewNotes: true,
        },
      }),
    ]);

    res.status(200).json(
      ApiResponse.success({
        verificationStatus: owner?.verificationStatus ?? 'pending',
        documents,
      }),
    );
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /owner/documents/:docId ──────────────────────────────────────────

router.delete('/:docId', async (req, res, next) => {
  try {
    const ownerId = req.user?.ownerId;
    if (!ownerId) {
      res.status(401).json(ApiResponse.error('Access token requerido'));
      return;
    }

    const { docId } = req.params;

    const doc = await prisma.ownerDocument.findFirst({
      where: { id: docId, ownerId },
    });

    if (!doc) {
      res.status(404).json(ApiResponse.error('Documento no encontrado'));
      return;
    }

    // No permitir borrar si ya está verificado
    const owner = await prisma.apartmentOwner.findUnique({
      where: { id: ownerId },
      select: { verificationStatus: true },
    });

    if (owner?.verificationStatus === 'verified') {
      res.status(409).json(
        ApiResponse.error('No se puede borrar documentos de una cuenta verificada.'),
      );
      return;
    }

    await prisma.ownerDocument.delete({ where: { id: docId } });
    await deleteOwnerDocument(doc.filePath);

    logger.info('Documento de owner borrado', { ownerId, docId });

    res.status(200).json(ApiResponse.success({ id: docId }, 'Documento eliminado'));
  } catch (error) {
    next(error);
  }
});

export const ownerDocumentsRouter = router;
