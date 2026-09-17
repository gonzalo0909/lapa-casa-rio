// lapa-casa-hostel/backend/src/routes/admin/admin-2fa.routes.ts
//
// 2FA (TOTP) para el login de admin (idea #22, roadmap.html). Montado
// bajo /admin/2fa en admin.routes.ts -- hereda authenticateToken,
// requireRole(['admin']) y verifyCsrf ya aplicados en el punto de
// montaje de /admin (routes/index.ts), así que estas rutas ya requieren
// sesión activa.
//
// Opt-in a propósito: desactivado por defecto, no cambia el login
// existente para nadie que no lo prenda explícitamente -- cero riesgo
// de dejar a alguien afuera del panel sin que lo haya pedido.
//
// El secreto vive en system_config (jsonb, mismo patrón que
// luggage_storage/carnival_dates) en vez de una tabla nueva: el admin
// no tiene fila propia en la base (sus credenciales son
// ADMIN_PASSWORD_HASH, una env var -- ver admin-auth.routes.ts), así
// que no hay una tabla natural para agregarle una columna.

import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../config/database';
import { validate } from '../../middleware/validation';
import { ApiResponse } from '../../utils/responses';
import { logger } from '../../utils/logger';
import {
  generateTotpSecret,
  getTotpQrCodeDataUrl,
  verifyTotpToken,
  generateBackupCode,
  hashBackupCode,
} from '../../utils/totp';

const CONFIG_KEY = 'admin_totp';

interface AdminTotpConfig {
  enabled: boolean;
  secret: string | null;
  pendingSecret: string | null;
  backupCodeHash: string | null;
}

const EMPTY_CONFIG: AdminTotpConfig = {
  enabled: false,
  secret: null,
  pendingSecret: null,
  backupCodeHash: null,
};

export async function getAdminTotpConfig(): Promise<AdminTotpConfig> {
  const { rows } = await query<{ value: AdminTotpConfig }>(
    `SELECT value FROM system_config WHERE key = $1`,
    [CONFIG_KEY],
  );
  return rows[0]?.value ?? EMPTY_CONFIG;
}

/** Usado también por admin-auth.routes.ts en la recuperación por código de respaldo. */
export async function disableAdminTotp(): Promise<void> {
  await saveAdminTotpConfig(EMPTY_CONFIG);
}

async function saveAdminTotpConfig(config: AdminTotpConfig): Promise<void> {
  await query(
    `INSERT INTO system_config (key, value, description)
     VALUES ($1, $2::jsonb, 'Doble verificación (TOTP) para el login de admin')
     ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = now()`,
    [CONFIG_KEY, JSON.stringify(config)],
  );
}

const router = Router();

router.get('/status', async (_req, res, next) => {
  try {
    const config = await getAdminTotpConfig();
    res.status(200).json(ApiResponse.success({ enabled: config.enabled }));
  } catch (error) {
    next(error);
  }
});

/** Genera un secreto nuevo (pendiente hasta confirmarlo con /enable) y su QR. */
router.post('/setup', async (_req, res, next) => {
  try {
    const secret = generateTotpSecret();
    const config = await getAdminTotpConfig();
    await saveAdminTotpConfig({ ...config, pendingSecret: secret });

    const qrCodeDataUrl = await getTotpQrCodeDataUrl(secret, 'admin');
    res.status(200).json(ApiResponse.success({ qrCodeDataUrl, secret }));
  } catch (error) {
    next(error);
  }
});

const EnableSchema = z.object({ token: z.string().length(6) });

/** Confirma el código de la app y activa 2FA. Devuelve el código de respaldo UNA sola vez. */
router.post('/enable', validate(EnableSchema), async (req, res, next) => {
  try {
    const { token } = req.body as z.infer<typeof EnableSchema>;
    const config = await getAdminTotpConfig();

    if (!config.pendingSecret) {
      res.status(400).json(ApiResponse.error('Primero hay que generar un código QR con /setup'));
      return;
    }

    const valid = await verifyTotpToken(config.pendingSecret, token);
    if (!valid) {
      res.status(401).json(ApiResponse.error('Código inválido'));
      return;
    }

    const backupCode = generateBackupCode();
    await saveAdminTotpConfig({
      enabled: true,
      secret: config.pendingSecret,
      pendingSecret: null,
      backupCodeHash: hashBackupCode(backupCode),
    });

    logger.info('2FA de admin activado');
    // El código de respaldo se devuelve una sola vez, en texto plano --
    // el hash es lo único que queda guardado. Sirve para desactivar 2FA
    // sin poder completar el login normal (POST /admin/login/2fa-recovery).
    res.status(200).json(ApiResponse.success({ backupCode }, '2FA activado'));
  } catch (error) {
    next(error);
  }
});

const DisableSchema = z.object({ token: z.string().length(6) });

router.post('/disable', validate(DisableSchema), async (req, res, next) => {
  try {
    const { token } = req.body as z.infer<typeof DisableSchema>;
    const config = await getAdminTotpConfig();

    if (!config.enabled || !config.secret) {
      res.status(400).json(ApiResponse.error('2FA no está activado'));
      return;
    }

    const valid = await verifyTotpToken(config.secret, token);
    if (!valid) {
      res.status(401).json(ApiResponse.error('Código inválido'));
      return;
    }

    await saveAdminTotpConfig(EMPTY_CONFIG);
    logger.info('2FA de admin desactivado');
    res.status(200).json(ApiResponse.success(null, '2FA desactivado'));
  } catch (error) {
    next(error);
  }
});

export const admin2faRouter = router;
