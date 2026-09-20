// backend/src/routes/webhooks/sentry.routes.ts
//
// Recibe webhooks de Sentry (evento "issue") y reenvía un mensaje al bot
// de Telegram configurado. Si TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no
// están definidos, el endpoint acepta el POST (200 OK) pero no envía nada.
//
// Configurar en Sentry: Settings → Integrations → WebHooks → "Add to Project"
// URL: https://<tu-dominio>/api/v1/webhooks/sentry

import { Router, type Request, type Response } from 'express';
import https from 'https';
import crypto from 'crypto';
import { env } from '../../config/environment';
import { logger } from '../../utils/logger';

const router = Router();

function sendTelegramMessage(text: string): void {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) { return; }

  const body = JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' });
  const req = https.request(
    {
      hostname: 'api.telegram.org',
      path: `/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    },
    (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        logger.warn('Telegram sendMessage falló', { status: res.statusCode });
      }
    },
  );
  req.on('error', (err) => logger.warn('Telegram request error', { error: err.message }));
  req.write(body);
  req.end();
}

function verifySignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!env.SENTRY_WEBHOOK_SECRET) { return false; }
  if (!signature) { return false; }
  const expected = crypto
    .createHmac('sha256', env.SENTRY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length) { return false; }
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

router.post('/', (req: Request, res: Response): void => {
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body));
  const signature = req.headers['sentry-hook-signature'] as string | undefined;

  if (!verifySignature(rawBody, signature)) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  // Sentry puede enviar varios tipos de recursos; solo procesamos "issue"
  const resource = req.headers['sentry-hook-resource'] as string | undefined;
  if (resource && resource !== 'issue') {
    res.status(200).json({ received: true });
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = req.body as Record<string, any>;
    const action: string = payload.action ?? 'unknown';
    const issue = payload.data?.issue ?? {};

    const level: string = issue.level ?? 'error';
    const title: string = issue.title ?? 'Sin título';
    const culprit: string = issue.culprit ?? '';
    const project: string = issue.project?.name ?? issue.projectSlug ?? '';
    const link: string = issue.permalink ?? '';

    const levelIcon: Record<string, string> = {
      fatal: '🔴',
      error: '🟠',
      warning: '🟡',
      info: '🔵',
      debug: '⚪',
    };
    const icon = levelIcon[level] ?? '🟠';

    const lines = [
      `${icon} <b>Sentry ${action.toUpperCase()}</b>`,
      `<b>${title}</b>`,
      ...(culprit ? [`📍 ${culprit}`] : []),
      ...(project ? [`📦 ${project}`] : []),
      ...(link ? [`🔗 <a href="${link}">Ver en Sentry</a>` ] : []),
    ];

    sendTelegramMessage(lines.join('\n'));
    logger.info('Sentry webhook procesado', { action, level, title });
  } catch (err) {
    logger.warn('Error parseando payload de Sentry', { error: err instanceof Error ? err.message : 'unknown' });
  }

  res.status(200).json({ received: true });
});

export default router;
export const sentryWebhookRouter = router;
